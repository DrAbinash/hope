export interface DiagnosisSuggestion {
  id: string;
  name: string;
  category: string;
  symptoms: string[];
  findings: string[];
  investigations: string[];
  confidence: number;
  icd10?: string;
  relevance?: number;
}

export const COMMON_DIAGNOSES: DiagnosisSuggestion[] = [
  {
    id: "pneumonia",
    name: "Pneumonia",
    category: "Respiratory",
    symptoms: ["Cough", "Fever", "Shortness of breath", "Chest pain"],
    findings: ["Fever present", "Tachycardia", "Tachypnea", "Cyanosis"],
    investigations: ["CBC", "CXR", "Blood cultures", "Blood glucose"],
    confidence: 0.95,
    icd10: "J15",
  },
  {
    id: "chf",
    name: "Congestive Heart Failure",
    category: "Cardiac",
    symptoms: ["Shortness of breath", "Weakness", "Nausea"],
    findings: ["Edema", "Tachycardia", "Fever present", "Cyanosis"],
    investigations: ["BNP", "ECG", "CXR", "Echocardiography"],
    confidence: 0.90,
    icd10: "I50",
  },
  {
    id: "uti",
    name: "Urinary Tract Infection",
    category: "Infectious",
    symptoms: ["Fever", "Nausea", "Vomiting", "Headache"],
    findings: ["Fever present", "Tachycardia", "Dehydration"],
    investigations: ["Urinalysis", "Urine culture", "Ultrasound"],
    confidence: 0.85,
    icd10: "N39.0",
  },
  {
    id: "acute_gastroenteritis",
    name: "Acute Gastroenteritis",
    category: "GI",
    symptoms: ["Nausea", "Vomiting", "Abdominal pain", "Fever"],
    findings: ["Dehydration", "Pallor", "Fever present"],
    investigations: ["CBC", "Blood glucose", "KFT", "Ultrasound"],
    confidence: 0.88,
    icd10: "A09",
  },
  {
    id: "dengue",
    name: "Dengue Fever",
    category: "Infectious",
    symptoms: ["Fever", "Headache", "Joint pain", "Back pain"],
    findings: ["Fever present", "Tachycardia", "Pallor"],
    investigations: ["CBC", "Dengue serology", "Blood glucose", "LFT"],
    confidence: 0.80,
    icd10: "A90",
  },
  {
    id: "hypertension",
    name: "Hypertension Crisis",
    category: "Cardiac",
    symptoms: ["Headache", "Dizziness", "Chest pain"],
    findings: ["Tachycardia", "Pallor", "Alert & conscious"],
    investigations: ["ECG", "Blood glucose", "KFT"],
    confidence: 0.85,
    icd10: "I11",
  },
  {
    id: "diabetes",
    name: "Diabetes Mellitus",
    category: "Endocrine",
    symptoms: ["Weakness", "Nausea"],
    findings: ["Pallor", "Dehydration"],
    investigations: ["Fasting Blood Sugar", "HbA1c", "Lipid profile"],
    confidence: 0.70,
    icd10: "E11",
  },
  {
    id: "stroke",
    name: "Acute Stroke/CVA",
    category: "Neurological",
    symptoms: ["Headache", "Weakness", "Dizziness"],
    findings: ["Alert & conscious", "Fever present"],
    investigations: ["CT scan", "ECG", "Blood glucose"],
    confidence: 0.85,
    icd10: "I63",
  },
  {
    id: "sepsis",
    name: "Sepsis/Severe Infection",
    category: "Infectious",
    symptoms: ["Fever", "Weakness", "Nausea", "Headache"],
    findings: ["Fever present", "Tachycardia", "Tachypnea", "Pallor"],
    investigations: ["CBC", "Blood cultures", "LFT", "KFT"],
    confidence: 0.90,
    icd10: "R65.2",
  },
  {
    id: "anemia",
    name: "Anemia",
    category: "Hematological",
    symptoms: ["Weakness", "Dizziness", "Shortness of breath"],
    findings: ["Pallor", "Tachycardia", "Tachypnea"],
    investigations: ["Hemoglobin", "Hematocrit", "CBC", "Blood glucose"],
    confidence: 0.80,
    icd10: "D64.9",
  },
  {
    id: "acute_mi",
    name: "Acute Myocardial Infarction",
    category: "Cardiac",
    symptoms: ["Chest pain", "Shortness of breath", "Nausea"],
    findings: ["Tachycardia", "Pallor", "Cyanosis"],
    investigations: ["ECG", "Troponin", "CXR", "Blood glucose"],
    confidence: 0.92,
    icd10: "I21",
  },
  {
    id: "hypoglycemia",
    name: "Hypoglycemia",
    category: "Endocrine",
    symptoms: ["Weakness", "Dizziness", "Headache"],
    findings: ["Tachycardia", "Pallor"],
    investigations: ["Blood glucose", "HbA1c"],
    confidence: 0.75,
    icd10: "E16.2",
  },
  {
    id: "asthma",
    name: "Acute Asthma Exacerbation",
    category: "Respiratory",
    symptoms: ["Cough", "Shortness of breath", "Chest pain"],
    findings: ["Tachypnea", "Cyanosis", "Tachycardia"],
    investigations: ["CXR", "Blood glucose", "Chest X-Ray"],
    confidence: 0.85,
    icd10: "J45.9",
  },
  {
    id: "jaundice",
    name: "Jaundice/Liver Disease",
    category: "Hepatic",
    symptoms: ["Nausea", "Vomiting", "Weakness"],
    findings: ["Jaundice", "Hepatomegaly", "Pallor"],
    investigations: ["LFT", "KFT", "Ultrasound"],
    confidence: 0.88,
    icd10: "R17",
  },
  {
    id: "renal_failure",
    name: "Acute Kidney Injury",
    category: "Renal",
    symptoms: ["Nausea", "Vomiting", "Weakness"],
    findings: ["Dehydration", "Pallor", "Edema"],
    investigations: ["KFT", "Urinalysis", "Ultrasound"],
    confidence: 0.85,
    icd10: "N17.9",
  },
];

