import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Eye, Download, File, FileText, Image as ImageIcon, Loader2, RotateCw, Crop, QrCode, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { compressImage, rotateImage, hashFile } from "@/lib/document-utils";
import { MobileDocumentQR } from "@/components/mobile-document-qr";

interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: Date;
  uploadedBy?: string;
  category?: string;
  hash?: string;
  isDuplicate?: boolean;
}

interface UploadProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
  error?: string;
}

interface DocumentUploadProps {
  category?: string;
  patientId?: number | string;
  module?: "OPD" | "IPD" | "Radiology" | "Lab" | "Billing" | "Registration";
  department?: string;
  description?: string;
  tags?: string[];
  onDocumentsChange?: (docs: UploadedDocument[]) => void;
  onClose?: () => void;
  maxSize?: number;
  acceptTypes?: string[];
  multiple?: boolean;
  showPreview?: boolean;
  allowWebcam?: boolean;
  allowScanner?: boolean;
  allowMobileQR?: boolean;
}

export function DocumentUpload({
  category = "Other",
  patientId,
  module,
  department,
  description,
  tags,
  onDocumentsChange,
  onClose,
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
  const [showWebcam, setShowWebcam] = useState(false);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget === dropZoneRef.current) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files) {
      handleFileSelect(files);
    }
  };

  const handleBatchUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Select files first");
      return;
    }

    setIsUploading(true);
    const progress: UploadProgress[] = selectedFiles.map((f, i) => ({
      fileId: `${Date.now()}-${i}`,
      fileName: f.name,
      progress: 0,
      status: "pending",
    }));
    setUploadProgress(progress);

    const newDocs: UploadedDocument[] = [];
    const existingHashes = new Set(documents.map((d) => d.hash));

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileId = progress[i].fileId;

      try {
        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === fileId ? { ...p, status: "uploading", progress: 25 } : p))
        );

        const hash = await hashFile(file);

        if (existingHashes.has(hash)) {
          setUploadProgress((prev) =>
            prev.map((p) =>
              p.fileId === fileId
                ? { ...p, status: "error", error: "Duplicate file detected", progress: 100 }
                : p
            )
          );
          toast.warning(`${file.name} is a duplicate`);
          continue;
        }

        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === fileId ? { ...p, progress: 50 } : p))
        );

        const compressed = await compressImage(file);
        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === fileId ? { ...p, progress: 75 } : p))
        );

        const newDoc: UploadedDocument = {
          id: fileId,
          name: file.name,
          size: compressed.size,
          type: file.type,
          url: URL.createObjectURL(compressed),
          uploadedAt: new Date(),
          category,
          hash,
        };

        newDocs.push(newDoc);
        existingHashes.add(hash);

        setUploadProgress((prev) =>
          prev.map((p) => (p.fileId === fileId ? { ...p, status: "complete", progress: 100 } : p))
        );
      } catch (e) {
        setUploadProgress((prev) =>
          prev.map((p) =>
            p.fileId === fileId
              ? { ...p, status: "error", error: e instanceof Error ? e.message : "Upload failed", progress: 0 }
              : p
          )
        );
        toast.error(`Failed to process ${file.name}`);
      }
    }

    const updated = multiple ? [...documents, ...newDocs] : newDocs;
    setDocuments(updated);
    onDocumentsChange?.(updated);
    setSelectedFiles([]);
    setUploadProgress([]);
    setIsUploading(false);

    if (newDocs.length > 0) {
      toast.success(`${newDocs.length} document(s) uploaded`);
    }
  };

  const startWebcam = async () => {
    try {
      setWebcamError(null);
      setRotation(0);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) videoRef.current.onloadedmetadata = () => resolve(null);
        });
      }
      setShowWebcam(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to access camera";
      setWebcamError(msg);
      toast.error(`Camera access denied: ${msg}`);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowWebcam(false);
    setWebcamError(null);
    setRotation(0);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      setIsCapturing(true);
      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;

      ctx.save();
      ctx.translate(canvasRef.current.width / 2, canvasRef.current.height / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.drawImage(
        videoRef.current,
        -canvasRef.current.width / 2,
        -canvasRef.current.height / 2,
        canvasRef.current.width,
        canvasRef.current.height
      );
      ctx.restore();

      canvasRef.current.toBlob(async (blob) => {
        try {
          if (!blob) return;
          const file = new (File as any)([blob], "webcam.jpg", { type: "image/jpeg" }) as File;
          const compressed = await compressImage(file);
          const url = URL.createObjectURL(compressed);

          const newDoc: UploadedDocument = {
            id: `${Date.now()}-webcam`,
            name: `${category}-${new Date().toISOString().split("T")[0]}.jpg`,
            size: compressed.size,
            type: "image/jpeg",
            url,
            uploadedAt: new Date(),
            category,
          };

          const updated = multiple ? [...documents, newDoc] : [newDoc];
          setDocuments(updated);
          onDocumentsChange?.(updated);
          stopWebcam();
          toast.success("Photo captured");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Failed to capture photo");
        } finally {
          setIsCapturing(false);
        }
      }, "image/jpeg", 0.8);
    } catch (e) {
      setIsCapturing(false);
      toast.error(e instanceof Error ? e.message : "Failed to capture photo");
    }
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

      {/* Drag & Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-3 text-center transition ${
          isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30"
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
        <p className="text-xs font-medium">Drag files here or click</p>
        <p className="text-xs text-muted-foreground">Max {(maxSize / 1024 / 1024).toFixed(0)}MB per file</p>
      </div>

      {/* Upload Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="h-8 text-xs flex-1"
        >
          <Upload className="w-3 h-3 mr-1" />
          Choose
        </Button>

        {allowWebcam && (
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading || showWebcam}
            className="h-8 text-xs flex-1"
            onClick={startWebcam}
          >
            📷 Webcam
          </Button>
        )}

        {allowMobileQR && patientId && (
          <Button
            size="sm"
            variant="outline"
            disabled={isUploading}
            className="h-8 text-xs flex-1"
            onClick={() => setShowMobileQR(true)}
          >
            📱 QR
          </Button>
        )}
      </div>

      {/* Batch Upload Selection */}
      {selectedFiles.length > 0 && (
        <Card className="bg-muted/50 border-primary/30">
          <CardContent className="p-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold">{selectedFiles.length} files selected</p>
              <Button size="sm" variant="ghost" className="h-5 text-xs" onClick={() => setSelectedFiles([])}>
                Clear
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full h-7 text-xs"
              onClick={handleBatchUpload}
              disabled={isUploading}
            >
              {isUploading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Upload className="w-3 h-3 mr-1" />}
              Upload {selectedFiles.length} File{selectedFiles.length !== 1 ? "s" : ""}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs">Upload Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {uploadProgress.map((item) => (
              <div key={item.fileId} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="truncate font-medium">{item.fileName}</span>
                  {item.status === "complete" && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                  {item.status === "error" && <AlertCircle className="w-3 h-3 text-red-600" />}
                  {item.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                <Progress value={item.progress} className="h-1" />
                {item.error && <p className="text-xs text-red-600">{item.error}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={acceptTypes.join(",")}
        onChange={(e) => {
          handleFileSelect(e.target.files);
          if (e.target.files) setSelectedFiles(Array.from(e.target.files));
        }}
        className="hidden"
      />

      {/* Document List */}
      {documents.length > 0 && (
        <div className="space-y-1 mt-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className={`flex items-center gap-2 p-2 rounded-md border text-xs ${
                doc.isDuplicate ? "bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20" : "bg-muted/30"
              }`}
            >
              {getFileIcon(doc.type)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="truncate font-medium">{doc.name}</p>
                  {doc.isDuplicate && <Badge variant="secondary" className="text-xs bg-yellow-200">Duplicate</Badge>}
                </div>
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

      {/* Mobile QR Modal */}
      {showMobileQR && patientId && (
        <MobileDocumentQR patientId={patientId} category={category} onClose={() => setShowMobileQR(false)} />
      )}

      {/* Webcam Modal */}
      {showWebcam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Capture {category}</p>
                <Button size="icon" variant="ghost" onClick={stopWebcam} className="h-6 w-6">
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {webcamError ? (
                <div className="text-center py-8">
                  <p className="text-sm text-red-600 mb-4">{webcamError}</p>
                  <Button onClick={stopWebcam}>Close</Button>
                </div>
              ) : (
                <>
                  <div className="relative bg-black rounded-lg overflow-hidden mb-3" style={{ aspectRatio: "4/3" }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      style={{ transform: `rotate(${rotation}deg)` }}
                    />
                  </div>

                  <div className="flex gap-2 mb-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1"
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                    >
                      <RotateCw className="w-3 h-3 mr-1" />
                      Rotate
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs flex-1 text-muted-foreground" disabled>
                      <Crop className="w-3 h-3 mr-1" />
                      Crop
                    </Button>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs flex-1"
                      onClick={stopWebcam}
                    >
                      Retake
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1"
                      onClick={capturePhoto}
                      disabled={isCapturing}
                    >
                      {isCapturing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : "Capture"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

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
