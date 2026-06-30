import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, Shield } from "lucide-react";

async function fetchImplants(patientId?: string) {
  const p = patientId ? `?patientId=${patientId}` : "";
  const r = await fetch(`/api/pharmacy/implants${p}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function fetchMedicines() {
  const r = await fetch("/api/pharmacy/medicines?limit=500", { credentials: "include" });
  if (!r.ok) return [];
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}
async function fetchPatients(q: string) {
  const r = await fetch(`/api/patients?search=${encodeURIComponent(q)}&limit=20`, { credentials: "include" });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : (Array.isArray(j?.patients) ? j.patients : []);
}

const SITES = ["Left Knee", "Right Knee", "Left Hip", "Right Hip", "Lumbar Spine", "Cervical Spine", "Left Shoulder", "Right Shoulder", "Cardiac", "Abdominal", "Other"];

export default function ImplantTrackingPage() {
  const qc = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [filterPatientId, setFilterPatientId] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    medicineId: "", medicineName: "", serialNo: "", batchNo: "", expiryDate: "",
    patientId: "", surgeonName: "", implantDate: new Date().toISOString().slice(0, 10),
    anatomicalSite: "", consentRef: "", purchaseRate: "", saleRate: "", mrp: "", notes: "",
  });

  const { data: implants = [], isLoading } = useQuery({
    queryKey: ["implants", filterPatientId],
    queryFn: () => fetchImplants(filterPatientId || undefined),
  });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });
  const { data: patients = [] } = useQuery({
    queryKey: ["patients-search", patientSearch],
    queryFn: () => fetchPatients(patientSearch),
    enabled: patientSearch.length >= 2,
  });

  const safeImplants = Array.isArray(implants) ? implants : [];
  const safeMedicines = Array.isArray(medicines) ? medicines : [];
  const safePatients = Array.isArray(patients) ? patients : [];

  const addImplant = useMutation({
    mutationFn: async (d: any) => {
      const r = await fetch("/api/pharmacy/implants", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(d) });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error); }
      return r.json();
    },
    onSuccess: () => { toast.success("Implant recorded"); qc.invalidateQueries({ queryKey: ["implants"] }); setShowAdd(false); setForm({ medicineId: "", medicineName: "", serialNo: "", batchNo: "", expiryDate: "", patientId: "", surgeonName: "", implantDate: new Date().toISOString().slice(0, 10), anatomicalSite: "", consentRef: "", purchaseRate: "", saleRate: "", mrp: "", notes: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Implant / High-Value Item Tracking</h1>
          <p className="text-sm text-muted-foreground">Patient-linked implant registry with serial number tracking</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="w-4 h-4 mr-1.5" />Record Implant</Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Filter by patient name…" className="pl-8 w-64" value={filterPatientId} onChange={e => setFilterPatientId(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Implant / Device</TableHead>
                <TableHead>Serial No</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Surgeon</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Sale Rate</TableHead>
                <TableHead>Consent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : safeImplants.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Shield className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p>No implants recorded yet</p>
                  </TableCell></TableRow>
                ) : safeImplants.map((imp: any) => (
                  <TableRow key={imp.id}>
                    <TableCell className="font-medium">{imp.medicineName}</TableCell>
                    <TableCell className="font-mono text-xs">{imp.serialNo || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{imp.batchNo || "—"}</TableCell>
                    <TableCell>{imp.patientName}</TableCell>
                    <TableCell>{imp.surgeonName || "—"}</TableCell>
                    <TableCell>{imp.anatomicalSite || "—"}</TableCell>
                    <TableCell>{imp.implantDate}</TableCell>
                    <TableCell className="text-right">₹{Number(imp.saleRate ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{imp.consentRef || "—"}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Record Implant / High-Value Device</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-4 max-h-[65vh] overflow-y-auto">
            <div className="col-span-2">
              <Label>Medicine / Implant *</Label>
              <Select value={form.medicineId} onValueChange={v => { const m = safeMedicines.find((x: any) => String(x.id) === v); setForm(f => ({ ...f, medicineId: v, medicineName: m?.name ?? "" })); }}>
                <SelectTrigger><SelectValue placeholder="Select implant medicine" /></SelectTrigger>
                <SelectContent className="max-h-48">{safeMedicines.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Serial Number</Label><Input value={form.serialNo} onChange={e => setForm(f => ({ ...f, serialNo: e.target.value }))} placeholder="Device serial no." /></div>
            <div><Label>Batch No</Label><Input value={form.batchNo} onChange={e => setForm(f => ({ ...f, batchNo: e.target.value }))} /></div>
            <div><Label>Expiry Date</Label><Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>
            <div>
              <Label>Patient *</Label>
              <Input
                placeholder="Search patient name…"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
              />
              {safePatients.length > 0 && !form.patientId && (
                <div className="border rounded mt-1 max-h-32 overflow-y-auto">
                  {safePatients.map((p: any) => (
                    <div key={p.id} className="px-3 py-1.5 hover:bg-muted cursor-pointer text-sm" onClick={() => { setForm(f => ({ ...f, patientId: String(p.id) })); setPatientSearch(p.name); }}>
                      {p.name} — {p.phone || p.uhid}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div><Label>Surgeon Name</Label><Input value={form.surgeonName} onChange={e => setForm(f => ({ ...f, surgeonName: e.target.value }))} /></div>
            <div><Label>Implant Date *</Label><Input type="date" value={form.implantDate} onChange={e => setForm(f => ({ ...f, implantDate: e.target.value }))} /></div>
            <div><Label>Anatomical Site</Label>
              <Select value={form.anatomicalSite} onValueChange={v => setForm(f => ({ ...f, anatomicalSite: v }))}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>{SITES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Purchase Rate (₹)</Label><Input type="number" value={form.purchaseRate} onChange={e => setForm(f => ({ ...f, purchaseRate: e.target.value }))} /></div>
            <div><Label>Sale Rate (₹)</Label><Input type="number" value={form.saleRate} onChange={e => setForm(f => ({ ...f, saleRate: e.target.value }))} /></div>
            <div><Label>MRP (₹)</Label><Input type="number" value={form.mrp} onChange={e => setForm(f => ({ ...f, mrp: e.target.value }))} /></div>
            <div><Label>Consent Ref</Label><Input value={form.consentRef} onChange={e => setForm(f => ({ ...f, consentRef: e.target.value }))} placeholder="Consent form number" /></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => addImplant.mutate({ ...form, medicineId: Number(form.medicineId), patientId: Number(form.patientId) })} disabled={!form.medicineId || !form.patientId || !form.implantDate || addImplant.isPending}>Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
