export interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: "mild" | "moderate" | "severe";
  interaction: string;
  recommendation: string;
}

export const DRUG_INTERACTIONS: DrugInteraction[] = [
  // Anticoagulants
  {
    drug1: "Aspirin",
    drug2: "Warfarin",
    severity: "severe",
    interaction: "Increased bleeding risk when combined",
    recommendation: "Monitor INR closely or use alternative antiplatelet",
  },
  {
    drug1: "Aspirin",
    drug2: "Ibuprofen",
    severity: "moderate",
    interaction: "Increased GI bleeding and ulcer risk",
    recommendation: "Avoid combination; use paracetamol instead",
  },
  {
    drug1: "Warfarin",
    drug2: "NSAIDs",
    severity: "severe",
    interaction: "Significantly increased bleeding risk",
    recommendation: "Avoid NSAIDs; use paracetamol for pain relief",
  },

  // Anticonvulsants
  {
    drug1: "Phenytoin",
    drug2: "Warfarin",
    severity: "moderate",
    interaction: "Decreased warfarin effectiveness",
    recommendation: "Monitor INR; may need warfarin dose adjustment",
  },

  // Statins
  {
    drug1: "Simvastatin",
    drug2: "Clarithromycin",
    severity: "severe",
    interaction: "Increased risk of myopathy and rhabdomyolysis",
    recommendation: "Use alternative antibiotic or statin",
  },
  {
    drug1: "Simvastatin",
    drug2: "Amiodarone",
    severity: "moderate",
    interaction: "Increased risk of muscle pain and myopathy",
    recommendation: "Limit simvastatin dose to 20mg/day",
  },

  // ACE Inhibitors & ARBs
  {
    drug1: "Lisinopril",
    drug2: "Potassium",
    severity: "moderate",
    interaction: "Risk of hyperkalemia",
    recommendation: "Monitor potassium levels; limit potassium supplementation",
  },
  {
    drug1: "Amlodipine",
    drug2: "Simvastatin",
    severity: "moderate",
    interaction: "Increased statin levels and myopathy risk",
    recommendation: "Use alternative statin or reduce simvastatin dose",
  },

  // Diuretics
  {
    drug1: "Furosemide",
    drug2: "Gentamicin",
    severity: "severe",
    interaction: "Increased nephrotoxicity and ototoxicity",
    recommendation: "Monitor renal function; ensure adequate hydration",
  },
  {
    drug1: "Furosemide",
    drug2: "Lithium",
    severity: "severe",
    interaction: "Increased lithium levels and toxicity risk",
    recommendation: "Avoid loop diuretics; use thiazides cautiously",
  },

  // Antibiotics
  {
    drug1: "Clarithromycin",
    drug2: "Metoprolol",
    severity: "moderate",
    interaction: "Increased beta-blocker effects and toxicity",
    recommendation: "Monitor blood pressure and heart rate",
  },
  {
    drug1: "Fluoroquinolones",
    drug2: "Theophylline",
    severity: "moderate",
    interaction: "Increased theophylline levels",
    recommendation: "Monitor theophylline levels; adjust dose if needed",
  },
  {
    drug1: "Trimethoprim",
    drug2: "Warfarin",
    severity: "moderate",
    interaction: "Increased warfarin effect",
    recommendation: "Monitor INR closely",
  },

  // Antiretrovirals
  {
    drug1: "Ritonavir",
    drug2: "Simvastatin",
    severity: "severe",
    interaction: "Dramatically increased statin levels",
    recommendation: "Use pravastatin or rosuvastatin instead",
  },

  // Antifungals
  {
    drug1: "Fluconazole",
    drug2: "Warfarin",
    severity: "moderate",
    interaction: "Increased warfarin effect",
    recommendation: "Monitor INR; warfarin dose adjustment may be needed",
  },
  {
    drug1: "Amphotericin B",
    drug2: "Aminoglycosides",
    severity: "severe",
    interaction: "Increased nephrotoxicity",
    recommendation: "Separate administration; monitor renal function",
  },

  // Cardiac
  {
    drug1: "Amiodarone",
    drug2: "Warfarin",
    severity: "moderate",
    interaction: "Increased warfarin effect",
    recommendation: "Monitor INR closely; reduce warfarin dose",
  },
  {
    drug1: "Digoxin",
    drug2: "Verapamil",
    severity: "moderate",
    interaction: "Increased digoxin levels",
    recommendation: "Monitor digoxin levels; reduce digoxin dose if needed",
  },

  // Hypoglycemics
  {
    drug1: "Metformin",
    drug2: "Contrast media (iodinated)",
    severity: "moderate",
    interaction: "Risk of lactic acidosis; renal impairment",
    recommendation: "Hold metformin 48 hours before and after contrast injection",
  },
  {
    drug1: "Sulfonylureas",
    drug2: "Clarithromycin",
    severity: "moderate",
    interaction: "Enhanced hypoglycemic effect",
    recommendation: "Monitor blood glucose; adjust sulfonylurea dose",
  },

  // Pain medications
  {
    drug1: "Tramadol",
    drug2: "SSRIs",
    severity: "moderate",
    interaction: "Risk of serotonin syndrome",
    recommendation: "Use with caution; monitor for serotonin syndrome symptoms",
  },
  {
    drug1: "NSAIDs",
    drug2: "ACE Inhibitors",
    severity: "moderate",
    interaction: "Reduced antihypertensive effect; renal impairment risk",
    recommendation: "Monitor blood pressure and renal function",
  },

  // Psychiatric
  {
    drug1: "Lithium",
    drug2: "Thiazide diuretics",
    severity: "moderate",
    interaction: "Increased lithium levels",
    recommendation: "Monitor lithium levels; reduce dose if needed",
  },
  {
    drug1: "SSRIs",
    drug2: "MAOIs",
    severity: "severe",
    interaction: "Risk of serotonin syndrome and hypertensive crisis",
    recommendation: "Avoid combination; wait 2 weeks between medications",
  },

  // Respiratory
  {
    drug1: "Beta-blockers",
    drug2: "Salbutamol",
    severity: "moderate",
    interaction: "Beta-blockers may reduce bronchodilator effectiveness",
    recommendation: "Use cardioselective beta-blockers; monitor breathing",
  },

  // GI
  {
    drug1: "Omeprazole",
    drug2: "Clopidogrel",
    severity: "moderate",
    interaction: "Reduced clopidogrel effectiveness",
    recommendation: "Use alternative PPI like pantoprazole",
  },
];

