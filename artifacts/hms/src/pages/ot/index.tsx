import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
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
  Scissors, Plus, Search, Trash2, PlayCircle, CheckCircle2, Receipt, FileText, Clock,
} from "lucide-react";

interface Consumable { code?: string; name: string; quantity: number; rate: number }
interface Booking {
  id: number; bookingNo: string;
  patientId: number; patientName: string; patientUhid: string;
  entityId: number | null;
  otRoom: string;
  surgeonId: number | null; surgeonName: string | null;
  anaesthetistId: number | null; anaesthetistName: string | null;
  procedureName: string; procedureCharge: string;
  anaesthesiaType: string | null; anaesthesiaNotes: string | null;
  preOpChecklist: Record<string, boolean>;
  consumables: Consumable[];
  notes: string | null;
  status: string;
  invoiceId: number | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
}
interface Patient { id: number; uhid: string; name: string; age: number; gender: string }
interface Doctor { id: number; name: string; specialization: string | null }
interface BillingHead { id: number; code: string; name: string; category: string; defaultRate: string }
interface InventoryItem { id: number; itemCode: string; name: string; unitCost: string }
interface Entity { id: number; name: string }
interface Employee { id: number; name: string; role: string; username: string | null }

const OT_ROOMS = ["OT-1 (Major)", "OT-2 (Minor)", "OT-3 (Emergency)", "Labor Room"];
const ANAES_TYPES = ["General", "Spinal", "Epidural", "Local", "MAC / Sedation"];
const PRE_OP_ITEMS = [
  { key: "consent", label: "Informed consent obtained" },
  { key: "npo", label: "NPO confirmed (≥6h)" },
  { key: "marking", label: "Surgical site marked" },
  { key: "fitness", label: "Anaesthesia fitness cleared" },
  { key: "investigations", label: "Investigations reviewed" },
  { key: "antibiotic", label: "Pre-op antibiotic given" },
  { key: "iv", label: "IV access secured" },
];
const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function nowLocal(offsetMin = 0) {
  const d = new Date(Date.now() + offsetMin * 60_000);
  d.setSeconds(0, 0);
  const tz = d.getTimezoneOffset();
  return new Date(d.getTime() - tz * 60_000).toISOString().slice(0, 16);
}

