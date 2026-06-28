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

interface Patient {
  id: number; uhid: string; name: string; age: number; gender: string;
  phone: string | null;
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
  const [showRegister, setShowRegister] = useState(false);
  const [newPatient, setNewPatient] = useState({
    name: "", age: "", gender: "Male", phone: "", address: "",
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
    queryFn: () => fetch(`/api/patients?search=${encodeURIComponent(search)}`).then((r) => r.json()),
    enabled: search.length >= 2,
  });
  const { data: heads } = useQuery<BillingHead[]>({
    queryKey: ["/api/billing-heads"],
    queryFn: () => fetch("/api/billing-heads").then((r) => r.json()),
  });
  const { data: packages } = useQuery<Pkg[]>({
    queryKey: ["/api/packages"],
    queryFn: () => fetch("/api/packages").then((r) => r.json()),
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: () => fetch("/api/entities").then((r) => r.json()),
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  const cashiers = (employees || []).filter((e) => e.username && ["cashier", "receptionist", "admin"].includes(e.role));

  // --- Mutations ---
  const registerPatient = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPatient.name,
          age: Number(newPatient.age),
          gender: newPatient.gender,
          phone: newPatient.phone,
          address: newPatient.address,
        }),
      });
      if (!r.ok) throw new Error("Failed to register patient");
      return r.json() as Promise<Patient>;
    },
    onSuccess: (p) => {
      toast.success(`Registered ${p.name} (${p.uhid})`);
      setPatient(p);
      setShowRegister(false);
      setNewPatient({ name: "", age: "", gender: "Male", phone: "", address: "" });
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
    if (!pickHead || !heads) return;
    const h = heads.find((x) => x.id === Number(pickHead));
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Registration & Billing Desk</h2>
        <p className="text-muted-foreground text-sm">Register patient, add services, collect payment — all in one screen.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Patient + Services */}
        <div className="lg:col-span-2 space-y-4">
          {/* Patient panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="w-4 h-4" />Step 1 — Patient
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patient ? (
                <div className="flex items-center justify-between border rounded-lg p-3 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {patient.name}
                      <Badge variant="secondary" className="font-mono text-xs">{patient.uhid}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {patient.age} yr • {patient.gender} {patient.phone ? `• ${patient.phone}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>Change</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name, UHID, or phone..." value={search}
                      onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                  </div>
                  {search.length >= 2 && (patientList?.patients || []).length > 0 && (
                    <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                      {(patientList?.patients || []).slice(0, 10).map((p) => (
                        <button key={p.id} onClick={() => { setPatient(p); setSearch(""); }}
                          className="w-full text-left p-2 px-3 hover:bg-muted text-sm flex justify-between items-center">
                          <span>
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground ml-2 text-xs">{p.age}{p.gender[0]} {p.phone}</span>
                          </span>
                          <Badge variant="outline" className="font-mono text-xs">{p.uhid}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                  {search.length >= 2 && (patientList?.patients || []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No patient found.</p>
                  )}
                  <Button variant="outline" onClick={() => setShowRegister(true)} className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" />Register New Patient
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Services panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Stethoscope className="w-4 h-4" />Step 2 — Add Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BillingQuickServices
                entityId={Number(entityId)}
                heads={heads || []}
                onPick={addHeadObjectToCart}
              />
              <Tabs defaultValue="heads">
                <TabsList>
                  <TabsTrigger value="heads">Individual Charges</TabsTrigger>
                  <TabsTrigger value="packages">Health Packages</TabsTrigger>
                </TabsList>
                <TabsContent value="heads" className="mt-3 space-y-3">
                  <div className="flex gap-2">
                    <Select value={pickHead} onValueChange={setPickHead}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Search consultation, lab test, room, OT, X-Ray..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-80">
                        {(heads || []).map((h) => (
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
                <TabsContent value="packages" className="mt-3 space-y-2">
                  {(packages || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No packages defined.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(packages || []).map((p) => {
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="w-4 h-4" />Bill Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No services added yet</p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {cart.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 text-sm border rounded-md p-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{c.code}</p>
                      </div>
                      <Input type="number" className="w-14 h-7 text-xs" min={1} value={c.quantity}
                        onChange={(e) => setCart(cart.map((x) => x.key === c.key ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))} />
                      <span className="w-20 text-right font-medium">₹{(c.rate * c.quantity).toLocaleString("en-IN")}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setCart(cart.filter((x) => x.key !== c.key))}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{totals.subtotal.toLocaleString("en-IN")}</span></div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Discount</span>
                  <Input type="number" className="w-24 h-7 text-right" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </div>
                {totals.gst > 0 && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span>₹{totals.gst.toFixed(2)}</span></div>}
                <Separator />
                <div className="flex justify-between font-bold text-base"><span>Total</span><span>₹{totals.total.toLocaleString("en-IN")}</span></div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={invoiceType} onValueChange={setInvoiceType}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OPD">OPD</SelectItem>
                        <SelectItem value="IPD">IPD</SelectItem>
                        <SelectItem value="TPA">TPA / Insurance</SelectItem>
                        <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Entity</Label>
                    <Select value={entityId} onValueChange={setEntityId}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {(entities || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Payment Mode</Label>
                  <div className="grid grid-cols-4 gap-1 mt-1">
                    {PAYMENT_MODES.map((m) => (
                      <Button key={m} type="button" size="sm" variant={paymentMode === m ? "default" : "outline"}
                        onClick={() => setPaymentMode(m)} className="text-xs h-8">{m}</Button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Paid Amount</Label>
                    <Input type="number" placeholder="0" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} className="h-9" />
                    {paidAmount !== "" && Number(paidAmount) < totals.total && (
                      <p className="text-xs text-orange-600 mt-1">Due ₹{(totals.total - Number(paidAmount)).toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Collected By</Label>
                    <Select value={collectedBy} onValueChange={setCollectedBy}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {cashiers.map((e) => <SelectItem key={e.id} value={e.username!}>{e.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button className="w-full" size="lg"
                  disabled={!patient || cart.length === 0 || generateInvoice.isPending}
                  onClick={() => generateInvoice.mutate()}>
                  {generateInvoice.isPending ? "Generating..." : `Generate Invoice — ₹${totals.total.toLocaleString("en-IN")}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Register dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader><DialogTitle>Register New Patient</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Full Name *</Label>
              <Input value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} />
            </div>
            <div>
              <Label>Age *</Label>
              <Input type="number" value={newPatient.age} onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })} />
            </div>
            <div>
              <Label>Gender *</Label>
              <Select value={newPatient.gender} onValueChange={(v) => setNewPatient({ ...newPatient, gender: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Phone</Label>
              <Input value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Input value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancel</Button>
            <Button disabled={!newPatient.name || !newPatient.age || registerPatient.isPending}
              onClick={() => registerPatient.mutate()}>
              {registerPatient.isPending ? "Registering..." : "Register & Continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
