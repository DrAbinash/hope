import { useState, useEffect, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetOpdVisit, useListBeds, useListDoctors, useListPrescriptionTemplates } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ArrowRightLeft, Stethoscope, Trash2, Save, Pill, Printer, FileText, BookmarkPlus, Check, Loader2, AlertCircle, Mic, Sparkles, ShieldAlert, ListTodo, Info, Clock, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { MedicineSearch, type MedicineLite } from "@/components/medicine-search";
import { ChipRow, HINDI_DOSE, HINDI_TIMING, HINDI_FREQ, ADVICE_CHIPS, NEXT_VISIT_PRESETS } from "@/components/hindi-chips";
import { VoiceDictate } from "@/components/voice-dictate";
import { DrugInteractionAlerts } from "@/components/drug-interaction-alerts";
import { useDebouncedAutosave } from "@/hooks/use-autosave";
import { useAuth } from "@/lib/auth";

interface RxItem {
  medicineId?: number;
  medicineName: string;
  genericName?: string;
  dose: string;
  timing: string;
  frequency: string;
  duration: string;
  qty: string;
  notes: string;
  stockAtPrescribe?: number;
  route?: string;
  longTerm?: boolean;
  highRisk?: boolean;
  stopped?: boolean;
  formulation?: string;
}

interface ClinicalState {
  chiefComplaints: string;
  diagnosis: string;
  labTests: string;
  radiologyTests: string;
  advise: string;
  specialAdvise: string;
  nextVisitDate: string;
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>;
  if (state === "saved") return <span className="inline-flex items-center gap-1 text-xs text-green-700"><Check className="h-3 w-3" />Saved</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-destructive"><AlertCircle className="h-3 w-3" />Save failed</span>;
}

