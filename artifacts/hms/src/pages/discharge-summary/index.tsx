import { useState } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  ClipboardList, Plus, Printer, Trash2, FileCheck2, FileText, Lock, Sparkles, ShieldAlert, ListTodo, Info, Clock,
} from "lucide-react";
import { DocumentIntegration } from "@/components/document-integration";
import { DocumentUpload } from "@/components/document-upload";

interface Med { name: string; dose: string; frequency: string; duration: string; instructions?: string }
interface Investigation { name: string; result: string; date?: string }
interface Procedure { name: string; date?: string; surgeon?: string; notes?: string }

interface SummaryRow {
  id: number; summaryNo: string;
  ipdAdmissionId: number | null;
  patientId: number; patientName: string; patientUhid: string;
  entityId: number | null; entityName: string | null;
  attendingDoctorId: number | null; attendingDoctorName: string | null;
  admissionDate: string | null; dischargeDate: string | null;
  finalDiagnosis: string | null;
  conditionAtDischarge: string | null;
  status: string; createdAt: string;
}
interface Summary extends SummaryRow {
  patientAge: number; patientGender: string; patientPhone: string | null; patientAddress: string | null;
  attendingDoctorSpec: string | null;
  admissionDiagnosis: string | null;
  presentingComplaints: string | null;
  history: string | null;
  examinationFindings: string | null;
  investigations: Investigation[];
  treatmentGiven: string | null;
  proceduresPerformed: Procedure[];
  dischargeMedications: Med[];
  followUpAdvice: string | null;
  dietAdvice: string | null;
  activityAdvice: string | null;
  warningSigns: string | null;
  aiGenerated?: boolean;
  doctorEdited?: boolean;
  approvedBy?: number | null;
  approvedAt?: string | null;
}

interface IpdAdm {
  id: number; ipdNo: string; patientId: number; patientName: string; patientUhid: string;
  consultantDoctorId: number | null; consultantDoctorName: string | null;
  admissionDate: string; dischargeDate: string | null; diagnosis: string | null; status: string;
}
interface Doctor { id: number; name: string }
interface Entity { id: number; name: string }
interface HospitalSetting { entityId: number; address1: string | null; phone: string | null; email: string | null }

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  finalized: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

