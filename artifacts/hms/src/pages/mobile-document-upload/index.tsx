import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function MobileDocumentUploadPage() {
  const params = new URLSearchParams(window.location.search);
  const patientId = params.get("patientId");
  const category = params.get("category");
  const session = params.get("session");

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);

  if (!patientId || !category || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-red-600 mb-3">
              <AlertCircle className="w-8 h-8" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Invalid session. Please scan the QR code again from the desktop app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("Select at least one file");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
        formData.append("category", category);
      });

      const r = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!r.ok) throw new Error("Failed to upload documents");

      setUploadComplete(true);
      toast.success("Documents uploaded successfully");
      setTimeout(() => window.close(), 2000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (uploadComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-emerald-600 mb-3">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h2 className="text-center font-semibold text-emerald-900">Upload Complete</h2>
            <p className="text-center text-sm text-emerald-700 mt-2">
              Documents uploaded to {category}. Closing in 2 seconds...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="max-w-2xl mx-auto">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Upload {category}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Patient ID: {patientId}</p>
        </CardHeader>
        <CardContent className="space-y-3 pt-2">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <Label className="cursor-pointer">
              <span className="text-sm font-medium">Tap to select files or camera</span>
              <Input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </Label>
            <p className="text-xs text-muted-foreground mt-2">Images and PDFs supported</p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium">{files.length} file(s) selected</p>
              {files.map((file, i) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded bg-muted/30 text-xs">
                  <span className="truncate">{file.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-red-600"
                    onClick={() => removeFile(i)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="w-full h-10"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload Documents"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
