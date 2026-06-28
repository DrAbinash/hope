import { useState } from "react";
import { useListDoctors } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, Stethoscope, Pencil } from "lucide-react";
import { ImageUpload } from "@/components/image-upload";
import { toServedUrl } from "@/lib/asset-url";

interface DoctorForm {
  name: string;
  specialization: string;
  qualification: string;
  phone: string;
  email: string;
  registrationNo: string;
  opdFee: string;
  signatureUrl: string | null;
}

const emptyForm: DoctorForm = { name: "", specialization: "", qualification: "", phone: "", email: "", registrationNo: "", opdFee: "", signatureUrl: null };

export default function DoctorsPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  const qc = useQueryClient();
  const { data: doctors, isLoading } = useListDoctors();

  const filtered = search
    ? (doctors || []).filter((d: any) => d.name?.toLowerCase().includes(search.toLowerCase()) || d.specialization?.toLowerCase().includes(search.toLowerCase()))
    : (doctors || []);

  function startAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function startEdit(d: any) {
    setEditingId(d.id);
    setForm({
      name: d.name || "",
      specialization: d.specialization || "",
      qualification: d.qualification || "",
      phone: d.phone || "",
      email: d.email || "",
      registrationNo: d.registrationNo || "",
      opdFee: d.opdFee != null ? String(d.opdFee) : "",
      signatureUrl: d.signatureUrl || null,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.specialization) { toast.error("Name and specialization are required"); return; }
    setSubmitting(true);
    try {
      const url = editingId ? `/api/doctors/${editingId}` : "/api/doctors";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, opdFee: parseFloat(form.opdFee) || 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success(editingId ? "Doctor updated" : "Doctor added");
      setOpen(false);
      setForm(emptyForm);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["/api/doctors"] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Doctors Registry</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} doctors registered</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditingId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button onClick={startAdd} data-testid="add-doctor"><Plus className="mr-2 h-4 w-4" />Add Doctor</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>{editingId ? "Edit Doctor" : "Add New Doctor"}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Name" data-testid="doctor-name" /></div>
                <div className="space-y-2"><Label>Specialization *</Label><Input value={form.specialization} onChange={e => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g. Cardiology" data-testid="doctor-specialization" /></div>
                <div className="space-y-2"><Label>Qualification</Label><Input value={form.qualification} onChange={e => setForm(f => ({ ...f, qualification: e.target.value }))} placeholder="MBBS, MD" /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit number" /></div>
                <div className="space-y-2"><Label>OPD Fee (₹)</Label><Input type="number" value={form.opdFee} onChange={e => setForm(f => ({ ...f, opdFee: e.target.value }))} placeholder="0" /></div>
                <div className="space-y-2"><Label>Registration No</Label><Input value={form.registrationNo} onChange={e => setForm(f => ({ ...f, registrationNo: e.target.value }))} /></div>
                <div className="col-span-2 space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="col-span-2 space-y-2">
                  <Label>Signature Image</Label>
                  <p className="text-xs text-muted-foreground">Prints at the bottom-left of every prescription. Suggested: transparent PNG, ~400×120 px.</p>
                  <ImageUpload
                    label="Signature"
                    value={form.signatureUrl}
                    onChange={(p) => setForm(f => ({ ...f, signatureUrl: p }))}
                    previewClassName="max-h-16"
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} data-testid="submit-doctor">{submitting ? "Saving…" : editingId ? "Save Changes" : "Add Doctor"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name or specialization..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Qualification</TableHead>
                <TableHead>Reg. No</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>OPD Fee</TableHead>
                <TableHead>Signature</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">No doctors found.</TableCell></TableRow>
              ) : (
                filtered.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/10 rounded-full p-1.5"><Stethoscope className="h-3 w-3 text-primary" /></div>
                        <span className="font-semibold">{d.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{d.specialization}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.qualification || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{d.registrationNo || "—"}</TableCell>
                    <TableCell>{d.phone || "—"}</TableCell>
                    <TableCell>₹{parseFloat(d.opdFee || "0").toLocaleString()}</TableCell>
                    <TableCell>
                      {toServedUrl(d.signatureUrl)
                        ? <img src={toServedUrl(d.signatureUrl)} alt="sig" className="h-8 max-w-[120px] object-contain" />
                        : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                        {d.isActive ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(d)} data-testid={`edit-doctor-${d.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
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
