import { useEffect, useState } from "react";
import { useListPrescriptionTemplates, useListDoctors } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { MedicineSearch, type MedicineLite } from "@/components/medicine-search";
import { ChipRow, HINDI_DOSE, HINDI_TIMING, HINDI_FREQ } from "@/components/hindi-chips";

interface RxItem {
  medicineId?: number; medicineName: string; genericName?: string;
  dose: string; timing: string; frequency: string; duration: string; qty: string; notes: string;
}

interface FormState {
  doctorId: string; name: string; chiefComplaints: string; diagnosis: string;
  labTests: string; radiologyTests: string; advise: string; specialAdvise: string; followUpDays: string;
  medicines: RxItem[];
}

const EMPTY_FORM: FormState = {
  doctorId: "", name: "", chiefComplaints: "", diagnosis: "",
  labTests: "", radiologyTests: "", advise: "", specialAdvise: "", followUpDays: "", medicines: [],
};

export default function PrescriptionTemplatesPage() {
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const qc = useQueryClient();

  const params = doctorFilter && doctorFilter !== "all" ? { doctorId: parseInt(doctorFilter) } : {};
  const { data: templates, isLoading } = useListPrescriptionTemplates(params);
  const { data: doctors } = useListDoctors();

  const filtered = search
    ? (templates || []).filter((t: any) => t.name?.toLowerCase().includes(search.toLowerCase()) || t.diagnosis?.toLowerCase().includes(search.toLowerCase()))
    : (templates || []);

  function openNew() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }
  function openEdit(t: any) {
    setEditId(t.id);
    setForm({
      doctorId: t.doctorId ? String(t.doctorId) : "",
      name: t.name || "",
      chiefComplaints: t.chiefComplaints || "",
      diagnosis: t.diagnosis || "",
      labTests: t.labTests || "",
      radiologyTests: t.radiologyTests || "",
      advise: t.advise || "",
      specialAdvise: t.specialAdvise || "",
      followUpDays: t.followUpDays != null ? String(t.followUpDays) : "",
      medicines: (Array.isArray(t.medicines) ? t.medicines : []).map((m: any) => ({
        medicineId: m.medicineId,
        medicineName: m.medicineName || m.name || "",
        genericName: m.genericName,
        dose: m.dose || "",
        timing: m.timing || m.when || "",
        frequency: m.frequency || "",
        duration: m.duration || "",
        qty: m.qty != null ? String(m.qty) : "",
        notes: m.notes || m.instructions || "",
      })),
    });
    setOpen(true);
  }

  function addMed(m: MedicineLite) {
    setForm(f => ({ ...f, medicines: [...f.medicines, { medicineId: m.id, medicineName: m.name, genericName: m.genericName || undefined, dose: "", timing: "", frequency: "", duration: "", qty: "", notes: "" }] }));
  }
  function updateMed(i: number, patch: Partial<RxItem>) {
    setForm(f => ({ ...f, medicines: f.medicines.map((r, idx) => idx === i ? { ...r, ...patch } : r) }));
  }
  function removeMed(i: number) {
    setForm(f => ({ ...f, medicines: f.medicines.filter((_, idx) => idx !== i) }));
  }
  function appendChip(field: "dose" | "timing" | "frequency", i: number, value: string) {
    const cur = form.medicines[i][field];
    const next = cur && cur.trim() ? `${cur} ${value}` : value;
    updateMed(i, { [field]: next } as Partial<RxItem>);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) { toast.error("Template name is required"); return; }
    setSubmitting(true);
    try {
      const body = {
        ...form,
        doctorId: form.doctorId ? parseInt(form.doctorId) : null,
        followUpDays: form.followUpDays ? parseInt(form.followUpDays) : null,
        medicines: form.medicines.map(m => ({ ...m, qty: m.qty ? Number(m.qty) : undefined })),
      };
      const url = editId ? `/api/prescription-templates/${editId}` : "/api/prescription-templates";
      const res = await fetch(url, {
        method: editId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editId ? "Template updated" : "Template created");
      setOpen(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      qc.invalidateQueries({ queryKey: ["/api/prescription-templates"] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(t: any) {
    if (!window.confirm(`Delete template "${t.name}"?`)) return;
    try {
      const res = await fetch(`/api/prescription-templates/${t.id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok && res.status !== 204) throw new Error(await res.text());
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["/api/prescription-templates"] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Prescription Templates</h2>
          <p className="text-muted-foreground text-sm">Reusable prescription patterns — apply during OPD with one click.</p>
        </div>
        <Button onClick={openNew} data-testid="new-template"><Plus className="mr-2 h-4 w-4" />New Template</Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(EMPTY_FORM); } }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Template" : "Create Prescription Template"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Viral Fever Protocol" data-testid="tpl-name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Doctor (optional)</Label>
                  <Select value={form.doctorId} onValueChange={v => setForm(f => ({ ...f, doctorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="All doctors" /></SelectTrigger>
                    <SelectContent>
                      {(doctors || []).map((d: any) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Follow-up Days</Label>
                  <Input type="number" value={form.followUpDays} onChange={e => setForm(f => ({ ...f, followUpDays: e.target.value }))} placeholder="7" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chief Complaints</Label>
                <Textarea rows={2} value={form.chiefComplaints} onChange={e => setForm(f => ({ ...f, chiefComplaints: e.target.value }))} placeholder="Common presenting complaints..." />
              </div>
              <div className="space-y-2">
                <Label>Diagnosis</Label>
                <Textarea rows={2} value={form.diagnosis} onChange={e => setForm(f => ({ ...f, diagnosis: e.target.value }))} placeholder="Diagnosis" />
              </div>
              <div className="space-y-2">
                <Label>Lab Tests</Label>
                <Textarea rows={2} value={form.labTests} onChange={e => setForm(f => ({ ...f, labTests: e.target.value }))} placeholder="CBC, LFT, ..." />
              </div>
              <div className="space-y-2">
                <Label>Radiology</Label>
                <Textarea rows={2} value={form.radiologyTests} onChange={e => setForm(f => ({ ...f, radiologyTests: e.target.value }))} placeholder="X-ray, USG, ..." />
              </div>
              <div className="space-y-2">
                <Label>Advise</Label>
                <Textarea rows={2} value={form.advise} onChange={e => setForm(f => ({ ...f, advise: e.target.value }))} placeholder="Patient instructions..." />
              </div>
              <div className="space-y-2">
                <Label>Special Advise</Label>
                <Textarea rows={2} value={form.specialAdvise} onChange={e => setForm(f => ({ ...f, specialAdvise: e.target.value }))} placeholder="Diet/lifestyle/precautions..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Medicines</Label>
              <MedicineSearch onSelect={addMed} />
              {form.medicines.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">No medicines yet — search above to add.</div>
              ) : (
                <div className="space-y-2">
                  {form.medicines.map((r, i) => (
                    <div key={i} className="border rounded-md p-2 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{i + 1}. {r.medicineName}</div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMed(i)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                      <div className="grid grid-cols-5 gap-1.5">
                        <div>
                          <Input value={r.dose} onChange={e => updateMed(i, { dose: e.target.value })} placeholder="Dose" className="h-7 text-xs" />
                          <ChipRow items={HINDI_DOSE} onPick={v => appendChip("dose", i, v)} />
                        </div>
                        <div>
                          <Input value={r.timing} onChange={e => updateMed(i, { timing: e.target.value })} placeholder="When" className="h-7 text-xs" />
                          <ChipRow items={HINDI_TIMING} onPick={v => appendChip("timing", i, v)} />
                        </div>
                        <div>
                          <Input value={r.frequency} onChange={e => updateMed(i, { frequency: e.target.value })} placeholder="Frequency" className="h-7 text-xs" />
                          <ChipRow items={HINDI_FREQ} onPick={v => appendChip("frequency", i, v)} />
                        </div>
                        <Input value={r.duration} onChange={e => updateMed(i, { duration: e.target.value })} placeholder="Duration" className="h-7 text-xs" />
                        <Input value={r.qty} onChange={e => updateMed(i, { qty: e.target.value.replace(/[^0-9]/g, "") })} placeholder="Qty" inputMode="numeric" className="h-7 text-xs" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : (editId ? "Update Template" : "Create Template")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={doctorFilter} onValueChange={setDoctorFilter}>
              <SelectTrigger className="w-48"><SelectValue placeholder="All doctors" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {(doctors || []).map((d: any) => (
                  <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Template Name</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead>Medicines</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No templates found.</TableCell></TableRow>
              ) : (
                filtered.map((t: any) => (
                  <TableRow key={t.id} data-testid={`tpl-row-${t.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold">{t.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{t.doctorId ? "Doctor-specific" : "General"}</Badge></TableCell>
                    <TableCell className="text-sm">{t.diagnosis || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{Array.isArray(t.medicines) ? t.medicines.length : 0} medicines</Badge>
                    </TableCell>
                    <TableCell>{t.followUpDays ? `${t.followUpDays} days` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)} data-testid={`tpl-edit-${t.id}`}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t)} data-testid={`tpl-delete-${t.id}`}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