export function checkDrugInteractions(medicines: string[]): DrugInteraction[] {
  if (medicines.length < 2) return [];

  const interactions: DrugInteraction[] = [];
  const normalizedMedicines = medicines.map(m => m.toLowerCase().trim());

  for (let i = 0; i < normalizedMedicines.length; i++) {
    for (let j = i + 1; j < normalizedMedicines.length; j++) {
      const med1 = normalizedMedicines[i];
      const med2 = normalizedMedicines[j];

      const interaction = DRUG_INTERACTIONS.find(
        inter =>
          (inter.drug1.toLowerCase().includes(med1) || med1.includes(inter.drug1.toLowerCase())) &&
          (inter.drug2.toLowerCase().includes(med2) || med2.includes(inter.drug2.toLowerCase())) ||
          (inter.drug1.toLowerCase().includes(med2) || med2.includes(inter.drug2.toLowerCase())) &&
          (inter.drug2.toLowerCase().includes(med1) || med1.includes(inter.drug2.toLowerCase()))
      );

      if (interaction) {
        interactions.push(interaction);
      }
    }
  }

  return interactions;
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
      return "bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-200";
  }
}

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case "severe":
      return "🚨";
    case "moderate":
      return "⚠️";
    case "mild":
      return "ℹ️";
    default:
      return "•";
  }
}
