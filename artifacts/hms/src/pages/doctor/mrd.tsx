import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Download, Trash2, Search, Upload, FolderArchive } from "lucide-react";

interface Patient { id: number; uhid: string; name: string; phone: string }
interface PatientDoc {
  id: number; patientId: number; documentDate: string; reportName: string;
  fileName: string; mimeType: string; fileSize: number; remark: string | null; uploadedAt: string;
}

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = ".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtSize(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function PatientPicker({ value, onChange, label }: { value: Patient | null; onChange: (p: Patient | null) => void; label: string }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(q, 200);
  const { data } = useQuery<{ patients: Patient[] }>({
    queryKey: ["/api/patients", debounced],
    queryFn: async () => {
      const r = await fetch(`/api/patients?search=${encodeURIComponent(debounced)}&limit=10`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: debounced.length >= 2,
  });
  const safePatients = Array.isArray(data?.patients) ? data.patients : [];
  return (
    <div className="relative">
      <Label>{label}</Label>
      <Input
        value={value ? `${value.name} (${value.uhid})` : q}
        onChange={(e) => { onChange(null); setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search by Reg No., name or phone"
      />
      {open && debounced.length >= 2 && safePatients.length ? (
        <div className="absolute z-30 mt-1 w-full bg-popover border rounded-md shadow-md max-h-64 overflow-auto">
          {safePatients.map((p) => (
            <button
              type="button"
              key={p.id}
              onMouseDown={(e) => { e.preventDefault(); onChange(p); setQ(""); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground">{p.uhid} · {p.phone}</div>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function useDebounced<T>(v: T, ms: number) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function MrdPage() {
  const qc = useQueryClient();
  const [uploadPatient, setUploadPatient] = useState<Patient | null>(null);
  const [searchPatient, setSearchPatient] = useState<Patient | null>(null);
  const [date, setDate] = useState(todayStr());
  const [reportName, setReportName] = useState("");
  const [remark, setRemark] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const { data: docs = [], isLoading } = useQuery<PatientDoc[]>({
    queryKey: ["/api/patient-documents", searchPatient?.id],
    queryFn: async () => {
      const r = await fetch(`/api/patient-documents?patientId=${searchPatient!.id}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: !!searchPatient,
  });

  const upload = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error("Please choose a file");
      if (file.size > MAX_BYTES) throw new Error("File exceeds 4 MB limit");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("patientId", String(uploadPatient!.id));
      fd.append("documentDate", date);
      fd.append("reportName", reportName.trim());
      if (remark.trim()) fd.append("remark", remark.trim());
      const r = await fetch("/api/patient-documents", { method: "POST", credentials: "include", body: fd });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      toast.success("Document uploaded");
      setReportName(""); setRemark(""); setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      if (uploadPatient && searchPatient && uploadPatient.id === searchPatient.id) {
        qc.invalidateQueries({ queryKey: ["/api/patient-documents", searchPatient.id] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/patient-documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    },
    onSuccess: () => {
      toast.success("Document deleted");
      qc.invalidateQueries({ queryKey: ["/api/patient-documents", searchPatient?.id] });
      setDelId(null);
    },
    onError: (e: Error) => { toast.error(e.message); setDelId(null); },
  });

  function submit() {
    if (!uploadPatient) { toast.error("Please select a patient"); return; }
    if (!date) { toast.error("Date is required"); return; }
    if (!reportName.trim()) { toast.error("Report Name is required"); return; }
    if (!fileRef.current?.files?.[0]) { toast.error("Please choose a file"); return; }
    upload.mutate();
  }

  const totalSize = useMemo(() => docs.reduce((s, d) => s + d.fileSize, 0), [docs]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><FolderArchive className="h-6 w-6" /> Medical Records (MRD)</h2>
        <p className="text-muted-foreground text-sm">Doctor → Report → MRD · Upload and search patient documents</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Upload Patient Documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <PatientPicker value={uploadPatient} onChange={setUploadPatient} label="Name / Reg No. *" />
            <div><Label>Report Name *</Label><Input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. MRI Brain Report" /></div>
            <div>
              <Label>Choose File *</Label>
              <Input ref={fileRef} type="file" accept={ACCEPT} onChange={(e) => setFileName(e.target.files?.[0]?.name || "")} />
              <p className="text-xs text-muted-foreground mt-1">Max size 4 MB. Only PDF and Excel allowed.{fileName ? ` · ${fileName}` : ""}</p>
            </div>
            <div><Label>Remark</Label><Textarea rows={2} value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
            <Button onClick={submit} disabled={upload.isPending} className="w-full">
              {upload.isPending ? "Uploading…" : "Save"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Search Uploaded Patient Documents</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <PatientPicker value={searchPatient} onChange={setSearchPatient} label="Name / Reg No." />
            {searchPatient && (
              <div className="text-xs text-muted-foreground">
                {docs.length} document{docs.length === 1 ? "" : "s"} · total {fmtSize(totalSize)}
              </div>
            )}
            <div className="border rounded-md max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Report</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead className="w-32 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!searchPatient ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Search a patient to view their documents.</TableCell></TableRow>
                  ) : isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : docs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No documents uploaded yet.</TableCell></TableRow>
                  ) : docs.map((d, i) => (
                    <TableRow key={d.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm">{d.documentDate}</TableCell>
                      <TableCell>
                        <div className="font-medium">{d.reportName}</div>
                        {d.remark && <div className="text-xs text-muted-foreground">{d.remark}</div>}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{d.fileName}</div>
                        <div className="text-xs text-muted-foreground">{fmtSize(d.fileSize)}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <a href={`/api/patient-documents/${d.id}/download`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                        </a>
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDelId(d.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={delId !== null} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>The file will be permanently removed. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && remove.mutate(delId)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
