import { useState } from "react";
import { useListOpdVisits, useListPatients, useListDoctors } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "wouter";
import { Plus, Search, Eye } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  converted: "bg-blue-100 text-blue-800",
};

export default function OPDPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ patientId: "", doctorId: "", visitDate: new Date().toISOString().slice(0, 10), chiefComplaints: "", fee: "" });
  const qc = useQueryClient();

  const { data, isLoading } = useListOpdVisits({});
  const { data: patientsData } = useListPatients({});
  const { data: doctors } = useListDoctors();

  const visits = data?.visits || [];
  const filtered = search
    ? visits.filter(v =>
        v.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        v.doctorName?.toLowerCase().includes(search.toLowerCase()) ||
        v.visitNo?.toLowerCase().includes(search.toLowerCase())
      )
    : visits;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patientId || !form.doctorId) { toast.error("Patient and doctor are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/opd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...form, patientId: parseInt(form.patientId), doctorId: parseInt(form.doctorId), fee: parseFloat(form.fee) || 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("OPD visit registered");
      setOpen(false);
      setForm({ patientId: "", doctorId: "", visitDate: new Date().toISOString().slice(0, 10), chiefComplaints: "", fee: "" });
      qc.invalidateQueries({ queryKey: ["/api/opd"] });
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
          <h2 className="text-2xl font-bold tracking-tight">OPD Queue</h2>
          <p className="text-muted-foreground text-sm">Outpatient Department visits</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />New OPD Visit</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Register New OPD Visit</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Patient *</Label>
                <Select value={form.patientId} onValueChange={v => setForm(f => ({ ...f, patientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                  <SelectContent>
                    {patientsData?.patients.map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.uhid})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Doctor *</Label>
                <Select value={form.doctorId} onValueChange={v => setForm(f => ({ ...f, doctorId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors?.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.name} — {d.specialization}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Visit Date</Label>
                  <Input type="date" value={form.visitDate} onChange={e => setForm(f => ({ ...f, visitDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Fee (₹)</Label>
                  <Input type="number" placeholder="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Chief Complaints</Label>
                <Textarea placeholder="Patient's complaints..." value={form.chiefComplaints} onChange={e => setForm(f => ({ ...f, chiefComplaints: e.target.value }))} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Register"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by patient, doctor, visit no..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visit No</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Chief Complaints</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No OPD visits found.</TableCell></TableRow>
              ) : (
                filtered.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs font-medium">{v.visitNo}</TableCell>
                    <TableCell className="font-semibold">{v.patientName}</TableCell>
                    <TableCell>{v.doctorName}</TableCell>
                    <TableCell>{v.visitDate}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{v.chiefComplaints || "—"}</TableCell>
                    <TableCell>₹{parseFloat(String(v.fee || "0")).toLocaleString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status || "pending"] || "bg-gray-100 text-gray-700"}`}>
                        {v.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/opd/${v.id}`}><Eye className="h-4 w-4 mr-1" />View</Link>
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
