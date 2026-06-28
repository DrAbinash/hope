import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, X, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { toServedUrl } from "@/lib/asset-url";

interface Props {
  value?: string | null;
  onChange: (objectPath: string | null) => void;
  label: string;
  hint?: string;
  accept?: string;
  maxSizeMB?: number;
  previewClassName?: string;
  allowPdf?: boolean;
}

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const IMAGE_PDF_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

function isPdfPath(p?: string | null) {
  return !!p && /\.pdf(\?|$)/i.test(p);
}

export function ImageUpload({
  value,
  onChange,
  label,
  hint,
  accept,
  maxSizeMB = 5,
  previewClassName = "max-h-32",
  allowPdf = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const effectiveAccept = accept ?? (allowPdf ? IMAGE_PDF_ACCEPT : IMAGE_ACCEPT);

  async function handleFile(file: File) {
    if (file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`File too large (max ${maxSizeMB}MB)`);
      return;
    }
    setUploading(true);
    try {
      const r = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "application/octet-stream" }),
      });
      if (!r.ok) throw new Error("Failed to request upload URL");
      const { uploadURL, objectPath } = await r.json();
      const put = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");
      onChange(objectPath);
      toast.success(`${label} uploaded`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const previewUrl = toServedUrl(value) || null;
  const isPdf = isPdfPath(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <input
          ref={inputRef}
          type="file"
          accept={effectiveAccept}
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          data-testid={`upload-input-${label.toLowerCase().replace(/\s+/g, "-")}`}
        />
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
          {uploading ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            <X className="w-4 h-4 mr-1" />Remove
          </Button>
        )}
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {previewUrl && (
        isPdf ? (
          <a href={previewUrl} target="_blank" rel="noreferrer" className="rounded border bg-muted/50 p-3 inline-flex items-center gap-2 text-sm hover:bg-muted">
            <FileText className="w-5 h-5 text-red-600" />
            <span>PDF uploaded — click to preview</span>
          </a>
        ) : (
          <div className="rounded border bg-white p-2 inline-block">
            <img src={previewUrl} alt={label} className={previewClassName} />
          </div>
        )
      )}
    </div>
  );
}
