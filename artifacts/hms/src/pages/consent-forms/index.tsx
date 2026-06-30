import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, Printer, CheckCircle2, FileText,
} from "lucide-react";
import { CONSENT_TEMPLATES, type ConsentTemplate } from "./templates";

interface ConsentForm {
  id: number; formNo: string; formType: string; title: string;
  patientId: number; patientName: string; patientUhid: string;
  entityId: number | null; entityName: string | null;
  doctorId: number | null; doctorName: string | null;
  variables: Record<string, string>;
  body: string;
  patientSigned: boolean;
  witnessName: string | null;
  signedAt: string | null;
  status: string;
  createdAt: string;
}
interface Patient { id: number; uhid: string; name: string; age: number; gender: string; address: string | null; phone: string | null }
interface Doctor { id: number; name: string }
interface Entity { id: number; name: string }

const TYPE_LABELS: Record<string, string> = {
  admission: "Admission",
  surgery: "Surgery",
  anaesthesia: "Anaesthesia",
  refusal: "Refusal / LAMA",
  discharge: "Discharge",
};
const TYPE_COLORS: Record<string, string> = {
  admission: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  surgery: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  anaesthesia: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  refusal: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  discharge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

function substitute(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `[${k}]`);
}

export default function ConsentFormsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [showNew, setShowNew] = useState(false);
  const [showView, setShowView] = useState<ConsentForm | null>(null);
  const [witnessInput, setWitnessInput] = useState("");

  // New form state
  const [pickedTemplate, setPickedTemplate] = useState<ConsentTemplate | null>(null);
  const [patientSearch, setPatientSearch] = useState("");
  const [pickedPatientId, setPickedPatientId] = useState("");
  const [entityId, setEntityId] = useState("1");
  const [doctorId, setDoctorId] = useState("");
  const [vars, setVars] = useState<Record<string, string>>({});

  const { data: forms } = useQuery<ConsentForm[]>({
    queryKey: ["/api/consent-forms"],
    queryFn: async () => {
      const r = await fetch("/api/consent-forms", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch forms");
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
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: async () => {
      const r = await fetch("/api/entities", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch entities");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const safePatients = Array.isArray(patientList?.patients) ? patientList.patients : [];
  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const safeEntities = Array.isArray(entities) ? entities : [];
  const safeForms = Array.isArray(forms) ? forms : [];

  const selectedPatient = safePatients.find((p) => p.id === Number(pickedPatientId));
  const selectedEntity = safeEntities.find((e) => e.id === Number(entityId));
  const filtered = useMemo(() => safeForms.filter((f) => filter === "all" || f.formType === filter), [safeForms, filter]);

  const create = useMutation({
    mutationFn: async () => {
      if (!pickedTemplate) throw new Error("Pick a template");
      if (!selectedPatient) throw new Error("Pick a patient");
      const fullVars: Record<string, string> = {
        ...vars,
        patientName: selectedPatient.name,
        patientUhid: selectedPatient.uhid,
        patientAge: String(selectedPatient.age),
        patientGender: selectedPatient.gender,
        patientAddress: selectedPatient.address || "—",
        patientPhone: selectedPatient.phone || "—",
        entityName: selectedEntity?.name || "Hospital",
      };
      const body = substitute(pickedTemplate.body, fullVars);
      const r = await fetch("/api/consent-forms", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          formType: pickedTemplate.type,
          title: pickedTemplate.title,
          patientId: selectedPatient.id,
          entityId: Number(entityId) || null,
          doctorId: doctorId ? Number(doctorId) : null,
          variables: fullVars,
          body,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (f: ConsentForm) => {
      toast.success(`Form ${f.formNo} created`);
      setShowNew(false);
      setPickedTemplate(null); setPickedPatientId(""); setPatientSearch("");
      setVars({}); setDoctorId("");
      qc.invalidateQueries({ queryKey: ["/api/consent-forms"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sign = useMutation({
    mutationFn: async ({ id, witnessName }: { id: number; witnessName: string }) => {
      const r = await fetch(`/api/consent-forms/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ patientSigned: true, witnessName, status: "signed" }),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: (f: ConsentForm) => {
      toast.success("Form signed");
      qc.invalidateQueries({ queryKey: ["/api/consent-forms"] });
      setShowView(f as any);
    },
  });

  const printForm = (f: ConsentForm) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const dt = new Date().toLocaleString("en-IN");
    const sigDate = f.signedAt ? new Date(f.signedAt).toLocaleString("en-IN") : "________________";
    w.document.write(`<!DOCTYPE html><html><head><title>${f.formNo} - ${f.title}</title>
      <style>
        @page { size: A4; margin: 18mm; }
        body { font-family: Georgia, serif; font-size: 11pt; line-height: 1.55; color:#000; }
        .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 16px; }
        .header h1 { font-size: 18pt; margin: 0 0 4px 0; }
        .header .sub { font-size: 10pt; color:#444; }
        h2 { font-size: 13pt; margin: 18px 0 8px 0; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 3px; }
        .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 12px; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; font-size: 11pt; line-height: 1.6; margin: 0; }
        .sig-block { margin-top: 36px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sig { border-top: 1px solid #000; padding-top: 4px; min-height: 60px; }
        .sig small { color:#666; font-size: 9pt; }
        .stamp { display:inline-block; padding: 4px 10px; border: 2px solid #2e7d32; color:#2e7d32; font-weight: bold; transform: rotate(-4deg); font-size: 11pt; }
      </style></head><body>
      <div class="header">
        <h1>${f.entityName || "Hospital"}</h1>
        <div class="sub">${f.title}</div>
      </div>
      <div class="meta">
        <div><strong>Form No:</strong> ${f.formNo}</div>
        <div><strong>Date:</strong> ${dt}</div>
      </div>
      <h2>Patient Details</h2>
      <div>
        <strong>Name:</strong> ${f.patientName} &nbsp;&nbsp;
        <strong>UHID:</strong> ${f.patientUhid} &nbsp;&nbsp;
        ${f.doctorName ? `<strong>Doctor:</strong> ${f.doctorName}` : ""}
      </div>
      <h2>Consent</h2>
      <pre>${f.body.replace(/</g, "&lt;")}</pre>
      <div class="sig-block">
        <div class="sig">
          <small>Patient / Legal Guardian Signature</small><br/>
          ${f.patientSigned ? `<span class="stamp">SIGNED ✓</span><br/><small>${sigDate}</small>` : ""}
        </div>
        <div class="sig">
          <small>Witness Signature</small><br/>
          ${f.witnessName ? `<strong>${f.witnessName}</strong>` : ""}
        </div>
        <div class="sig">
          <small>Treating Doctor</small><br/>
          ${f.doctorName ? `<strong>${f.doctorName}</strong>` : ""}
        </div>
        <div class="sig">
          <small>Date & Time</small><br/>
          ${dt}
        </div>
      </div>
      <script>window.onload=()=>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  const stats = {
    total: safeForms.length,
    signed: safeForms.filter((f) => f.patientSigned).length,
    draft: safeForms.filter((f) => f.status === "draft").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Consent Forms</h2>
          <p className="text-muted-foreground text-sm">Library of medico-legal consents — admission, surgery, anaesthesia, refusal, discharge.</p>
        </div>
        <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />New Consent</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Forms</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Signed</p><p className="text-2xl font-bold text-emerald-600">{stats.signed}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending Signature</p><p className="text-2xl font-bold text-amber-600">{stats.draft}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Templates Available</p><p className="text-2xl font-bold">{CONSENT_TEMPLATES.length}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-sm">Filter by type:</Label>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No consent forms yet. Click "New Consent" to generate one from a template.</TableCell></TableRow>
              ) : filtered.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.formNo}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[f.formType]} variant="secondary">{TYPE_LABELS[f.formType]}</Badge></TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{f.title}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{f.patientName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{f.patientUhid}</div>
                  </TableCell>
                  <TableCell className="text-sm">{f.doctorName || "—"}</TableCell>
                  <TableCell>
                    {f.patientSigned ? (
                      <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <CheckCircle2 className="w-3 h-3 mr-1" />Signed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">Draft</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(f.createdAt).toLocaleString()}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => { setShowView(f); setWitnessInput(f.witnessName || ""); }}>
                      <FileText className="w-3 h-3 mr-1" />View
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => printForm(f)}>
                      <Printer className="w-3 h-3 mr-1" />Print
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* New Consent Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>New Consent Form</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template *</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {CONSENT_TEMPLATES.map((t) => (
                  <button key={t.type} onClick={() => { setPickedTemplate(t); setVars({}); }}
                    className={`text-left border rounded-lg p-3 hover:bg-muted transition-colors ${
                      pickedTemplate?.type === t.type ? "border-primary bg-primary/5" : ""
                    }`}>
                    <div className="flex items-center gap-2">
                      <Badge className={TYPE_COLORS[t.type]} variant="secondary">{TYPE_LABELS[t.type]}</Badge>
                    </div>
                    <p className="text-sm font-medium mt-1">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {pickedTemplate && (
              <>
                <Separator />
                <div>
                  <Label>Patient *</Label>
                  {selectedPatient ? (
                    <div className="flex items-center justify-between border rounded-lg p-2 bg-muted/30">
                      <div><span className="font-medium">{selectedPatient.name}</span> <Badge variant="outline" className="ml-2 font-mono text-xs">{selectedPatient.uhid}</Badge></div>
                      <Button size="sm" variant="ghost" onClick={() => setPickedPatientId("")}>Change</Button>
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
                            <button key={p.id} onClick={() => setPickedPatientId(String(p.id))}
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
                    <Select value={entityId} onValueChange={setEntityId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{(entities || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Treating Doctor</Label>
                    <Select value={doctorId} onValueChange={setDoctorId}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>{(doctors || []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {pickedTemplate.variables.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-base font-semibold">Fill in template variables</Label>
                    {pickedTemplate.variables.map((v) => (
                      <div key={v.key}>
                        <Label className="text-xs">{v.label}</Label>
                        {v.type === "textarea" ? (
                          <Textarea rows={2} value={vars[v.key] || ""}
                            onChange={(e) => setVars({ ...vars, [v.key]: e.target.value })} />
                        ) : (
                          <Input value={vars[v.key] || ""}
                            onChange={(e) => setVars({ ...vars, [v.key]: e.target.value })} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {selectedPatient && (
                  <div>
                    <Label className="text-base font-semibold">Preview</Label>
                    <div className="border rounded-lg p-3 bg-muted/20 max-h-64 overflow-y-auto whitespace-pre-wrap text-xs font-serif">
                      {substitute(pickedTemplate.body, {
                        ...vars,
                        patientName: selectedPatient.name,
                        patientUhid: selectedPatient.uhid,
                        patientAge: String(selectedPatient.age),
                        patientGender: selectedPatient.gender,
                        patientAddress: selectedPatient.address || "—",
                        entityName: selectedEntity?.name || "Hospital",
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={create.isPending || !pickedTemplate || !selectedPatient} onClick={() => create.mutate()}>
              {create.isPending ? "Creating..." : "Create Form"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View / Sign Dialog */}
      <Dialog open={!!showView} onOpenChange={(o) => !o && setShowView(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="w-5 h-5" />
              {showView?.formNo}
              {showView && <Badge className={TYPE_COLORS[showView.formType]} variant="secondary">{TYPE_LABELS[showView.formType]}</Badge>}
              {showView?.patientSigned && <Badge variant="secondary" className="bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3 mr-1" />Signed</Badge>}
            </DialogTitle>
          </DialogHeader>
          {showView && (
            <div className="space-y-3">
              <div className="text-sm">
                <span className="font-medium">{showView.title}</span>
                <div className="text-xs text-muted-foreground mt-1">
                  {showView.patientName} ({showView.patientUhid})
                  {showView.doctorName && <> • Dr. {showView.doctorName}</>}
                  {showView.entityName && <> • {showView.entityName}</>}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-muted/20 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm font-serif leading-relaxed">
                {showView.body}
              </div>
              {!showView.patientSigned && (
                <div className="border rounded-lg p-3 bg-amber-50 dark:bg-amber-950/20 space-y-2">
                  <p className="text-sm font-medium">Mark as signed</p>
                  <Input placeholder="Witness name (e.g. attendant relative, nurse)"
                    value={witnessInput} onChange={(e) => setWitnessInput(e.target.value)} />
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox id="confirm-sign" />
                    <span>I confirm patient/guardian has read and signed this form</span>
                  </label>
                </div>
              )}
              {showView.patientSigned && (
                <div className="border rounded-lg p-3 bg-emerald-50 dark:bg-emerald-950/20 text-sm">
                  <p><CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-600" />Signed on {showView.signedAt ? new Date(showView.signedAt).toLocaleString() : "—"}</p>
                  {showView.witnessName && <p className="text-xs text-muted-foreground mt-1">Witness: {showView.witnessName}</p>}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            {showView && !showView.patientSigned && (
              <Button onClick={() => sign.mutate({ id: showView.id, witnessName: witnessInput })} disabled={sign.isPending}>
                <CheckCircle2 className="w-4 h-4 mr-1" />Mark Signed
              </Button>
            )}
            {showView && (
              <Button variant="outline" onClick={() => printForm(showView)}>
                <Printer className="w-4 h-4 mr-1" />Print
              </Button>
            )}
            <Button variant="ghost" onClick={() => setShowView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