export default function DischargeSummaryPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [activeId, setActiveId] = useState<number | null>(null);
  
  const isDoctorOrAdmin = user?.role === "doctor" || user?.role === "admin";


  const [pickedIpdId, setPickedIpdId] = useState("");

  const { data: rows } = useQuery<SummaryRow[]>({
    queryKey: ["/api/discharge-summaries"],
    queryFn: async () => {
      const r = await fetch("/api/discharge-summaries", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch summaries");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: admissions } = useQuery<IpdAdm[]>({
    queryKey: ["/api/ipd"],
    queryFn: async () => {
      const r = await fetch("/api/ipd", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch admissions");
      const data = await r.json();
      return Array.isArray(data) ? data : (data.admissions || []);
    },
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
  const { data: settings } = useQuery<HospitalSetting[]>({
    queryKey: ["/api/hospital-settings"],
    queryFn: async () => {
      const r = await fetch("/api/hospital-settings", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch settings");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: activeSummary } = useQuery<Summary>({
    queryKey: ["/api/discharge-summaries", activeId],
    queryFn: async () => {
      const r = await fetch(`/api/discharge-summaries/${activeId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch summary");
      return r.json();
    },
    enabled: !!activeId,
  });

  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const safeEntities = Array.isArray(entities) ? entities : [];
  const safeSettings = Array.isArray(settings) ? settings : [];
  const safeAdmissions = Array.isArray(admissions) ? admissions : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  // AI draft assistant states
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiDraftInfo, setAiDraftInfo] = useState<{
    transparency?: { model: string; timestamp: string; confidence: string; sourcesConsulted: string[] };
    consistencyChecks: string[];
    missingInfo: string[];
    timeline: { day: string; description: string }[];
  } | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiDraftOriginalValues, setAiDraftOriginalValues] = useState<any>(null);

  const handleGenerateAiDraft = async () => {
    if (!activeSummary || !activeSummary.ipdAdmissionId) return;
    setIsAiLoading(true);
    try {
      const res = await fetch(`/api/ipd/${activeSummary.ipdAdmissionId}/ai-draft?type=discharge`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to compile AI draft");
      const data = await res.json();

      const pre = "AI Draft – Pending Doctor Approval\n\n";
      const updatedFields: any = {
        presentingComplaints: pre + (data.draft.presentingComplaints || "Information not available."),
        history: pre + (data.draft.history || "Information not available."),
        hospitalCourse: pre + (data.draft.hospitalCourse || "Information not available."),
        treatmentGiven: pre + (data.draft.treatmentGiven || "Information not available."),
        conditionAtDischarge: data.draft.conditionAtDischarge || "Information not available.",
        dietAdvice: data.draft.dietAdvice || "Information not available.",
        activityAdvice: data.draft.activityAdvice || "Information not available.",
        followUpAdvice: data.draft.followUpAdvice || "Information not available.",
        warningSigns: data.draft.warningSigns || "Information not available.",
        dischargeMedications: data.draft.dischargeMedications || [],
        investigations: data.draft.investigations || [],
        proceduresPerformed: data.draft.proceduresPerformed || [],
        aiGenerated: true,
        doctorEdited: false,
        approvedBy: null,
        approvedAt: null,
      };

      // Update local query state
      qc.setQueryData(["/api/discharge-summaries", activeId], { ...activeSummary, ...updatedFields });

      // Save to database
      await save.mutateAsync(updatedFields);

      setAiDraftOriginalValues(updatedFields);
      setAiDraftInfo({
        transparency: data.transparency,
        consistencyChecks: data.consistencyChecks,
        missingInfo: data.missingInfo,
        timeline: data.timeline,
      });
      setAiGenerated(true);
      toast.success("AI discharge summary draft generated successfully");
    } catch (err: any) {
      toast.error("AI Draft compilation failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const summariesByIpd = new Set(safeRows.map((r) => r.ipdAdmissionId).filter(Boolean));
  const eligibleAdmissions = safeAdmissions.filter((a) => !summariesByIpd.has(a.id));

  const create = useMutation({
    mutationFn: async () => {
      if (!pickedIpdId) throw new Error("Pick an admission");
      const pr = await fetch(`/api/discharge-summaries/prefill/${pickedIpdId}`, { credentials: "include" });
      if (!pr.ok) throw new Error("Failed to prefill summary");
      const pre = await pr.json();
      const adm = (admissions || []).find((a) => a.id === Number(pickedIpdId));
      const r = await fetch("/api/discharge-summaries", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({
          ipdAdmissionId: Number(pickedIpdId),
          patientId: pre.patientId,
          entityId: 1,
          attendingDoctorId: pre.attendingDoctorId,
          admissionDate: pre.admissionDate,
          dischargeDate: pre.dischargeDate,
          admissionDiagnosis: pre.admissionDiagnosis,
          finalDiagnosis: pre.finalDiagnosis,
          presentingComplaints: pre.presentingComplaints,
          conditionAtDischarge: "Stable / Recovered",
          dietAdvice: "Regular home diet, adequate hydration",
          activityAdvice: "Gradual return to normal activity over 2 weeks",
          status: "draft",
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: (s: Summary) => {
      toast.success(`Summary ${s.summaryNo} created — opening editor`);
      setShowNew(false); setPickedIpdId("");
      qc.invalidateQueries({ queryKey: ["/api/discharge-summaries"] });
      setActiveId(s.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = useMutation({
    mutationFn: async (body: Partial<Summary>) => {
      if (!activeId) throw new Error("No summary");
      const r = await fetch(`/api/discharge-summaries/${activeId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/discharge-summaries"] });
    },
  });

  const finalize = () => {
    if (!confirm("Finalize this discharge summary? It will be locked from further editing.")) return;
    const docId = user?.id || activeSummary?.attendingDoctorId || 1;
    const isEdited = activeSummary?.aiGenerated ? (
      activeSummary.presentingComplaints !== aiDraftOriginalValues?.presentingComplaints ||
      activeSummary.history !== aiDraftOriginalValues?.history ||
      activeSummary.treatmentGiven !== aiDraftOriginalValues?.treatmentGiven ||
      activeSummary.conditionAtDischarge !== aiDraftOriginalValues?.conditionAtDischarge
    ) : false;

    save.mutate({
      status: "finalized",
      doctorEdited: isEdited,
      approvedBy: activeSummary?.aiGenerated ? docId : null,
      approvedAt: activeSummary?.aiGenerated ? new Date().toISOString() : null,
    } as any, {
      onSuccess: () => toast.success("Discharge summary finalized"),
    });
  };

  const updateField = (field: keyof Summary, value: any) => {
    if (!activeSummary) return;
    qc.setQueryData(["/api/discharge-summaries", activeId], { ...activeSummary, [field]: value });
  };

  const addArrayItem = (field: "investigations" | "proceduresPerformed" | "dischargeMedications", item: any) => {
    if (!activeSummary) return;
    const updated = [...(activeSummary[field] as any[] || []), item];
    updateField(field, updated);
    save.mutate({ [field]: updated } as any);
  };

  const removeArrayItem = (field: "investigations" | "proceduresPerformed" | "dischargeMedications", idx: number) => {
    if (!activeSummary) return;
    const updated = (activeSummary[field] as any[]).filter((_: any, i: number) => i !== idx);
    updateField(field, updated);
    save.mutate({ [field]: updated } as any);
  };

  // Adders
  const [newInv, setNewInv] = useState({ name: "", result: "", date: "" });
  const [newProc, setNewProc] = useState({ name: "", date: "", surgeon: "", notes: "" });
  const [newMed, setNewMed] = useState({ name: "", dose: "", frequency: "", duration: "", instructions: "" });

  const printSummary = (s: Summary) => {
    const setting = safeSettings.find((x) => x.entityId === s.entityId);
    const w = window.open("", "_blank", "width=900,height=1000");
    if (!w) return;
    const fmt = (d: any) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
    const escapeHtml = (s: string | null | undefined) => (s || "").replace(/</g, "&lt;").replace(/\n/g, "<br/>");
    const medsHtml = (s.dischargeMedications || []).length === 0 ? "<em>None</em>" :
      `<table><thead><tr><th>Medication</th><th>Dose</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead><tbody>${
        s.dischargeMedications.map((m) => `<tr><td>${escapeHtml(m.name)}</td><td>${escapeHtml(m.dose)}</td><td>${escapeHtml(m.frequency)}</td><td>${escapeHtml(m.duration)}</td><td>${escapeHtml(m.instructions || "")}</td></tr>`).join("")
      }</tbody></table>`;
    const invHtml = (s.investigations || []).length === 0 ? "<em>None recorded</em>" :
      `<ul>${s.investigations.map((i) => `<li><strong>${escapeHtml(i.name)}</strong>${i.date ? ` (${fmt(i.date)})` : ""}: ${escapeHtml(i.result)}</li>`).join("")}</ul>`;
    const procHtml = (s.proceduresPerformed || []).length === 0 ? "<em>None</em>" :
      `<ul>${s.proceduresPerformed.map((p) => `<li><strong>${escapeHtml(p.name)}</strong>${p.date ? ` — ${fmt(p.date)}` : ""}${p.surgeon ? ` by ${escapeHtml(p.surgeon)}` : ""}${p.notes ? `<br/><small>${escapeHtml(p.notes)}</small>` : ""}</li>`).join("")}</ul>`;

    w.document.write(`<!DOCTYPE html><html><head><title>${s.summaryNo} - Discharge Summary</title>
      <style>
        @page { size: A4; margin: 16mm; }
        body { font-family: Georgia, serif; font-size: 10.5pt; line-height: 1.5; color:#000; }
        .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 14px; }
        .header h1 { font-size: 20pt; margin: 0; letter-spacing: 1px; }
        .header .sub { font-size: 9.5pt; color:#444; margin-top: 4px; }
        .title { text-align: center; font-size: 14pt; font-weight: bold; text-transform: uppercase; margin: 14px 0 10px 0; letter-spacing: 2px; }
        table.meta { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10pt; }
        table.meta td { padding: 3px 6px; border: 1px solid #999; }
        table.meta td.lbl { background: #f3f4f6; font-weight: bold; width: 18%; }
        h2 { font-size: 11pt; text-transform: uppercase; background: #1e3a8a; color: white; padding: 4px 8px; margin: 12px 0 6px 0; letter-spacing: 0.5px; }
        .section { margin-bottom: 8px; }
        table.meds { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
        table.meds th, table.meds td { border: 1px solid #999; padding: 4px 6px; text-align: left; }
        table.meds th { background: #e5e7eb; }
        ul { margin: 4px 0; padding-left: 22px; }
        .sig-block { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .sig { border-top: 1px solid #000; padding-top: 4px; min-height: 50px; font-size: 10pt; }
        .footer { margin-top: 20px; font-size: 8.5pt; color:#666; text-align: center; border-top: 1px solid #ccc; padding-top: 6px; }
        .stamp { display: inline-block; padding: 2px 8px; border: 2px solid #2e7d32; color:#2e7d32; font-weight: bold; transform: rotate(-3deg); font-size: 10pt; }
      </style></head><body>
      <div class="header">
        <h1>${escapeHtml(s.entityName)}</h1>
        <div class="sub">${escapeHtml(setting?.address1 || "")} ${setting?.phone ? "• " + escapeHtml(setting.phone) : ""} ${setting?.email ? "• " + escapeHtml(setting.email) : ""}</div>
      </div>
      <div class="title">Discharge Summary</div>
      <table class="meta">
        <tr><td class="lbl">Summary No</td><td>${s.summaryNo}</td><td class="lbl">IPD No</td><td>${s.ipdAdmissionId ? "(linked)" : "—"}</td></tr>
        <tr><td class="lbl">Patient</td><td>${escapeHtml(s.patientName)}</td><td class="lbl">UHID</td><td>${escapeHtml(s.patientUhid)}</td></tr>
        <tr><td class="lbl">Age / Sex</td><td>${s.patientAge} / ${escapeHtml(s.patientGender)}</td><td class="lbl">Phone</td><td>${escapeHtml(s.patientPhone)}</td></tr>
        <tr><td class="lbl">Admitted</td><td>${fmt(s.admissionDate)}</td><td class="lbl">Discharged</td><td>${fmt(s.dischargeDate)}</td></tr>
        <tr><td class="lbl">Consultant</td><td colspan="3">${escapeHtml(s.attendingDoctorName)} ${s.attendingDoctorSpec ? `(${escapeHtml(s.attendingDoctorSpec)})` : ""}</td></tr>
      </table>

      <h2>Final Diagnosis</h2><div class="section">${escapeHtml(s.finalDiagnosis) || "<em>—</em>"}</div>
      ${s.admissionDiagnosis && s.admissionDiagnosis !== s.finalDiagnosis ? `<h2>Admission Diagnosis</h2><div class="section">${escapeHtml(s.admissionDiagnosis)}</div>` : ""}
      <h2>Presenting Complaints</h2><div class="section">${escapeHtml(s.presentingComplaints) || "<em>—</em>"}</div>
      ${s.history ? `<h2>History of Present Illness</h2><div class="section">${escapeHtml(s.history)}</div>` : ""}
      ${s.examinationFindings ? `<h2>Examination Findings</h2><div class="section">${escapeHtml(s.examinationFindings)}</div>` : ""}
      <h2>Investigations</h2><div class="section">${invHtml}</div>
      <h2>Procedures Performed</h2><div class="section">${procHtml}</div>
      <h2>Treatment Given During Stay</h2><div class="section">${escapeHtml(s.treatmentGiven) || "<em>—</em>"}</div>
      <h2>Condition at Discharge</h2><div class="section">${escapeHtml(s.conditionAtDischarge) || "<em>—</em>"}</div>
      <h2>Discharge Medications</h2><div class="section">${medsHtml}</div>
      <h2>Diet</h2><div class="section">${escapeHtml(s.dietAdvice) || "<em>—</em>"}</div>
      <h2>Activity</h2><div class="section">${escapeHtml(s.activityAdvice) || "<em>—</em>"}</div>
      <h2>Follow-Up</h2><div class="section">${escapeHtml(s.followUpAdvice) || "<em>—</em>"}</div>
      ${s.warningSigns ? `<h2>⚠ Warning Signs — Return Immediately If</h2><div class="section">${escapeHtml(s.warningSigns)}</div>` : ""}

      <div class="sig-block">
        <div class="sig">
          <small style="color:#666">Patient / Attendant Signature</small>
        </div>
        <div class="sig">
          ${s.status === "finalized" ? '<span class="stamp">FINALIZED ✓</span><br/>' : ""}
          <small style="color:#666">${escapeHtml(s.attendingDoctorName)}<br/>${escapeHtml(s.attendingDoctorSpec)}</small>
        </div>
      </div>
      <div class="footer">Generated on ${new Date().toLocaleString("en-IN")} • ${s.summaryNo} • This is a system-generated discharge summary.</div>
      <script>window.onload=()=>setTimeout(()=>window.print(),300);</script>
      </body></html>`);
    w.document.close();
  };

  const stats = {
    total: safeRows.length,
    draft: safeRows.filter((r) => r.status === "draft").length,
    finalized: safeRows.filter((r) => r.status === "finalized").length,
    eligible: eligibleAdmissions.length,
  };

  const isLocked = activeSummary?.status === "finalized" || !isDoctorOrAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Discharge Summary</h2>
          <p className="text-muted-foreground text-sm">Generate, edit and print discharge summaries from IPD admissions.</p>
        </div>
        {isDoctorOrAdmin && (
          <Button onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-2" />New from IPD</Button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total Summaries</p><p className="text-2xl font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Draft</p><p className="text-2xl font-bold text-amber-600">{stats.draft}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Finalized</p><p className="text-2xl font-bold text-emerald-600">{stats.finalized}</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Pending IPD Discharges</p><p className="text-2xl font-bold">{stats.eligible}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Summary #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Admitted</TableHead>
                <TableHead>Discharged</TableHead>
                <TableHead>Final Diagnosis</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safeRows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-12">No discharge summaries yet. Click "New from IPD" to generate one from an admission.</TableCell></TableRow>
              ) : safeRows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.summaryNo}</TableCell>
                  <TableCell>
                    <div className="text-sm font-medium">{r.patientName}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.patientUhid}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.attendingDoctorName || "—"}</TableCell>
                  <TableCell className="text-xs">{r.admissionDate || "—"}</TableCell>
                  <TableCell className="text-xs">{r.dischargeDate || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[260px] truncate">{r.finalDiagnosis || "—"}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[r.status]} variant="secondary">{r.status}</Badge></TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="sm" variant="ghost" onClick={() => setActiveId(r.id)}>
                      <FileText className="w-3 h-3 mr-1" />Open
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Discharge Summary Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-indigo-50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200">
            <p className="text-xs text-muted-foreground mb-3">
              Upload discharge certificates, prescriptions, follow-up instructions, and related discharge documents.
            </p>
            <DocumentUpload
              category="Discharge Summary"
              patientId={0}
              module="IPD"
              department="Discharge"
              description="Discharge certificate or summary document"
              tags={["discharge", "discharge-summary"]}
              multiple={true}
            />
          </div>

          <DocumentIntegration
            patientId={0}
            module="IPD"
            title="Discharge Documents"
            showUpload={false}
            maxDocuments={25}
          />
        </CardContent>
      </Card>

      {/* New from IPD */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Discharge Summary</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Pick IPD Admission *</Label>
            <Select value={pickedIpdId} onValueChange={setPickedIpdId}>
              <SelectTrigger><SelectValue placeholder="Choose an admission..." /></SelectTrigger>
              <SelectContent>
                {eligibleAdmissions.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">All admissions already have summaries</div>
                ) : eligibleAdmissions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.ipdNo} • {a.patientName} • {a.admissionDate}
                    {a.diagnosis ? ` • ${a.diagnosis}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Patient, doctor, dates, and admission diagnosis will be auto-filled from the IPD record.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={create.isPending || !pickedIpdId} onClick={() => create.mutate()}>
              {create.isPending ? "Creating..." : "Create & Edit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <Dialog open={!!activeId} onOpenChange={(o) => !o && setActiveId(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5" />
              {activeSummary?.summaryNo}
              {activeSummary && <Badge className={STATUS_COLORS[activeSummary.status]} variant="secondary">{activeSummary.status}</Badge>}
              {isLocked && <Badge variant="outline" className="text-xs"><Lock className="w-3 h-3 mr-1" />Locked</Badge>}
            </DialogTitle>
          </DialogHeader>
          {activeSummary && (
            <div className="space-y-4">
              {/* AI Assistant Panel */}
              {!isLocked && (
                <div className="space-y-2">
                  {!aiGenerated ? (
                    <Button
                      type="button"
                      disabled={isAiLoading}
                      onClick={handleGenerateAiDraft}
                      className="w-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 rounded-xl py-5 font-semibold flex items-center justify-center gap-2 text-xs"
                    >
                      <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                      {isAiLoading ? "Compiling Discharge Summary Draft..." : "Generate AI Discharge Summary Draft"}
                    </Button>
                  ) : (
                    aiDraftInfo && (
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-3.5 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-semibold text-xs">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span>AI Clinical Assistant Draft Loaded</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] bg-white dark:bg-slate-900 text-slate-700 border-slate-200">
                              Model: {aiDraftInfo.transparency?.model}
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] font-medium border-0 ${
                              aiDraftInfo.transparency?.confidence === "High" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" :
                              aiDraftInfo.transparency?.confidence === "Medium" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300" :
                              "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            }`}>
                              Confidence: {aiDraftInfo.transparency?.confidence}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 border-t border-indigo-100/50 pt-2">
                          <span>Sources Consulted: {aiDraftInfo.transparency?.sourcesConsulted?.join(", ") || "None"}</span>
                          <span>Generated: {aiDraftInfo.transparency?.timestamp ? new Date(aiDraftInfo.transparency.timestamp).toLocaleTimeString() : ""}</span>
                        </div>

                        {/* Consistency Checks */}
                        <div className="space-y-1.5 border-t border-indigo-100/50 pt-3">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> AI Clinical Consistency Scan (Suggestions Only)
                          </h4>
                          {aiDraftInfo.consistencyChecks.length === 0 ? (
                            <p className="text-slate-500 italic text-[10px]">No inconsistencies detected between documentation inputs.</p>
                          ) : (
                            <ul className="list-disc pl-4 text-amber-700 dark:text-amber-300 space-y-1 text-[10px]">
                              {aiDraftInfo.consistencyChecks.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          )}
                        </div>

                        {/* Missing Info */}
                        <div className="space-y-1.5 border-t border-indigo-100/50 pt-3">
                          <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <ListTodo className="w-3.5 h-3.5 text-indigo-500" /> AI Missing Documentation Scan (Reminders)
                          </h4>
                          {aiDraftInfo.missingInfo.length === 0 ? (
                            <p className="text-slate-500 italic text-[10px]">No critical documents are flagged as missing.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {aiDraftInfo.missingInfo.map((m, i) => (
                                <Badge key={i} variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[9px] hover:bg-slate-100 flex items-center gap-1 border-0">
                                  <Info className="w-2.5 h-2.5 text-slate-500" /> {m}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Timeline Summary */}
                        {aiDraftInfo.timeline && aiDraftInfo.timeline.length > 0 && (
                          <div className="space-y-1.5 border-t border-indigo-100/50 pt-3">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-indigo-500" /> Chronological Admission Timeline
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] bg-white/50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-indigo-50/50">
                              {aiDraftInfo.timeline.map((t, i) => (
                                <div key={i} className="flex gap-2">
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400 shrink-0">{t.day}:</span>
                                  <span className="text-slate-600 dark:text-slate-300">{t.description}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-lg text-sm">
                <div><span className="text-xs text-muted-foreground">Patient</span><br/><span className="font-medium">{activeSummary.patientName}</span> <Badge variant="outline" className="ml-1 font-mono text-xs">{activeSummary.patientUhid}</Badge></div>
                <div><span className="text-xs text-muted-foreground">Age / Sex</span><br/><span className="font-medium">{activeSummary.patientAge} / {activeSummary.patientGender}</span></div>
                <div>
                  <span className="text-xs text-muted-foreground">Attending Doctor</span><br/>
                  <Select value={String(activeSummary.attendingDoctorId || "")} onValueChange={(v) => { updateField("attendingDoctorId" as any, Number(v)); save.mutate({ attendingDoctorId: Number(v) } as any); }} disabled={isLocked}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{safeDoctors.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Entity</span><br/>
                  <Select value={String(activeSummary.entityId || "")} onValueChange={(v) => { updateField("entityId" as any, Number(v)); save.mutate({ entityId: Number(v) } as any); }} disabled={isLocked}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{safeEntities.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Admission Date</Label>
                  <Input type="date" value={activeSummary.admissionDate || ""} disabled={isLocked}
                    onChange={(e) => updateField("admissionDate", e.target.value)}
                    onBlur={(e) => save.mutate({ admissionDate: e.target.value } as any)} />
                </div>
                <div>
                  <Label className="text-xs">Discharge Date</Label>
                  <Input type="date" value={activeSummary.dischargeDate || ""} disabled={isLocked}
                    onChange={(e) => updateField("dischargeDate", e.target.value)}
                    onBlur={(e) => save.mutate({ dischargeDate: e.target.value } as any)} />
                </div>
              </div>

              {[
                { key: "finalDiagnosis", label: "Final Diagnosis", rows: 2 },
                { key: "admissionDiagnosis", label: "Admission Diagnosis", rows: 2 },
                { key: "presentingComplaints", label: "Presenting Complaints", rows: 2 },
                { key: "history", label: "History of Present Illness", rows: 3 },
                { key: "examinationFindings", label: "Examination Findings (Vitals, General, Systemic)", rows: 3 },
                { key: "treatmentGiven", label: "Treatment Given During Stay", rows: 4 },
                { key: "conditionAtDischarge", label: "Condition at Discharge", rows: 1 },
              ].map((f) => (
                <div key={f.key}>
                  <Label className="font-semibold">{f.label}</Label>
                  <Textarea rows={f.rows} disabled={isLocked}
                    value={(activeSummary as any)[f.key] || ""}
                    onChange={(e) => updateField(f.key as any, e.target.value)}
                    onBlur={(e) => save.mutate({ [f.key]: e.target.value } as any)} />
                </div>
              ))}

              {/* Investigations */}
              <div>
                <Label className="font-semibold">Investigations</Label>
                <div className="space-y-1 mb-2">
                  {(activeSummary.investigations || []).map((it, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                      <span className="flex-1"><strong>{it.name}</strong>{it.date && ` (${it.date})`}: {it.result}</span>
                      {!isLocked && (<Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeArrayItem("investigations", i)}><Trash2 className="w-3 h-3" /></Button>)}
                    </div>
                  ))}
                </div>
                {!isLocked && (
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-4" placeholder="Test name" value={newInv.name} onChange={(e) => setNewInv({ ...newInv, name: e.target.value })} />
                    <Input className="col-span-5" placeholder="Result" value={newInv.result} onChange={(e) => setNewInv({ ...newInv, result: e.target.value })} />
                    <Input type="date" className="col-span-2" value={newInv.date} onChange={(e) => setNewInv({ ...newInv, date: e.target.value })} />
                    <Button className="col-span-1" disabled={!newInv.name || !newInv.result} onClick={() => { addArrayItem("investigations", newInv); setNewInv({ name: "", result: "", date: "" }); }}><Plus className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>

              {/* Procedures */}
              <div>
                <Label className="font-semibold">Procedures Performed</Label>
                <div className="space-y-1 mb-2">
                  {(activeSummary.proceduresPerformed || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                      <span className="flex-1"><strong>{p.name}</strong>{p.date && ` — ${p.date}`}{p.surgeon && ` by ${p.surgeon}`}{p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}</span>
                      {!isLocked && (<Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeArrayItem("proceduresPerformed", i)}><Trash2 className="w-3 h-3" /></Button>)}
                    </div>
                  ))}
                </div>
                {!isLocked && (
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-4" placeholder="Procedure" value={newProc.name} onChange={(e) => setNewProc({ ...newProc, name: e.target.value })} />
                    <Input type="date" className="col-span-2" value={newProc.date} onChange={(e) => setNewProc({ ...newProc, date: e.target.value })} />
                    <Input className="col-span-3" placeholder="Surgeon" value={newProc.surgeon} onChange={(e) => setNewProc({ ...newProc, surgeon: e.target.value })} />
                    <Input className="col-span-2" placeholder="Notes" value={newProc.notes} onChange={(e) => setNewProc({ ...newProc, notes: e.target.value })} />
                    <Button className="col-span-1" disabled={!newProc.name} onClick={() => { addArrayItem("proceduresPerformed", newProc); setNewProc({ name: "", date: "", surgeon: "", notes: "" }); }}><Plus className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>

              {/* Medications */}
              <div>
                <Label className="font-semibold">Discharge Medications</Label>
                <div className="space-y-1 mb-2">
                  {(activeSummary.dischargeMedications || []).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm border rounded p-2">
                      <span className="flex-1">
                        <strong>{m.name}</strong> — {m.dose} • {m.frequency} • {m.duration}
                        {m.instructions && <div className="text-xs text-muted-foreground">{m.instructions}</div>}
                      </span>
                      {!isLocked && (<Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeArrayItem("dischargeMedications", i)}><Trash2 className="w-3 h-3" /></Button>)}
                    </div>
                  ))}
                </div>
                {!isLocked && (
                  <div className="grid grid-cols-12 gap-2">
                    <Input className="col-span-3" placeholder="Drug name" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} />
                    <Input className="col-span-2" placeholder="Dose" value={newMed.dose} onChange={(e) => setNewMed({ ...newMed, dose: e.target.value })} />
                    <Input className="col-span-2" placeholder="Frequency" value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} />
                    <Input className="col-span-2" placeholder="Duration" value={newMed.duration} onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })} />
                    <Input className="col-span-2" placeholder="Instructions" value={newMed.instructions} onChange={(e) => setNewMed({ ...newMed, instructions: e.target.value })} />
                    <Button className="col-span-1" disabled={!newMed.name} onClick={() => { addArrayItem("dischargeMedications", newMed); setNewMed({ name: "", dose: "", frequency: "", duration: "", instructions: "" }); }}><Plus className="w-3 h-3" /></Button>
                  </div>
                )}
              </div>

              {[
                { key: "dietAdvice", label: "Diet Advice", rows: 1 },
                { key: "activityAdvice", label: "Activity / Lifestyle Advice", rows: 1 },
                { key: "followUpAdvice", label: "Follow-Up Plan", rows: 2 },
                { key: "warningSigns", label: "Warning Signs — Return Immediately If", rows: 2 },
              ].map((f) => (
                <div key={f.key}>
                  <Label className="font-semibold">{f.label}</Label>
                  <Textarea rows={f.rows} disabled={isLocked}
                    value={(activeSummary as any)[f.key] || ""}
                    onChange={(e) => updateField(f.key as any, e.target.value)}
                    onBlur={(e) => save.mutate({ [f.key]: e.target.value } as any)} />
                </div>
              ))}

              <Separator />
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setActiveId(null)}>Close</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => activeSummary && printSummary(activeSummary)}>
                    <Printer className="w-4 h-4 mr-1" />Print
                  </Button>
                  {!isLocked && (
                    <Button onClick={finalize}><FileCheck2 className="w-4 h-4 mr-1" />Finalize</Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
