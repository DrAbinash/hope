export interface GCSResponse {
  id: string;
  score: number;
  description: string;
}

export interface GCSScore {
  eyeOpening: number | null;
  verbalResponse: number | null;
  motorResponse: number | null;
}

export const EYE_OPENING_SCORES: GCSResponse[] = [
  { id: "e4", score: 4, description: "Spontaneous" },
  { id: "e3", score: 3, description: "To verbal command" },
  { id: "e2", score: 2, description: "To pain" },
  { id: "e1", score: 1, description: "No response" },
];

export const VERBAL_RESPONSE_SCORES: GCSResponse[] = [
  { id: "v5", score: 5, description: "Oriented and converses" },
  { id: "v4", score: 4, description: "Disoriented conversation" },
  { id: "v3", score: 3, description: "Inappropriate words" },
  { id: "v2", score: 2, description: "Incomprehensible sounds" },
  { id: "v1", score: 1, description: "No response" },
];

export const MOTOR_RESPONSE_SCORES: GCSResponse[] = [
  { id: "m6", score: 6, description: "Obeys commands" },
  { id: "m5", score: 5, description: "Localizes to pain" },
  { id: "m4", score: 4, description: "Withdrawal from pain" },
  { id: "m3", score: 3, description: "Abnormal flexion (decorticate)" },
  { id: "m2", score: 2, description: "Abnormal extension (decerebrate)" },
  { id: "m1", score: 1, description: "No response" },
];

export function calculateGCSTotal(score: GCSScore): number {
  const eye = score.eyeOpening ?? 0;
  const verbal = score.verbalResponse ?? 0;
  const motor = score.motorResponse ?? 0;
  return eye + verbal + motor;
}

export function getGCSSeverity(total: number): string {
  if (total >= 13) return "Mild";
  if (total >= 9) return "Moderate";
  return "Severe";
}

export function getGCSSeverityColor(total: number): string {
  if (total >= 13) return "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200";
  if (total >= 9) return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
  return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
}

export function getGCSSeverityIcon(total: number): string {
  if (total >= 13) return "✓";
  if (total >= 9) return "⚠";
  return "🚨";
}

export function formatGCSScore(score: GCSScore): string {
  const eye = score.eyeOpening ?? "-";
  const verbal = score.verbalResponse ?? "-";
  const motor = score.motorResponse ?? "-";
  const total = calculateGCSTotal(score);
  return `GCS ${total} (E${eye}V${verbal}M${motor})`;
}
