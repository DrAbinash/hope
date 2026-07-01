export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string;
  uploadedBy?: string;
  category: string;
  tags?: string[];
  description?: string;
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

export function deskewImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
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
