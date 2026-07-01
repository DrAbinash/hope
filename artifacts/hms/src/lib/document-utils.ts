export interface DocumentMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy?: string;
  category: string;
  tags?: string[];
  description?: string;
  department?: string;
  module?: string;
  patientId?: number | string;
  url?: string;
}

export interface DocumentSearchFilter {
  category?: string;
  uploadedBy?: string;
  startDate?: Date;
  endDate?: Date;
  tags?: string[];
  department?: string;
  module?: string;
  searchText?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

export function getFileIcon(type: string): string {
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf") return "pdf";
  if (type.startsWith("application/")) return "document";
  return "file";
}

export function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function isPdf(type: string): boolean {
  return type === "application/pdf";
}

export function validateFileSize(size: number, maxSize: number): boolean {
  return size <= maxSize;
}

export function validateFileType(type: string, allowedTypes: string[]): boolean {
  return allowedTypes.some((allowed) => {
    if (allowed.endsWith("/*")) {
      return type.startsWith(allowed.replace("/*", ""));
    }
    return type === allowed || type === `application/${allowed.replace(".", "")}`;
  });
}

export async function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(blob || file);
        }, file.type, quality);
      };
    };
  });
}

export function detectDocumentEdges(canvas: HTMLCanvasElement): { x: number; y: number; width: number; height: number } | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minX = canvas.width;
  let maxX = 0;
  let minY = canvas.height;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

      if (brightness < 200) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        found = true;
      }
    }
  }

  if (!found) return null;

  const padding = 20;
  return {
    x: Math.max(0, minX - padding),
    y: Math.max(0, minY - padding),
    width: Math.min(canvas.width, maxX + padding * 2) - Math.max(0, minX - padding),
    height: Math.min(canvas.height, maxY + padding * 2) - Math.max(0, minY - padding),
  };
}

export async function autoCropImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);

        const edges = detectDocumentEdges(canvas);
        if (edges) {
          const croppedCanvas = document.createElement("canvas");
          croppedCanvas.width = edges.width;
          croppedCanvas.height = edges.height;
          const croppedCtx = croppedCanvas.getContext("2d")!;
          croppedCtx.drawImage(canvas, edges.x, edges.y, edges.width, edges.height, 0, 0, edges.width, edges.height);

          croppedCanvas.toBlob((blob) => {
            resolve(blob || file);
          }, file.type, 0.8);
        } else {
          resolve(file);
        }
      };
    };
  });
}

export function deskewImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let minAngle = -45;
  let maxAngle = 45;
  let bestAngle = 0;
  let bestScore = Infinity;

  for (let angle = minAngle; angle <= maxAngle; angle += 0.5) {
    let score = 0;
    const radians = (angle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    for (let y = 0; y < canvas.height; y++) {
      let blackPixels = 0;
      for (let x = 0; x < canvas.width; x++) {
        const idx = (y * canvas.width + x) * 4;
        const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
        if (brightness < 128) blackPixels++;
      }
      if (blackPixels > 0) score += blackPixels;
    }

    if (score < bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  if (Math.abs(bestAngle) > 0.5) {
    return rotateImage(canvas, bestAngle);
  }
  return canvas;
}

export function rotateImage(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const newCanvas = document.createElement("canvas");
  newCanvas.width = Math.abs(canvas.width * cos) + Math.abs(canvas.height * sin);
  newCanvas.height = Math.abs(canvas.width * sin) + Math.abs(canvas.height * cos);

  const ctx = newCanvas.getContext("2d")!;
  ctx.translate(newCanvas.width / 2, newCanvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return newCanvas;
}

export async function generateQRCode(text: string, size: number = 256): Promise<string> {
  const encodedText = encodeURIComponent(text);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}`;
}

export const DOCUMENT_CATEGORIES = [
  "Patient Photo",
  "Identity",
  "Prescription",
  "Radiology",
  "Laboratory",
  "Clinical Photograph",
  "Consent",
  "Insurance",
  "Referral",
  "ECG",
  "Echo",
  "Operation Notes",
  "Discharge Summary",
  "Other",
];

export const DOCUMENT_DEPARTMENTS = [
  "Registration",
  "Billing",
  "OPD",
  "IPD",
  "ICU",
  "Radiology",
  "Laboratory",
  "Pharmacy",
  "Surgery",
  "Discharge",
];

export const DOCUMENT_MODULES = [
  "Admission",
  "Consultation",
  "Investigation",
  "Treatment",
  "Discharge",
  "Follow-up",
  "Insurance",
  "Legal",
];

export function searchDocuments(documents: DocumentMetadata[], filter: DocumentSearchFilter): DocumentMetadata[] {
  return documents.filter((doc) => {
    if (filter.category && doc.category !== filter.category) return false;
    if (filter.uploadedBy && doc.uploadedBy !== filter.uploadedBy) return false;
    if (filter.department && doc.department !== filter.department) return false;
    if (filter.module && doc.module !== filter.module) return false;

    if (filter.startDate) {
      const docDate = new Date(doc.uploadedAt);
      if (docDate < filter.startDate) return false;
    }

    if (filter.endDate) {
      const docDate = new Date(doc.uploadedAt);
      if (docDate > filter.endDate) return false;
    }

    if (filter.tags && filter.tags.length > 0) {
      const docTags = doc.tags || [];
      const hasAllTags = filter.tags.every((tag) => docTags.includes(tag));
      if (!hasAllTags) return false;
    }

    if (filter.searchText) {
      const searchLower = filter.searchText.toLowerCase();
      const matches =
        doc.fileName.toLowerCase().includes(searchLower) ||
        doc.category.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.tags?.some((tag) => tag.toLowerCase().includes(searchLower));
      if (!matches) return false;
    }

    return true;
  });
}

export function groupDocumentsByCategory(documents: DocumentMetadata[]): Record<string, DocumentMetadata[]> {
  return documents.reduce(
    (acc, doc) => {
      if (!acc[doc.category]) acc[doc.category] = [];
      acc[doc.category].push(doc);
      return acc;
    },
    {} as Record<string, DocumentMetadata[]>
  );
}

export function groupDocumentsByDate(documents: DocumentMetadata[]): Record<string, DocumentMetadata[]> {
  return documents.reduce(
    (acc, doc) => {
      const date = new Date(doc.uploadedAt).toLocaleDateString("en-IN");
      if (!acc[date]) acc[date] = [];
      acc[date].push(doc);
      return acc;
    },
    {} as Record<string, DocumentMetadata[]>
  );
}

export function getDocumentStats(documents: DocumentMetadata[]) {
  return {
    total: documents.length,
    byCategory: Object.entries(groupDocumentsByCategory(documents)).map(([category, docs]) => ({
      category,
      count: docs.length,
    })),
    totalSize: documents.reduce((sum, doc) => sum + doc.fileSize, 0),
    uploadedBy: [...new Set(documents.map((doc) => doc.uploadedBy).filter(Boolean))] as string[],
  };
}
