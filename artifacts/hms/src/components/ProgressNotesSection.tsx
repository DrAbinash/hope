import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { FileText, Plus, Edit3, Printer, Clock, User, Heart, ChevronDown, ChevronUp, Sparkles, ShieldAlert, ListTodo, Info, Zap } from "lucide-react";
import VoiceDictationButton from "./VoiceDictationButton";
import DrugInteractionChecker from "./DrugInteractionChecker";
import SmartDiagnosisSuggestions from "./SmartDiagnosisSuggestions";

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

// Quick select templates for common clinical findings
const COMPLAINT_TEMPLATES = [
  "No active complaints",
  "Stable, resting",
  "Mild discomfort",
  "Pain in affected area",
  "Fever",
  "Shortness of breath",
  "Nausea/Vomiting",
  "Dizziness",
];

const VITAL_TEMPLATES = {
  normal: { temp: "98.6", pulse: "72-80", bp: "120/80", rr: "16-20", spo2: "98-100" },
  fever: { temp: "101.2", pulse: "88", bp: "120/80", rr: "18", spo2: "98" },
  tachycardia: { temp: "98.6", pulse: "110", bp: "130/85", rr: "20", spo2: "97" },
  hypotension: { temp: "98.6", pulse: "96", bp: "95/60", rr: "18", spo2: "98" },
};

const CNS_OPTIONS = [
  "Conscious, oriented to time/place/person",
  "Alert and responsive",
  "Drowsy but arousable",
  "Speech clear",
  "Pupils reactive",
  "Limb power normal",
  "No focal neurological deficit",
];

const CVS_OPTIONS = [
  "S1 S2 heard clearly",
  "Regular rate and rhythm",
  "No murmurs",
  "Radial pulse felt",
  "Good perfusion",
  "No edema",
  "BP within normal limits",
];

const RS_OPTIONS = [
  "Bilateral breath sounds clear",
  "No crackles/wheezes",
  "Chest expansion normal",
  "Respiratory rate normal",
  "Oxygen saturation good",
  "No accessory muscle use",
  "Breathing easy",
];

const PA_OPTIONS = [
  "Soft, non-tender",
  "Normal bowel sounds",
  "No distension",
  "No organomegaly",
  "No guarding",
  "Abdomen lax",
  "No rebound tenderness",
];

const DEFAULT_INVESTIGATION_TEMPLATES = [
  "CBC",
  "LFT",
  "KFT",
  "Blood glucose",
  "Lipid profile",
  "Troponin",
  "BNP",
  "CXR",
  "ECG",
  "Ultrasound",
  "CT scan",
  "Blood cultures",
];

const VITAL_RANGES = {
  temp: { min: 98.0, max: 100.4, unit: "°F" },
  pulse: { min: 60, max: 100, unit: "bpm" },
  bp_systolic: { min: 90, max: 140, unit: "mmHg" },
  bp_diastolic: { min: 60, max: 90, unit: "mmHg" },
  rr: { min: 12, max: 20, unit: "/min" },
  spo2: { min: 95, max: 100, unit: "%" },
};

const checkVitalStatus = (vital: string, value: string): "normal" | "warning" | "critical" | "unknown" => {
  if (!value) return "unknown";
  const num = parseFloat(value);
  if (isNaN(num)) return "unknown";

  if (vital === "temp") {
    if (num < 95 || num > 103) return "critical";
    if (num < 98 || num > 100.4) return "warning";
    return "normal";
  }
  if (vital === "pulse") {
    if (num < 40 || num > 140) return "critical";
    if (num < 60 || num > 100) return "warning";
    return "normal";
  }
  if (vital === "bp") {
    const parts = value.split("/");
    const systolic = parseFloat(parts[0]);
    const diastolic = parseFloat(parts[1]);
    if (isNaN(systolic) || isNaN(diastolic)) return "unknown";
    if (systolic < 80 || systolic > 180 || diastolic < 50 || diastolic > 120) return "critical";
    if (systolic < 90 || systolic > 140 || diastolic < 60 || diastolic > 90) return "warning";
    return "normal";
  }
  if (vital === "rr") {
    if (num < 8 || num > 30) return "critical";
    if (num < 12 || num > 20) return "warning";
    return "normal";
  }
  if (vital === "spo2") {
    if (num < 85) return "critical";
    if (num < 95) return "warning";
    return "normal";
  }
  return "unknown";
};

const DEFAULT_SYMPTOMS = [
  "Fever",
  "Cough",
  "Shortness of breath",
  "Chest pain",
  "Abdominal pain",
  "Nausea",
  "Vomiting",
  "Headache",
  "Dizziness",
  "Weakness",
  "Joint pain",
  "Back pain",
];

const DEFAULT_QUICK_FINDINGS = [
  "Alert & conscious",
  "Fever present",
  "Tachycardia",
  "Tachypnea",
  "Hypoxia",
  "Dehydration",
  "Pallor",
  "Jaundice",
  "Cyanosis",
  "Edema",
  "Lymphadenopathy",
  "Hepatomegaly",
];

const DEFAULT_FOLLOWUP_TEMPLATES = [
  "Review vitals 4-hourly",
  "Monitor I/O chart",
  "Strict bed rest",
  "Elevate head end",
  "Deep breathing exercises",
  "Early mobilization",
  "Follow-up labs tomorrow",
  "Review for discharge tomorrow",
  "Contact doctor if condition worsens",
  "Cardiac monitoring if indicated",
];

