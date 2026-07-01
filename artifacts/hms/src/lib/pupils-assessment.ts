export interface PupilSize {
  left: number | null; // in mm
  right: number | null; // in mm
}

export interface PupilReactivity {
  left: "Reactive" | "Sluggish" | "Fixed" | null;
  right: "Reactive" | "Sluggish" | "Fixed" | null;
}

export interface PupilShape {
  left: "Round" | "Irregular" | null;
  right: "Round" | "Irregular" | null;
}

export interface PupilsAssessment {
  size: PupilSize;
  reactivity: PupilReactivity;
  shape: PupilShape;
  equality: "Equal" | "Unequal" | null;
  notes?: string;
}

export const PUPIL_SIZES = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8];

export const REACTIVITY_OPTIONS = ["Reactive", "Sluggish", "Fixed"] as const;

export const SHAPE_OPTIONS = ["Round", "Irregular"] as const;

export function isPupilAbnormal(assessment: PupilsAssessment): boolean {
  const leftSize = assessment.size.left ?? 0;
  const rightSize = assessment.size.right ?? 0;

  // Check for fixed pupils (concerning)
  if (assessment.reactivity.left === "Fixed" || assessment.reactivity.right === "Fixed") {
    return true;
  }

  // Check for significant size difference
  if (leftSize > 0 && rightSize > 0 && Math.abs(leftSize - rightSize) > 1) {
    return true;
  }

  // Check for abnormal sizes
  if ((leftSize < 2 || leftSize > 8) || (rightSize < 2 || rightSize > 8)) {
    return true;
  }

  // Check for irregular shape
  if (assessment.shape.left === "Irregular" || assessment.shape.right === "Irregular") {
    return true;
  }

  return false;
}

export function getPupilAbnormalityColor(isAbnormal: boolean): string {
  if (!isAbnormal) {
    return "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200";
  }
  return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
}

export function getPupilAbnormalityIcon(isAbnormal: boolean): string {
  return isAbnormal ? "🚨" : "✓";
}

export function formatPupilsAssessment(assessment: PupilsAssessment): string {
  const leftSize = assessment.size.left ?? "-";
  const rightSize = assessment.size.right ?? "-";
  const equality = assessment.equality || "Not assessed";
  return `Pupils L${leftSize}/R${rightSize}mm, ${equality}`;
}

export function getPupilAbnormalityDetails(assessment: PupilsAssessment): string[] {
  const issues: string[] = [];

  const leftSize = assessment.size.left ?? 0;
  const rightSize = assessment.size.right ?? 0;

  if (assessment.reactivity.left === "Fixed") {
    issues.push("Left pupil fixed - concerning");
  }
  if (assessment.reactivity.right === "Fixed") {
    issues.push("Right pupil fixed - concerning");
  }

  if (leftSize > 0 && rightSize > 0 && Math.abs(leftSize - rightSize) > 1) {
    issues.push("Significant anisocoria (size difference)");
  }

  if (leftSize < 2 || leftSize > 8) {
    issues.push("Left pupil size abnormal");
  }
  if (rightSize < 2 || rightSize > 8) {
    issues.push("Right pupil size abnormal");
  }

  if (assessment.shape.left === "Irregular") {
    issues.push("Left pupil irregular");
  }
  if (assessment.shape.right === "Irregular") {
    issues.push("Right pupil irregular");
  }

  if (assessment.equality === "Unequal" && Math.abs(leftSize - rightSize) <= 1) {
    issues.push("Noted as unequal but size difference is minor");
  }

  return issues;
}
