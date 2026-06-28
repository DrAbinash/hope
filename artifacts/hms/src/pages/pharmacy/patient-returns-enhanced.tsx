import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { RotateCcw, Plus, Search } from "lucide-react";

const RETURN_REASONS = ["Excess purchase", "Wrong medicine dispensed", "Doctor changed treatment", "Adverse effect reported", "Duplicate billing", "Patient refused", "Other"];
const INSPECTION_STATUSES = [
  { value: "reusable", label: "Reusable — Return to Stock", badge: "bg-green-100 text-green-800" },
  { value: "damaged", label: "Damaged — Non-saleable", badge: "bg-red-100 text-red-800" },
  { value: "quarantine", label: "Quarantine", badge: "bg-amber-100 text-amber-800" },
  { value: "expired", label: "Expired", badge: "bg-gray-100 text-gray-800" },
];
const REFUND_STATUS_META: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export default function PatientReturnsEnhanced() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [saleLookup, setSaleLookup] = useState("");
  const [saleData, setSaleData] = useState<any | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [form, setForm] = useState({
    return_reason: "", inspection_status: "reusable", refund_mode: "cash",
    stock_action: "return_to_stock", total_refund_amount: "", gst_credit_amount: ""
  });
  const [returnItems, setReturnItems] = useState<{ medicine_name: string; quantity: string; rate: string; amount: string }[]>([]);

  const { data: returns = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/enhanced-returns"],
    queryFn: () => fetch("/api/pharmacy/enhanced-returns").then(r => r.json()),
  });

  async function lookupSale() {
    setLookupError(""); setSaleData(null);
    if (!saleLookup) return;
    try {
      const r = await fetch(`/api/pharmacy/sales/${saleLookup}`).catch(() => null);
      const j = r ? await r.json() : null;
      if (!j || j.error) { setLookupError("Sale not found. Check the ID."); return; }
      setSaleData(j);
      // Pre-fill items from sale
      const items: any[] = Array.isArray(j.items) ? j.items : [];
      setReturnItems(items.map((it: any) => ({ medicine_name: it.medicine_name ?? "Unknown", quantity: String(it.quantity ?? 1), rate: String(it.rate ?? 0), amount: String(it.amount ?? 0) })));
    } catch { setLookupError("Error fetching sale"); }
  }

  const saveMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/pharmacy/enhanced-returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: () => { toast.success("Return created successfully"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/enhanced-returns"] }); setShowNew(false); setSaleData(null); setSaleLookup(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/pharmacy/enhanced-returns/${id}/approve`, { method: "PATCH" }).then(r => r.json()),
    onSuccess: () => { toast.success("Return approved"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/enhanced-returns"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const pendingCount = returns.filter((r: any) => r.refund_status === "pending").length;

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-6 w-6 text-violet-600" />
          <div>
            <h1 className="text-xl font-bold">Patient Medicine Returns</h1>
            <p className="text-sm text-muted-foreground">GST-safe return workflow with stock disposition tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && <Badge className="bg-amber-100 text-amber-800">{pendingCount} pending approval</Badge>}
          <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />New Return</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Returns", value: returns.length, color: "" },
          { label: "Pending Approval", value: pendingCount, color: "text-amber-700" },
          { label: "Total Refunded", value: `₹${returns.filter((r: any) => r.refund_status === "approved").reduce((s: number, r: any) => s + Number(r.total_refund_amount ?? 0), 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-green-700" },
        ].map(k => (
          <Card key={k.label}><CardContent className="pt-3 pb-2">
            <div className="text-xs text-muted-foreground">{k.label}</div>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
          </CardContent></Card>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return No</TableHead>
              <TableHead>Original Bill</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Return Date</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Inspection</TableHead>
              <TableHead>Refund Mode</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10">Loading…</TableCell></TableRow>
            ) : returns.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No returns recorded yet</TableCell></TableRow>
            ) : returns.map((r: any) => {
              const insp = INSPECTION_STATUSES.find(i => i.value === r.inspection_status);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.return_no}</TableCell>
                  <TableCell className="text-xs">{r.original_bill_no ?? `Sale #${r.original_sale_id}`}</TableCell>
                  <TableCell className="font-medium">{r.patient_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{r.return_date}</TableCell>
                  <TableCell className="text-xs max-w-36 truncate">{r.return_reason}</TableCell>
                  <TableCell><Badge className={insp?.badge ?? "bg-gray-100 text-gray-800"} variant="outline">{insp?.label ?? r.inspection_status}</Badge></TableCell>
                  <TableCell className="capitalize text-xs">{r.refund_mode}</TableCell>
                  <TableCell className="font-semibold text-green-700">₹{Number(r.total_refund_amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</TableCell>
                  <TableCell><Badge className={REFUND_STATUS_META[r.refund_status] ?? "bg-gray-100 text-gray-800"}>{r.refund_status}</Badge></TableCell>
                  <TableCell>
                    {r.refund_status === "pending" && (
                      <Button size="sm" variant="outline" onClick={() => approveMutation.mutate(r.id)} disabled={approveMutation.isPending}>Approve</Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* New Return Dialog */}
      <Dialog open={showNew} onOpenChange={v => { setShowNew(v); if (!v) { setSaleData(null); setSaleLookup(""); setLookupError(""); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Patient Return</DialogTitle></DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Step 1: lookup sale */}
            <div className="flex gap-2 items-end">
              <div className="flex-1"><Label>Original Sale ID *</Label><Input type="number" value={saleLookup} onChange={e => setSaleLookup(e.target.value)} placeholder="Enter sale ID" /></div>
              <Button size="sm" variant="outline" onClick={lookupSale}><Search className="h-4 w-4 mr-1" />Look up</Button>
            </div>
            {lookupError && <p className="text-sm text-red-600">{lookupError}</p>}

            {saleData && (
              <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                <div className="font-semibold">Bill: {saleData.bill_no} — Patient: {saleData.patient_name ?? "Unknown"}</div>
                <div className="text-xs text-muted-foreground">Date: {saleData.bill_date} | Amount: ₹{saleData.total_amount}</div>
                <div className="text-xs text-amber-700 mt-1">Return window: within 7 days of purchase date</div>
              </div>
            )}

            {saleData && (
              <>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted"><tr><th className="px-2 py-1.5 text-left">Medicine</th><th className="px-2 py-1.5">Qty</th><th className="px-2 py-1.5">Rate</th><th className="px-2 py-1.5">Amount</th></tr></thead>
                    <tbody>
                      {returnItems.map((it, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2 py-1">{it.medicine_name}</td>
                          <td className="px-2 py-1"><Input type="number" className="h-7 w-16 text-xs" value={it.quantity} onChange={e => setReturnItems(p => p.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} /></td>
                          <td className="px-2 py-1">₹{it.rate}</td>
                          <td className="px-2 py-1">₹{(Number(it.quantity) * Number(it.rate)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><Label>Return Reason *</Label>
                    <Select value={form.return_reason} onValueChange={v => setForm(p => ({ ...p, return_reason: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                      <SelectContent>{RETURN_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Inspection Status</Label>
                    <Select value={form.inspection_status} onValueChange={v => setForm(p => ({ ...p, inspection_status: v, stock_action: v === "reusable" ? "return_to_stock" : "non_saleable" }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{INSPECTION_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Refund Mode</Label>
                    <Select value={form.refund_mode} onValueChange={v => setForm(p => ({ ...p, refund_mode: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["cash", "wallet", "credit_adjustment", "bank_transfer"].map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Stock Action</Label>
                    <Select value={form.stock_action} onValueChange={v => setForm(p => ({ ...p, stock_action: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="return_to_stock">Return to Stock (same batch)</SelectItem>
                        <SelectItem value="non_saleable">Non-saleable Inventory</SelectItem>
                        <SelectItem value="quarantine">Quarantine</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Refund Amount (₹) *</Label><Input type="number" value={form.total_refund_amount} onChange={e => setForm(p => ({ ...p, total_refund_amount: e.target.value }))} placeholder="Total refund amount" /></div>
                  <div><Label>GST Credit Amount (₹)</Label><Input type="number" value={form.gst_credit_amount} onChange={e => setForm(p => ({ ...p, gst_credit_amount: e.target.value }))} placeholder="GST portion" /></div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setSaleData(null); setSaleLookup(""); }}>Cancel</Button>
            <Button disabled={!saleData || !form.return_reason || !form.total_refund_amount || saveMutation.isPending}
              onClick={() => saveMutation.mutate({
                original_sale_id: saleData.id,
                patient_id: saleData.patient_id,
                return_reason: form.return_reason,
                items: returnItems.map(it => ({ ...it, quantity: Number(it.quantity), rate: Number(it.rate), amount: Number(it.quantity) * Number(it.rate) })),
                total_refund_amount: Number(form.total_refund_amount),
                gst_credit_amount: form.gst_credit_amount ? Number(form.gst_credit_amount) : 0,
                refund_mode: form.refund_mode,
                inspection_status: form.inspection_status,
                stock_action: form.stock_action,
              })}>
              Create Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
