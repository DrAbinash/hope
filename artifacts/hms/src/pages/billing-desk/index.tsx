import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  UserPlus, UserCheck, Search, Plus, Trash2, Receipt, CheckCircle2, Tag, Stethoscope,
} from "lucide-react";
import { BillingQuickServices } from "@/components/billing-quick-services";
import { DocumentUpload } from "@/components/document-upload";

interface Patient {
  id: number; uhid: string; name: string; age: number; gender: string;
  phone: string | null; address?: string;
}
interface BillingHead {
  id: number; code: string; name: string; category: string;
  defaultRate: string; gstPercent: string | null;
}
interface PackageItem { id: number; quantity: number; headName: string; headCode: string; headRate: string }
interface Pkg {
  id: number; code: string; name: string; description: string | null;
  mrpTotal: string; packageRate: string; items: PackageItem[];
}
interface Entity { id: number; name: string }
interface Employee { id: number; name: string; role: string; username: string | null }

interface CartItem {
  key: string;
  source: "head" | "package";
  refId: number;
  name: string;
  code: string;
  quantity: number;
  rate: number;
  gstPercent: number;
}

const PAYMENT_MODES = ["Cash", "Card", "UPI", "Online"];

export default function BillingDeskPage() {
  const qc = useQueryClient();

  // --- Patient state ---
  const [patient, setPatient] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [newPatient, setNewPatient] = useState({
    name: "", age: "", gender: "Male", phone: "", address: "",
    guardianName: "", guardianPhone: "", idCardUrl: "", photoUrl: "", reportsUrl: "",
  });

  // --- Cart + payment state ---
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pickHead, setPickHead] = useState("");
  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [collectedBy, setCollectedBy] = useState("");
  const [entityId, setEntityId] = useState("1");
  const [invoiceType, setInvoiceType] = useState("OPD");

  // --- Success state ---
  const [successInvoice, setSuccessInvoice] = useState<{ invoiceNo: string; totalAmount: string } | null>(null);

  // --- Queries ---
  const { data: patientList } = useQuery<{ patients: Patient[] }>({
    queryKey: ["/api/patients", search],
    queryFn: async () => {
      const r = await fetch(`/api/patients?search=${encodeURIComponent(search)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch patients");
      return r.json();
    },
    enabled: search.length >= 2,
  });
  const { data: heads } = useQuery<BillingHead[]>({
    queryKey: ["/api/billing-heads"],
    queryFn: async () => {
      const r = await fetch("/api/billing-heads", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch billing heads");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: packages } = useQuery<Pkg[]>({
    queryKey: ["/api/packages"],
    queryFn: async () => {
      const r = await fetch("/api/packages", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch packages");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const r = await fetch("/api/entities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch entities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const r = await fetch("/api/employees", { credentials: "include" });
      if (!r.ok) {
        throw new Error(`Failed to fetch employees: ${r.status}`);
      }
      const data = await r.json();
      // Ensure data is an array
      return Array.isArray(data) ? data : [];
    },
  });

  const safeHeads = Array.isArray(heads) ? heads : [];
  const safePackages = Array.isArray(packages) ? packages : [];
  const safeEntities = Array.isArray(entities) ? entities : [];
  const safePatients = Array.isArray(patientList?.patients) ? patientList.patients : [];
  const cashiers = (Array.isArray(employees) ? employees : []).filter((e) => e.username && ["cashier", "receptionist", "admin"].includes(e.role));

  // --- Mutations ---
  const registerPatient = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: newPatient.name,
          age: Number(newPatient.age),
          gender: newPatient.gender,
          phone: newPatient.phone,
          address: newPatient.address,
          guardianName: newPatient.guardianName || null,
          guardianPhone: newPatient.guardianPhone || null,
          idCardUrl: newPatient.idCardUrl || null,
          photoUrl: newPatient.photoUrl || null,
          reportsUrl: newPatient.reportsUrl || null,
        }),
      });
      if (!r.ok) throw new Error("Failed to register patient");
      return r.json() as Promise<Patient>;
    },
    onSuccess: (p) => {
      toast.success(`Registered ${p.name} (${p.uhid})`);
      setPatient(p);
      setNewPatient({ name: "", age: "", gender: "Male", phone: "", address: "", guardianName: "", guardianPhone: "", idCardUrl: "", photoUrl: "", reportsUrl: "" });
      qc.invalidateQueries({ queryKey: ["/api/patients"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateInvoice = useMutation({
    mutationFn: async () => {
      if (!patient) throw new Error("Select a patient first");
      if (cart.length === 0) throw new Error("Cart is empty");
      const items = cart.map((c) => ({
        description: c.name,
        code: c.code,
        quantity: c.quantity,
        rate: c.rate,
        amount: c.rate * c.quantity,
        gstPercent: c.gstPercent,
      }));
      const body = {
        patientId: patient.id,
        type: invoiceType,
        entityId: Number(entityId),
        collectedBy: collectedBy || null,
        items,
        discount: Number(discount) || 0,
        paidAmount: Number(paidAmount) || 0,
        paymentMode,
      };
      const r = await fetch("/api/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed to create invoice");
      return r.json();
    },
    onSuccess: (inv) => {
      toast.success(`Invoice ${inv.invoiceNo} generated`);
      setSuccessInvoice({ invoiceNo: inv.invoiceNo, totalAmount: inv.totalAmount });
      qc.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
      qc.invalidateQueries({ queryKey: ["/api/reports/daily-collection"] });
      qc.invalidateQueries({ queryKey: ["/api/reports/user-collection"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // --- Cart helpers ---
  const addHeadObjectToCart = (h: BillingHead) => {
    const key = `head-${h.id}`;
    setCart((prev) => {
      if (prev.some((c) => c.key === key)) {
        return prev.map((c) => c.key === key ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        key, source: "head", refId: h.id, name: h.name, code: h.code,
        quantity: 1, rate: Number(h.defaultRate), gstPercent: Number(h.gstPercent || 0),
      }];
    });
  };

  const addHeadToCart = () => {
    if (!pickHead) return;
    const h = safeHeads.find((x) => x.id === Number(pickHead));
    if (!h) return;
    addHeadObjectToCart(h);
    setPickHead("");
  };

  const addPackageToCart = (p: Pkg) => {
    const key = `package-${p.id}`;
    if (cart.some((c) => c.key === key)) {
      toast.info(`${p.name} already in cart`);
      return;
    }
    setCart([...cart, {
      key, source: "package", refId: p.id, name: `${p.name} (Package)`, code: p.code,
      quantity: 1, rate: Number(p.packageRate), gstPercent: 0,
    }]);
  };

  // --- Computed totals ---
  const totals = useMemo(() => {
    const subtotal = cart.reduce((s, c) => s + c.rate * c.quantity, 0);
    const disc = Number(discount) || 0;
    const gst = cart.reduce((s, c) => s + (c.rate * c.quantity) * (c.gstPercent / 100), 0);
    const total = subtotal - disc + gst;
    return { subtotal, discount: disc, gst, total };
  }, [cart, discount]);

  // --- Reset for next bill ---
  const resetForNext = () => {
    setSuccessInvoice(null);
    setPatient(null);
    setSearch("");
    setCart([]);
    setDiscount("0");
    setPaidAmount("");
    setPaymentMode("Cash");
  };

  return (
    <div className="space-y-3">
      <div className="pb-2">
        <h2 className="text-xl font-bold tracking-tight">Registration & Billing Desk</h2>
        <p className="text-muted-foreground text-xs">Register patient, add services, collect payment — all in one screen.</p>
      </div>

      {/* Registration Form — Always Expanded */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <UserPlus className="w-4 h-4" />Patient Registration / Search
            </span>
            {patient && <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change Patient</Button>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          {patient ? (
            <div className="flex items-center gap-3 border rounded-lg p-2 bg-emerald-50/50 dark:bg-emerald-950/20">
              <div className="flex-1">
                <p className="font-semibold text-base flex items-center gap-2">
                  {patient.name}
                  <Badge variant="secondary" className="font-mono text-xs">{patient.uhid}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {patient.age} yr • {patient.gender} {patient.phone ? `• ${patient.phone}` : ""} {patient.address ? `• ${patient.address}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search by name, UHID, or phone..." value={search}
                  onChange={(e) => setSearch(e.target.value)} className="pl-10" />
              </div>
              {search.length >= 2 && safePatients.length > 0 && (
                <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                  {safePatients.slice(0, 10).map((p) => (
                    <button key={p.id} onClick={() => { setPatient(p); setSearch(""); }}
                      className="w-full text-left p-3 hover:bg-muted text-sm flex justify-between items-center">
                      <span>
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{p.age}{p.gender[0]} {p.phone}</span>
                      </span>
                      <Badge variant="outline" className="font-mono text-xs">{p.uhid}</Badge>
                    </button>
                  ))}
                </div>
              )}
              {search.length >= 2 && safePatients.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No patient found. Register new patient below.</p>
              )}

              {/* Registration Form — Always Visible */}
              <div className="border-t pt-2 space-y-2">
                <h3 className="font-semibold text-xs">Register New Patient</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Full Name *</Label>
                    <Input placeholder="Patient name" value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Age *</Label>
                    <Input type="number" placeholder="Age" min={0} max={150} value={newPatient.age} onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })} className="h-8" />
                  </div>
                  <div>
                    <Label className="text-xs">Gender *</Label>
                    <Select value={newPatient.gender} onValueChange={(v) => setNewPatient({ ...newPatient, gender: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Phone</Label>
                    <Input placeholder="Phone" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} className="h-8" />
                  </div>
                  <div className="col-span-1 md:col-span-2 lg:col-span-3">
                    <Label className="text-xs">Address</Label>
                    <Input placeholder="Address" value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} className="h-8" />
                  </div>
                </div>

                {/* IPD-specific demographics */}
                <div className="border-t pt-2 space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground">IPD Demographics</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Guardian Name</Label>
                      <Input placeholder="Guardian name" value={newPatient.guardianName} onChange={(e) => setNewPatient({ ...newPatient, guardianName: e.target.value })} className="h-8" />
                    </div>
                    <div>
                      <Label className="text-xs">Guardian Phone</Label>
                      <Input placeholder="Contact" value={newPatient.guardianPhone} onChange={(e) => setNewPatient({ ...newPatient, guardianPhone: e.target.value })} className="h-8" />
                    </div>
                  </div>

                  {/* Document uploads */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <DocumentUpload category="ID Card / Aadhar" onDocumentsChange={(docs) => {
                      setNewPatient({ ...newPatient, idCardUrl: docs.map((d) => d.url).join(",") });
                    }} />
                    <DocumentUpload category="Photo" onDocumentsChange={(docs) => {
                      setNewPatient({ ...newPatient, photoUrl: docs.map((d) => d.url).join(",") });
                    }} />
                    <DocumentUpload category="Reports" onDocumentsChange={(docs) => {
                      setNewPatient({ ...newPatient, reportsUrl: docs.map((d) => d.url).join(",") });
                    }} />
                  </div>
                </div>

                <Button className="w-full h-8" size="sm" disabled={!newPatient.name || !newPatient.age || registerPatient.isPending}
                  onClick={() => registerPatient.mutate()}>
                  {registerPatient.isPending ? "Registering..." : "Register & Continue"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* LEFT: Services */}
        <div className="lg:col-span-2 space-y-3">

          {/* Services panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />Add Services
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-2">
              <BillingQuickServices
                entityId={Number(entityId)}
                heads={safeHeads}
                onPick={addHeadObjectToCart}
              />
              <Tabs defaultValue="heads">
                <TabsList className="h-8">
                  <TabsTrigger value="heads" className="text-xs">Individual</TabsTrigger>
                  <TabsTrigger value="packages" className="text-xs">Packages</TabsTrigger>
                </TabsList>
                <TabsContent value="heads" className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <Select value={pickHead} onValueChange={setPickHead}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Search consultation, lab test, room, OT, X-Ray..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {safeHeads.map((h) => (
                          <SelectItem key={h.id} value={String(h.id)}>
                            <span className="font-mono text-xs text-muted-foreground mr-2">{h.code}</span>
                            {h.name} — ₹{Number(h.defaultRate).toLocaleString("en-IN")}
                            <span className="text-muted-foreground ml-2 text-xs">({h.category})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={addHeadToCart} disabled={!pickHead}>
                      <Plus className="w-4 h-4 mr-1" />Add
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="packages" className="mt-2 space-y-1">
                  {safePackages.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">No packages</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {safePackages.map((p) => {
                        const mrp = Number(p.mrpTotal);
                        const rate = Number(p.packageRate);
                        const pct = mrp > 0 ? Math.round((1 - rate / mrp) * 100) : 0;
                        return (
                          <button key={p.id} onClick={() => addPackageToCart(p)}
                            className="text-left border rounded-lg p-3 hover:bg-muted hover:border-primary transition">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <p className="font-medium text-sm flex items-center gap-1"><Tag className="w-3 h-3" />{p.name}</p>
                                <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" variant="secondary">{pct}% off</Badge>
                            </div>
                            <div className="flex items-end justify-between mt-2">
                              <p className="text-xs text-muted-foreground line-through">₹{mrp.toLocaleString("en-IN")}</p>
                              <p className="text-lg font-bold">₹{rate.toLocaleString("en-IN")}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Cart + Payment */}
        <div>
          <Card className="sticky top-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Receipt className="w-4 h-4" />Bill
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-2">
              {cart.length === 0 ? (
                <p className="text-xs text-muted-foreground py-3 text-center">Empty</p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {cart.map((c) => (
                    <div key={c.key} className="flex items-center gap-1 text-xs border rounded-md p-1">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-xs">{c.name}</p>
                      </div>
                      <Input type="number" className="w-10 h-6 text-xs" min={1} value={c.quantity}
                        onChange={(e) => setCart(cart.map((x) => x.key === c.key ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} />
                      <span className="w-16 text-right font-medium text-xs">₹{(c.rate * c.quantity).toLocaleString("en-IN")}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6"
                        onClick={() => setCart(cart.filter((x) => x.key !== c.key))}>
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-1" />

              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Sub</span><span className="font-medium">₹{totals.subtotal.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between items-center gap-1">
                  <span className="text-muted-foreground">Disc</span>
                  <Input type="number" className="w-16 h-6 text-right text-xs" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                {totals.gst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{totals.gst.toFixed(0)}</span></div>}
                <Separator className="my-0.5" />
                <div className="flex justify-between font-bold text-sm"><span>Total</span><span>₹{totals.total.toLocaleString("en-IN")}</span></div>
              </div>

              <Separator className="my-1" />

              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={invoiceType} onValueChange={setInvoiceType}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPD">OPD</SelectItem>
                        <SelectItem value="IPD">IPD</SelectItem>
                        <SelectItem value="TPA">TPA</SelectItem>
                        <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Entity</Label>
                    <Select value={entityId} onValueChange={setEntityId}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {safeEntities.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Mode</Label>
                  <div className="grid grid-cols-4 gap-0.5 mt-0.5">
                    {PAYMENT_MODES.map((m) => (
                      <Button key={m} type="button" size="sm" variant={paymentMode === m ? "default" : "outline"}
                        onClick={() => setPaymentMode(m)} className="text-xs h-7">{m}</Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="text-xs">Paid</Label>
                    <Input type="number" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-7 text-xs" />
                    {paidAmount !== "" && Number(paidAmount) < totals.total && (
                      <p className="text-xs text-orange-600 mt-0.5">Due ₹{(totals.total - Number(paidAmount)).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Collector</Label>
                    <Select value={collectedBy} onValueChange={setCollectedBy}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {cashiers.map((e) => <SelectItem key={e.id} value={e.username!}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full h-8" size="sm"
                  disabled={!patient || cart.length === 0 || generateInvoice.isPending}
                  onClick={() => generateInvoice.mutate()}>
                  {generateInvoice.isPending ? "Generating..." : `Invoice — ₹${totals.total.toLocaleString("en-IN")}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>


      {/* Success dialog */}
      <Dialog open={!!successInvoice} onOpenChange={(o) => !o && resetForNext()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />Invoice Generated
            </DialogTitle>
          </DialogHeader>
          {successInvoice && (
            <div className="space-y-3 py-2">
              <div className="border rounded-lg p-4 bg-muted/40">
                <p className="text-xs text-muted-foreground">Invoice Number</p>
                <p className="text-xl font-mono font-bold">{successInvoice.invoiceNo}</p>
                <Separator className="my-2" />
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="text-2xl font-bold">₹{Number(successInvoice.totalAmount).toLocaleString("en-IN")}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={resetForNext}>New Bill</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