export function suggestDiagnoses(
  symptoms: string[],
  findings: string[],
  minConfidence: number = 0.5
): DiagnosisSuggestion[] {
  if (symptoms.length === 0 && findings.length === 0) return [];

  const scored = COMMON_DIAGNOSES.map(diagnosis => {
    let matchScore = 0;
    let totalWeight = 0;

    const normalizedSymptoms = symptoms.map(s => s.toLowerCase());
    const normalizedFindings = findings.map(f => f.toLowerCase());

    diagnosis.symptoms.forEach(symptom => {
      const normalizedSymptom = symptom.toLowerCase();
      const symptonWeight = 0.4;
      if (normalizedSymptoms.some(s => s.includes(normalizedSymptom) || normalizedSymptom.includes(s))) {
        matchScore += symptonWeight;
        totalWeight += symptonWeight;
      }
    });

    diagnosis.findings.forEach(finding => {
      const normalizedFinding = finding.toLowerCase();
      const findingWeight = 0.6;
      if (normalizedFindings.some(f => f.includes(normalizedFinding) || normalizedFinding.includes(f))) {
        matchScore += findingWeight;
        totalWeight += findingWeight;
      }
    });

    const relevance = totalWeight > 0 ? matchScore / totalWeight : 0;
    const adjustedConfidence = (diagnosis.confidence * relevance + diagnosis.confidence) / 2;

    return {
      ...diagnosis,
      confidence: Math.min(adjustedConfidence, 1),
      relevance,
    };
  });

  return scored
    .filter(d => d.confidence >= minConfidence && d.relevance > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200";
  if (confidence >= 0.70) return "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200";
  if (confidence >= 0.55) return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
  return "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200";
}

export function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return "High";
  if (confidence >= 0.70) return "Moderate-High";
  if (confidence >= 0.55) return "Moderate";
  return "Low";
}