const DEFAULT_MEDICATION_TEMPLATES = {
  fever: [
    { name: "Paracetamol", dose: "1-1-1" },
    { name: "Ibuprofen", dose: "1-0-1" },
  ],
  painAbdomen: [
    { name: "Omeprazole", dose: "1-0-0" },
    { name: "Ibuprofen", dose: "1-0-1" },
    { name: "Dicyclomine", dose: "1-1-1" },
  ],
  postOp: [
    { name: "Paracetamol", dose: "1-1-1" },
    { name: "Tramadol", dose: "0-0-1" },
    { name: "Omeprazole", dose: "1-0-0" },
  ],
  infection: [
    { name: "Ceftriaxone", dose: "1-0-1" },
    { name: "Metronidazole", dose: "1-1-1" },
    { name: "Paracetamol", dose: "1-1-1" },
  ],
  breathlessness: [
    { name: "Salbutamol", dose: "2-2-2" },
    { name: "Furosmide", dose: "1-0-0" },
    { name: "Oxygen", dose: "PRN" },
  ],
};

const CONDITION_TEMPLATES = {
  chf: {
    name: "Heart Failure (CHF)",
    investigations: ["BNP", "ECG", "CXR", "Troponin", "LFT", "KFT"],
    followups: ["Review vitals 4-hourly", "Monitor I/O chart", "Strict bed rest", "Elevate head end", "Follow-up labs tomorrow"],
    medications: ["fever"]
  },
  pneumonia: {
    name: "Pneumonia",
    investigations: ["CBC", "CXR", "Blood cultures", "Blood glucose", "KFT"],
    followups: ["Review vitals 4-hourly", "Deep breathing exercises", "Oxygen if needed", "Follow-up labs tomorrow"],
    medications: ["fever", "infection"]
  },
  postOp: {
    name: "Post-Operative",
    investigations: ["CBC", "CXR", "KFT"],
    followups: ["Review vitals 4-hourly", "Early mobilization", "Deep breathing exercises", "Review for discharge tomorrow"],
    medications: ["postOp"]
  },
  acuteGastroenteritis: {
    name: "Acute Gastroenteritis",
    investigations: ["CBC", "Blood glucose", "KFT"],
    followups: ["Monitor I/O chart", "Elevate head end", "Contact doctor if condition worsens"],
    medications: ["painAbdomen"]
  },
  sepsis: {
    name: "Sepsis/Infection",
    investigations: ["CBC", "Blood cultures", "LFT", "KFT", "Lactate"],
    followups: ["Review vitals hourly", "Monitor I/O chart", "Cardiac monitoring if indicated"],
    medications: ["fever", "infection"]
  },
  stroke: {
    name: "Stroke/Neuro",
    investigations: ["CT scan", "ECG", "CBC", "Blood glucose", "Coagulation studies"],
    followups: ["Neuro checks 2-hourly", "Strict bed rest", "Contact doctor if condition worsens"],
    medications: ["fever"]
  },
};

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

  // Checkbox templates for systemic examination
  const [selectedCNS, setSelectedCNS] = useState<string[]>([]);
  const [selectedCVS, setSelectedCVS] = useState<string[]>([]);
  const [selectedRS, setSelectedRS] = useState<string[]>([]);
  const [selectedPA, setSelectedPA] = useState<string[]>([]);
  const [selectedInvestigations, setSelectedInvestigations] = useState<string[]>([]);
  const [selectedFollowup, setSelectedFollowup] = useState<string[]>([]);
  const [selectedMedicationTemplates, setSelectedMedicationTemplates] = useState<string[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);

  // Editable templates with localStorage persistence
  const [investigationTemplates, setInvestigationTemplates] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("investigationTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_INVESTIGATION_TEMPLATES;
    }
    return DEFAULT_INVESTIGATION_TEMPLATES;
  });

  const [followupTemplates, setFollowupTemplates] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("followupTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_FOLLOWUP_TEMPLATES;
    }
    return DEFAULT_FOLLOWUP_TEMPLATES;
  });

  const [symptomTemplates, setSymptomTemplates] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("symptomTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_SYMPTOMS;
    }
    return DEFAULT_SYMPTOMS;
  });

  const [findingTemplates, setFindingTemplates] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("findingTemplates");
      return stored ? JSON.parse(stored) : DEFAULT_QUICK_FINDINGS;
    }
    return DEFAULT_QUICK_FINDINGS;
  });

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [selectedFindings, setSelectedFindings] = useState<string[]>([]);

  const [newInvestigation, setNewInvestigation] = useState("");
  const [newFollowup, setNewFollowup] = useState("");
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

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
    setSelectedCNS([]);
    setSelectedCVS([]);
    setSelectedRS([]);
    setSelectedPA([]);
    setSelectedInvestigations([]);
    setSelectedFollowup([]);
    setSelectedMedicationTemplates([]);
    setSelectedConditions([]);
    setSelectedSymptoms([]);
    setSelectedFindings([]);
    setAiGenerated(false);
    setAiDraftInfo(null);
    setAiDraftOriginalValues(null);
  };

  const applyVitalTemplate = (template: keyof typeof VITAL_TEMPLATES) => {
    setForm(f => ({ ...f, vitals: VITAL_TEMPLATES[template] }));
    toast.success(`Applied ${template} vitals template`);
  };

  const toggleSystemicOption = (system: 'cns' | 'cvs' | 'rs' | 'pa', option: string) => {
    if (system === 'cns') {
      const updated = selectedCNS.includes(option)
        ? selectedCNS.filter(x => x !== option)
        : [...selectedCNS, option];
      setSelectedCNS(updated);
      setForm(f => ({ ...f, systemic: { ...f.systemic, cns: updated.join("; ") } }));
    } else if (system === 'cvs') {
      const updated = selectedCVS.includes(option)
        ? selectedCVS.filter(x => x !== option)
        : [...selectedCVS, option];
      setSelectedCVS(updated);
      setForm(f => ({ ...f, systemic: { ...f.systemic, cvs: updated.join("; ") } }));
    } else if (system === 'rs') {
      const updated = selectedRS.includes(option)
        ? selectedRS.filter(x => x !== option)
        : [...selectedRS, option];
      setSelectedRS(updated);
      setForm(f => ({ ...f, systemic: { ...f.systemic, rs: updated.join("; ") } }));
    } else if (system === 'pa') {
      const updated = selectedPA.includes(option)
        ? selectedPA.filter(x => x !== option)
        : [...selectedPA, option];
      setSelectedPA(updated);
      setForm(f => ({ ...f, systemic: { ...f.systemic, pa: updated.join("; ") } }));
    }
  };

  const toggleInvestigation = (inv: string) => {
    const updated = selectedInvestigations.includes(inv)
      ? selectedInvestigations.filter(x => x !== inv)
      : [...selectedInvestigations, inv];
    setSelectedInvestigations(updated);
    setForm(f => ({ ...f, investigations: updated.join(", ") }));
  };

  const toggleFollowup = (followup: string) => {
    const updated = selectedFollowup.includes(followup)
      ? selectedFollowup.filter(x => x !== followup)
      : [...selectedFollowup, followup];
    setSelectedFollowup(updated);
    setForm(f => ({ ...f, followUpInstructions: updated.join("; ") }));
  };

  const addInvestigationTemplate = () => {
    if (newInvestigation.trim() && !investigationTemplates.includes(newInvestigation.trim())) {
      const updated = [...investigationTemplates, newInvestigation.trim()];
      setInvestigationTemplates(updated);
      localStorage.setItem("investigationTemplates", JSON.stringify(updated));
      setNewInvestigation("");
      toast.success("Investigation template added");
    }
  };

  const removeInvestigationTemplate = (inv: string) => {
    const updated = investigationTemplates.filter(x => x !== inv);
    setInvestigationTemplates(updated);
    localStorage.setItem("investigationTemplates", JSON.stringify(updated));
    setSelectedInvestigations(selectedInvestigations.filter(x => x !== inv));
    toast.success("Investigation template removed");
  };

  const addFollowupTemplate = () => {
    if (newFollowup.trim() && !followupTemplates.includes(newFollowup.trim())) {
      const updated = [...followupTemplates, newFollowup.trim()];
      setFollowupTemplates(updated);
      localStorage.setItem("followupTemplates", JSON.stringify(updated));
      setNewFollowup("");
      toast.success("Follow-up template added");
    }
  };

  const removeFollowupTemplate = (followup: string) => {
    const updated = followupTemplates.filter(x => x !== followup);
    setFollowupTemplates(updated);
    localStorage.setItem("followupTemplates", JSON.stringify(updated));
    setSelectedFollowup(selectedFollowup.filter(x => x !== followup));
    toast.success("Follow-up template removed");
  };

  const resetTemplatesToDefault = () => {
    setInvestigationTemplates(DEFAULT_INVESTIGATION_TEMPLATES);
    localStorage.setItem("investigationTemplates", JSON.stringify(DEFAULT_INVESTIGATION_TEMPLATES));
    setFollowupTemplates(DEFAULT_FOLLOWUP_TEMPLATES);
    localStorage.setItem("followupTemplates", JSON.stringify(DEFAULT_FOLLOWUP_TEMPLATES));
    setSymptomTemplates(DEFAULT_SYMPTOMS);
    localStorage.setItem("symptomTemplates", JSON.stringify(DEFAULT_SYMPTOMS));
    setFindingTemplates(DEFAULT_QUICK_FINDINGS);
    localStorage.setItem("findingTemplates", JSON.stringify(DEFAULT_QUICK_FINDINGS));
    toast.success("All templates reset to default");
  };

  const toggleSymptom = (symptom: string) => {
    const updated = selectedSymptoms.includes(symptom)
      ? selectedSymptoms.filter(x => x !== symptom)
      : [...selectedSymptoms, symptom];
    setSelectedSymptoms(updated);
    setForm(f => ({ ...f, subjectiveComplaints: updated.join("; ") }));
  };

  const toggleFinding = (finding: string) => {
    const updated = selectedFindings.includes(finding)
      ? selectedFindings.filter(x => x !== finding)
      : [...selectedFindings, finding];
    setSelectedFindings(updated);
    setForm(f => ({ ...f, objectiveFindings: updated.join("; ") }));
  };

  const addSymptomTemplate = (newSymptom: string) => {
    if (newSymptom.trim() && !symptomTemplates.includes(newSymptom.trim())) {
      const updated = [...symptomTemplates, newSymptom.trim()];
      setSymptomTemplates(updated);
      localStorage.setItem("symptomTemplates", JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const removeSymptomTemplate = (symptom: string) => {
    const updated = symptomTemplates.filter(x => x !== symptom);
    setSymptomTemplates(updated);
    localStorage.setItem("symptomTemplates", JSON.stringify(updated));
    setSelectedSymptoms(selectedSymptoms.filter(x => x !== symptom));
  };

  const addFindingTemplate = (newFinding: string) => {
    if (newFinding.trim() && !findingTemplates.includes(newFinding.trim())) {
      const updated = [...findingTemplates, newFinding.trim()];
      setFindingTemplates(updated);
      localStorage.setItem("findingTemplates", JSON.stringify(updated));
      return true;
    }
    return false;
  };

  const removeFindingTemplate = (finding: string) => {
    const updated = findingTemplates.filter(x => x !== finding);
    setFindingTemplates(updated);
    localStorage.setItem("findingTemplates", JSON.stringify(updated));
    setSelectedFindings(selectedFindings.filter(x => x !== finding));
  };

  const toggleMedicationTemplate = (templateKey: string) => {
    const updated = selectedMedicationTemplates.includes(templateKey)
      ? selectedMedicationTemplates.filter(x => x !== templateKey)
      : [...selectedMedicationTemplates, templateKey];
    setSelectedMedicationTemplates(updated);

    // Merge medications from selected templates
    const mergedMeds: { [key: string]: { name: string; dose: string; action: "Added" | "Stopped" | "Modified" } } = {};
    updated.forEach(key => {
      const meds = DEFAULT_MEDICATION_TEMPLATES[key as keyof typeof DEFAULT_MEDICATION_TEMPLATES];
      if (meds) {
        meds.forEach(med => {
          mergedMeds[med.name] = { name: med.name, dose: med.dose, action: "Added" };
        });
      }
    });

    const finalMeds = Object.values(mergedMeds);
    setForm(f => ({ ...f, medicines: finalMeds }));

    if (updated.length > 0) {
      toast.success(`Merged ${finalMeds.length} medications from ${updated.length} template(s)`);
    }
  };

  const toggleConditionTemplate = (conditionKey: string) => {
    const updated = selectedConditions.includes(conditionKey)
      ? selectedConditions.filter(x => x !== conditionKey)
      : [...selectedConditions, conditionKey];
    setSelectedConditions(updated);

    // Merge all data from selected conditions
    const mergedInv = new Set<string>();
    const mergedFollowup = new Set<string>();
    const mergedMeds: { [key: string]: { name: string; dose: string; action: "Added" | "Stopped" | "Modified" } } = {};

    updated.forEach(key => {
      const condition = CONDITION_TEMPLATES[key as keyof typeof CONDITION_TEMPLATES];
      if (condition) {
        // Merge investigations
        condition.investigations.forEach(inv => mergedInv.add(inv));

        // Merge follow-ups
        condition.followups.forEach(followup => mergedFollowup.add(followup));

        // Merge medications
        condition.medications.forEach(medKey => {
          const meds = DEFAULT_MEDICATION_TEMPLATES[medKey as keyof typeof DEFAULT_MEDICATION_TEMPLATES];
          if (meds) {
            meds.forEach(med => {
              mergedMeds[med.name] = { name: med.name, dose: med.dose, action: "Added" };
            });
          }
        });
      }
    });

    setSelectedInvestigations(Array.from(mergedInv));
    setSelectedFollowup(Array.from(mergedFollowup));
    setForm(f => ({
      ...f,
      investigations: Array.from(mergedInv).join(", "),
      followUpInstructions: Array.from(mergedFollowup).join("; "),
      medicines: Object.values(mergedMeds),
    }));

    if (updated.length > 0) {
      toast.success(`Loaded ${updated.length} condition template(s) - ${Array.from(mergedInv).length} investigations, ${Array.from(mergedFollowup).length} follow-ups, ${Object.keys(mergedMeds).length} medications`);
    }
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

    // Restore checkbox states from existing data
    if (note.examinationSystemic?.cns) {
      setSelectedCNS(note.examinationSystemic.cns.split("; ").filter(Boolean));
    }
    if (note.examinationSystemic?.cvs) {
      setSelectedCVS(note.examinationSystemic.cvs.split("; ").filter(Boolean));
    }
    if (note.examinationSystemic?.rs) {
      setSelectedRS(note.examinationSystemic.rs.split("; ").filter(Boolean));
    }
    if (note.examinationSystemic?.pa) {
      setSelectedPA(note.examinationSystemic.pa.split("; ").filter(Boolean));
    }
    if (note.investigationsAdvised) {
      setSelectedInvestigations(note.investigationsAdvised);
    }
    if (note.followUpInstructions) {
      setSelectedFollowup(note.followUpInstructions.split("; ").filter(Boolean));
    }
  };

  const copyFromPreviousDay = () => {
    if (!notes || notes.length === 0) {
      toast.error("No previous notes to copy from");
      return;
    }
    const prevNote = notes[0]; // Most recent is first
    setForm({
      subjectiveComplaints: prevNote.subjectiveComplaints ? `[From previous day] ${prevNote.subjectiveComplaints}` : "",
      objectiveFindings: prevNote.objectiveFindings ? `[From previous day] ${prevNote.objectiveFindings}` : "",
      vitals: {
        temp: prevNote.vitalsSummary?.temp || "",
        pulse: prevNote.vitalsSummary?.pulse || "",
        bp: prevNote.vitalsSummary?.bp || "",
        rr: prevNote.vitalsSummary?.rr || "",
        spo2: prevNote.vitalsSummary?.spo2 || "",
      },
      systemic: {
        cns: prevNote.examinationSystemic?.cns || "",
        cvs: prevNote.examinationSystemic?.cvs || "",
        rs: prevNote.examinationSystemic?.rs || "",
        pa: prevNote.examinationSystemic?.pa || "",
      },
      diagnosisAssessment: prevNote.diagnosisAssessment || "",
      plan: prevNote.plan || "",
      investigations: Array.isArray(prevNote.investigationsAdvised) ? prevNote.investigationsAdvised.join(", ") : "",
      medicines: [],
      procedureNotes: "",
      followUpInstructions: prevNote.followUpInstructions || "",
    });

    if (prevNote.examinationSystemic?.cns) {
      setSelectedCNS(prevNote.examinationSystemic.cns.split("; ").filter(Boolean));
    }
    if (prevNote.examinationSystemic?.cvs) {
      setSelectedCVS(prevNote.examinationSystemic.cvs.split("; ").filter(Boolean));
    }
    if (prevNote.examinationSystemic?.rs) {
      setSelectedRS(prevNote.examinationSystemic.rs.split("; ").filter(Boolean));
    }
    if (prevNote.examinationSystemic?.pa) {
      setSelectedPA(prevNote.examinationSystemic.pa.split("; ").filter(Boolean));
    }
    if (prevNote.investigationsAdvised) {
      setSelectedInvestigations(prevNote.investigationsAdvised);
    }
    if (prevNote.followUpInstructions) {
      setSelectedFollowup(prevNote.followUpInstructions.split("; ").filter(Boolean));
    }

    setShowAdd(true);
    toast.success("Loaded findings from previous day - edit as needed");
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
          <div className="flex gap-2">
            {notes && notes.length > 0 && (
              <Button size="sm" onClick={copyFromPreviousDay} variant="outline" className="rounded-xl">
                ↻ Copy Previous Day
              </Button>
            )}
            <Button size="sm" onClick={() => { resetForm(); setShowAdd(true); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4 mr-1" /> Add Daily Note
            </Button>
          </div>
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

      {/* Template Editor Dialog */}
      <Dialog open={showTemplateEditor} onOpenChange={setShowTemplateEditor}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Customize Templates & Quick Selections</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-xs">
            {/* Symptoms Editor */}
            <div className="space-y-2 border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20">
              <Label className="font-semibold">Symptoms (Subjective Complaints)</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add new symptom (e.g., Joint pain)"
                  onKeyPress={e => {
                    if (e.key === "Enter") {
                      const inp = e.currentTarget;
                      if (addSymptomTemplate(inp.value)) {
                        inp.value = "";
                        toast.success("Symptom added");
                      }
                    }
                  }}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  onClick={(e) => {
                    const inp = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                    if (inp && addSymptomTemplate(inp.value)) {
                      inp.value = "";
                      toast.success("Symptom added");
                    }
                  }}
                  className="h-8 bg-amber-700 text-white text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {symptomTemplates.map(symptom => (
                  <Badge key={symptom} variant="secondary" className="flex items-center gap-1 text-[10px] bg-amber-100">
                    {symptom}
                    <button
                      type="button"
                      onClick={() => { removeSymptomTemplate(symptom); toast.success("Symptom removed"); }}
                      className="text-red-600 font-bold ml-1 hover:text-red-800"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Findings Editor */}
            <div className="space-y-2 border rounded-lg p-3 bg-blue-50/50 dark:bg-blue-950/20">
              <Label className="font-semibold">Physical Findings (Objective)</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add new finding (e.g., Splenomegaly)"
                  onKeyPress={e => {
                    if (e.key === "Enter") {
                      const inp = e.currentTarget;
                      if (addFindingTemplate(inp.value)) {
                        inp.value = "";
                        toast.success("Finding added");
                      }
                    }
                  }}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  onClick={(e) => {
                    const inp = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                    if (inp && addFindingTemplate(inp.value)) {
                      inp.value = "";
                      toast.success("Finding added");
                    }
                  }}
                  className="h-8 bg-blue-700 text-white text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {findingTemplates.map(finding => (
                  <Badge key={finding} variant="secondary" className="flex items-center gap-1 text-[10px] bg-blue-100">
                    {finding}
                    <button
                      type="button"
                      onClick={() => { removeFindingTemplate(finding); toast.success("Finding removed"); }}
                      className="text-red-600 font-bold ml-1 hover:text-red-800"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Investigations Editor */}
            <div className="space-y-2 border rounded-lg p-3 bg-purple-50/50 dark:bg-purple-950/20">
              <Label className="font-semibold">Investigation Templates</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add new investigation (e.g., MRI Brain)"
                  value={newInvestigation}
                  onChange={e => setNewInvestigation(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && addInvestigationTemplate()}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  onClick={addInvestigationTemplate}
                  className="h-8 bg-purple-700 text-white text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {investigationTemplates.map(inv => (
                  <Badge key={inv} variant="secondary" className="flex items-center gap-1 text-[10px] bg-purple-100">
                    {inv}
                    <button
                      type="button"
                      onClick={() => removeInvestigationTemplate(inv)}
                      className="text-red-600 font-bold ml-1 hover:text-red-800"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Follow-up Editor */}
            <div className="space-y-2 border rounded-lg p-3 bg-cyan-50/50 dark:bg-cyan-950/20">
              <Label className="font-semibold">Follow-up Templates</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  placeholder="Add new follow-up instruction"
                  value={newFollowup}
                  onChange={e => setNewFollowup(e.target.value)}
                  onKeyPress={e => e.key === "Enter" && addFollowupTemplate()}
                  className="h-8 text-xs flex-1"
                />
                <Button
                  type="button"
                  onClick={addFollowupTemplate}
                  className="h-8 bg-cyan-700 text-white text-xs rounded-lg"
                >
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {followupTemplates.map(followup => (
                  <Badge key={followup} variant="secondary" className="flex items-center gap-1 text-[10px] bg-cyan-100">
                    {followup}
                    <button
                      type="button"
                      onClick={() => removeFollowupTemplate(followup)}
                      className="text-red-600 font-bold ml-1 hover:text-red-800"
                    >
                      ×
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetTemplatesToDefault}
              className="w-full text-xs"
            >
              Reset All Templates to Defaults
            </Button>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowTemplateEditor(false)}
              className="rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            {/* Subjective Complaints - Chocolate Box Selector */}
            <div className="border p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-amber-500" /> Symptoms (Click to Select)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTemplateEditor(true)}
                  className="h-6 text-xs text-slate-500 hover:text-slate-700"
                >
                  ⚙ Customize
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg max-h-40 overflow-y-auto">
                {symptomTemplates.map(symptom => (
                  <button
                    key={symptom}
                    type="button"
                    onClick={() => toggleSymptom(symptom)}
                    className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
                      selectedSymptoms.includes(symptom)
                        ? "bg-amber-400 text-amber-900 border-amber-600 shadow-md scale-105"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-amber-200 dark:border-amber-800 hover:shadow-sm hover:border-amber-400"
                    }`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <Textarea value={form.subjectiveComplaints} onChange={e => setForm(f => ({ ...f, subjectiveComplaints: e.target.value }))} className="h-14 rounded-lg text-xs flex-1" placeholder="Or type custom complaints..." />
                <VoiceDictationButton
                  onText={(text) => setForm(f => ({ ...f, subjectiveComplaints: f.subjectiveComplaints ? f.subjectiveComplaints + " " + text : text }))}
                  tooltip="Hold to dictate complaints"
                />
              </div>
            </div>

            {/* Objective Findings - Chocolate Box Selector */}
            <div className="border p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-blue-500" /> Physical Findings (Click to Select)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTemplateEditor(true)}
                  className="h-6 text-xs text-slate-500 hover:text-slate-700"
                >
                  ⚙ Customize
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg max-h-40 overflow-y-auto">
                {findingTemplates.map(finding => (
                  <button
                    key={finding}
                    type="button"
                    onClick={() => toggleFinding(finding)}
                    className={`px-3 py-2 text-xs rounded-lg border-2 font-semibold transition ${
                      selectedFindings.includes(finding)
                        ? "bg-blue-400 text-blue-900 border-blue-600 shadow-md scale-105"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-blue-200 dark:border-blue-800 hover:shadow-sm hover:border-blue-400"
                    }`}
                  >
                    {finding}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <Textarea value={form.objectiveFindings} onChange={e => setForm(f => ({ ...f, objectiveFindings: e.target.value }))} className="h-14 rounded-lg text-xs flex-1" placeholder="Or type custom findings..." />
                <VoiceDictationButton
                  onText={(text) => setForm(f => ({ ...f, objectiveFindings: f.objectiveFindings ? f.objectiveFindings + " " + text : text }))}
                  tooltip="Hold to dictate findings"
                />
              </div>
            </div>

            {/* Vitals Summary with Quick Templates */}
            <div className="border p-3 rounded-xl space-y-2">
              <Label className="font-semibold flex items-center gap-1"><Heart className="w-3.5 h-3.5 text-rose-500" /> Vitals Summary (Quick Templates)</Label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {Object.keys(VITAL_TEMPLATES).map(key => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyVitalTemplate(key as keyof typeof VITAL_TEMPLATES)}
                    className="h-7 text-xs rounded-lg capitalize"
                  >
                    {key === 'normal' ? '✓ Normal' : key}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    Temp (°F)
                    {checkVitalStatus("temp", form.vitals.temp) === "critical" && <ShieldAlert className="w-3 h-3 text-red-600" />}
                    {checkVitalStatus("temp", form.vitals.temp) === "warning" && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                  </Label>
                  <Input
                    size={5}
                    value={form.vitals.temp}
                    onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, temp: e.target.value } }))}
                    className={`mt-1 h-8 rounded-lg text-xs border ${
                      checkVitalStatus("temp", form.vitals.temp) === "critical" ? "border-red-500 bg-red-50" :
                      checkVitalStatus("temp", form.vitals.temp) === "warning" ? "border-orange-500 bg-orange-50" : ""
                    }`}
                    placeholder="98.6"
                  />
                </div>
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    Pulse (bpm)
                    {checkVitalStatus("pulse", form.vitals.pulse) === "critical" && <ShieldAlert className="w-3 h-3 text-red-600" />}
                    {checkVitalStatus("pulse", form.vitals.pulse) === "warning" && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                  </Label>
                  <Input
                    value={form.vitals.pulse}
                    onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, pulse: e.target.value } }))}
                    className={`mt-1 h-8 rounded-lg text-xs border ${
                      checkVitalStatus("pulse", form.vitals.pulse) === "critical" ? "border-red-500 bg-red-50" :
                      checkVitalStatus("pulse", form.vitals.pulse) === "warning" ? "border-orange-500 bg-orange-50" : ""
                    }`}
                    placeholder="72"
                  />
                </div>
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    BP (mmHg)
                    {checkVitalStatus("bp", form.vitals.bp) === "critical" && <ShieldAlert className="w-3 h-3 text-red-600" />}
                    {checkVitalStatus("bp", form.vitals.bp) === "warning" && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                  </Label>
                  <Input
                    value={form.vitals.bp}
                    onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, bp: e.target.value } }))}
                    className={`mt-1 h-8 rounded-lg text-xs border ${
                      checkVitalStatus("bp", form.vitals.bp) === "critical" ? "border-red-500 bg-red-50" :
                      checkVitalStatus("bp", form.vitals.bp) === "warning" ? "border-orange-500 bg-orange-50" : ""
                    }`}
                    placeholder="120/80"
                  />
                </div>
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    Resp Rate (/min)
                    {checkVitalStatus("rr", form.vitals.rr) === "critical" && <ShieldAlert className="w-3 h-3 text-red-600" />}
                    {checkVitalStatus("rr", form.vitals.rr) === "warning" && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                  </Label>
                  <Input
                    value={form.vitals.rr}
                    onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, rr: e.target.value } }))}
                    className={`mt-1 h-8 rounded-lg text-xs border ${
                      checkVitalStatus("rr", form.vitals.rr) === "critical" ? "border-red-500 bg-red-50" :
                      checkVitalStatus("rr", form.vitals.rr) === "warning" ? "border-orange-500 bg-orange-50" : ""
                    }`}
                    placeholder="18"
                  />
                </div>
                <div>
                  <Label className="text-[10px] flex items-center gap-1">
                    SpO2 (%)
                    {checkVitalStatus("spo2", form.vitals.spo2) === "critical" && <ShieldAlert className="w-3 h-3 text-red-600" />}
                    {checkVitalStatus("spo2", form.vitals.spo2) === "warning" && <ShieldAlert className="w-3 h-3 text-orange-500" />}
                  </Label>
                  <Input
                    value={form.vitals.spo2}
                    onChange={e => setForm(f => ({ ...f, vitals: { ...f.vitals, spo2: e.target.value } }))}
                    className={`mt-1 h-8 rounded-lg text-xs border ${
                      checkVitalStatus("spo2", form.vitals.spo2) === "critical" ? "border-red-500 bg-red-50" :
                      checkVitalStatus("spo2", form.vitals.spo2) === "warning" ? "border-orange-500 bg-orange-50" : ""
                    }`}
                    placeholder="98"
                  />
                </div>
              </div>
            </div>

            {/* Systemic Examination with Checkboxes */}
            <div className="border p-3 rounded-xl space-y-3">
              <Label className="font-semibold">Systemic Examination (Check Common Findings)</Label>

              <div className="grid grid-cols-2 gap-4">
                {/* CNS */}
                <div className="border rounded-lg p-2 space-y-2 bg-slate-50/50 dark:bg-slate-900/20">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">CNS (Central Nervous)</Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {CNS_OPTIONS.map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          id={`cns-${option}`}
                          checked={selectedCNS.includes(option)}
                          onCheckedChange={() => toggleSystemicOption('cns', option)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`cns-${option}`} className="text-[10px] cursor-pointer font-normal">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* CVS */}
                <div className="border rounded-lg p-2 space-y-2 bg-red-50/30 dark:bg-red-950/20">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">CVS (Cardiovascular)</Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {CVS_OPTIONS.map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          id={`cvs-${option}`}
                          checked={selectedCVS.includes(option)}
                          onCheckedChange={() => toggleSystemicOption('cvs', option)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`cvs-${option}`} className="text-[10px] cursor-pointer font-normal">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* RS */}
                <div className="border rounded-lg p-2 space-y-2 bg-blue-50/30 dark:bg-blue-950/20">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">RS (Respiratory)</Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {RS_OPTIONS.map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          id={`rs-${option}`}
                          checked={selectedRS.includes(option)}
                          onCheckedChange={() => toggleSystemicOption('rs', option)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`rs-${option}`} className="text-[10px] cursor-pointer font-normal">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* PA */}
                <div className="border rounded-lg p-2 space-y-2 bg-green-50/30 dark:bg-green-950/20">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">PA (Abdominal)</Label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {PA_OPTIONS.map(option => (
                      <div key={option} className="flex items-center gap-2">
                        <Checkbox
                          id={`pa-${option}`}
                          checked={selectedPA.includes(option)}
                          onCheckedChange={() => toggleSystemicOption('pa', option)}
                          className="h-4 w-4"
                        />
                        <Label htmlFor={`pa-${option}`} className="text-[10px] cursor-pointer font-normal">{option}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Diagnosis Suggestions */}
            {(selectedSymptoms.length > 0 || selectedFindings.length > 0) && (
              <SmartDiagnosisSuggestions
                symptoms={selectedSymptoms}
                findings={selectedFindings}
                onSelectDiagnosis={(diagnosis) => {
                  setForm(f => ({ ...f, diagnosisAssessment: diagnosis }));
                }}
              />
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Diagnosis / Assessment</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Textarea value={form.diagnosisAssessment} onChange={e => setForm(f => ({ ...f, diagnosisAssessment: e.target.value }))} className="h-16 rounded-xl flex-1" placeholder="Clinical assessment..." />
                  <VoiceDictationButton
                    onText={(text) => setForm(f => ({ ...f, diagnosisAssessment: f.diagnosisAssessment ? f.diagnosisAssessment + " " + text : text }))}
                    tooltip="Hold to dictate assessment"
                  />
                </div>
              </div>
              <div>
                <Label>Treatment Plan</Label>
                <div className="flex gap-2 items-center mt-1">
                  <Textarea value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} className="h-16 rounded-xl flex-1" placeholder="Plan details..." />
                  <VoiceDictationButton
                    onText={(text) => setForm(f => ({ ...f, plan: f.plan ? f.plan + " " + text : text }))}
                    tooltip="Hold to dictate plan"
                  />
                </div>
              </div>
            </div>

            {/* Medicines Changed */}
            <div className="border p-3 rounded-xl space-y-2">
              <Label className="font-semibold">Medicines Changed / Adjusted</Label>

              {/* Medication Quick Select Templates */}
              <div className="bg-slate-50 dark:bg-slate-900/30 p-2 rounded-lg space-y-1.5 mb-2 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">Quick Select by Condition:</div>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(DEFAULT_MEDICATION_TEMPLATES).map(key => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={selectedMedicationTemplates.includes(key) ? "default" : "outline"}
                      onClick={() => toggleMedicationTemplate(key)}
                      className="h-6 text-xs rounded-lg capitalize"
                    >
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Button>
                  ))}
                </div>
              </div>

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

              {form.medicines.length > 1 && (
                <div className="mt-3">
                  <DrugInteractionChecker medicines={form.medicines.map(m => m.name)} />
                </div>
              )}
            </div>

            {/* Condition-Based Quick Select */}
            <div className="border p-3 rounded-xl space-y-2 bg-indigo-50/30 dark:bg-indigo-950/20">
              <Label className="font-semibold">Select by Condition (Quick Fill)</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(CONDITION_TEMPLATES).map(([key, template]) => (
                  <Button
                    key={key}
                    type="button"
                    size="sm"
                    variant={selectedConditions.includes(key) ? "default" : "outline"}
                    onClick={() => toggleConditionTemplate(key)}
                    className="h-7 text-xs rounded-lg"
                  >
                    {template.name}
                  </Button>
                ))}
              </div>
              {selectedConditions.length > 0 && (
                <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1">
                  ✓ {selectedConditions.length} condition(s) selected - will merge investigations, follow-ups & meds
                </div>
              )}
            </div>

            {/* Investigations with Quick Select */}
            <div className="border p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-purple-500" /> Investigations Advised (Quick Select)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTemplateEditor(true)}
                  className="h-6 text-xs text-slate-500 hover:text-slate-700"
                >
                  ⚙ Customize
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {investigationTemplates.map(inv => (
                  <Button
                    key={inv}
                    type="button"
                    size="sm"
                    variant={selectedInvestigations.includes(inv) ? "default" : "outline"}
                    onClick={() => toggleInvestigation(inv)}
                    className="h-7 text-xs rounded-lg"
                  >
                    {inv}
                  </Button>
                ))}
              </div>
              <Input value={form.investigations} onChange={e => setForm(f => ({ ...f, investigations: e.target.value }))} className="h-9 rounded-lg text-xs" placeholder="Or enter custom investigations..." />
            </div>

            {/* Procedure Notes */}
            <div>
              <Label>Procedure Notes</Label>
              <div className="flex gap-2 items-center mt-1">
                <Input value={form.procedureNotes} onChange={e => setForm(f => ({ ...f, procedureNotes: e.target.value }))} className="h-9 rounded-lg text-xs flex-1" placeholder="e.g. Catheterization, Aspiration..." />
                <VoiceDictationButton
                  onText={(text) => setForm(f => ({ ...f, procedureNotes: f.procedureNotes ? f.procedureNotes + " " + text : text }))}
                  tooltip="Hold to dictate procedures"
                />
              </div>
            </div>

            {/* Follow-up Instructions with Quick Select */}
            <div className="border p-3 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-semibold flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-blue-500" /> Follow-Up Instructions (Quick Select)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowTemplateEditor(true)}
                  className="h-6 text-xs text-slate-500 hover:text-slate-700"
                >
                  ⚙ Customize
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {followupTemplates.map(followup => (
                  <Button
                    key={followup}
                    type="button"
                    size="sm"
                    variant={selectedFollowup.includes(followup) ? "default" : "outline"}
                    onClick={() => toggleFollowup(followup)}
                    className="h-7 text-xs rounded-lg"
                  >
                    {followup}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <Input value={form.followUpInstructions} onChange={e => setForm(f => ({ ...f, followUpInstructions: e.target.value }))} className="h-9 rounded-lg text-xs flex-1" placeholder="Or enter custom follow-up..." />
                <VoiceDictationButton
                  onText={(text) => setForm(f => ({ ...f, followUpInstructions: f.followUpInstructions ? f.followUpInstructions + " " + text : text }))}
                  tooltip="Hold to dictate follow-up"
                />
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
