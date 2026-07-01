export interface ICDCode {
  code: string;
  description: string;
  category: string;
  symptoms: string[];
  severity: "mild" | "moderate" | "severe";
}

export const SYMPTOM_ICD_MAPPINGS: ICDCode[] = [
  // Fever/Temperature related
  {
    code: "R50.9",
    description: "Fever, unspecified",
    category: "General Symptoms",
    symptoms: ["Fever", "High temperature", "Heat"],
    severity: "moderate",
  },
  {
    code: "R50.1",
    description: "Persistent fever",
    category: "General Symptoms",
    symptoms: ["Persistent fever", "Prolonged fever", "Chronic fever"],
    severity: "moderate",
  },

  // Cough
  {
    code: "R05.9",
    description: "Cough, unspecified",
    category: "Respiratory Symptoms",
    symptoms: ["Cough", "Dry cough", "Wet cough"],
    severity: "mild",
  },
  {
    code: "R05.1",
    description: "Acute cough",
    category: "Respiratory Symptoms",
    symptoms: ["Acute cough", "Recent cough"],
    severity: "mild",
  },

  // Shortness of breath
  {
    code: "R06.0",
    description: "Dyspnea",
    category: "Respiratory Symptoms",
    symptoms: ["Shortness of breath", "Dyspnea", "Breathlessness", "Difficulty breathing"],
    severity: "moderate",
  },
  {
    code: "R06.0",
    description: "Dyspnea - moderate exertion",
    category: "Respiratory Symptoms",
    symptoms: ["Shortness of breath on exertion", "Exertional dyspnea"],
    severity: "moderate",
  },

  // Chest pain
  {
    code: "R07.9",
    description: "Chest pain, unspecified",
    category: "Cardiac/Thoracic Symptoms",
    symptoms: ["Chest pain", "Chest discomfort"],
    severity: "moderate",
  },
  {
    code: "R07.2",
    description: "Precordial pain",
    category: "Cardiac/Thoracic Symptoms",
    symptoms: ["Precordial pain", "Heart pain"],
    severity: "moderate",
  },

  // Abdominal pain
  {
    code: "R10.9",
    description: "Abdominal pain, unspecified",
    category: "GI Symptoms",
    symptoms: ["Abdominal pain", "Stomach pain", "Belly pain"],
    severity: "moderate",
  },
  {
    code: "R10.1",
    description: "Pain localized to upper abdomen",
    category: "GI Symptoms",
    symptoms: ["Upper abdominal pain", "Epigastric pain"],
    severity: "moderate",
  },
  {
    code: "R10.3",
    description: "Pain localized to lower abdomen",
    category: "GI Symptoms",
    symptoms: ["Lower abdominal pain", "Pelvic pain"],
    severity: "moderate",
  },

  // Nausea/Vomiting
  {
    code: "R11.0",
    description: "Nausea",
    category: "GI Symptoms",
    symptoms: ["Nausea", "Feeling sick", "Queasiness"],
    severity: "mild",
  },
  {
    code: "R11.1",
    description: "Vomiting",
    category: "GI Symptoms",
    symptoms: ["Vomiting", "Throwing up"],
    severity: "moderate",
  },

  // Headache
  {
    code: "R51.9",
    description: "Headache, unspecified",
    category: "Neurological Symptoms",
    symptoms: ["Headache", "Head pain", "Migraine"],
    severity: "mild",
  },
  {
    code: "G43.9",
    description: "Migraine, unspecified",
    category: "Neurological Symptoms",
    symptoms: ["Migraine", "Severe headache", "Throbbing headache"],
    severity: "moderate",
  },

  // Dizziness/Vertigo
  {
    code: "R42",
    description: "Dizziness and giddiness",
    category: "Neurological Symptoms",
    symptoms: ["Dizziness", "Vertigo", "Lightheadedness", "Giddiness"],
    severity: "mild",
  },

  // Weakness
  {
    code: "R53.1",
    description: "Weakness",
    category: "General Symptoms",
    symptoms: ["Weakness", "Fatigue", "Tiredness", "Lethargy"],
    severity: "mild",
  },

  // Joint/Back pain
  {
    code: "M25.5",
    description: "Pain in joint",
    category: "Musculoskeletal",
    symptoms: ["Joint pain", "Arthralgia", "Body ache"],
    severity: "mild",
  },
  {
    code: "M54.5",
    description: "Low back pain",
    category: "Musculoskeletal",
    symptoms: ["Back pain", "Lower back pain", "Lumbar pain"],
    severity: "mild",
  },

  // Respiratory infections
  {
    code: "J15.9",
    description: "Pneumonia, unspecified",
    category: "Respiratory Infections",
    symptoms: ["Pneumonia", "Lung infection", "Lower respiratory infection"],
    severity: "severe",
  },
  {
    code: "J20.9",
    description: "Acute bronchitis, unspecified",
    category: "Respiratory Infections",
    symptoms: ["Bronchitis", "Chest cold", "Acute cough"],
    severity: "moderate",
  },

  // Gastrointestinal infections
  {
    code: "A09",
    description: "Diarrhea and gastroenteritis",
    category: "GI Infections",
    symptoms: ["Gastroenteritis", "Diarrhea", "Food poisoning", "Viral gastroenteritis"],
    severity: "moderate",
  },

  // Urinary symptoms
  {
    code: "R30.0",
    description: "Dysuria",
    category: "Urinary Symptoms",
    symptoms: ["Burning urination", "Painful urination", "Dysuria"],
    severity: "mild",
  },
  {
    code: "N39.0",
    description: "Urinary tract infection, site not specified",
    category: "Urinary Infections",
    symptoms: ["UTI", "Urinary tract infection", "Bladder infection"],
    severity: "moderate",
  },

  // Fever-related infections
  {
    code: "A90",
    description: "Dengue fever",
    category: "Viral Infections",
    symptoms: ["Dengue", "Dengue fever"],
    severity: "moderate",
  },
  {
    code: "A91",
    description: "Dengue hemorrhagic fever",
    category: "Viral Infections",
    symptoms: ["Dengue hemorrhagic", "DHF"],
    severity: "severe",
  },

  // Edema
  {
    code: "R60.9",
    description: "Edema, unspecified",
    category: "Circulatory Symptoms",
    symptoms: ["Swelling", "Edema", "Puffiness"],
    severity: "moderate",
  },

  // Jaundice
  {
    code: "R17",
    description: "Jaundice",
    category: "Hepatic Symptoms",
    symptoms: ["Jaundice", "Yellow skin", "Yellow eyes"],
    severity: "moderate",
  },

  // Pallor
  {
    code: "R23.1",
    description: "Pallor",
    category: "Skin/General",
    symptoms: ["Pale", "Pallor", "Paleness"],
    severity: "mild",
  },

  // Cardiac conditions
  {
    code: "I50.9",
    description: "Heart failure, unspecified",
    category: "Cardiac Conditions",
    symptoms: ["Heart failure", "CHF", "Congestive heart failure"],
    severity: "severe",
  },
  {
    code: "I21.9",
    description: "Acute myocardial infarction",
    category: "Cardiac Conditions",
    symptoms: ["Heart attack", "Myocardial infarction", "MI"],
    severity: "severe",
  },

  // Hypertension
  {
    code: "I11.9",
    description: "Hypertensive disease",
    category: "Cardiovascular",
    symptoms: ["Hypertension", "High blood pressure", "Elevated BP"],
    severity: "moderate",
  },

  // Diabetes
  {
    code: "E11",
    description: "Type 2 diabetes mellitus",
    category: "Endocrine",
    symptoms: ["Diabetes", "Type 2 diabetes"],
    severity: "moderate",
  },
  {
    code: "E10",
    description: "Type 1 diabetes mellitus",
    category: "Endocrine",
    symptoms: ["Type 1 diabetes", "IDDM"],
    severity: "moderate",
  },

  // Anemia
  {
    code: "D64.9",
    description: "Anemia, unspecified",
    category: "Hematological",
    symptoms: ["Anemia", "Low hemoglobin", "Low iron"],
    severity: "mild",
  },

  // Stroke
  {
    code: "I63.9",
    description: "Cerebral infarction, unspecified",
    category: "Neurological",
    symptoms: ["Stroke", "CVA", "Cerebral infarction"],
    severity: "severe",
  },
];

export function searchICDBySymptoms(symptoms: string[]): ICDCode[] {
  if (symptoms.length === 0) return [];

  const normalizedSymptoms = symptoms.map(s => s.toLowerCase().trim());

  const matched = SYMPTOM_ICD_MAPPINGS.filter(icd => {
    return normalizedSymptoms.some(sym =>
      icd.symptoms.some(
        icdSym =>
          icdSym.toLowerCase().includes(sym) || sym.includes(icdSym.toLowerCase())
      )
    );
  });

  // Remove duplicates by code
  const uniqueByCode = Array.from(
    new Map(matched.map(item => [item.code, item])).values()
  );

  return uniqueByCode.sort((a, b) => {
    const severityOrder = { severe: 2, moderate: 1, mild: 0 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "severe":
      return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
    case "moderate":
      return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
    case "mild":
      return "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200";
    default:
      return "bg-slate-100 dark:bg-slate-800";
  }
}
