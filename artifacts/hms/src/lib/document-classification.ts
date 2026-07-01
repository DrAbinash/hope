import { DOCUMENT_CATEGORIES } from "./document-utils";

export interface ClassificationResult {
  category: string;
  confidence: number;
  alternatives: Array<{ category: string; confidence: number }>;
}

const categoryPatterns: Record<string, RegExp[]> = {
  "Patient Photo": [/photo|portrait|selfie|profile.*pic/i],
  "Identity": [/aadhar|aadhaar|id.*card|passport|license|voter/i],
  "Prescription": [/prescription|rx|medicine|medication|tablet|capsule/i],
  "Radiology": [/x-?ray|ct.*scan|mri|ultrasound|xray|radiograph/i],
  "Laboratory": [/lab.*report|blood.*test|pathology|biopsy|urinalysis|cbc|lipid/i],
  "Clinical Photograph": [/clinical|wound|ulcer|surgical|scar|clinical.*photo/i],
  "Consent": [/consent|agreement|waiver|signed|permission|authorization/i],
  "Insurance": [/insurance|policy|premium|claim|tpa|coverage|health.*insurance/i],
  "Referral": [/referral|refer|specialist|consultation.*request/i],
  "ECG": [/ecg|ekg|electrocardiogram|heartbeat|cardiac/i],
  "Echo": [/echocardiography|echo|cardiac.*echo|heart.*ultrasound/i],
  "Operation Notes": [/operation|operative|surgery|surgical|ot.*report|operation.*note/i],
  "Discharge Summary": [/discharge|summary|hospital.*discharge|discharge.*note/i],
};

export function classifyDocument(fileName: string, fileSize?: number): ClassificationResult {
  const lowerName = fileName.toLowerCase();
  const scores: Record<string, number> = {};

  // Initialize scores
  DOCUMENT_CATEGORIES.forEach((cat) => {
    scores[cat] = 0;
  });

  // Check file name patterns
  Object.entries(categoryPatterns).forEach(([category, patterns]) => {
    patterns.forEach((pattern) => {
      if (pattern.test(lowerName)) {
        scores[category] += 3;
      }
    });
  });

  // File extension hints
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "pdf") {
    scores["Prescription"] += 1;
    scores["Laboratory"] += 1;
    scores["Discharge Summary"] += 1;
  } else if (["jpg", "jpeg", "png", "gif"].includes(ext || "")) {
    scores["Patient Photo"] += 1;
    scores["Clinical Photograph"] += 1;
    scores["Identity"] += 1;
  }

  // File size hints (typical medical documents)
  if (fileSize) {
    if (fileSize < 100000) scores["Prescription"] += 0.5; // Small PDF
    if (fileSize > 500000) scores["Radiology"] += 0.5; // Large image/PDF
  }

  // Find best match
  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter((entry) => entry[1] > 0);

  if (sorted.length === 0) {
    return {
      category: "Other",
      confidence: 0,
      alternatives: [],
    };
  }

  const maxScore = sorted[0][1];
  const confidence = Math.min(100, (maxScore / 3) * 100);

  return {
    category: sorted[0][0],
    confidence: Math.round(confidence),
    alternatives: sorted.slice(1, 4).map(([cat, score]) => ({
      category: cat,
      confidence: Math.round(Math.min(100, (score / 3) * 100)),
    })),
  };
}

export async function extractTextFromImage(imageUrl: string): Promise<string> {
  try {
    // For now, return placeholder
    // In production, integrate with Google Vision API or AWS Textract
    // This is a mock implementation

    const response = await fetch("/api/ocr/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ imageUrl }),
    });

    if (!response.ok) throw new Error("OCR extraction failed");
    const data = await response.json();
    return data.text || "";
  } catch (e) {
    console.warn("OCR extraction error:", e);
    return "";
  }
}

export async function detectDocumentContent(file: File): Promise<{
  hasText: boolean;
  isPDF: boolean;
  isImage: boolean;
  pageCount?: number;
}> {
  return {
    hasText: true,
    isPDF: file.type === "application/pdf",
    isImage: file.type.startsWith("image/"),
  };
}
