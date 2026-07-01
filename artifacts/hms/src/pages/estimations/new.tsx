import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useListPatients, useListDoctors } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, Save, Package as PackageIcon } from "lucide-react";
import { toast } from "sonner";

type Item = { description: string; quantity: number; rate: number; billingHeadId?: number | null; category?: string | null };

const TYPE_LABELS: Record<string, string> = {
  surgery: "Surgery Estimation",
  ipd: "IPD Estimation",
  investigation: "Investigation Estimation",
  general: "General Estimation",
};

const WARD_CATEGORIES = ["General", "Semi-Private", "Private", "Deluxe", "ICU", "HDU"];

function getQueryParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function NewEstimation() {
  const [, setLocation] = useLocation();
  const initialType = (getQueryParam("type") || "surgery") as keyof typeof TYPE_LABELS;
  const [type, setType] = useState<string>(initialType);

  const [patientId, setPatientId] = useState<string>("");
  const [surgeonId, setSurgeonId] = useState<string>("");
  const [packageId, setPackageId] = useState<string>("");
  const [procedureName, setProcedureName] = useState("");
  const [wardCategory, setWardCategory] = useState("");
  const [expectedDays, setExpectedDays] = useState<string>("");
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, rate: 0 }]);
  const [discount, setDiscount] = useState("0");
  const [gstAmount, setGstAmount] = useState("0");
  const [validityDays, setValidityDays] = useState("7");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: patientsData } = useListPatients({});
  const { data: doctors } = useListDoctors();

  const safePatients = Array.isArray(patientsData?.patients) ? patientsData.patients : [];
  const safeDoctors = Array.isArray(doctors) ? doctors : [];

  const { data: billingHeads } = useQuery({
    queryKey: ["/api/billing-heads"],
    queryFn: async () => {
      const r = await fetch("/api/billing-heads", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: packages } = useQuery({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const r = await fetch("/api/packages", { credentials: "include" });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const safePackages = Array.isArray(packages) ? packages : [];
  const safeBillingHeads = Array.isArray(billingHeads) ? billingHeads : [];

  // Adopt selected package — append its line items
  function adoptPackage(pkgIdStr: string) {
    setPackageId(pkgIdStr);
    if (!pkgIdStr) return;
    const pkg = safePackages.find((p) => String(p.id) === pkgIdStr);
    if (!pkg) return;
    const newItems: Item[] = (pkg.items || []).map((it: any) => ({
      description: it.headName,
      quantity: it.quantity || 1,
      rate: Number(it.headRate || 0),
      billingHeadId: it.billingHeadId,
      category: it.headCategory,
    }));
    if (newItems.length > 0) {
      setItems(newItems);
      if (!procedureName) setProcedureName(pkg.name);
    }
  }

  function adoptBillingHead(idx: number, headIdStr: string) {
    const head = safeBillingHeads.find((h) => String(h.id) === headIdStr);
    if (!head) return;
    setItems((rows) => rows.map((r, i) => i === idx ? {
      ...r,
      description: head.name,
      rate: Number(head.defaultRate || 0),
      billingHeadId: head.id,
      category: head.category,
    } : r));
  }

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.rate) || 0), 0),
    [items],
  );
  const total = useMemo(() => subtotal - (Number(discount) || 0) + (Number(gstAmount) || 0), [subtotal, discount, gstAmount]);

  function addItem() { setItems((r) => [...r, { description: "", quantity: 1, rate: 0 }]); }
  function removeItem(i: number) { setItems((r) => r.filter((_, idx) => idx !== i)); }
  function updateItem(i: number, patch: Partial<Item>) {
    setItems((r) => r.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) { toast.error("Select a patient"); return; }
    const cleanItems = items.filter((it) => it.description.trim());
    if (cleanItems.length === 0) { toast.error("Add at least one line item"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/estimations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          type,
          patientId: parseInt(patientId),
          surgeonId: surgeonId ? parseInt(surgeonId) : undefined,
          packageId: packageId ? parseInt(packageId) : undefined,
          wardCategory: wardCategory || undefined,
          expectedDays: expectedDays ? parseInt(expectedDays) : undefined,
          procedureName: procedureName || undefined,
          items: cleanItems,
          discount: Number(discount) || 0,
          gstAmount: Number(gstAmount) || 0,
          validityDays: Number(validityDays) || 7,
          notes,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const created = await r.json();
      toast.success(`Estimation ${created.estimationNo} created`);
      setLocation(`/estimations/${created.id}`);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-pop reasonable defaults based on type
  useEffect(() => {
    if (type === "ipd" && items.length === 1 && !items[0].description) {
      setItems([
        { description: "Bed charge per day", quantity: 1, rate: 0 },
        { description: "Doctor visit per day", quantity: 1, rate: 0 },
        { description: "Nursing charges per day", quantity: 1, rate: 0 },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const showSurgery = type === "surgery";
  const showIpd = type === "ipd";

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{TYPE_LABELS[type]}</h2>
          <p className="text-muted-foreground text-sm">Create a new printable cost estimate</p>
        </div>
        <div className="w-56">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger data-testid="type-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger data-testid="patient-select"><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>
                {safePatients.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.uhid})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(showSurgery || showIpd) && (
            <div className="space-y-2">
              <Label>{showSurgery ? "Surgeon" : "Consultant"}</Label>
              <Select value={surgeonId} onValueChange={setSurgeonId}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {safeDoctors.map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name} — {d.specialization}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {showSurgery && (
            <div className="space-y-2">
              <Label>Procedure name</Label>
              <Input value={procedureName} onChange={(e) => setProcedureName(e.target.value)} placeholder="e.g. Lap. Cholecystectomy" />
            </div>
          )}

          {showIpd && (
            <>
              <div className="space-y-2">
                <Label>Ward category</Label>
                <Select value={wardCategory} onValueChange={setWardCategory}>
                  <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
                  <SelectContent>
                    {WARD_CATEGORIES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expected days of stay</Label>
                <Input type="number" min="1" value={expectedDays} onChange={(e) => setExpectedDays(e.target.value)} placeholder="e.g. 5" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label>Validity (days)</Label>
            <Input type="number" min="1" value={validityDays} onChange={(e) => setValidityDays(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Quick adopt: package */}
      {(showSurgery || showIpd) && (
        <Card>
          <CardContent className="p-4 flex items-end gap-3">
            <PackageIcon className="h-5 w-5 mb-2 text-muted-foreground" />
            <div className="flex-1 space-y-2">
              <Label>Adopt from a Package (optional)</Label>
              <Select value={packageId} onValueChange={adoptPackage}>
                <SelectTrigger data-testid="package-select"><SelectValue placeholder="Pick a package to populate items" /></SelectTrigger>
                <SelectContent>
                  {safePackages.map((p: any) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name} — ₹{Number(p.packageRate).toLocaleString()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line items */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <span className="font-semibold">Line Items</span>
          <Button type="button" size="sm" variant="outline" onClick={addItem} data-testid="add-item">
            <Plus className="h-3.5 w-3.5 mr-1" />Add line
          </Button>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Billing Head (optional)</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Rate</TableHead>
                <TableHead className="w-28 text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <Input
                      value={it.description}
                      onChange={(e) => updateItem(i, { description: e.target.value })}
                      placeholder="Service / charge name"
                      data-testid={`item-desc-${i}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={it.billingHeadId ? String(it.billingHeadId) : ""} onValueChange={(v) => adoptBillingHead(i, v)}>
                      <SelectTrigger><SelectValue placeholder="Pick a billing head…" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {safeBillingHeads.map((h: any) => (
                          <SelectItem key={h.id} value={String(h.id)}>{h.name} (₹{Number(h.defaultRate).toLocaleString()})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="1" value={it.quantity}
                      onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value) || 0 })}
                      data-testid={`item-qty-${i}`} />
                  </TableCell>
                  <TableCell>
                    <Input type="number" min="0" step="0.01" value={it.rate}
                      onChange={(e) => updateItem(i, { rate: parseFloat(e.target.value) || 0 })}
                      data-testid={`item-rate-${i}`} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    ₹{((Number(it.quantity) || 0) * (Number(it.rate) || 0)).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)}>
                      <Trash2 className="h-4 w-4 text-rose-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Notes / Remarks</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5}
              placeholder="Anything the patient should know about this estimate" />
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-mono" data-testid="subtotal">₹{subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-muted-foreground">Discount</span>
              <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)}
                className="w-32 text-right" data-testid="discount" />
            </div>
            <div className="flex justify-between items-center gap-3">
              <span className="text-muted-foreground">GST / Other charges</span>
              <Input type="number" min="0" step="0.01" value={gstAmount} onChange={(e) => setGstAmount(e.target.value)}
                className="w-32 text-right" data-testid="gst" />
            </div>
            <div className="border-t pt-3 flex justify-between text-base">
              <span className="font-semibold">Estimated Total</span>
              <span className="font-bold text-lg" data-testid="total">₹{total.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancel</Button>
        <Button type="submit" disabled={submitting} data-testid="submit-estimation">
          <Save className="h-4 w-4 mr-1" />{submitting ? "Saving…" : "Save Estimation"}
        </Button>
      </div>
    </form>
  );
}
