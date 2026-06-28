import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, CheckCircle2, XCircle, Clock, AlertCircle } from "lucide-react";

const STATUS_META: Record<string, { color: string; icon: React.ReactNode }> = {
  pending: { color: "bg-amber-100 text-amber-700", icon: <Clock className="w-3 h-3" /> },
  given: { color: "bg-green-100 text-green-700", icon: <CheckCircle2 className="w-3 h-3" /> },
  missed: { color: "bg-red-100 text-red-700", icon: <XCircle className="w-3 h-3" /> },
  held: { color: "bg-blue-100 text-blue-700", icon: <AlertCircle className="w-3 h-3" /> },
  refused: { color: "bg-purple-100 text-purple-700", icon: <XCircle className="w-3 h-3" /> },
};

async function fetchAdmissions() {
  const r = await fetch("/api/ipd/admissions?status=admitted&limit=100");
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : (j.data ?? []);
}
async function fetchMAR(ipdAdmissionId: string, date: string) {
  const params = new URLSearchParams({ ipdAdmissionId, date });
  const r = await fetch(`/api/pharmacy/mar?${params}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}
async function fetchMedicines() {
  const r = await fetch("/api/pharmacy/medicines?limit=500");
  if (!r.ok) return [];
  return r.json();
}

const ROUTES = ["oral", "iv", "im", "sc", "topical", "inhaled", "sublingual", "rectal", "nasal"];
const FREQUENCIES = ["OD (once daily)", "BD (twice daily)", "TDS (thrice daily)", "QDS (4× daily)", "SOS (when needed)", "STAT (immediately)", "HS (at bedtime)"];

export default function MARPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedAdm, setSelectedAdm] = useState("");
  const [date, setDate] = useState(today);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpdate, setShowUpdate] = useState<any>(null);
  const [form, setForm] = useState({ medicineId: "", medicineName: "", dose: "", route: "oral", frequency: "OD (once daily)", scheduledAt: `${today}T08:00` });
  const [updateStatus, setUpdateStatus] = useState("given");
  const [updateReason, setUpdateReason] = useState("");

  const { data: admissions = [] } = useQuery({ queryKey: ["ipd-admissions-mar"], queryFn: fetchAdmissions });
  const { data: records = [], isLoading } = useQuery({ queryKey: ["mar", selectedAdm, date], queryFn: () => fetchMAR(selectedAdm, date), enabled: !!selectedAdm });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });

  const addMAR = useMutation({
    mutationFn: async (payload: any) => {
      const adm = (admissions as any[]).find((a: any) => String(a.id) === selectedAdm);
      const r = await fetch("/api/pharmacy/mar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, ipdAdmissionId: Number(selectedAdm), patientId: adm?.patientId }) });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error); }
      return r.json();
    },
    onSuccess: () => { toast.success("MAR entry added"); qc.invalidateQueries({ queryKey: ["mar"] }); setShowAdd(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMAR = useMutation({
    mutationFn: async ({ id, status, reason }: any) => {
      const r = await fetch(`/api/pharmacy/mar/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { toast.success("MAR updated"); qc.invalidateQueries({ queryKey: ["mar"] }); setShowUpdate(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const pending = (records as any[]).filter((r: any) => r.status === "pending").length;
  const missed = (records as any[]).filter((r: any) => r.status === "missed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">Medication Administration Record (MAR)</h1><p className="text-sm text-muted-foreground">Track and document nurse-administered medications</p></div>
        {selectedAdm && <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />Schedule Dose</Button>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <Label>Patient (IPD Admission)</Label>
          <Select value={selectedAdm} onValueChange={setSelectedAdm}>
            <SelectTrigger><SelectValue placeholder="Choose patient…" /></SelectTrigger>
            <SelectContent className="max-h-60">
              {(admissions as any[]).map((a: any) => <SelectItem key={a.id} value={String(a.id)}>{a.ipdNo} — {a.patientName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
      </div>

      {selectedAdm && (
        <div className="flex gap-3">
          {pending > 0 && <Badge className="bg-amber-100 text-amber-800 px-3 py-1">{pending} Pending</Badge>}
          {missed > 0 && <Badge className="bg-red-100 text-red-800 px-3 py-1">{missed} Missed</Badge>}
        </div>
      )}

      {selectedAdm && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Dose / Route</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Administered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Nurse</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  : (records as any[]).length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No MAR entries for this date</TableCell></TableRow>
                  : (records as any[]).map((rec: any) => (
                    <TableRow key={rec.id} className={rec.status === "missed" ? "bg-red-50" : rec.status === "given" ? "bg-green-50/40" : ""}>
                      <TableCell className="font-medium">{rec.medicineName}</TableCell>
                      <TableCell className="text-sm">{rec.dose || "—"} / {rec.route || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rec.frequency || "—"}</TableCell>
                      <TableCell className="text-sm">{rec.scheduledAt ? new Date(rec.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell className="text-sm">{rec.administeredAt ? new Date(rec.administeredAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                      <TableCell>
                        <Badge className={`flex items-center gap-1 w-fit ${STATUS_META[rec.status]?.color ?? ""}`}>
                          {STATUS_META[rec.status]?.icon}{rec.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{rec.nurseName || "—"}</TableCell>
                      <TableCell>
                        {rec.status === "pending" && (
                          <Button variant="outline" size="sm" onClick={() => { setShowUpdate(rec); setUpdateStatus("given"); setUpdateReason(""); }}>Update</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Schedule Dose Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Medication Dose</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Medicine *</Label>
              <Select value={form.medicineId} onValueChange={v => { const m = (medicines as any[]).find((x: any) => String(x.id) === v); setForm(f => ({ ...f, medicineId: v, medicineName: m?.name ?? "" })); }}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent className="max-h-48">{(medicines as any[]).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Dose</Label><Input value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} placeholder="e.g. 500mg" /></div>
              <div><Label>Route</Label>
                <Select value={form.route} onValueChange={v => setForm(f => ({ ...f, route: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROUTES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scheduled Date & Time *</Label><Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addMAR.mutate({ ...form, medicineId: Number(form.medicineId) })} disabled={!form.medicineId || !form.scheduledAt || addMAR.isPending}>Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Status Dialog */}
      <Dialog open={!!showUpdate} onOpenChange={() => setShowUpdate(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update — {showUpdate?.medicineName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Status *</Label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["given", "missed", "held", "refused", "returned"].map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {updateStatus !== "given" && <div><Label>Reason</Label><Input value={updateReason} onChange={e => setUpdateReason(e.target.value)} placeholder="Required for missed/held/refused" /></div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUpdate(null)}>Cancel</Button>
            <Button onClick={() => updateMAR.mutate({ id: showUpdate?.id, status: updateStatus, reason: updateReason })} disabled={updateMAR.isPending}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
