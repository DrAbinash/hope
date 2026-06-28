import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { FileText, Plus, Edit3, Printer, Clock, User, Heart, ChevronDown, ChevronUp, Sparkles, ShieldAlert, ListTodo, Info } from "lucide-react";

interface Vitals {
  temp?: string;
  pulse?: string;
  bp?: string;
  rr?: string;
  spo2?: string;
}

interface SystemicExam {
  cns?: string;
  cvs?: string;
  rs?: string;
  pa?: string;
}

interface ProgressNote {
  id: number;
  ipdAdmissionId: number;
  patientId: number;
  doctorId: number;
  doctorName: string;
  noteDate: string;
  subjectiveComplaints: string;
  objectiveFindings: string;
  vitalsSummary: Vitals;
  examinationSystemic: SystemicExam;
  diagnosisAssessment: string;
  plan: string;
  investigationsAdvised: string[];
  medicinesChanged: { name: string; dose: string; action: "Added" | "Stopped" | "Modified" }[];
  procedureNotes: string;
  followUpInstructions: string;
}

interface Props {
  admissionId: number;
  patientId: number;
  patientName: string;
}

export default function ProgressNotesSection({ admissionId, patientId, patientName }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingNote, setEditingNote] = useState<ProgressNote | null>(null);
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);

  const isDoctorOrAdmin = user?.role === "doctor" || user?.role === "admin";

  // AI draft assistant states
  const [aiDraftInfo, setAiDraftInfo] = useState<{
    transparency?: { model: string; timestamp: string; confidence: string; sourcesConsulted: string[] };
    consistencyChecks: string[];
    missingInfo: string[];
    timeline: { day: string; description: string }[];
  } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiDraftOriginalValues, setAiDraftOriginalValues] = useState<{
    subjectiveComplaints: string;
    objectiveFindings: string;
    vitals: Vitals;
    systemic: SystemicExam;
    diagnosisAssessment: string;
    plan: string;
  } | null>(null);

  // Form State
  const [form, setForm] = useState({
    subjectiveComplaints: "",
    objectiveFindings: "",
    vitals: { temp: "", pulse: "", bp: "", rr: "", spo2: "" },
    systemic: { cns: "", cvs: "", rs: "", pa: "" },
    diagnosisAssessment: "",
    plan: "",
    investigations: "",
    medicines: [] as { name: string; dose: string; action: "Added" | "Stopped" | "Modified" }[],
    procedureNotes: "",
    followUpInstructions: "",
  });

  const [medName, setMedName] = useState("");
  const [medDose, setMedDose] = useState("");
  const [medAction, setMedAction] = useState<"Added" | "Stopped" | "Modified">("Added");

  const { data: notes, isLoading } = useQuery<ProgressNote[]>({
    queryKey: ["/api/ipd/progress-notes", admissionId],
    queryFn: () => fetch(`/api/ipd/${admissionId}/progress-notes`).then((r) => r.json()),
  });

  const { data: doctors } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/doctors"],
    queryFn: () => fetch("/api/doctors").then((r) => r.json()),
  });

  const handleGenerateAiDraft = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch(`/api/ipd/${admissionId}/ai-draft?type=progress`);
      if (!res.ok) throw new Error("Failed to compile AI draft");
      const data = await res.json();

      const subjective = `AI Draft – Pending Doctor Approval\n\n${data.draft.subjectiveComplaints || "Information not available."}`;
      const objective = `AI Draft – Pending Doctor Approval\n\n${data.draft.objectiveFindings || "Information not available."}`;
      const planVal = `AI Draft – Pending Doctor Approval\n\n${data.draft.plan || "Information not available."}`;

      setForm({
        subjectiveComplaints: subjective,
        objectiveFindings: objective,
        vitals: data.draft.vitalsSummary,
        systemic: data.draft.examinationSystemic,
        diagnosisAssessment: data.draft.diagnosisAssessment,
        plan: planVal,
        investigations: Array.isArray(data.draft.investigationsAdvised) ? data.draft.investigationsAdvised.join(", ") : "",
        medicines: data.draft.medicinesChanged || [],
        procedureNotes: data.draft.procedureNotes || "",
        followUpInstructions: data.draft.followUpInstructions || "",
      });

      setAiDraftOriginalValues({
        subjectiveComplaints: subjective,
        objectiveFindings: objective,
        vitals: data.draft.vitalsSummary,
        systemic: data.draft.examinationSystemic,
        diagnosisAssessment: data.draft.diagnosisAssessment,
        plan: planVal,
      });

      setAiDraftInfo({
        transparency: data.transparency,
        consistencyChecks: data.consistencyChecks,
        missingInfo: data.missingInfo,
        timeline: data.timeline,
      });
      setAiGenerated(true);
      toast.success("AI clinical draft prefilled successfully");
    } catch (err: any) {
      toast.error("AI Draft compilation failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/ipd/${admissionId}/progress-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Progress note saved");
      setShowAdd(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["/api/ipd/progress-notes", admissionId] });
    },
    onError: (err: any) => toast.error("Failed to save: " + err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await fetch(`/api/ipd/${admissionId}/progress-notes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast.success("Progress note updated");
      setEditingNote(null);
      qc.invalidateQueries({ queryKey: ["/api/ipd/progress-notes", admissionId] });
    },
    onError: (err: any) => toast.error("Failed to update: " + err.message),
  });

  const resetForm = () => {
    setForm({
      subjectiveComplaints: "",
      objectiveFindings: "",
      vitals: { temp: "", pulse: "", bp: "", rr: "", spo2: "" },
      systemic: { cns: "", cvs: "", rs: "", pa: "" },
      diagnosisAssessment: "",
      plan: "",
      investigations: "",
      medicines: [],
      procedureNotes: "",
      followUpInstructions: "",
    });
    setAiGenerated(false);
    setAiDraftInfo(null);
    setAiDraftOriginalValues(null);
  };

  const handleOpenEdit = (note: ProgressNote) => {
    setEditingNote(note);
    setForm({
      subjectiveComplaints: note.subjectiveComplaints || "",
      objectiveFindings: note.objectiveFindings || "",
      vitals: {
        temp: note.vitalsSummary?.temp || "",
        pulse: note.vitalsSummary?.pulse || "",
        bp: note.vitalsSummary?.bp || "",
        rr: note.vitalsSummary?.rr || "",
        spo2: note.vitalsSummary?.spo2 || "",
      },
      systemic: {
        cns: note.examinationSystemic?.cns || "",
        cvs: note.examinationSystemic?.cvs || "",
        rs: note.examinationSystemic?.rs || "",
        pa: note.examinationSystemic?.pa || "",
      },
      diagnosisAssessment: note.diagnosisAssessment || "",
      plan: note.plan || "",
      investigations: Array.isArray(note.investigationsAdvised) ? note.investigationsAdvised.join(", ") : "",
      medicines: note.medicinesChanged || [],
      procedureNotes: note.procedureNotes || "",
      followUpInstructions: note.followUpInstructions || "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const docId = user?.id || (doctors && doctors[0]?.id) || 1;
    const isEdited = aiGenerated ? (
      form.subjectiveComplaints !== aiDraftOriginalValues?.subjectiveComplaints ||
      form.objectiveFindings !== aiDraftOriginalValues?.objectiveFindings ||
      form.plan !== aiDraftOriginalValues?.plan ||
      JSON.stringify(form.vitals) !== JSON.stringify(aiDraftOriginalValues?.vitals) ||
      JSON.stringify(form.systemic) !== JSON.stringify(aiDraftOriginalValues?.systemic) ||
      form.diagnosisAssessment !== aiDraftOriginalValues?.diagnosisAssessment
    ) : false;

    const payload = {
      patientId,
      doctorId: docId,
      subjectiveComplaints: form.subjectiveComplaints,
      objectiveFindings: form.objectiveFindings,
      vitalsSummary: form.vitals,
      examinationSystemic: form.systemic,
      diagnosisAssessment: form.diagnosisAssessment,
      plan: form.plan,
      investigationsAdvised: form.investigations.split(",").map(i => i.trim()).filter(Boolean),
      medicinesChanged: form.medicines,
      procedureNotes: form.procedureNotes,
      followUpInstructions: form.followUpInstructions,
      aiGenerated,
      doctorEdited: isEdited,
      approvedBy: aiGenerated ? docId : null,
      approvedAt: aiGenerated ? new Date().toISOString() : null,
    };

    if (editingNote) {
      updateMutation.mutate({ id: editingNote.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const printNote = (n: ProgressNote) => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Daily Progress Note</title>
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.5; color: #333; }
            h2 { border-bottom: 2px solid #3f51b5; color: #3f51b5; padding-bottom: 5px; }
            .header-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
            .header-table td { padding: 5px; border: 1px solid #ddd; font-size: 14px; }
            .section { margin-bottom: 15px; }
            .section-title { font-weight: bold; color: #555; }
            .vitals-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; border: 1px solid #ddd; padding: 10px; border-radius: 5px; background: #f9f9f9; }
            .med-badge { display: inline-block; padding: 3px 8px; margin: 3px; background: #e0e0e0; border-radius: 3px; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1 style="text-align: center;">Daily Progress Note</h1>
          <table class="header-table">
            <tr>
              <td><strong>Patient:</strong> ${patientName}</td>
              <td><strong>Date:</strong> ${new Date(n.noteDate).toLocaleString("en-IN")}</td>
            </tr>
            <tr>
              <td><strong>Consultant:</strong> Dr. ${n.doctorName || "Staff Consultant"}</td>
              <td><strong>IPD Admission:</strong> #${admissionId}</td>
            </tr>
          </table>

          <div class="section">
            <span class="section-title">Vitals:</span>
            <div class="vitals-grid">
              <div>Temp: ${n.vitalsSummary?.temp || "—"} °F</div>
              <div>Pulse: ${n.vitalsSummary?.pulse || "—"} bpm</div>
              <div>BP: ${n.vitalsSummary?.bp || "—"}</div>
              <div>RR: ${n.vitalsSummary?.rr || "—"} /min</div>
              <div>SpO2: ${n.vitalsSummary?.spo2 || "—"}%</div>
            </div>
          </div>

          <div class="section">
            <strong>Subjective Complaints:</strong>
            <p>${n.subjectiveComplaints || "No active complaints."}</p>
          </div>

          <div class="section">
            <strong>Objective Findings:</strong>
            <p>${n.objectiveFindings || "—"}</p>
          </div>

          <div class="section">
            <strong>Systemic Examination:</strong>
            <ul>
              <li>CNS: ${n.examinationSystemic?.cns || "—"}</li>
              <li>CVS: ${n.examinationSystemic?.cvs || "—"}</li>
              <li>RS: ${n.examinationSystemic?.rs || "—"}</li>
              <li>PA: ${n.examinationSystemic?.pa || "—"}</li>
            </ul>
          </div>

          <div class="section">
            <strong>Diagnosis / Assessment:</strong>
            <p>${n.diagnosisAssessment || "—"}</p>
          </div>

          <div class="section">
            <strong>Plan:</strong>
            <p>${n.plan || "—"}</p>
          </div>

          <div class="section">
            <strong>Investigations Advised:</strong>
            <p>${(n.investigationsAdvised || []).join(", ") || "None"}</p>
          </div>

          <div class="section">
            <strong>Medicines Changed:</strong><br/>
            ${(n.medicinesChanged || []).map(m => `<span class="med-badge"><strong>${m.action}</strong>: ${m.name} (${m.dose})</span>`).join("") || "No changes."}
          </div>

          <div class="section">
            <strong>Procedures Performed:</strong>
            <p>${n.procedureNotes || "None"}</p>
          </div>

          <div class="section">
            <strong>Follow-Up / Instructions:</strong>
            <p>${n.followUpInstructions || "—"}</p>
          </div>

          <div style="margin-top: 50px; border-top: 1px solid #ccc; padding-top: 10px;">
            <small>Signed By: Dr. ${n.doctorName || "Staff Consultant"}</small>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    w.document.close();
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            IPD Daily Progress Notes
          </CardTitle>
          <CardDescription>Clinical daily checkins and assessment notes</CardDescription>
        </div>
        {isDoctorOrAdmin && (
          <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 mr-1" /> Add Daily Note
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          </div>
        ) : !notes || notes.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground italic">No progress notes logged yet.</div>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => {
              const isExpanded = expandedNoteId === note.id;
              return (
                <div key={note.id} className="border rounded-xl p-3 bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50 transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {new Date(note.noteDate).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="w-3 h-3" /> Dr. {note.doctorName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-500" onClick={() => printNote(note)} title="Print Note">
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      {isDoctorOrAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-500" onClick={() => handleOpenEdit(note)} title="Edit Note">
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-slate-500" onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 border-t pt-3 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                      <div className="grid grid-cols-5 gap-2 bg-slate-100 dark:bg-slate-800 p-2 rounded-lg text-[10px]">
                        <div>Temp: {note.vitalsSummary?.temp || "—"} °F</div>
                        <div>Pulse: {note.vitalsSummary?.pulse || "—"} bpm</div>
                        <div>BP: {note.vitalsSummary?.bp || "—"}</div>
                        <div>RR: {note.vitalsSummary?.rr || "—"} /min</div>
                        <div>SpO2: {note.vitalsSummary?.spo2 || "—"}%</div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <strong>Subjective:</strong>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{note.subjectiveComplaints || "—"}</p>
                        </div>
                        <div>
                          <strong>Objective:</strong>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{note.objectiveFindings || "—"}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 border p-2 rounded-lg text-[10px]">
                        <div>CNS: {note.examinationSystemic?.cns || "—"}</div>
                        <div>CVS: {note.examinationSystemic?.cvs || "—"}</div>
                        <div>RS: {note.examinationSystemic?.rs || "—"}</div>
                        <div>PA: {note.examinationSystemic?.pa || "—"}</div>
                      </div>

                      <div>
                        <strong>Assessment:</strong>
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">{note.diagnosisAssessment || "—"}</p>
                      </div>

                      <div>
                        <strong>Plan:</strong>
                        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">{note.plan || "—"}</p>
                      </div>

                      {note.medicinesChanged && note.medicinesChanged.length > 0 && (
                        <div>
                          <strong>Medicines Changed:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {note.medicinesChanged.map((m, i) => (
                              <Badge key={i} variant="secondary" className="text-[9px]">
                                {m.action}: {m.name} ({m.dose})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Add / Edit Dialog */}
      <Dialog open={showAdd || !!editingNote} onOpenChange={(o) => { if (!o) { setShowAdd(false); setEditingNote(null); resetForm(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingNote ? "Edit Daily Progress Note" : "New Daily Progress Note"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* AI Assistant Panel */}
            {!editingNote && isDoctorOrAdmin && (
              <div className="space-y-2">
                {!aiGenerated ? (
                  <Button
                    type="button"
                    disabled={isAiLoading}
                    onClick={handleGenerateAiDraft}
                    className="w-full bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 border border-indigo-200 dark:border-indigo-800 rounded-xl py-5 font-semibold flex items-center justify-center gap-2 text-xs"
                  >
                    <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
                    {isAiLoading ? "Analyzing Clinical Records & Compiling Draft..." : "Generate AI Draft from Clinical Records"}
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
                          <p className="text-slate-500 italic text-[10px]">No inconsistencies detected between current documentation inputs.</p>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Subjective Complaints</Label>
                <Textarea value={form.subjectiveComplaints} onChange={e => setForm(f => ({ ...f, subjectiveComplaints: e.target.value }))} className="mt-1 h-16 rounded-xl" placeholder="Patient's complaints..." />
              </div>
              <div>
                <Label>Objective Findings</Label>
                <Textarea value={form.objectiveFindings} onChange={e => setForm(f => ({ ...f, objectiveFindings: e.target.value }))} className="mt-1 h-16 rounded-xl" placeholder="Clinical findings..." />
              </div>
            </div>

            {/* Vitals Summary */}
            <div className="border p-3 rounded-xl space-y-2">
              <Label className="font-semibold flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> Vitals Summary</Label>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <Label className="text-[10px]">Temp (°F)</Label>
                  <Input size={5} value={form.vitals.temp} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, temp: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="98.6" />
                </div>
                <div>
                  <Label className="text-[10px]">Pulse (bpm)</Label>
                  <Input value={form.vitals.pulse} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, pulse: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="72" />
                </div>
                <div>
                  <Label className="text-[10px]">BP (mmHg)</Label>
                  <Input value={form.vitals.bp} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, bp: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="120/80" />
                </div>
                <div>
                  <Label className="text-[10px]">Resp Rate (/min)</Label>
                  <Input value={form.vitals.rr} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, rr: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="18" />
                </div>
                <div>
                  <Label className="text-[10px]">SpO2 (%)</Label>
                  <Input value={form.vitals.spo2} onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, spo2: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="98" />
                </div>
              </div>
            </div>

            {/* Systemic Exam */}
            <div className="border p-3 rounded-xl space-y-2">
              <Label className="font-semibold">Systemic Examination (CNS / CVS / RS / PA)</Label>
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <Label className="text-[10px]">CNS</Label>
                  <Input value={form.systemic.cns} onChange={e => setForm(f => ({ ...f, systemic: { ...f.systemic, cns: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="Conscious/Oriented..." />
                </div>
                <div>
                  <Label className="text-[10px]">CVS</Label>
                  <Input value={form.systemic.cvs} onChange={e => setForm(f => ({ ...f, systemic: { ...f.systemic, cvs: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="S1 S2 heard..." />
                </div>
                <div>
                  <Label className="text-[10px]">RS</Label>
                  <Input value={form.systemic.rs} onChange={e => setForm(f => ({ ...f, systemic: { ...f.systemic, rs: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="Bilateral clear..." />
                </div>
                <div>
                  <Label className="text-[10px]">PA (Abdomen)</Label>
                  <Input value={form.systemic.pa} onChange={e => setForm(f => ({ ...f, systemic: { ...f.systemic, pa: e.target.value } }))} className="mt-1 h-8 rounded-lg" placeholder="Soft/Non-tender..." />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Diagnosis / Assessment</Label>
                <Textarea value={form.diagnosisAssessment} onChange={e => setForm(f => ({ ...f, diagnosisAssessment: e.target.value }))} className="mt-1 h-16 rounded-xl" placeholder="Clinical assessment..." />
              </div>
              <div>
                <Label>Treatment Plan</Label>
                <Textarea value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="mt-1 h-16 rounded-xl" placeholder="Plan details..." />
              </div>
            </div>

            {/* Medicines Changed */}
            <div className="border p-3 rounded-xl space-y-2">
              <Label className="font-semibold">Medicines Changed / Adjusted</Label>
              <div className="flex gap-2">
                <Input placeholder="Medicine name" value={medName} onChange={e => setMedName(e.target.value)} className="h-8 text-xs" />
                <Input placeholder="Dose (e.g. 1-0-1)" value={medDose} onChange={e => setMedDose(e.target.value)} className="h-8 text-xs" />
                <select value={medAction} onChange={e => setMedAction(e.target.value as any)} className="h-8 border rounded-lg px-2 text-xs bg-white dark:bg-slate-900">
                  <option value="Added">Added</option>
                  <option value="Stopped">Stopped</option>
                  <option value="Modified">Modified</option>
                </select>
                <Button type="button" onClick={() => { if (medName) { setForm(f => ({ ...f, medicines: [...f.medicines, { name: medName, dose: medDose, action: medAction }] })); setMedName(""); setMedDose(""); } }} className="h-8 bg-slate-800 text-white rounded-lg">Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {form.medicines.map((m, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1 text-[10px]">
                    <strong>{m.action}</strong>: {m.name} ({m.dose})
                    <button type="button" onClick={() => setForm(f => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) }))} className="text-red-500 font-bold ml-1">×</button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <Label>Investigations Advised</Label>
                <Input value={form.investigations} onChange={e => setForm(f => ({ ...f, investigations: e.target.value }))} className="mt-1 h-9 rounded-lg" placeholder="CBC, Chest X-Ray..." />
              </div>
              <div className="col-span-1">
                <Label>Procedure Notes</Label>
                <Input value={form.procedureNotes} onChange={e => setForm(f => ({ ...f, procedureNotes: e.target.value }))} className="mt-1 h-9 rounded-lg" placeholder="e.g. Catheterization..." />
              </div>
              <div className="col-span-1">
                <Label>Follow-Up Instructions</Label>
                <Input value={form.followUpInstructions} onChange={e => setForm(f => ({ ...f, followUpInstructions: e.target.value }))} className="mt-1 h-9 rounded-lg" placeholder="Review in OPD..." />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setEditingNote(null); resetForm(); }} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