export default function OPDDetail() {
  const [, params] = useRoute("/opd/:id");
  const id = parseInt(params?.id || "0");
  const [, setLocation] = useLocation();
  const [ipdOpen, setIpdOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ipdForm, setIpdForm] = useState({ wardId: "", bedId: "", consultantDoctorId: "", admissionNote: "", transferOpdBilling: false, emergencyMode: false });
  const [rx, setRx] = useState<RxItem[]>([]);
  const [clinical, setClinical] = useState<ClinicalState>({
    chiefComplaints: "", diagnosis: "", labTests: "", radiologyTests: "", advise: "", specialAdvise: "", nextVisitDate: "",
  });
  const [loadedFor, setLoadedFor] = useState<number | null>(null);
  const [savingRx, setSavingRx] = useState(false);
  const [tplSearch, setTplSearch] = useState("");
  const [voiceLang, setVoiceLang] = useState<"en-IN" | "hi-IN">("en-IN");
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplFollowUp, setTplFollowUp] = useState("");
  const qc = useQueryClient();

  const { user } = useAuth();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiDraftInfo, setAiDraftInfo] = useState<{
    transparency?: { model: string; timestamp: string; confidence: string; sourcesConsulted: string[] };
    consistencyChecks: string[];
    missingInfo: string[];
    timeline: { day: string; description: string }[];
  } | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiDraftOriginalValues, setAiDraftOriginalValues] = useState<any>(null);
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);
  // favorites must be declared here (before any early returns) to satisfy Rules of Hooks.
  // favsKey uses optional chaining so it is safe to compute before visit/user are loaded.
  const [favorites, setFavorites] = useState<any[]>([]);

  const { data: visit, isLoading } = useGetOpdVisit(id);
  const { data: beds } = useListBeds({ status: "available" });
  const { data: doctors } = useListDoctors();
  const { data: templates } = useListPrescriptionTemplates({});

  const bedsInWard = ipdForm.wardId ? (beds || []).filter((b: any) => String(b.wardId) === ipdForm.wardId) : [];

  useEffect(() => {
    if (!visit || loadedFor === id) return;
    const meds = Array.isArray(visit.medicines) ? visit.medicines : [];
    setRx(meds.map((m: any) => ({
      medicineId: m.medicineId,
      medicineName: m.medicineName || m.name || "",
      genericName: m.genericName,
      dose: m.dose || "",
      timing: m.timing || m.when || "",
      frequency: m.frequency || "",
      duration: m.duration || "",
      qty: m.qty != null ? String(m.qty) : "",
      notes: m.notes || m.instructions || "",
      stockAtPrescribe: m.stockAtPrescribe,
    })));
    setClinical({
      chiefComplaints: (visit as any).chiefComplaints || "",
      diagnosis: (visit as any).diagnosis || "",
      labTests: (visit as any).labTests || "",
      radiologyTests: (visit as any).radiologyTests || "",
      advise: (visit as any).advise || "",
      specialAdvise: (visit as any).specialAdvise || "",
      nextVisitDate: (visit as any).nextVisitDate || "",
    });
    setLoadedFor(id);
    if ((visit as any).aiGenerated) {
      setAiGenerated(true);
      setAiDraftOriginalValues({
        chiefComplaints: (visit as any).chiefComplaints || "",
        diagnosis: (visit as any).diagnosis || "",
        advise: (visit as any).advise || "",
        specialAdvise: (visit as any).specialAdvise || "",
      });
    }
  }, [visit, id, loadedFor]);

  // Prescription Safety Check Hook
  useEffect(() => {
    if (rx.length === 0) {
      setSafetyWarnings([]);
      return;
    }
    const checkSafety = async () => {
      try {
        const res = await fetch("/api/prescription-safety", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: visit?.patientId,
            medicines: rx.map(r => ({ medicineName: r.medicineName, genericName: r.genericName })),
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setSafetyWarnings(data.warnings || []);
        }
      } catch (err) {
        console.error("Prescription safety check failed", err);
      }
    };
    const timer = setTimeout(checkSafety, 600);
    return () => clearTimeout(timer);
  }, [rx, visit?.patientId]);

  const handleGenerateAiDraft = async () => {
    setIsAiLoading(true);
    try {
      const res = await fetch(`/api/opd/${id}/ai-draft`);
      if (!res.ok) throw new Error("Failed to compile AI draft");
      const data = await res.json();

      const pre = "AI Draft – Pending Doctor Approval\n\n";

      const updatedFields = {
        chiefComplaints: pre + `Chief Complaints: ${data.draft.chiefComplaints}\n\nHistory of Present Illness: ${data.draft.historyOfPresentIllness}\n\nRelevant Past History: ${data.draft.relevantPastHistory}\n\nDrug History: ${data.draft.drugHistory}\n\nAllergy History: ${data.draft.allergyHistory}`,
        diagnosis: pre + `Differential Diagnosis Suggestions:\n${data.draft.differentialDiagnosis}`,
        advise: pre + `Examination Checklist:\n${data.draft.examinationChecklist}\n\nSuggested Investigations:\n${data.draft.suggestedInvestigations}\n\nFollow-up Reminders:\n${data.draft.followUpReminders}`,
        specialAdvise: pre + `Patient Education Points:\n${data.draft.patientEducationPoints}`,
      };

      setClinical(c => ({
        ...c,
        ...updatedFields,
      }));

      setAiDraftOriginalValues(updatedFields);
      setAiDraftInfo({
        transparency: data.transparency,
        consistencyChecks: data.consistencyChecks,
        missingInfo: data.missingInfo,
        timeline: data.timeline,
      });
      setAiGenerated(true);
      toast.success("AI consultation draft generated successfully");
    } catch (err: any) {
      toast.error("AI Draft compilation failed: " + err.message);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleApprove = async () => {
    const docId = user?.id || visit?.doctorId || 1;
    const isEdited = aiGenerated ? (
      clinical.chiefComplaints !== aiDraftOriginalValues?.chiefComplaints ||
      clinical.diagnosis !== aiDraftOriginalValues?.diagnosis ||
      clinical.advise !== aiDraftOriginalValues?.advise ||
      clinical.specialAdvise !== aiDraftOriginalValues?.specialAdvise
    ) : false;

    try {
      const res = await fetch(`/api/opd/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...clinical,
          status: "completed",
          aiGenerated,
          doctorEdited: isEdited,
          approvedBy: docId,
          approvedAt: new Date().toISOString()
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Consultation approved and completed");
      qc.invalidateQueries({ queryKey: [`/api/opd/${id}`] });
    } catch (err: any) {
      toast.error("Failed to approve consultation: " + err.message);
    }
  };

  const saveClinical = useCallback(async (c: ClinicalState) => {
    const docId = user?.id || visit?.doctorId || 1;
    const isEdited = aiGenerated ? (
      c.chiefComplaints !== aiDraftOriginalValues?.chiefComplaints ||
      c.diagnosis !== aiDraftOriginalValues?.diagnosis ||
      c.advise !== aiDraftOriginalValues?.advise ||
      c.specialAdvise !== aiDraftOriginalValues?.specialAdvise
    ) : false;

    const res = await fetch(`/api/opd/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...c,
        aiGenerated,
        doctorEdited: isEdited,
        approvedBy: aiGenerated ? docId : undefined,
        approvedAt: aiGenerated ? new Date().toISOString() : undefined,
      }),
    });
    if (!res.ok) throw new Error(await res.text());
    qc.invalidateQueries({ queryKey: [`/api/opd/${id}`] });
  }, [id, qc, aiGenerated, aiDraftOriginalValues, user, visit]);

  const saveState = useDebouncedAutosave(clinical, saveClinical, 800, loadedFor === id);

  async function convertToIPD(e: React.FormEvent) {
    e.preventDefault();
    if (!ipdForm.wardId || !ipdForm.bedId) { toast.error("Ward and bed are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/opd/${id}/convert-to-ipd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...ipdForm, wardId: parseInt(ipdForm.wardId), bedId: parseInt(ipdForm.bedId), consultantDoctorId: ipdForm.consultantDoctorId ? parseInt(ipdForm.consultantDoctorId) : undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      const ipd = await res.json();
      toast.success(`Converted to IPD: ${ipd.ipdNo}`);
      setIpdOpen(false);
      qc.invalidateQueries({ queryKey: [`/api/opd/${id}`] });
      setLocation(`/ipd/${ipd.id}`);
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>;
  if (!visit) return <div className="text-center py-12 text-muted-foreground">OPD visit not found.</div>;

  function patchClinical(patch: Partial<ClinicalState>) { setClinical(c => ({ ...c, ...patch })); }

  function appendAdvice(chip: string) {
    setClinical(c => {
      const cur = (c.advise || "").trim();
      const sep = cur && !cur.endsWith("/") ? " / " : cur ? " " : "";
      return { ...c, advise: cur + sep + chip };
    });
  }

  function setNextVisitDays(days: number) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    patchClinical({ nextVisitDate: `${yyyy}-${mm}-${dd}` });
  }

  const filteredTemplates = (templates || []).filter((t: any) => {
    if (!tplSearch.trim()) return true;
    const q = tplSearch.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.diagnosis?.toLowerCase().includes(q);
  });
  const favsKey = user?.id ? `doctor_favorites_${user.id}` : visit?.doctorId ? `doctor_favorites_${visit.doctorId}` : `doctor_favorites_guest`;

  useEffect(() => {
    try {
      setFavorites(JSON.parse(localStorage.getItem(favsKey) || "[]"));
    } catch {
      setFavorites([]);
    }
  }, [favsKey]);

  const toggleFavorite = (med: any) => {
    let nextFavs;
    const medId = med.id || med.medicineId;
    if (favorites.some(f => f.id === medId || f.medicineId === medId)) {
      nextFavs = favorites.filter(f => f.id !== medId && f.medicineId !== medId);
      toast.success("Removed from favorites");
    } else {
      nextFavs = [...favorites, { id: medId, medicineId: medId, name: med.name || med.medicineName, genericName: med.genericName, stock: med.stock, formulation: med.formulation }];
      toast.success("Added to favorites");
    }
    setFavorites(nextFavs);
    localStorage.setItem(favsKey, JSON.stringify(nextFavs));
  };

  const copyPreviousRx = async () => {
    if (!visit?.patientId) return;
    try {
      const res = await fetch(`/api/opd?patientId=${visit.patientId}&limit=5`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load previous visits");
      const data = await res.json();
      const visits = data.visits || [];
      const pastVisit = visits.find((v: any) => v.id !== id && Array.isArray(v.medicines) && v.medicines.length > 0);
      if (!pastVisit) {
        toast.error("No previous prescriptions found for this patient");
        return;
      }
      setRx(list => [
        ...list,
        ...pastVisit.medicines.map((m: any) => ({
          medicineId: m.medicineId,
          medicineName: m.medicineName || m.name || "",
          genericName: m.genericName,
          dose: m.dose || "",
          timing: m.timing || "",
          frequency: m.frequency || "",
          duration: m.duration || "",
          qty: m.qty != null ? String(m.qty) : "",
          notes: m.notes || "",
          route: m.route || "Oral",
          longTerm: m.longTerm,
          highRisk: m.highRisk,
          formulation: m.formulation,
        }))
      ]);
      toast.success(`Copied ${pastVisit.medicines.length} medicines from visit on ${pastVisit.visitDate}`);
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
  };

  function suggestQty(dose: string, duration: string, formulation?: string): string {
    const form = (formulation || "").toLowerCase();
    const d = dose.toLowerCase();
    if (form.includes("inj") || form.includes("syr") || form.includes("drop") || form.includes("oint") || form.includes("inhal") || form.includes("gel") || form.includes("cream") || form.includes("spray") || form.includes("lotion") || form.includes("bottl") || form.includes("vial")) {
      return "1";
    }
    if (d.includes("sos") || d.includes("prn") || d.includes("need") || d.includes("taper") || d.includes("asc") || d.includes("desc")) {
      return "1";
    }
    
    let days = 1;
    const durationMatch = duration.match(/(\d+)/);
    if (durationMatch) {
      days = parseInt(durationMatch[1], 10);
      if (duration.toLowerCase().includes("week")) days *= 7;
      else if (duration.toLowerCase().includes("month")) days *= 30;
    }
    
    let perDay = 0;
    const doseParts = dose.match(/\d+(\.\d+)?/g);
    if (doseParts && doseParts.length > 1) {
      perDay = doseParts.reduce((acc, val) => acc + parseFloat(val), 0);
    } else if (doseParts && doseParts.length === 1) {
      perDay = parseFloat(doseParts[0]);
    } else {
      perDay = 1;
    }
    
    return String(Math.ceil(perDay * days));
  }

  function addMedicine(m: MedicineLite) {
    setRx(list => [...list, {
      medicineId: m.id, medicineName: m.name, genericName: m.genericName || undefined,
      dose: "", timing: "", frequency: "", duration: "", qty: "", notes: "",
      stockAtPrescribe: m.stock,
      route: "Oral", longTerm: false, highRisk: false, stopped: false,
      formulation: m.formulation || undefined
    }]);
  }
  function updateRx(i: number, patch: Partial<RxItem>) {
    setRx(list => list.map((r, idx) => {
      if (idx === i) {
        const merged = { ...r, ...patch };
        if (patch.dose !== undefined || patch.duration !== undefined) {
          merged.qty = suggestQty(merged.dose, merged.duration, merged.formulation);
        }
        return merged;
      }
      return r;
    }));
  }
  function removeRx(i: number) { setRx(list => list.filter((_, idx) => idx !== i)); }
  function appendChip(field: "dose" | "timing" | "frequency", i: number, value: string) {
    const cur = rx[i][field] || "";
    const next = cur && cur.trim() ? `${cur} ${value}` : value;
    updateRx(i, { [field]: next } as Partial<RxItem>);
  }

  async function saveRx() {
    setSavingRx(true);
    try {
      const res = await fetch(`/api/opd/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ medicines: rx.map(r => ({ ...r, qty: r.qty ? Number(r.qty) : undefined })) }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Prescription saved");
      qc.invalidateQueries({ queryKey: [`/api/opd/${id}`] });
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSavingRx(false);
    }
  }

  function applyTemplate(t: any) {
    setClinical(c => ({
      ...c,
      chiefComplaints: t.chiefComplaints || c.chiefComplaints,
      diagnosis: t.diagnosis || c.diagnosis,
      labTests: t.labTests || c.labTests,
      radiologyTests: t.radiologyTests || c.radiologyTests,
      advise: t.advise || c.advise,
      specialAdvise: t.specialAdvise || c.specialAdvise,
    }));
    const tplMeds: any[] = Array.isArray(t.medicines) ? t.medicines : [];
    if (tplMeds.length > 0) {
      setRx(list => [
        ...list,
        ...tplMeds.map(m => ({
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
      ]);
    }
    toast.success(`Applied template: ${t.name}`);
    setTplSearch("");
  }

  function appendToField(field: keyof ClinicalState, text: string) {
    setClinical(c => {
      const cur = (c[field] as string) || "";
      const sep = cur && !/\s$/.test(cur) ? " " : "";
      return { ...c, [field]: cur + sep + text };
    });
  }

  async function saveAsTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!tplName.trim()) { toast.error("Template name is required"); return; }
    try {
      const body = {
        name: tplName.trim(),
        doctorId: visit?.doctorId || 0,
        chiefComplaints: clinical.chiefComplaints,
        diagnosis: clinical.diagnosis,
        labTests: clinical.labTests,
        radiologyTests: clinical.radiologyTests,
        advise: clinical.advise,
        specialAdvise: clinical.specialAdvise,
        followUpDays: tplFollowUp ? parseInt(tplFollowUp) : null,
        medicines: rx.map(r => ({ ...r, qty: r.qty ? Number(r.qty) : undefined })),
      };
      const res = await fetch("/api/prescription-templates", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Saved as template");
      setSaveTplOpen(false);
      setTplName(""); setTplFollowUp("");
      qc.invalidateQueries({ queryKey: ["/api/prescription-templates"] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild><Link href="/opd"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link></Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold">{visit?.visitNo}</h2>
          <p className="text-sm text-muted-foreground">{visit?.patientName} — {visit?.doctorName}</p>
        </div>
        {!visit?.convertedToIpd && (
          <Dialog open={ipdOpen} onOpenChange={setIpdOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive"><ArrowRightLeft className="h-4 w-4 mr-2" />Convert to IPD</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Convert OPD to IPD Admission</DialogTitle></DialogHeader>
              <form onSubmit={convertToIPD} className="space-y-4">
                <div className="space-y-2">
                  <Label>Ward *</Label>
                  <Select value={ipdForm.wardId} onValueChange={v => setIpdForm(f => ({ ...f, wardId: v, bedId: "" }))}>
                    <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
                    <SelectContent>
                      {(beds || []).filter((b: any, idx: number, arr: any[]) => arr.findIndex(x => x.wardId === b.wardId) === idx).map((b: any) => (
                        <SelectItem key={b.wardId} value={String(b.wardId)}>{b.wardName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bed *</Label>
                  <Select value={ipdForm.bedId} onValueChange={v => setIpdForm(f => ({ ...f, bedId: v }))} disabled={!ipdForm.wardId}>
                    <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
                    <SelectContent>
                      {bedsInWard.map((b: any) => (
                        <SelectItem key={b.id} value={String(b.id)}>Bed {b.bedNo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consultant Doctor</Label>
                  <Select value={ipdForm.consultantDoctorId} onValueChange={v => setIpdForm(f => ({ ...f, consultantDoctorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Same as OPD doctor" /></SelectTrigger>
                    <SelectContent>
                      {(doctors || []).map((d: any) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Admission Note</Label>
                  <Textarea value={ipdForm.admissionNote} onChange={e => setIpdForm(f => ({ ...f, admissionNote: e.target.value }))} placeholder="Admission notes..." />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Transfer OPD Billing</Label>
                  <Switch checked={ipdForm.transferOpdBilling} onCheckedChange={v => setIpdForm(f => ({ ...f, transferOpdBilling: v }))} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Emergency Mode</Label>
                  <Switch checked={ipdForm.emergencyMode} onCheckedChange={v => setIpdForm(f => ({ ...f, emergencyMode: v }))} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setIpdOpen(false)}>Cancel</Button>
                  <Button type="submit" variant="destructive" disabled={submitting}>{submitting ? "Converting…" : "Convert to IPD"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle className="text-sm">Patient</CardTitle></CardHeader><CardContent><p className="font-semibold">{visit?.patientName}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Doctor</CardTitle></CardHeader><CardContent><p className="font-semibold">{visit?.doctorName}</p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
          <CardContent>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${visit?.convertedToIpd ? "bg-blue-100 text-blue-800" : visit?.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
              {visit?.convertedToIpd ? "Converted to IPD" : visit?.status}
            </span>
          </CardContent>
        </Card>
      </div>

      {(visit?.vitals as any) && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" />Vitals</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(visit?.vitals as Record<string, string>).map(([k, v]) => (
                <div key={k} className="bg-muted rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</p>
                  <p className="font-bold mt-1">{v}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" />Load Prescription Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input
            placeholder="Search your template…"
            value={tplSearch}
            onChange={e => setTplSearch(e.target.value)}
            data-testid="tpl-search"
          />
          {(templates || []).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">No templates yet. Create one from any visit using "Save as Template".</div>
          ) : tplSearch.trim() ? (
            filteredTemplates.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-md">No templates match "{tplSearch}".</div>
            ) : (
              <div className="divide-y rounded-md border max-h-64 overflow-auto">
                {filteredTemplates.slice(0, 20).map((t: any) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-accent text-left"
                    data-testid={`tpl-apply-${t.id}`}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm uppercase truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.diagnosis || "—"} · {Array.isArray(t.medicines) ? t.medicines.length : 0} medicines</div>
                    </div>
                    <span className="text-xs text-primary shrink-0">Apply →</span>
                  </button>
                ))}
              </div>
            )
          ) : (
            <p className="text-xs text-muted-foreground">{templates?.length || 0} template{templates?.length === 1 ? "" : "s"} available — type to search, click a result to apply.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" />Clinical Notes <SaveBadge state={saveState} /></CardTitle>
            <div className="flex gap-2 items-center flex-wrap">
              <Button
                size="sm"
                variant="outline"
                className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800"
                onClick={handleGenerateAiDraft}
                disabled={isAiLoading}
              >
                {isAiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin text-indigo-500" />
                    Compiling Draft...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1.5 text-indigo-500" />
                    Generate AI Draft
                  </>
                )}
              </Button>
              <div role="radiogroup" aria-label="Voice dictation language" className="flex items-center gap-1 text-xs text-muted-foreground border rounded px-1.5 py-0.5">
                <Mic className="h-3 w-3" aria-hidden="true" />
                <button type="button" role="radio" aria-checked={voiceLang === "en-IN"} aria-label="English (India)" className={`px-1 rounded ${voiceLang === "en-IN" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setVoiceLang("en-IN")} data-testid="voice-lang-en">EN</button>
                <button type="button" role="radio" aria-checked={voiceLang === "hi-IN"} aria-label="Hindi (India)" className={`px-1 rounded ${voiceLang === "hi-IN" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setVoiceLang("hi-IN")} data-testid="voice-lang-hi">हिं</button>
              </div>
              <Dialog open={saveTplOpen} onOpenChange={setSaveTplOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" data-testid="save-as-template"><BookmarkPlus className="h-4 w-4 mr-1" />Save as Template</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Save current visit as template</DialogTitle></DialogHeader>
                  <form onSubmit={saveAsTemplate} className="space-y-3">
                    <div className="space-y-1.5"><Label>Template Name *</Label><Input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="e.g. Viral Fever Protocol" /></div>
                    <div className="space-y-1.5"><Label>Default Follow-up Days</Label><Input type="number" value={tplFollowUp} onChange={e => setTplFollowUp(e.target.value)} placeholder="e.g. 7" /></div>
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                      Saves: complaints, diagnosis, lab/radiology, advise, special advise, and {rx.length} medicines.
                    </div>
                    <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setSaveTplOpen(false)}>Cancel</Button><Button type="submit">Save Template</Button></div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {aiDraftInfo && (
            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl p-3.5 space-y-3.5 mb-4">
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
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
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
                <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
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

              {/* Investigation summary and highlights */}
              {(((aiDraftInfo as any).draft?.investigationSummary?.labAbnormalities?.length > 0 ||
                (aiDraftInfo as any).draft?.investigationSummary?.imagingCompleted?.length > 0 ||
                (aiDraftInfo as any).draft?.investigationSummary?.imagingPending?.length > 0) ||
                (aiDraftInfo as any).draft?.investigationSummary?.trends?.length > 0) && (
                <div className="space-y-1.5 border-t border-indigo-100/50 pt-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" /> Investigation Review Assistant (Summaries with Links)
                  </h4>
                  <div className="text-[10px] space-y-1 text-slate-700 dark:text-slate-300">
                    {(aiDraftInfo as any).draft.investigationSummary.labAbnormalities?.length > 0 && (
                      <div>
                        <b>Lab Abnormalities:</b>
                        <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                          {(aiDraftInfo as any).draft.investigationSummary.labAbnormalities.map((item: string, i: number) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 hover:underline font-medium">$1</a>') }} />
                          ))}
                        </ul>
                      </div>
                    )}
                    {(aiDraftInfo as any).draft.investigationSummary.imagingCompleted?.length > 0 && (
                      <div className="mt-1">
                        <b>Imaging Completed:</b>
                        <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                          {(aiDraftInfo as any).draft.investigationSummary.imagingCompleted.map((item: string, i: number) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 hover:underline font-medium">$1</a>') }} />
                          ))}
                        </ul>
                      </div>
                    )}
                    {(aiDraftInfo as any).draft.investigationSummary.imagingPending?.length > 0 && (
                      <div className="mt-1">
                        <b>Imaging Pending:</b>
                        <ul className="list-disc pl-4 space-y-0.5 mt-0.5">
                          {(aiDraftInfo as any).draft.investigationSummary.imagingPending.map((item: string, i: number) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: item.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" class="text-indigo-600 hover:underline font-medium">$1</a>') }} />
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline Summary */}
              {aiDraftInfo.timeline && aiDraftInfo.timeline.length > 0 && (
                <div className="space-y-1.5 border-t border-indigo-100/50 pt-3">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-[11px]">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> Chronological Patient History Timeline
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
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Chief Complaints</Label>
                <VoiceDictate lang={voiceLang} title="Chief Complaints" onResult={(t) => appendToField("chiefComplaints", t)} />
              </div>
              <Textarea rows={3} value={clinical.chiefComplaints} onChange={e => patchClinical({ chiefComplaints: e.target.value })} placeholder="Fever × 3 days, cough..." data-testid="chief-complaints" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Diagnosis</Label>
                <VoiceDictate lang={voiceLang} title="Diagnosis" onResult={(t) => appendToField("diagnosis", t)} />
              </div>
              <Textarea rows={3} value={clinical.diagnosis} onChange={e => patchClinical({ diagnosis: e.target.value })} placeholder="Provisional diagnosis..." data-testid="diagnosis" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Lab Tests</Label>
                <VoiceDictate lang={voiceLang} title="Lab Tests" onResult={(t) => appendToField("labTests", t)} />
              </div>
              <Textarea rows={2} value={clinical.labTests} onChange={e => patchClinical({ labTests: e.target.value })} placeholder="CBC, LFT, ..." data-testid="lab-tests" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Radiology Tests</Label>
                <VoiceDictate lang={voiceLang} title="Radiology" onResult={(t) => appendToField("radiologyTests", t)} />
              </div>
              <Textarea rows={2} value={clinical.radiologyTests} onChange={e => patchClinical({ radiologyTests: e.target.value })} placeholder="X-Ray Chest PA, USG Abdomen..." data-testid="radiology-tests" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Advise</Label>
                <VoiceDictate lang={voiceLang} title="Advise" onResult={(t) => appendToField("advise", t)} />
              </div>
              <Textarea rows={3} value={clinical.advise} onChange={e => patchClinical({ advise: e.target.value })} placeholder="Plenty of fluids, rest, ..." data-testid="advise" />
              <div className="flex flex-wrap gap-1 pt-1">
                {ADVICE_CHIPS.map((chip, idx) => (
                  <Button
                    key={idx}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-auto py-1 px-2 text-[11px] font-normal text-left whitespace-normal max-w-full justify-start bg-purple-50 hover:bg-purple-100 border-purple-200"
                    onClick={() => appendAdvice(chip)}
                    data-testid={`advice-chip-${idx}`}
                  >
                    {chip.length > 90 ? chip.slice(0, 90) + "…" : chip}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Special Advise</Label>
                <VoiceDictate lang={voiceLang} title="Special Advise" onResult={(t) => appendToField("specialAdvise", t)} />
              </div>
              <Textarea rows={3} value={clinical.specialAdvise} onChange={e => patchClinical({ specialAdvise: e.target.value })} placeholder="Diabetic diet, low-salt, avoid driving..." data-testid="special-advise" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Next Visit After</Label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1">
                  {NEXT_VISIT_PRESETS.map(p => (
                    <Button
                      key={p.label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setNextVisitDays(p.days)}
                      data-testid={`next-visit-${p.days}`}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs text-muted-foreground">Next Visit Date</Label>
                  <Input type="date" value={clinical.nextVisitDate} onChange={e => patchClinical({ nextVisitDate: e.target.value })} className="h-8 max-w-[160px]" data-testid="next-visit-date" />
                  {clinical.nextVisitDate && (
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => patchClinical({ nextVisitDate: "" })}>Clear</Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2"><Pill className="h-4 w-4" />Prescription (Rx)</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(`${import.meta.env.BASE_URL}opd/${id}/print?mode=plain`, "_blank")} data-testid="print-plain">
                <Printer className="h-4 w-4 mr-1" />Print Plain A4
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(`${import.meta.env.BASE_URL}opd/${id}/print?mode=letterpad`, "_blank")} data-testid="print-letterpad">
                <Printer className="h-4 w-4 mr-1" />Print on Letter Pad
              </Button>
              <Button size="sm" onClick={saveRx} disabled={savingRx} data-testid="save-prescription">
                <Save className="h-4 w-4 mr-1" />{savingRx ? "Saving…" : "Save Prescription"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5 flex-wrap gap-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">Add medicine from pharmacy stock</Label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs bg-indigo-50 hover:bg-indigo-100 border-indigo-200" onClick={copyPreviousRx}>
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Copy Previous Rx
              </Button>
            </div>
            <div className="mt-1.5"><MedicineSearch onSelect={addMedicine} /></div>
            {favorites.length > 0 && (
              <div className="space-y-1 mt-3">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Doctor's Favorites:</div>
                <div className="flex flex-wrap gap-1.5">
                  {favorites.map((f: any) => (
                    <Button
                      key={f.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs bg-amber-50/50 hover:bg-amber-100/50 border-amber-200 gap-1"
                      onClick={() => addMedicine({ id: f.id, name: f.name, genericName: f.genericName, stock: f.stock || 0 })}
                    >
                      ⭐ {f.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Hindi quick-pick chips below each row — click to insert. You can also type Hindi or English directly.</p>
          </div>

          <DrugInteractionAlerts medicines={rx} />

          {safetyWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-2.5">
              <div className="flex items-center gap-2 font-semibold text-amber-800 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
                <span>Prescription Safety Warnings ({safetyWarnings.length})</span>
              </div>
              <ul className="list-disc pl-5 text-[11px] text-amber-700 space-y-1">
                {safetyWarnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {rx.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 border-2 border-dashed rounded-md">No medicines prescribed yet. Search above to add.</div>
          ) : (
            <div className="space-y-3">
              {rx.map((r, i) => (
                <div key={i} className="border rounded-md p-3 space-y-2" data-testid={`rx-row-${i}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className={`font-medium flex items-center gap-2 flex-wrap ${r.stopped ? "line-through text-muted-foreground" : ""}`}>
                        <span>{i + 1}. {r.medicineName}</span>
                        {r.stopped && <Badge variant="secondary" className="text-[9px] bg-amber-100 text-amber-800">Stopped</Badge>}
                        {r.longTerm && <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-800">Long-term</Badge>}
                        {r.highRisk && <Badge variant="destructive" className="text-[9px] font-bold">High Alert</Badge>}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 p-0"
                          onClick={() => toggleFavorite({ id: r.medicineId || 0, name: r.medicineName, genericName: r.genericName })}
                        >
                          <BookmarkPlus className={`h-3.5 w-3.5 ${favorites.some(f => f.id === r.medicineId || f.medicineId === r.medicineId) ? "text-amber-500 fill-amber-500" : "text-muted-foreground"}`} />
                        </Button>
                      </div>
                      {r.genericName && <div className="text-xs text-muted-foreground">{r.genericName}</div>}
                      {r.stockAtPrescribe != null && (
                        <Badge variant={r.stockAtPrescribe <= 0 ? "destructive" : r.stockAtPrescribe < 10 ? "outline" : "secondary"} className="mt-1 text-[10px]">
                          Stock: {r.stockAtPrescribe}
                        </Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRx(i)} data-testid={`rx-remove-${i}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-6">
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Route / मार्ग</Label>
                      <Select value={r.route || "Oral"} onValueChange={v => updateRx(i, { route: v })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Oral" /></SelectTrigger>
                        <SelectContent>
                          {["Oral", "IV", "IM", "SC", "Topical", "Inhalation", "Eye Drops", "Ear Drops", "Other"].map(route => (
                            <SelectItem key={route} value={route} className="text-xs">{route}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Dose / मात्रा</Label>
                      <Input value={r.dose} onChange={e => updateRx(i, { dose: e.target.value })} placeholder="1-0-1" className="h-8" data-testid={`rx-dose-${i}`} />
                      <ChipRow items={HINDI_DOSE} onPick={v => appendChip("dose", i, v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">When / समय</Label>
                      <Input value={r.timing} onChange={e => updateRx(i, { timing: e.target.value })} placeholder="खाना खाने के बाद" className="h-8" data-testid={`rx-timing-${i}`} />
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {["Before Food", "After Food", "With Food", "Bedtime"].map(p => (
                          <Button key={p} type="button" variant="outline" size="sm" className="h-4 px-1 text-[8px] font-normal" onClick={() => updateRx(i, { timing: p })}>{p.split(" ")[0]}</Button>
                        ))}
                      </div>
                      <ChipRow items={HINDI_TIMING} onPick={v => appendChip("timing", i, v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Frequency / आवृत्ति</Label>
                      <Input value={r.frequency} onChange={e => updateRx(i, { frequency: e.target.value })} placeholder="दिन में दो बार" className="h-8" data-testid={`rx-freq-${i}`} />
                      <ChipRow items={HINDI_FREQ} onPick={v => appendChip("frequency", i, v)} />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Duration</Label>
                      <Input value={r.duration} onChange={e => updateRx(i, { duration: e.target.value })} placeholder="5 days" className="h-8" />
                    </div>
                    <div>
                      <Label className="text-[10px] uppercase text-muted-foreground">Qty</Label>
                      <Input value={r.qty} onChange={e => updateRx(i, { qty: e.target.value.replace(/[^0-9]/g, "") })} inputMode="numeric" className="h-8" />
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                    <div className="flex-1 w-full">
                      <Label className="text-[10px] uppercase text-muted-foreground">Notes / Instructions</Label>
                      <Input value={r.notes} onChange={e => updateRx(i, { notes: e.target.value })} placeholder="Optional instructions" className="h-8" />
                    </div>
                    <div className="flex flex-wrap items-center gap-4 pt-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={!!r.longTerm} onChange={e => updateRx(i, { longTerm: e.target.checked })} className="rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 h-3.5 w-3.5" />
                        <span>Long-term</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={!!r.highRisk} onChange={e => updateRx(i, { highRisk: e.target.checked })} className="rounded text-red-600 border-gray-300 focus:ring-red-500 h-3.5 w-3.5" />
                        <span className="text-destructive font-medium">High-risk</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                        <input type="checkbox" checked={!!r.stopped} onChange={e => updateRx(i, { stopped: e.target.checked })} className="rounded text-amber-600 border-gray-300 focus:ring-amber-500 h-3.5 w-3.5" />
                        <span className="text-amber-700">Stopped</span>
                      </label>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-t-4 border-t-indigo-600 bg-indigo-50/5 dark:bg-indigo-950/5 mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 text-base">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            AI Consultation Finalization & Sign-Off
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Please review the generated draft, edit any clinical descriptions and prescriptions as necessary, and click <b>Approve & Finalize Consultation</b> to save the official record.
          </p>

          {aiGenerated && (
            <div className="text-xs space-y-1.5 p-3 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 rounded-lg text-indigo-900 dark:text-indigo-300">
              <p className="font-semibold">⚠️ AI Draft Transparency Disclaimer:</p>
              <p>The notes above contain text generated by <b>{aiDraftInfo?.transparency?.model || "Local AI Engine"}</b>. All clinical decisions, prescriptions, and finalized notes are the sole responsibility of the treating physician.</p>
              <div className="text-[10px] text-muted-foreground mt-1">
                <span>Approved By: {(visit as any)?.approvedBy ? `Doctor #${(visit as any).approvedBy}` : "Pending Approval"}</span>
                {(visit as any)?.approvedAt && <span className="ml-4">Approved At: {new Date((visit as any).approvedAt).toLocaleString()}</span>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 flex-wrap">
            <Button variant="outline" onClick={() => window.open(`${import.meta.env.BASE_URL}opd/${id}/print?mode=plain`, "_blank")}>
              <Printer className="h-4 w-4 mr-1" /> Preview Printable Summary
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
              onClick={handleApprove}
            >
              <Check className="h-4 w-4 mr-1" /> Approve & Finalize Consultation
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
