import { DocumentMetadata } from "./document-utils";

export async function downloadAsZip(documents: DocumentMetadata[]): Promise<void> {
  try {
    // Using JSZip library (add to dependencies)
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();

    for (const doc of documents) {
      if (doc.url) {
        const response = await fetch(doc.url);
        const blob = await response.blob();
        zip.file(doc.fileName, blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    downloadBlob(zipBlob, `documents-${Date.now()}.zip`);
  } catch (e) {
    console.error("Failed to create ZIP:", e);
    throw new Error("Failed to create ZIP file. Please ensure JSZip library is installed.");
  }
}

export async function downloadAsCSV(documents: DocumentMetadata[]): Promise<void> {
  const headers = ["fileName", "category", "department", "uploadedAt", "uploadedBy", "tags", "description"];
  const rows = documents.map((doc) => [
    doc.fileName,
    doc.category,
    doc.department || "",
    doc.uploadedAt,
    doc.uploadedBy || "",
    (doc.tags || []).join("; "),
    doc.description || "",
  ]);

  const csv = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
  ].join("\n");

  downloadBlob(new Blob([csv], { type: "text/csv" }), `documents-${Date.now()}.csv`);
}

export async function downloadAsJSON(documents: DocumentMetadata[]): Promise<void> {
  const json = JSON.stringify(
    {
      exported: new Date().toISOString(),
      totalDocuments: documents.length,
      documents: documents,
    },
    null,
    2
  );

  downloadBlob(new Blob([json], { type: "application/json" }), `documents-${Date.now()}.json`);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function mergePDFs(documents: DocumentMetadata[]): Promise<void> {
  try {
    // Using PDF-lib library (add to dependencies)
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();

    for (const doc of documents) {
      if (doc.fileType === "application/pdf" && doc.url) {
        const response = await fetch(doc.url);
        const pdfBytes = await response.arrayBuffer();
        const pdf = await PDFDocument.load(pdfBytes);
        const copiedPages = await pdfDoc.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => pdfDoc.addPage(page));
      }
    }

    const pdfBytes = await pdfDoc.save();
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), `merged-${Date.now()}.pdf`);
  } catch (e) {
    console.error("Failed to merge PDFs:", e);
    throw new Error("Failed to merge PDFs. Please ensure PDF-lib library is installed.");
  }
}

export function generateManifest(documents: DocumentMetadata[]): string {
  const manifest = documents
    .map(
      (doc, idx) =>
        `${idx + 1}. ${doc.fileName}
   Size: ${(doc.fileSize / 1024).toFixed(2)} KB
   Category: ${doc.category}
   Uploaded: ${new Date(doc.uploadedAt).toLocaleString()}
   Uploader: ${doc.uploadedBy || "N/A"}
   Tags: ${(doc.tags || []).join(", ") || "None"}
   Description: ${doc.description || "N/A"}
   `
    )
    .join("\n");

  return `DOCUMENT MANIFEST
Generated: ${new Date().toLocaleString()}
Total Documents: ${documents.length}
Total Size: ${(documents.reduce((sum, d) => sum + d.fileSize, 0) / 1024 / 1024).toFixed(2)} MB

${manifest}`;
}

export function downloadManifest(documents: DocumentMetadata[]): void {
  const manifest = generateManifest(documents);
  downloadBlob(new Blob([manifest], { type: "text/plain" }), `manifest-${Date.now()}.txt`);
}
