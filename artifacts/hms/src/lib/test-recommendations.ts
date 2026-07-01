export interface TestRecommendation {
  test: string;
  type: "lab" | "radiology" | "procedure";
  priority: "critical" | "important" | "optional";
  reason: string;
  timing: string;
}

interface DiagnosisTests {
  critical: TestRecommendation[];
  important: TestRecommendation[];
  optional: TestRecommendation[];
}

export const DIAGNOSIS_TEST_MAP: Record<string, DiagnosisTests> = {
  "pneumonia": {
    critical: [
      { test: "CBC", type: "lab", priority: "critical", reason: "WBC count helps assess severity", timing: "Immediately" },
      { test: "Chest X-Ray", type: "radiology", priority: "critical", reason: "Confirm diagnosis and assess extent", timing: "Immediately" },
    ],
    important: [
      { test: "Blood Culture", type: "lab", priority: "important", reason: "Identify causative organism", timing: "Before antibiotics" },
      { test: "Sputum Culture", type: "lab", priority: "important", reason: "Organism sensitivity testing", timing: "Within 24 hours" },
      { test: "Blood Glucose", type: "lab", priority: "important", reason: "Monitor for hyperglycemia", timing: "Daily" },
    ],
    optional: [
      { test: "CT Chest", type: "radiology", priority: "optional", reason: "If complications suspected", timing: "If no improvement in 48 hours" },
    ],
  },
  "heart failure": {
    critical: [
      { test: "BNP", type: "lab", priority: "critical", reason: "Gold standard for HF diagnosis", timing: "Immediately" },
      { test: "ECG", type: "procedure", priority: "critical", reason: "Assess for ischemia/arrhythmias", timing: "Immediately" },
      { test: "CXR", type: "radiology", priority: "critical", reason: "Assess pulmonary congestion", timing: "Immediately" },
    ],
    important: [
      { test: "Troponin", type: "lab", priority: "important", reason: "Rule out MI", timing: "Immediately" },
      { test: "LFT", type: "lab", priority: "important", reason: "Assess liver congestion", timing: "Within 24 hours" },
      { test: "KFT", type: "lab", priority: "important", reason: "Monitor renal function", timing: "Within 24 hours" },
      { test: "Echocardiography", type: "radiology", priority: "important", reason: "Assess EF and valve function", timing: "Within 48 hours" },
    ],
    optional: [
      { test: "Coronary Angiography", type: "procedure", priority: "optional", reason: "If ischemic HF suspected", timing: "After stabilization" },
    ],
  },
  "diabetes mellitus": {
    critical: [
      { test: "Fasting Blood Sugar", type: "lab", priority: "critical", reason: "Confirm diagnosis", timing: "Immediately" },
      { test: "HbA1c", type: "lab", priority: "critical", reason: "Assess glycemic control", timing: "Immediately" },
    ],
    important: [
      { test: "Lipid Profile", type: "lab", priority: "important", reason: "Cardiovascular risk assessment", timing: "Within 48 hours" },
      { test: "KFT", type: "lab", priority: "important", reason: "Baseline for medications", timing: "Within 48 hours" },
      { test: "Urine Routine", type: "lab", priority: "important", reason: "Screen for complications", timing: "Within 48 hours" },
      { test: "Microalbumin", type: "lab", priority: "important", reason: "Early nephropathy detection", timing: "Within 1 week" },
    ],
    optional: [
      { test: "Thyroid Profile", type: "lab", priority: "optional", reason: "Type 1 diabetes complications", timing: "1st visit" },
      { test: "ECG", type: "procedure", priority: "optional", reason: "Baseline cardiac assessment", timing: "Risk stratification" },
    ],
  },
  "urinary tract infection": {
    critical: [
      { test: "Urinalysis", type: "lab", priority: "critical", reason: "Confirm diagnosis", timing: "Immediately" },
      { test: "Urine Culture", type: "lab", priority: "critical", reason: "Identify organism and sensitivity", timing: "Before antibiotics" },
    ],
    important: [
      { test: "Ultrasound Abdomen", type: "radiology", priority: "important", reason: "Rule out obstruction/hydronephrosis", timing: "If recurrent" },
      { test: "Blood Culture", type: "lab", priority: "important", reason: "Assess for bacteremia", timing: "If febrile" },
      { test: "KFT", type: "lab", priority: "important", reason: "Baseline for treatment", timing: "If recurrent" },
    ],
    optional: [
      { test: "CT KUB", type: "radiology", priority: "optional", reason: "Detailed imaging if complications", timing: "If stones suspected" },
    ],
  },
  "hypertension": {
    critical: [
      { test: "Blood Pressure (24-hour)", type: "procedure", priority: "critical", reason: "Confirm diagnosis", timing: "Immediately" },
      { test: "ECG", type: "procedure", priority: "critical", reason: "Assess LVH and ischemia", timing: "Immediately" },
    ],
    important: [
      { test: "KFT", type: "lab", priority: "important", reason: "Baseline for ACE inhibitors", timing: "Within 48 hours" },
      { test: "Lipid Profile", type: "lab", priority: "important", reason: "Cardiovascular risk", timing: "Within 48 hours" },
      { test: "Urine Microalbumin", type: "lab", priority: "important", reason: "Early kidney damage", timing: "Within 48 hours" },
    ],
    optional: [
      { test: "Renal Ultrasound", type: "radiology", priority: "optional", reason: "Rule out renal artery stenosis", timing: "If resistant HTN" },
      { test: "Echocardiography", type: "radiology", priority: "optional", reason: "Assess LVH severity", timing: "If ECG abnormal" },
    ],
  },
  "sepsis": {
    critical: [
      { test: "CBC", type: "lab", priority: "critical", reason: "WBC elevation/leucopenia", timing: "Immediately" },
      { test: "Blood Culture", type: "lab", priority: "critical", reason: "Identify organism", timing: "Before antibiotics" },
      { test: "Lactate", type: "lab", priority: "critical", reason: "Marker of tissue hypoxia", timing: "Immediately" },
    ],
    important: [
      { test: "LFT", type: "lab", priority: "important", reason: "Multi-organ involvement", timing: "Immediately" },
      { test: "KFT", type: "lab", priority: "important", reason: "AKI assessment", timing: "Immediately" },
      { test: "PT/INR", type: "lab", priority: "important", reason: "DIC screening", timing: "Immediately" },
      { test: "Procalcitonin", type: "lab", priority: "important", reason: "Bacterial infection marker", timing: "Immediately" },
    ],
    optional: [
      { test: "Imaging (relevant)", type: "radiology", priority: "optional", reason: "Identify source", timing: "After stabilization" },
    ],
  },
  "acute stroke": {
    critical: [
      { test: "CT Brain", type: "radiology", priority: "critical", reason: "Ischemic vs hemorrhagic", timing: "Within 1 hour" },
      { test: "ECG", type: "procedure", priority: "critical", reason: "Cardiac source of embolus", timing: "Immediately" },
    ],
    important: [
      { test: "Blood Glucose", type: "lab", priority: "important", reason: "Hypoglycemia mimics stroke", timing: "Immediately" },
      { test: "CBC", type: "lab", priority: "important", reason: "Hemoglobin for perfusion", timing: "Immediately" },
      { test: "PT/INR", type: "lab", priority: "important", reason: "Bleeding risk", timing: "Immediately" },
      { test: "Lipid Profile", type: "lab", priority: "important", reason: "Secondary prevention", timing: "Within 48 hours" },
    ],
    optional: [
      { test: "MRI Brain", type: "radiology", priority: "optional", reason: "Ischemic lesion detection", timing: "If CT negative" },
      { test: "Carotid Ultrasound", type: "radiology", priority: "optional", reason: "Assess for stenosis", timing: "After stabilization" },
    ],
  },
};

export function getRecommendationsForDiagnosis(diagnosis: string): DiagnosisTests | null {
  const diagnosisLower = diagnosis.toLowerCase();
  
  for (const [key, value] of Object.entries(DIAGNOSIS_TEST_MAP)) {
    if (diagnosisLower.includes(key) || key.includes(diagnosisLower)) {
      return value;
    }
  }
  
  return null;
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
    case "important":
      return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
    case "optional":
      return "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200";
    default:
      return "bg-slate-100 dark:bg-slate-800";
  }
}

export function getPriorityIcon(priority: string): string {
  switch (priority) {
    case "critical":
      return "🚨";
    case "important":
      return "⚠️";
    case "optional":
      return "ℹ️";
    default:
      return "•";
  }
}
