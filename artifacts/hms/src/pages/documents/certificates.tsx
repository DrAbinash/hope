import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Baby, FileText, Plus, Printer, Trash2, Pencil, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";

type CertType = "birth" | "death";
const today = () => new Date().toISOString().slice(0, 10);

interface Cert {
  id: number; certificateNo: string; type: CertType; issuedDate: string;
  patientId: number | null; patientName: string | null; uhid: string | null;
  details: any; issuedByName: string | null;
}

function useCerts(type: CertType, q: string) {
  return useQuery<{ total: number; rows: Cert[] }>({
    queryKey: ["/api/certificates", type, q],
    queryFn: async () => {
      const u = new URL("/api/certificates", window.location.origin);
      u.searchParams.set("type", type);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
}

function PatientPicker({ value, onChange }: { value: number | null; onChange: (id: number | null, p?: any) => void }) {
  const [s, setS] = useState("");
  const { data } = useQuery<any[]>({
    queryKey: ["/api/patients/search", s],
    queryFn: async () => {
      if (!s || s.length < 2) return [];
      const r = await fetch(`/api/patients?search=${encodeURIComponent(s)}`, { credentials: "include" });
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.rows || []);
    },
    enabled: s.length >= 2,
  });
  return (
    <div>
      <Input placeholder="Search patient by name/UHID/phone (optional)…" value={s} onChange={e => setS(e.target.value)} />
      {value && <p className="text-xs text-emerald-700 mt-1">Linked patient #{value}. <button type="button" className="underline" onClick={() => onChange(null)}>clear</button></p>}
      {!!(data || []).length && (
        <div className="border rounded mt-1 max-h-40 overflow-auto bg-popover">
          {(data || []).slice(0, 8).map((p: any) => (
            <button key={p.id} type="button" className="w-full text-left px-2 py-1 text-sm hover:bg-accent flex justify-between"
              onClick={() => { onChange(p.id, p); setS(""); }}>
              <span>{p.name}</span><span className="font-mono text-xs text-muted-foreground">{p.uhid}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BirthForm({ initial, onSave, onCancel, saving }: any) {
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate || today());
  const [patientId, setPatientId] = useState<number | null>(initial?.patientId ?? null);
  const d0 = initial?.details || {};
  const [d, setD] = useState<any>({
    childName: d0.childName || "",
    sex: d0.sex || "Male",
    dob: d0.dob || today(),
    timeOfBirth: d0.timeOfBirth || "",
    placeOfBirth: d0.placeOfBirth || "Hope Hospital",
    motherName: d0.motherName || "",
    motherAge: d0.motherAge || "",
    fatherName: d0.fatherName || "",
    address: d0.address || "",
    weightKg: d0.weightKg || "",
    deliveryType: d0.deliveryType || "Normal",
    attendedBy: d0.attendedBy || "",
    religion: d0.religion || "",
    nationality: d0.nationality || "Indian",
  });
  const set = (k: string, v: any) => setD((s: any) => ({ ...s, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Issued Date *</Label><Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} /></div>
        <div><Label>Place of Birth</Label><Input value={d.placeOfBirth} onChange={e => set("placeOfBirth", e.target.value)} /></div>
        <div className="col-span-2"><Label>Linked Patient (optional)</Label><PatientPicker value={patientId} onChange={(id) => setPatientId(id)} /></div>
        <div><Label>Child's Name *</Label><Input value={d.childName} onChange={e => set("childName", e.target.value)} /></div>
        <div><Label>Sex *</Label>
          <Select value={d.sex} onValueChange={v => set("sex", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Date of Birth *</Label><Input type="date" value={d.dob} onChange={e => set("dob", e.target.value)} /></div>
        <div><Label>Time of Birth</Label><Input type="time" value={d.timeOfBirth} onChange={e => set("timeOfBirth", e.target.value)} /></div>
        <div><Label>Mother's Name *</Label><Input value={d.motherName} onChange={e => set("motherName", e.target.value)} /></div>
        <div><Label>Mother's Age</Label><Input type="number" value={d.motherAge} onChange={e => set("motherAge", e.target.value)} /></div>
        <div><Label>Father's Name</Label><Input value={d.fatherName} onChange={e => set("fatherName", e.target.value)} /></div>
        <div><Label>Religion</Label><Input value={d.religion} onChange={e => set("religion", e.target.value)} /></div>
        <div><Label>Weight (kg)</Label><Input type="number" step="0.01" value={d.weightKg} onChange={e => set("weightKg", e.target.value)} /></div>
        <div><Label>Type of Delivery</Label>
          <Select value={d.deliveryType} onValueChange={v => set("deliveryType", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Normal">Normal</SelectItem><SelectItem value="C-Section">C-Section</SelectItem>
              <SelectItem value="Forceps">Forceps</SelectItem><SelectItem value="Vacuum">Vacuum</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>Attended By (Doctor)</Label><Input value={d.attendedBy} onChange={e => set("attendedBy", e.target.value)} /></div>
        <div><Label>Nationality</Label><Input value={d.nationality} onChange={e => set("nationality", e.target.value)} /></div>
      </div>
      <div><Label>Address</Label><Textarea rows={2} value={d.address} onChange={e => set("address", e.target.value)} /></div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving} onClick={() => onSave({ issuedDate, patientId, details: d })}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </div>
  );
}

function DeathForm({ initial, onSave, onCancel, saving }: any) {
  const [issuedDate, setIssuedDate] = useState(initial?.issuedDate || today());
  const [patientId, setPatientId] = useState<number | null>(initial?.patientId ?? null);
  const d0 = initial?.details || {};
  const [d, setD] = useState<any>({
    deceasedName: d0.deceasedName || "",
    sex: d0.sex || "Male",
    age: d0.age || "",
    dod: d0.dod || today(),
    timeOfDeath: d0.timeOfDeath || "",
    placeOfDeath: d0.placeOfDeath || "Hope Hospital",
    causeOfDeath: d0.causeOfDeath || "",
    attendedBy: d0.attendedBy || "",
    fatherOrSpouse: d0.fatherOrSpouse || "",
    address: d0.address || "",
    religion: d0.religion || "",
    nationality: d0.nationality || "Indian",
  });
  const set = (k: string, v: any) => setD((s: any) => ({ ...s, [k]: v }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Issued Date *</Label><Input type="date" value={issuedDate} onChange={e => setIssuedDate(e.target.value)} /></div>
        <div><Label>Place of Death</Label><Input value={d.placeOfDeath} onChange={e => set("placeOfDeath", e.target.value)} /></div>
        <div className="col-span-2"><Label>Linked Patient (optional)</Label><PatientPicker value={patientId} onChange={(id, p) => { setPatientId(id); if (p) setD((s: any) => ({ ...s, deceasedName: p.name, age: p.age, sex: p.gender, address: p.address || s.address })); }} /></div>
        <div><Label>Deceased Name *</Label><Input value={d.deceasedName} onChange={e => set("deceasedName", e.target.value)} /></div>
        <div><Label>Sex *</Label>
          <Select value={d.sex} onValueChange={v => set("sex", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>Age</Label><Input type="number" value={d.age} onChange={e => set("age", e.target.value)} /></div>
        <div><Label>Date of Death *</Label><Input type="date" value={d.dod} onChange={e => set("dod", e.target.value)} /></div>
        <div><Label>Time of Death</Label><Input type="time" value={d.timeOfDeath} onChange={e => set("timeOfDeath", e.target.value)} /></div>
        <div><Label>Father / Spouse Name</Label><Input value={d.fatherOrSpouse} onChange={e => set("fatherOrSpouse", e.target.value)} /></div>
        <div><Label>Religion</Label><Input value={d.religion} onChange={e => set("religion", e.target.value)} /></div>
        <div><Label>Nationality</Label><Input value={d.nationality} onChange={e => set("nationality", e.target.value)} /></div>
        <div><Label>Attended By (Doctor)</Label><Input value={d.attendedBy} onChange={e => set("attendedBy", e.target.value)} /></div>
      </div>
      <div><Label>Cause of Death *</Label><Textarea rows={2} value={d.causeOfDeath} onChange={e => set("causeOfDeath", e.target.value)} /></div>
      <div><Label>Address</Label><Textarea rows={2} value={d.address} onChange={e => set("address", e.target.value)} /></div>
      <DialogFooter>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={saving} onClick={() => onSave({ issuedDate, patientId, details: d })}>{saving ? "Saving…" : "Save"}</Button>
      </DialogFooter>
    </div>
  );
}

function PrintView({ cert }: { cert: Cert }) {
  const d = cert.details || {};
  const isB = cert.type === "birth";
  const subject = isB ? d.childName : d.deceasedName;
  return (
    <div className="bg-white text-black p-10 print:p-0 mx-auto" style={{ maxWidth: 800 }}>
      <style>{`@media print { @page { size: A4; margin: 16mm; } .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="text-center border-b-4 border-double pb-3 mb-6">
        <h1 className="text-2xl font-bold">CarePlus Hospital Management</h1>
        <p className="text-sm">Hope Hospital</p>
        <h2 className="text-xl font-bold mt-3 uppercase tracking-wider">{isB ? "Certificate of Birth" : "Certificate of Death"}</h2>
        <p className="text-xs mt-1">Certificate No: <span className="font-mono">{cert.certificateNo}</span></p>
      </div>
      <p className="mb-4">This is to certify that <b className="uppercase">{subject || "—"}</b>{" "}
        {isB
          ? <> was born on <b>{d.dob}</b>{d.timeOfBirth ? <> at <b>{d.timeOfBirth}</b></> : null} at <b>{d.placeOfBirth || "—"}</b>.</>
          : <> aged <b>{d.age || "—"}</b> years, expired on <b>{d.dod}</b>{d.timeOfDeath ? <> at <b>{d.timeOfDeath}</b></> : null} at <b>{d.placeOfDeath || "—"}</b>.</>}
      </p>
      <table className="w-full text-sm border-collapse">
        <tbody>
          {isB ? (
            <>
              <tr><td className="border p-2 w-1/3 font-semibold">Child's Name</td><td className="border p-2">{d.childName}</td></tr>
              <tr><td className="border p-2 font-semibold">Sex</td><td className="border p-2">{d.sex}</td></tr>
              <tr><td className="border p-2 font-semibold">Date / Time of Birth</td><td className="border p-2">{d.dob} {d.timeOfBirth}</td></tr>
              <tr><td className="border p-2 font-semibold">Place of Birth</td><td className="border p-2">{d.placeOfBirth}</td></tr>
              <tr><td className="border p-2 font-semibold">Mother's Name</td><td className="border p-2">{d.motherName} {d.motherAge ? `(${d.motherAge} yrs)` : ""}</td></tr>
              <tr><td className="border p-2 font-semibold">Father's Name</td><td className="border p-2">{d.fatherName || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Address</td><td className="border p-2">{d.address || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Weight at Birth</td><td className="border p-2">{d.weightKg ? `${d.weightKg} kg` : "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Type of Delivery</td><td className="border p-2">{d.deliveryType || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Attended By</td><td className="border p-2">{d.attendedBy || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Religion / Nationality</td><td className="border p-2">{d.religion || "—"} / {d.nationality || "—"}</td></tr>
            </>
          ) : (
            <>
              <tr><td className="border p-2 w-1/3 font-semibold">Deceased Name</td><td className="border p-2">{d.deceasedName}</td></tr>
              <tr><td className="border p-2 font-semibold">Sex / Age</td><td className="border p-2">{d.sex} / {d.age}</td></tr>
              <tr><td className="border p-2 font-semibold">Father / Spouse</td><td className="border p-2">{d.fatherOrSpouse || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Date / Time of Death</td><td className="border p-2">{d.dod} {d.timeOfDeath}</td></tr>
              <tr><td className="border p-2 font-semibold">Place of Death</td><td className="border p-2">{d.placeOfDeath}</td></tr>
              <tr><td className="border p-2 font-semibold">Cause of Death</td><td className="border p-2">{d.causeOfDeath}</td></tr>
              <tr><td className="border p-2 font-semibold">Attended By</td><td className="border p-2">{d.attendedBy || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Address</td><td className="border p-2">{d.address || "—"}</td></tr>
              <tr><td className="border p-2 font-semibold">Religion / Nationality</td><td className="border p-2">{d.religion || "—"} / {d.nationality || "—"}</td></tr>
            </>
          )}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
        <div><p className="border-t pt-2">Patient / Relative Signature</p></div>
        <div className="text-right"><p className="border-t pt-2">Authorised Signatory<br /><span className="text-xs">Issued: {cert.issuedDate}{cert.issuedByName ? ` by ${cert.issuedByName}` : ""}</span></p></div>
      </div>
      <div className="text-center mt-8 no-print">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </div>
    </div>
  );
}

function CertList({ type }: { type: CertType }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canWrite = ["admin", "doctor", "receptionist"].includes(user?.role || "");
  const [q, setQ] = useState("");
  const { data, isLoading } = useCerts(type, q);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cert | null>(null);
  const [printing, setPrinting] = useState<Cert | null>(null);
  const [confirmDel, setConfirmDel] = useState<Cert | null>(null);

  const save = useMutation({
    mutationFn: async (payload: any) => {
      const url = editing ? `/api/certificates/${editing.id}` : "/api/certificates";
      const method = editing ? "PUT" : "POST";
      const body = editing ? payload : { type, ...payload };
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      return j;
    },
    onSuccess: (j) => {
      toast.success(editing ? "Certificate updated" : `Certificate ${j.certificateNo} issued`);
      qc.invalidateQueries({ queryKey: ["/api/certificates"] });
      setOpen(false); setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/certificates/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["/api/certificates"] }); setConfirmDel(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const Title = type === "birth" ? "Birth Certificate" : "Death Certificate";
  const Icon = type === "birth" ? Baby : FileText;
  const Form = type === "birth" ? BirthForm : DeathForm;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
        <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {Title}s ({data?.total ?? 0})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute top-2.5 left-2 text-muted-foreground" />
            <Input className="pl-7 w-64" placeholder="Search by name / cert no…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          {canWrite && (
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New {Title}</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editing ? `Edit ${Title}` : `Issue ${Title}`}</DialogTitle></DialogHeader>
                <Form initial={editing} saving={save.isPending} onSave={(v: any) => save.mutate(v)} onCancel={() => { setOpen(false); setEditing(null); }} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Cert No.</TableHead>
            <TableHead>Issued</TableHead>
            <TableHead>{type === "birth" ? "Child" : "Deceased"}</TableHead>
            <TableHead>Sex</TableHead>
            <TableHead>{type === "birth" ? "DOB" : "DOD"}</TableHead>
            <TableHead>Linked Patient</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((c) => {
              const d = c.details || {};
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.certificateNo}</TableCell>
                  <TableCell>{c.issuedDate}</TableCell>
                  <TableCell className="font-medium">{type === "birth" ? d.childName : d.deceasedName}</TableCell>
                  <TableCell>{d.sex}</TableCell>
                  <TableCell>{type === "birth" ? d.dob : d.dod}</TableCell>
                  <TableCell className="text-sm">{c.patientName ? <>{c.patientName} <span className="font-mono text-xs text-muted-foreground">({c.uhid})</span></> : "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setPrinting(c)}><Printer className="h-3.5 w-3.5" /></Button>
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => setConfirmDel(c)}><Trash2 className="h-3.5 w-3.5 text-rose-600" /></Button>}
                  </TableCell>
                </TableRow>
              );
            })}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No certificates issued yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={!!printing} onOpenChange={(o) => { if (!o) setPrinting(null); }}>
        <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
          <DialogHeader className="no-print"><DialogTitle>Certificate Preview</DialogTitle></DialogHeader>
          {printing && <PrintView cert={printing} />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => { if (!o) setConfirmDel(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete certificate?</AlertDialogTitle>
            <AlertDialogDescription>{confirmDel?.certificateNo} — this cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function CertificatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FileText className="h-6 w-6" /> Documents</h2>
        <p className="text-muted-foreground text-sm">Issue and reprint Birth &amp; Death Certificates.</p>
      </div>
      <Tabs defaultValue="birth">
        <TabsList>
          <TabsTrigger value="birth"><Baby className="h-4 w-4 mr-2" />Birth Certificate</TabsTrigger>
          <TabsTrigger value="death"><FileText className="h-4 w-4 mr-2" />Death Certificate</TabsTrigger>
        </TabsList>
        <TabsContent value="birth" className="mt-4"><CertList type="birth" /></TabsContent>
        <TabsContent value="death" className="mt-4"><CertList type="death" /></TabsContent>
      </Tabs>
    </div>
  );
}
