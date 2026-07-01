export interface MedicineWithDose {
  name: string;
  dose: string;
  frequency?: string;
  duration?: string;
  timing?: string;
}

export interface ValidationError {
  severity: "error" | "warning" | "info";
  medicine: string;
  issue: string;
  recommendation: string;
}

interface MedicineRules {
  maxSingleDose?: number;
  maxDailyDose?: number;
  minDuration?: number;
  maxDuration?: number;
  unit: string;
  commonDosages: string[];
}

const MEDICINE_RULES: Record<string, MedicineRules> = {
  "paracetamol": {
    maxSingleDose: 1000,
    maxDailyDose: 4000,
    minDuration: 1,
    maxDuration: 7,
    unit: "mg",
    commonDosages: ["500", "650", "1000"],
  },
  "ibuprofen": {
    maxSingleDose: 800,
    maxDailyDose: 2400,
    minDuration: 1,
    maxDuration: 10,
    unit: "mg",
    commonDosages: ["400", "600", "800"],
  },
  "aspirin": {
    maxSingleDose: 650,
    maxDailyDose: 3900,
    minDuration: 1,
    maxDuration: 14,
    unit: "mg",
    commonDosages: ["325", "500", "650"],
  },
  "amoxicillin": {
    maxSingleDose: 1000,
    maxDailyDose: 3000,
    minDuration: 5,
    maxDuration: 14,
    unit: "mg",
    commonDosages: ["250", "500", "1000"],
  },
  "metformin": {
    maxSingleDose: 1000,
    maxDailyDose: 2550,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["500", "850", "1000"],
  },
  "lisinopril": {
    maxSingleDose: 40,
    maxDailyDose: 40,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["5", "10", "20", "40"],
  },
  "amlodipine": {
    maxSingleDose: 10,
    maxDailyDose: 10,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["2.5", "5", "10"],
  },
  "metoprolol": {
    maxSingleDose: 100,
    maxDailyDose: 400,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["25", "50", "100"],
  },
  "simvastatin": {
    maxSingleDose: 80,
    maxDailyDose: 80,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["10", "20", "40", "80"],
  },
  "omeprazole": {
    maxSingleDose: 40,
    maxDailyDose: 40,
    minDuration: 1,
    maxDuration: 12,
    unit: "mg",
    commonDosages: ["20", "40"],
  },
  "furosemide": {
    maxSingleDose: 600,
    maxDailyDose: 1200,
    minDuration: 1,
    maxDuration: 365,
    unit: "mg",
    commonDosages: ["20", "40", "80"],
  },
  "ceftriaxone": {
    maxSingleDose: 2000,
    maxDailyDose: 4000,
    minDuration: 5,
    maxDuration: 14,
    unit: "mg",
    commonDosages: ["500", "1000", "2000"],
  },
};

const FREQUENCY_MULTIPLIERS: Record<string, number> = {
  "1-0-0": 1,
  "1-1-0": 2,
  "1-0-1": 2,
  "1-1-1": 3,
  "0-0-1": 1,
  "0-1-0": 1,
  "1-0-0-1": 2,
  "2-0-0": 2,
  "2-1-0": 3,
  "2-0-1": 3,
  "2-2-2": 6,
  "twice daily": 2,
  "thrice daily": 3,
  "once daily": 1,
  "bd": 2,
  "td": 3,
  "od": 1,
  "qid": 4,
  "prn": 1,
  "as needed": 1,
};

export function extractDoseValue(doseString: string): { value: number; unit: string } | null {
  const match = doseString.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z%]*)/);
  if (!match) return null;
  return {
    value: parseFloat(match[1]),
    unit: match[2] || "mg",
  };
}

export function calculateDailyDose(
  doseString: string,
  frequency: string
): { dailyDose: number; unit: string } | null {
  const dose = extractDoseValue(doseString);
  if (!dose) return null;

  const multiplier = FREQUENCY_MULTIPLIERS[frequency.toLowerCase()] || 1;
  return {
    dailyDose: dose.value * multiplier,
    unit: dose.unit,
  };
}

export function extractDuration(durationString: string): number | null {
  if (!durationString) return null;
  const match = durationString.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

export function validatePrescription(medicines: MedicineWithDose[]): ValidationError[] {
  const errors: ValidationError[] = [];

  medicines.forEach((med, idx) => {
    const medNameLower = med.name.toLowerCase();
    const rules = MEDICINE_RULES[medNameLower];

    if (!rules) {
      errors.push({
        severity: "info",
        medicine: med.name,
        issue: "Medicine not in validation database",
        recommendation: "Manual review recommended for this medicine",
      });
      return;
    }

    // Validate single dose
    const singleDose = extractDoseValue(med.dose);
    if (singleDose && singleDose.value > rules.maxSingleDose) {
      errors.push({
        severity: "error",
        medicine: med.name,
        issue: `Single dose ${singleDose.value}${singleDose.unit} exceeds max of ${rules.maxSingleDose}${rules.unit}`,
        recommendation: `Reduce single dose to ≤${rules.maxSingleDose}${rules.unit}. Common dosages: ${rules.commonDosages.join(", ")}${rules.unit}`,
      });
    }

    // Validate daily dose
    if (med.frequency) {
      const dailyDose = calculateDailyDose(med.dose, med.frequency);
      if (dailyDose && dailyDose.dailyDose > rules.maxDailyDose) {
        errors.push({
          severity: "error",
          medicine: med.name,
          issue: `Daily dose ${dailyDose.dailyDose}${dailyDose.unit} exceeds max of ${rules.maxDailyDose}${rules.unit}`,
          recommendation: `Reduce frequency or dose. Max daily: ${rules.maxDailyDose}${rules.unit}`,
        });
      }
    }

    // Validate duration
    if (med.duration) {
      const duration = extractDuration(med.duration);
      if (duration) {
        if (duration < rules.minDuration) {
          errors.push({
            severity: "warning",
            medicine: med.name,
            issue: `Duration ${duration} day(s) is shorter than typical minimum of ${rules.minDuration} day(s)`,
            recommendation: `Consider extending to at least ${rules.minDuration} day(s)`,
          });
        }
        if (duration > rules.maxDuration) {
          errors.push({
            severity: "warning",
            medicine: med.name,
            issue: `Duration ${duration} day(s) exceeds recommended maximum of ${rules.maxDuration} day(s)`,
            recommendation: `Consider shortening to ≤${rules.maxDuration} day(s) or review necessity`,
          });
        }
      }
    }
  });

  // Check for duplicate medicines
  const medicineNames = medicines.map(m => m.name.toLowerCase());
  const duplicates = medicineNames.filter((item, index) => medicineNames.indexOf(item) !== index);
  duplicates.forEach(dup => {
    errors.push({
      severity: "error",
      medicine: dup,
      issue: "Duplicate medicine in prescription",
      recommendation: "Remove duplicate or adjust doses if intentional",
    });
  });

  return errors;
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "error":
      return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
    case "warning":
      return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
    case "info":
      return "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200";
    default:
      return "bg-slate-100 dark:bg-slate-800";
  }
}

export function getSeverityIcon(severity: string): string {
  switch (severity) {
    case "error":
      return "❌";
    case "warning":
      return "⚠️";
    case "info":
      return "ℹ️";
    default:
      return "•";
  }
}
