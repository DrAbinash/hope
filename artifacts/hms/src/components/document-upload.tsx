import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, X, Eye, Download, File, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
  uploadedBy?: string;
  category?: string;
}

interface DocumentUploadProps {
  category: string;
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
  maxSize?: number;
  acceptTypes?: string[];
  multiple?: boolean;
  showPreview?: boolean;
  allowWebcam?: boolean;
  allowScanner?: boolean;
  allowMobileQR?: boolean;
}

export function DocumentUpload({
  category,
  onDocumentsChange,
  maxSize = 10 * 1024 * 1024,
  acceptTypes = ["image/*", ".pdf"],
  multiple = true,
  showPreview = true,
  allowWebcam = false,
  allowScanner = false,
  allowMobileQR = false,
}: DocumentUploadProps) {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;

    const newDocs: UploadedDocument[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > maxSize) {
        toast.error(`${file.name} exceeds ${(maxSize / 1024 / 1024).toFixed(1)}MB limit`);
        continue;
      }

      newDocs.push({
        id: `${Date.now()}-${i}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        uploadedAt: new Date(),
        category,
      });
    }

    const updated = multiple ? [...documents, ...newDocs] : newDocs;
    setDocuments(updated);
    onDocumentsChange?.(updated);

    if (newDocs.length > 0) {
      toast.success(`${newDocs.length} document(s) added`);
    }
  };

  const handleDeleteDocument = (id: string) => {
    const updated = documents.filter((d) => d.id !== id);
    setDocuments(updated);
    onDocumentsChange?.(updated);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
    if (type === "application/pdf") return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">{category}</Label>

      {/* Upload Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-8 text-xs"
        >
          <Upload className="w-3 h-3 mr-1" />
          Choose Files
        </Button>

        {allowWebcam && (
          <Button size="sm" variant="outline" disabled={isUploading} className="h-8 text-xs">
            📷 Webcam
          </Button>
        )}

        {allowMobileQR && (
          <Button size="sm" variant="outline" disabled={isUploading} className="h-8 text-xs">
            📱 Mobile QR
          </Button>
        )}

        {allowScanner && (
          <Button size="sm" variant="outline" disabled={isUploading} className="h-8 text-xs">
            📠 Scanner
          </Button>
        )}
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptTypes.join(",")}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-1 mt-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-2 p-2 rounded-md border bg-muted/30 text-xs"
            >
              {getFileIcon(doc.type)}
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium">{doc.name}</p>
                <p className="text-muted-foreground">{formatFileSize(doc.size)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {showPreview && doc.type.startsWith("image/") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setPreviewDoc(doc)}
                    title="Preview"
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteDocument(doc.id)}
                  title="Delete"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && previewDoc.type.startsWith("image/") && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewDoc(null)}
        >
          <Card className="max-w-2xl w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium truncate">{previewDoc.name}</p>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setPreviewDoc(null)}
                  className="h-6 w-6"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <img src={previewDoc.url} alt={previewDoc.name} className="w-full rounded-md" />
            </CardContent>
          </Card>
        </div>
      )}

      {documents.length > 0 && (
        <Badge variant="secondary" className="text-xs">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </Badge>
      )}
    </div>
  );
}
