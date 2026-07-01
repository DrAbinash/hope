export interface VitalReading {
  date: string;
  temp?: number;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  rr?: number;
  spo2?: number;
}

export interface VitalTrend {
  vital: string;
  readings: VitalReading[];
  current?: number;
  previous?: number;
  trend: "stable" | "rising" | "falling";
  normalRange: { min: number; max: number };
  unit: string;
  status: "normal" | "warning" | "critical";
}

export const VITAL_RANGES = {
  temp: { min: 98.0, max: 100.4, unit: "°F", critical: { min: 95, max: 103 } },
  pulse: { min: 60, max: 100, unit: "bpm", critical: { min: 40, max: 140 } },
  bp_systolic: { min: 90, max: 140, unit: "mmHg", critical: { min: 80, max: 180 } },
  bp_diastolic: { min: 60, max: 90, unit: "mmHg", critical: { min: 50, max: 120 } },
  rr: { min: 12, max: 20, unit: "/min", critical: { min: 8, max: 30 } },
  spo2: { min: 95, max: 100, unit: "%", critical: { min: 85, max: 100 } },
};

export function checkVitalStatus(
  vital: string,
  value: number
): "normal" | "warning" | "critical" {
  const ranges = VITAL_RANGES[vital as keyof typeof VITAL_RANGES];
  if (!ranges) return "normal";

  if (value < ranges.critical.min || value > ranges.critical.max) return "critical";
  if (value < ranges.min || value > ranges.max) return "warning";
  return "normal";
}

export function calculateTrend(readings: number[]): "stable" | "rising" | "falling" {
  if (readings.length < 2) return "stable";

  const recent = readings.slice(-3);
  if (recent.length < 2) return "stable";

  const avg1 = recent.slice(0, Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(recent.length / 2);
  const avg2 = recent.slice(Math.ceil(recent.length / 2)).reduce((a, b) => a + b, 0) / (recent.length - Math.ceil(recent.length / 2));

  const diff = avg2 - avg1;
  if (Math.abs(diff) < 0.5) return "stable";
  return diff > 0 ? "rising" : "falling";
}

export function getTrendIcon(trend: string): string {
  switch (trend) {
    case "rising":
      return "📈";
    case "falling":
      return "📉";
    case "stable":
      return "➡️";
    default:
      return "•";
  }
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "critical":
      return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
    case "warning":
      return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
    case "normal":
      return "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200";
    default:
      return "bg-slate-100 dark:bg-slate-800";
  }
}

export function parseVitalValue(value: string | number | undefined): number | null {
  if (!value) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

export function parseBP(value: string | undefined): { systolic: number | null; diastolic: number | null } {
  if (!value) return { systolic: null, diastolic: null };
  const parts = value.split("/");
  return {
    systolic: parseFloat(parts[0]) || null,
    diastolic: parseFloat(parts[1]) || null,
  };
}
