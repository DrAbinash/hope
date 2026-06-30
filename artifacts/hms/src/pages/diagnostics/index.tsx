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
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  TestTube, Microscope, Plus, FileText, CheckCircle2, Receipt, Search, Trash2,
} from "lucide-react";

interface OrderItem {
  billingHeadId?: number;
  code: string;
  name: string;
  rate: number;
  quantity: number;
  result?: string;
  normalRange?: string;
  observation?: string;
}
interface DiagnosticOrder {
  id: number; orderNo: string; type: "pathology" | "radiology";
  patientId: number; patientName: string; patientUhid: string;
  entityId: number | null; doctorId: number | null; doctorName: string | null;
  items: OrderItem[]; totalAmount: string; status: string;
  invoiceId: number | null; notes: string | null;
  orderedAt: string; completedAt: string | null;
}
interface Patient { id: number; uhid: string; name: string; age: number; gender: string }
interface Doctor { id: number; name: string; specialization: string | null }
interface BillingHead {
  id: number; code: string; name: string; category: string; defaultRate: string;
}
interface Entity { id: number; name: string }
interface Employee { id: number; name: string; role: string; username: string | null }

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  collected: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

export default function DiagnosticsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pathology" | "radiology">("pathology");
  const [showNew, setShowNew] = useState(false);
  const [activeOrder, setActiveOrder] = useState<DiagnosticOrder | null>(null);
  const [showBill, setShowBill] = useState<DiagnosticOrder | null>(null);

  // New order form
  const [newOrder, setNewOrder] = useState({
    patientId: "", entityId: "1", doctorId: "", notes: "",
    items: [] as OrderItem[],
  });
  const [patientSearch, setPatientSearch] = useState("");
  const [pickHead, setPickHead] = useState("");

  // Bill form
  const [billPaid, setBillPaid] = useState("");
  const [billMode, setBillMode] = useState("Cash");
  const [billCollectedBy, setBillCollectedBy] = useState("");
  const [billDiscount, setBillDiscount] = useState("0");

  const { data: orders } = useQuery<DiagnosticOrder[]>({
    queryKey: ["/api/diagnostic-orders", tab],
    queryFn: async () => {
      const r = await fetch(`/api/diagnostic-orders?type=${tab}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch orders");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: patientList } = useQuery<{ patients: Patient[] }>({
    queryKey: ["/api/patients", patientSearch],
    queryFn: async () => {
      const r = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch patients");
      return r.json();
    },
    enabled: patientSearch.length >= 2,
  });
  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
    queryFn: async () => {
      const r = await fetch("/api/doctors", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch doctors");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
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
      if (!r.ok) throw new Error("Failed to fetch employees");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const safeHeads = Array.isArray(heads) ? heads : [];
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safePatients = Array.isArray(patientList?.patients) ? patientList.patients : [];

  const filteredHeads = useMemo(() => {
    const cat = tab === "pathology" ? "Pathology" : "Radiology";
    return safeHeads.filter((h) => h.category === cat);
  }, [safeHeads, tab]);

  const selectedPatient = safePatients.find((p) => p.id === Number(newOrder.patientId));
  const cashiers = safeEmployees.filter((e) => e.username && ["cashier", "receptionist", "admin"].includes(e.role));

  const addItemToOrder = () => {
    if (!pickHead) return;
    const h = filteredHeads.find((x) => x.id === Number(pickHead));
    if (!h) return;
    if (newOrder.items.some((i) => i.code === h.code)) {
      toast.info(`${h.name} already added`);
      return;
    }
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, {
        billingHeadId: h.id, code: h.code, name: h.name,
        rate: Number(h.defaultRate), quantity: 1,
      }],
    });
    setPickHead("");
  };

  const newOrderTotal = newOrder.items.reduce((s, i) => s + i.rate * i.quantity, 0);

  const createOrder = useMutation({
    mutationFn: async () => {
      if (!newOrder.patientId) throw new Error("Patient is required");
      if (newOrder.items.length === 0) throw new Error("Add at least one test");
      const r = await fetch("/api/diagnostic-orders", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          type: tab,
          patientId: Number(newOrder.patientId),
          entityId: Number(newOrder.entityId) || null,
          doctorId: newOrder.doctorId ? Number(newOrder.doctorId) : null,
          items: newOrder.items, notes: newOrder.notes || null,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (o: DiagnosticOrder) => {
      toast.success(`Order ${o.orderNo} created`);
      setShowNew(false);
      setNewOrder({ patientId: "", entityId: "1", doctorId: "", notes: "", items: [] });
      setPatientSearch("");
      qc.invalidateQueries({ queryKey: ["/api/diagnostic-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const r = await fetch(`/api/diagnostic-orders/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/diagnostic-orders"] });
      toast.success("Order updated");
    },
  });

  const billOrder = useMutation({
    mutationFn: async () => {
      if (!showBill) throw new Error("No order");
      const r = await fetch(`/api/diagnostic-orders/${showBill.id}/bill`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          paidAmount: Number(billPaid) || 0,
          paymentMode: billMode,
          collectedBy: billCollectedBy || null,
          discount: Number(billDiscount) || 0,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (data: any) => {
      toast.success(`Invoice ${data.invoice.invoiceNo} generated`);
      setShowBill(null);
      setBillPaid(""); setBillDiscount("0"); setBillCollectedBy("");
      qc.invalidateQueries({ queryKey: ["/api/diagnostic-orders"] });
      qc.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setActiveItemField = (idx: number, field: keyof OrderItem, value: string) => {
    if (!activeOrder) return;
    const items = activeOrder.items.map((it, i) => i === idx ? { ...it, [field]: value } : it);
    setActiveOrder({ ...activeOrder, items });
  };

  const saveResults = () => {
    if (!activeOrder) return;
    updateOrder.mutate({ id: activeOrder.id, body: { items: activeOrder.items, status: "in_progress" } });
  };
  const markComplete = () => {
    if (!activeOrder) return;
    updateOrder.mutate({ id: activeOrder.id, body: { items: activeOrder.items, status: "completed" } },
      { onSuccess: () => setActiveOrder(null) });
  };

  const list = orders || [];
  const stats = {
    total: list.length,
    pending: list.filter((o) => o.status === "pending").length,
    inProgress: list.filter((o) => o.status === "in_progress").length,
    completed: list.filter((o) => o.status === "completed").length,
    revenue: list.reduce((s, o) => s + Number(o.totalAmount), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pathology & Radiology</h2>
          <p className="text-muted-foreground text-sm">Test orders, results entry, and billing.</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />New Order</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending</p><p className="text-2xl font-bold text-amber-600">{stats.pending}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-violet-600">{stats.inProgress}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Completed</p><p className="text-2xl font-bold text-emerald-600">{stats.completed}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold">₹{stats.revenue.toLocaleString("en-IN")}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pathology" | "radiology")}>
        <TabsList>
          <TabsTrigger value="pathology"><TestTube className="w-4 h-4 mr-2" />Pathology</TabsTrigger>
          <TabsTrigger value="radiology"><Microscope className="w-4 h-4 mr-2" />Radiology</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Tests</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ordered</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No orders yet. Click "New Order" to create one.</TableCell></TableRow>
                  ) : list.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.orderNo}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{o.patientName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{o.patientUhid}</div>
                      </TableCell>
                      <TableCell className="text-sm">{o.doctorName || "—"}</TableCell>
                      <TableCell className="text-sm">{o.items.length} test{o.items.length !== 1 ? "s" : ""}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(o.totalAmount).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[o.status] || ""} variant="secondary">{o.status.replace("_", " ")}</Badge>
                        {o.invoiceId && <Badge variant="outline" className="ml-1 text-xs">Billed</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(o.orderedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setActiveOrder(o)}>
                          <FileText className="w-3 h-3 mr-1" />Results
                        </Button>
                        {!o.invoiceId && (
                          <Button size="sm" variant="ghost" onClick={() => { setShowBill(o); setBillPaid(o.totalAmount); }}>
                            <Receipt className="w-3 h-3 mr-1" />Bill
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Order Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New {tab === "pathology" ? "Pathology" : "Radiology"} Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between border rounded-lg p-2 bg-muted/30">
                  <div>
                    <span className="font-medium">{selectedPatient.name}</span>
                    <Badge variant="outline" className="ml-2 font-mono text-xs">{selectedPatient.uhid}</Badge>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setNewOrder({ ...newOrder, patientId: "" })}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search by name, UHID, or phone..."
                      value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                  </div>
                  {patientSearch.length >= 2 && safePatients.length > 0 && (
                    <div className="border rounded-lg divide-y mt-2 max-h-40 overflow-y-auto">
                      {safePatients.slice(0, 8).map((p) => (
                        <button key={p.id} onClick={() => setNewOrder({ ...newOrder, patientId: String(p.id) })}
                          className="w-full text-left p-2 hover:bg-muted text-sm flex justify-between">
                          <span>{p.name} <span className="text-xs text-muted-foreground">{p.age}{p.gender[0]}</span></span>
                          <Badge variant="outline" className="font-mono text-xs">{p.uhid}</Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Entity</Label>
                <Select value={newOrder.entityId} onValueChange={(v) => setNewOrder({ ...newOrder, entityId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(entities) ? entities : []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referring Doctor</Label>
                <Select value={newOrder.doctorId} onValueChange={(v) => setNewOrder({ ...newOrder, doctorId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(doctors) ? doctors : []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Tests</Label>
              <div className="flex gap-2">
                <Select value={pickHead} onValueChange={setPickHead}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={`Pick a ${tab} test...`} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredHeads.map((h) => (
                      <SelectItem key={h.id} value={String(h.id)}>
                        <span className="font-mono text-xs text-muted-foreground mr-2">{h.code}</span>
                        {h.name} — ₹{Number(h.defaultRate).toLocaleString("en-IN")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addItemToOrder} disabled={!pickHead}><Plus className="w-4 h-4" /></Button>
              </div>
              {newOrder.items.length > 0 && (
                <div className="mt-2 space-y-1">
                  {newOrder.items.map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                      <span className="flex-1">{it.name}</span>
                      <span className="text-muted-foreground">₹{it.rate.toLocaleString("en-IN")}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7"
                        onClick={() => setNewOrder({ ...newOrder, items: newOrder.items.filter((_, j) => j !== i) })}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between font-bold pt-1">
                    <span>Total</span><span>₹{newOrderTotal.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label>Clinical Notes</Label>
              <Textarea rows={2} value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                placeholder="Provisional diagnosis, sample type, urgency..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={createOrder.isPending} onClick={() => createOrder.mutate()}>
              {createOrder.isPending ? "Creating..." : "Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Entry Dialog */}
      <Dialog open={!!activeOrder} onOpenChange={(o) => !o && setActiveOrder(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeOrder?.orderNo}
              <Badge className={STATUS_COLORS[activeOrder?.status || ""]} variant="secondary">{activeOrder?.status.replace("_", " ")}</Badge>
            </DialogTitle>
          </DialogHeader>
          {activeOrder && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{activeOrder.patientName}</span> ({activeOrder.patientUhid})
                {activeOrder.doctorName && <> • Dr. {activeOrder.doctorName}</>}
              </div>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {activeOrder.items.map((it, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{it.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{it.code}</p>
                      </div>
                      <span className="text-sm font-medium">₹{it.rate.toLocaleString("en-IN")}</span>
                    </div>
                    {tab === "pathology" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Result</Label>
                          <Input value={it.result || ""} onChange={(e) => setActiveItemField(i, "result", e.target.value)}
                            placeholder="e.g. 7.4 g/dL" />
                        </div>
                        <div>
                          <Label className="text-xs">Normal Range</Label>
                          <Input value={it.normalRange || ""} onChange={(e) => setActiveItemField(i, "normalRange", e.target.value)}
                            placeholder="e.g. 12.0–16.0 g/dL" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-xs">Observation / Findings</Label>
                        <Textarea rows={3} value={it.observation || ""}
                          onChange={(e) => setActiveItemField(i, "observation", e.target.value)}
                          placeholder="Radiologist findings, impression, recommendations..." />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveOrder(null)}>Close</Button>
            <Button variant="secondary" onClick={saveResults} disabled={updateOrder.isPending}>Save Draft</Button>
            <Button onClick={markComplete} disabled={updateOrder.isPending}>
              <CheckCircle2 className="w-4 h-4 mr-1" />Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bill Dialog */}
      <Dialog open={!!showBill} onOpenChange={(o) => !o && setShowBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Invoice — {showBill?.orderNo}</DialogTitle>
          </DialogHeader>
          {showBill && (
            <div className="space-y-3">
              <div className="border rounded-lg p-3 bg-muted/30">
                <p className="text-sm font-medium">{showBill.patientName} <Badge variant="outline" className="ml-2 font-mono text-xs">{showBill.patientUhid}</Badge></p>
                <p className="text-xs text-muted-foreground mt-1">{showBill.items.length} item(s) • Order total ₹{Number(showBill.totalAmount).toLocaleString("en-IN")}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Discount</Label>
                  <Input type="number" value={billDiscount} onChange={(e) => setBillDiscount(e.target.value)} />
                </div>
                <div>
                  <Label>Paid Amount</Label>
                  <Input type="number" value={billPaid} onChange={(e) => setBillPaid(e.target.value)} />
                </div>
                <div>
                  <Label>Payment Mode</Label>
                  <Select value={billMode} onValueChange={setBillMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["Cash", "Card", "UPI", "Online"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Collected By</Label>
                  <Select value={billCollectedBy} onValueChange={setBillCollectedBy}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {cashiers.map((e) => <SelectItem key={e.id} value={e.username!}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-right text-lg font-bold">
                Net: ₹{(Number(showBill.totalAmount) - Number(billDiscount || 0)).toLocaleString("en-IN")}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBill(null)}>Cancel</Button>
            <Button disabled={billOrder.isPending} onClick={() => billOrder.mutate()}>
              {billOrder.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
