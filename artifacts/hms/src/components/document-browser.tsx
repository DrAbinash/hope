import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, X, File, FileText, Image as ImageIcon, Calendar } from "lucide-react";
import { useState } from "react";

interface PatientDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  uploadedAt: string;
  uploadedBy?: string;
  url: string;
}

interface DocumentBrowserProps {
  documents: PatientDocument[];
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
}

export function DocumentBrowser({ documents, onDelete, onDownload }: DocumentBrowserProps) {
  const [previewDoc, setPreviewDoc] = useState<PatientDocument | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = Array.from(new Set(documents.map((d) => d.category)));
  const filtered = selectedCategory
    ? documents.filter((d) => d.category === selectedCategory)
    : documents;

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="w-4 h-4" />;
    if (type === "application/pdf") return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          No documents uploaded yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Document Repository</CardTitle>
          <div className="flex flex-wrap gap-1 mt-2">
            <Button
              size="sm"
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              className="h-7 text-xs"
            >
              All ({documents.length})
            </Button>
            {categories.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? "default" : "outline"}
                onClick={() => setSelectedCategory(cat)}
                className="h-7 text-xs"
              >
                {cat} ({documents.filter((d) => d.category === cat).length})
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {filtered.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-2 rounded-md border bg-muted/20">
              {getFileIcon(doc.type)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{formatFileSize(doc.size)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {new Date(doc.uploadedAt).toLocaleDateString()}
                  </span>
                  {doc.uploadedBy && (
                    <>
                      <span>•</span>
                      <span>{doc.uploadedBy}</span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {doc.type.startsWith("image/") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <Eye className="w-3 h-3" />
                  </Button>
                )}
                {onDownload && (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(doc.id)}>
                    <Download className="w-3 h-3" />
                  </Button>
                )}
                {onDelete && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-red-600 hover:text-red-700"
                    onClick={() => onDelete(doc.id)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
    </>
  );
}