export default function OtPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("upcoming");
  const [showNew, setShowNew] = useState(false);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const [showBill, setShowBill] = useState<Booking | null>(null);

  // New booking
  const [newB, setNewB] = useState({
    patientId: "", entityId: "1", otRoom: OT_ROOMS[0],
    surgeonId: "", anaesthetistId: "",
    procedureBillingHeadId: "", procedureName: "", procedureCharge: "",
    anaesthesiaType: "General",
    scheduledAt: nowLocal(60),
    notes: "",
  });
  const [patientSearch, setPatientSearch] = useState("");

  // Bill form
  const [billPaid, setBillPaid] = useState("");
  const [billMode, setBillMode] = useState("Cash");
  const [billCollectedBy, setBillCollectedBy] = useState("");
  const [billDiscount, setBillDiscount] = useState("0");
  const [billOtCharges, setBillOtCharges] = useState("1500");

  // Surgical record consumable picker
  const [pickConsumable, setPickConsumable] = useState("");
  const [consumableQty, setConsumableQty] = useState("1");

  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ["/api/ot-bookings"],
    queryFn: () => fetch("/api/ot-bookings").then((r) => r.json()),
  });
  const { data: patientList } = useQuery<{ patients: Patient[] }>({
    queryKey: ["/api/patients", patientSearch],
    queryFn: () => fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}`).then((r) => r.json()),
    enabled: patientSearch.length >= 2,
  });
  const { data: doctors } = useQuery<Doctor[]>({
    queryKey: ["/api/doctors"],
    queryFn: () => fetch("/api/doctors").then((r) => r.json()),
  });
  const { data: heads } = useQuery<BillingHead[]>({
    queryKey: ["/api/billing-heads"],
    queryFn: () => fetch("/api/billing-heads").then((r) => r.json()),
  });
  const { data: inventory } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: () => fetch("/api/inventory").then((r) => r.json()),
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: () => fetch("/api/entities").then((r) => r.json()),
  });
  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });

  const otHeads = (heads || []).filter((h) => h.category === "OT");
  const cashiers = (employees || []).filter((e) => e.username && ["cashier", "receptionist", "admin"].includes(e.role));
  const selectedPatient = (patientList?.patients || []).find((p) => p.id === Number(newB.patientId));

  const filteredBookings = useMemo(() => {
    const all = bookings || [];
    if (tab === "upcoming") return all.filter((b) => b.status === "scheduled");
    if (tab === "in_progress") return all.filter((b) => b.status === "in_progress");
    if (tab === "completed") return all.filter((b) => b.status === "completed");
    return all;
  }, [bookings, tab]);

  const stats = useMemo(() => {
    const all = bookings || [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      todayCount: all.filter((b) => b.scheduledAt.slice(0, 10) === today).length,
      inProgress: all.filter((b) => b.status === "in_progress").length,
      completedToday: all.filter((b) => b.status === "completed" && (b.endedAt || "").slice(0, 10) === today).length,
      revenue: all.filter((b) => b.invoiceId).reduce((s, b) => s + Number(b.procedureCharge), 0),
    };
  }, [bookings]);

  const createBooking = useMutation({
    mutationFn: async () => {
      if (!newB.patientId) throw new Error("Patient required");
      if (!newB.procedureName) throw new Error("Procedure required");
      if (!newB.procedureCharge) throw new Error("Procedure charge required");
      const r = await fetch("/api/ot-bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: Number(newB.patientId),
          entityId: Number(newB.entityId) || null,
          otRoom: newB.otRoom,
          surgeonId: newB.surgeonId ? Number(newB.surgeonId) : null,
          anaesthetistId: newB.anaesthetistId ? Number(newB.anaesthetistId) : null,
          procedureBillingHeadId: newB.procedureBillingHeadId ? Number(newB.procedureBillingHeadId) : null,
          procedureName: newB.procedureName,
          procedureCharge: Number(newB.procedureCharge),
          anaesthesiaType: newB.anaesthesiaType,
          notes: newB.notes,
          scheduledAt: newB.scheduledAt,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (b: Booking) => {
      toast.success(`Booking ${b.bookingNo} created`);
      setShowNew(false);
      setNewB({ ...newB, patientId: "", procedureName: "", procedureCharge: "", procedureBillingHeadId: "", surgeonId: "", anaesthetistId: "", notes: "" });
      setPatientSearch("");
      qc.invalidateQueries({ queryKey: ["/api/ot-bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const r = await fetch(`/api/ot-bookings/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (b: Booking) => {
      qc.invalidateQueries({ queryKey: ["/api/ot-bookings"] });
      if (activeBooking?.id === b.id) setActiveBooking({ ...activeBooking, ...b } as any);
    },
  });

  const billBooking = useMutation({
    mutationFn: async () => {
      if (!showBill) throw new Error("No booking");
      const r = await fetch(`/api/ot-bookings/${showBill.id}/bill`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paidAmount: Number(billPaid) || 0,
          paymentMode: billMode,
          collectedBy: billCollectedBy || null,
          discount: Number(billDiscount) || 0,
          otCharges: Number(billOtCharges) || 0,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (data: any) => {
      toast.success(`Invoice ${data.invoice.invoiceNo} generated`);
      setShowBill(null);
      setBillPaid(""); setBillDiscount("0"); setBillCollectedBy(""); setBillOtCharges("1500");
      qc.invalidateQueries({ queryKey: ["/api/ot-bookings"] });
      qc.invalidateQueries({ queryKey: ["/api/billing/invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onPickProcedure = (id: string) => {
    const h = otHeads.find((x) => String(x.id) === id);
    if (!h) return;
    setNewB({ ...newB, procedureBillingHeadId: id, procedureName: h.name, procedureCharge: String(h.defaultRate) });
  };

  const addConsumable = () => {
    if (!activeBooking || !pickConsumable) return;
    const item = (inventory || []).find((x) => String(x.id) === pickConsumable);
    if (!item) return;
    const qty = Math.max(1, Number(consumableQty) || 1);
    const consumables = [...(activeBooking.consumables || []), {
      code: item.itemCode, name: item.name, quantity: qty, rate: Number(item.unitCost),
    }];
    updateBooking.mutate({ id: activeBooking.id, body: { consumables } });
    setPickConsumable(""); setConsumableQty("1");
  };

  const removeConsumable = (idx: number) => {
    if (!activeBooking) return;
    const consumables = activeBooking.consumables.filter((_, i) => i !== idx);
    updateBooking.mutate({ id: activeBooking.id, body: { consumables } });
  };

  const togglePreOp = (key: string) => {
    if (!activeBooking) return;
    const checklist = { ...(activeBooking.preOpChecklist || {}), [key]: !activeBooking.preOpChecklist?.[key] };
    updateBooking.mutate({ id: activeBooking.id, body: { preOpChecklist: checklist } });
  };

  const consumablesTotal = activeBooking
    ? (activeBooking.consumables || []).reduce((s, c) => s + Number(c.rate) * Number(c.quantity), 0) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Operation Theatre</h2>
          <p className="text-muted-foreground text-sm">Surgical bookings, anaesthesia notes, consumables, and OT billing.</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />New Booking</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Today's Bookings</p><p className="text-2xl font-bold">{stats.todayCount}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">In Progress</p><p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Completed Today</p><p className="text-2xl font-bold text-emerald-600">{stats.completedToday}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Billed Procedure Revenue</p><p className="text-2xl font-bold">₹{stats.revenue.toLocaleString("en-IN")}</p></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upcoming"><Clock className="w-4 h-4 mr-2" />Upcoming</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking #</TableHead>
                    <TableHead>Scheduled</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Procedure</TableHead>
                    <TableHead>OT</TableHead>
                    <TableHead>Surgeon</TableHead>
                    <TableHead className="text-right">Charge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-12">No bookings in this tab.</TableCell></TableRow>
                  ) : filteredBookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.bookingNo}</TableCell>
                      <TableCell className="text-xs">{new Date(b.scheduledAt).toLocaleString()}</TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">{b.patientName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{b.patientUhid}</div>
                      </TableCell>
                      <TableCell className="text-sm">{b.procedureName}</TableCell>
                      <TableCell className="text-xs">{b.otRoom}</TableCell>
                      <TableCell className="text-sm">{b.surgeonName || "—"}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(b.procedureCharge).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[b.status]} variant="secondary">{b.status.replace("_", " ")}</Badge>
                        {b.invoiceId && <Badge variant="outline" className="ml-1 text-xs">Billed</Badge>}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => setActiveBooking(b)}>
                          <FileText className="w-3 h-3 mr-1" />Record
                        </Button>
                        {b.status === "scheduled" && (
                          <Button size="sm" variant="ghost"
                            onClick={() => updateBooking.mutate({ id: b.id, body: { status: "in_progress" } })}>
                            <PlayCircle className="w-3 h-3 mr-1" />Start
                          </Button>
                        )}
                        {b.status === "completed" && !b.invoiceId && (
                          <Button size="sm" variant="ghost" onClick={() => { setShowBill(b); setBillPaid(b.procedureCharge); }}>
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

      {/* New Booking */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New OT Booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
              {selectedPatient ? (
                <div className="flex items-center justify-between border rounded-lg p-2 bg-muted/30">
                  <div><span className="font-medium">{selectedPatient.name}</span> <Badge variant="outline" className="ml-2 font-mono text-xs">{selectedPatient.uhid}</Badge></div>
                  <Button size="sm" variant="ghost" onClick={() => setNewB({ ...newB, patientId: "" })}>Change</Button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Search patient..." value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
                  </div>
                  {patientSearch.length >= 2 && (patientList?.patients || []).length > 0 && (
                    <div className="border rounded-lg divide-y mt-2 max-h-40 overflow-y-auto">
                      {(patientList?.patients || []).slice(0, 8).map((p) => (
                        <button key={p.id} onClick={() => setNewB({ ...newB, patientId: String(p.id) })}
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
                <Label>OT Room *</Label>
                <Select value={newB.otRoom} onValueChange={(v) => setNewB({ ...newB, otRoom: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{OT_ROOMS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scheduled At *</Label>
                <Input type="datetime-local" value={newB.scheduledAt} onChange={(e) => setNewB({ ...newB, scheduledAt: e.target.value })} />
              </div>
              <div>
                <Label>Surgeon</Label>
                <Select value={newB.surgeonId} onValueChange={(v) => setNewB({ ...newB, surgeonId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(doctors || []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Anaesthetist</Label>
                <Select value={newB.anaesthetistId} onValueChange={(v) => setNewB({ ...newB, anaesthetistId: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{(doctors || []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Anaesthesia Type</Label>
                <Select value={newB.anaesthesiaType} onValueChange={(v) => setNewB({ ...newB, anaesthesiaType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ANAES_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entity</Label>
                <Select value={newB.entityId} onValueChange={(v) => setNewB({ ...newB, entityId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{(entities || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Procedure (pick from rate card or type custom) *</Label>
              <Select value={newB.procedureBillingHeadId} onValueChange={onPickProcedure}>
                <SelectTrigger><SelectValue placeholder="Pick standard procedure..." /></SelectTrigger>
                <SelectContent>
                  {otHeads.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{h.code}</span>
                      {h.name} — ₹{Number(h.defaultRate).toLocaleString("en-IN")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input placeholder="Procedure name" value={newB.procedureName} onChange={(e) => setNewB({ ...newB, procedureName: e.target.value })} />
                <Input type="number" placeholder="Charge" value={newB.procedureCharge} onChange={(e) => setNewB({ ...newB, procedureCharge: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Pre-Op Notes</Label>
              <Textarea rows={2} value={newB.notes} onChange={(e) => setNewB({ ...newB, notes: e.target.value })}
                placeholder="Indication, special precautions..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={createBooking.isPending} onClick={() => createBooking.mutate()}>
              {createBooking.isPending ? "Creating..." : "Create Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Surgical Record */}
      <Dialog open={!!activeBooking} onOpenChange={(o) => !o && setActiveBooking(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="w-5 h-5" />{activeBooking?.bookingNo}
              {activeBooking && <Badge className={STATUS_COLORS[activeBooking.status]} variant="secondary">{activeBooking.status.replace("_", " ")}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {activeBooking && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Patient</p>
                  <p className="font-medium">{activeBooking.patientName} <Badge variant="outline" className="ml-1 font-mono text-xs">{activeBooking.patientUhid}</Badge></p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">OT Room</p>
                  <p className="font-medium">{activeBooking.otRoom}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Surgeon</p>
                  <p className="font-medium">{activeBooking.surgeonName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Anaesthetist</p>
                  <p className="font-medium">{activeBooking.anaesthetistName || "—"} ({activeBooking.anaesthesiaType || "—"})</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="font-medium text-xs">{activeBooking.startedAt ? new Date(activeBooking.startedAt).toLocaleString() : "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ended</p>
                  <p className="font-medium text-xs">{activeBooking.endedAt ? new Date(activeBooking.endedAt).toLocaleString() : "—"}</p>
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold">Pre-Op Checklist</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PRE_OP_ITEMS.map((it) => (
                    <label key={it.key} className="flex items-center gap-2 cursor-pointer text-sm">
                      <Checkbox
                        checked={!!activeBooking.preOpChecklist?.[it.key]}
                        onCheckedChange={() => togglePreOp(it.key)}
                      />
                      {it.label}
                    </label>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold">Anaesthesia Notes</Label>
                <Textarea rows={3} value={activeBooking.anaesthesiaNotes || ""}
                  onChange={(e) => setActiveBooking({ ...activeBooking, anaesthesiaNotes: e.target.value })}
                  onBlur={() => updateBooking.mutate({ id: activeBooking.id, body: { anaesthesiaNotes: activeBooking.anaesthesiaNotes } })}
                  placeholder="Drugs given, dosage, vitals, induction time, response..." />
              </div>

              <Separator />

              <div>
                <Label className="text-base font-semibold">Consumables Used</Label>
                <div className="flex gap-2 mt-2">
                  <Select value={pickConsumable} onValueChange={setPickConsumable}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Pick from inventory..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(inventory || []).map((i) => (
                        <SelectItem key={i.id} value={String(i.id)}>
                          <span className="font-mono text-xs text-muted-foreground mr-1">{i.itemCode}</span>
                          {i.name} — ₹{Number(i.unitCost).toLocaleString("en-IN")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input type="number" min={1} className="w-20" value={consumableQty} onChange={(e) => setConsumableQty(e.target.value)} />
                  <Button onClick={addConsumable} disabled={!pickConsumable}><Plus className="w-4 h-4" /></Button>
                </div>
                {(activeBooking.consumables || []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {activeBooking.consumables.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                        <span className="flex-1">{c.name} <span className="text-xs text-muted-foreground">× {c.quantity}</span></span>
                        <span className="text-muted-foreground">₹{(Number(c.rate) * Number(c.quantity)).toLocaleString("en-IN")}</span>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeConsumable(i)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                    <div className="flex justify-between font-medium pt-1 border-t mt-2">
                      <span>Consumables total</span><span>₹{consumablesTotal.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                {activeBooking.status === "scheduled" && (
                  <Button onClick={() => updateBooking.mutate({ id: activeBooking.id, body: { status: "in_progress" } })}>
                    <PlayCircle className="w-4 h-4 mr-1" />Start Surgery
                  </Button>
                )}
                {activeBooking.status === "in_progress" && (
                  <Button onClick={() => updateBooking.mutate({ id: activeBooking.id, body: { status: "completed" } })}>
                    <CheckCircle2 className="w-4 h-4 mr-1" />Mark Complete
                  </Button>
                )}
                {activeBooking.status === "scheduled" && (
                  <Button variant="outline" onClick={() => updateBooking.mutate({ id: activeBooking.id, body: { status: "cancelled" } })}>Cancel</Button>
                )}
                {activeBooking.status === "completed" && !activeBooking.invoiceId && (
                  <Button onClick={() => { setShowBill(activeBooking); setBillPaid(activeBooking.procedureCharge); setActiveBooking(null); }}>
                    <Receipt className="w-4 h-4 mr-1" />Generate Bill
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bill */}
      <Dialog open={!!showBill} onOpenChange={(o) => !o && setShowBill(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Invoice — {showBill?.bookingNo}</DialogTitle></DialogHeader>
          {showBill && (() => {
            const consSum = (showBill.consumables || []).reduce((s, c) => s + Number(c.rate) * Number(c.quantity), 0);
            const procCharge = Number(showBill.procedureCharge);
            const otCh = Number(billOtCharges) || 0;
            const subtotal = procCharge + otCh + consSum;
            const net = subtotal - (Number(billDiscount) || 0);
            return (
              <div className="space-y-3">
                <div className="border rounded-lg p-3 bg-muted/30 text-sm">
                  <div className="flex justify-between"><span>Procedure: {showBill.procedureName}</span><span>₹{procCharge.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between"><span>OT Theatre Charges</span><span>₹{otCh.toLocaleString("en-IN")}</span></div>
                  <div className="flex justify-between"><span>Consumables ({(showBill.consumables || []).length})</span><span>₹{consSum.toLocaleString("en-IN")}</span></div>
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold"><span>Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>OT Charges</Label>
                    <Input type="number" value={billOtCharges} onChange={(e) => setBillOtCharges(e.target.value)} />
                  </div>
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
                      <SelectContent>{["Cash", "Card", "UPI", "Online"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label>Collected By</Label>
                    <Select value={billCollectedBy} onValueChange={setBillCollectedBy}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{cashiers.map((e) => <SelectItem key={e.id} value={e.username!}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="text-right text-lg font-bold">Net: ₹{net.toLocaleString("en-IN")}</div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBill(null)}>Cancel</Button>
            <Button disabled={billBooking.isPending} onClick={() => billBooking.mutate()}>
              {billBooking.isPending ? "Generating..." : "Generate Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
