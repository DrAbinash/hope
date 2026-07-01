import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentBrowser } from "@/components/document-browser";
import { DocumentManager } from "@/components/document-manager";
import { ImageCropEditor } from "@/components/image-crop-editor";
import { Upload, FileText } from "lucide-react";
import { DocumentMetadata } from "@/lib/document-utils";

export default function DocumentsDemo() {
  const [demoDocuments, setDemoDocuments] = useState<DocumentMetadata[]>([
    {
      id: "doc1",
      fileName: "Patient_ID_Front.jpg",
      fileSize: 245000,
      fileType: "image/jpeg",
      uploadedAt: new Date().toISOString(),
      uploadedBy: "Dr. Smith",
      category: "Identity",
      department: "Registration",
      module: "Admission",
      tags: ["verified", "primary"],
      description: "Patient Aadhar card front side",
      url: "/demo/aadhar.jpg",
    },
    {
      id: "doc2",
      fileName: "Patient_Photo.jpg",
      fileSize: 125000,
      fileType: "image/jpeg",
      uploadedAt: new Date(Date.now() - 86400000).toISOString(),
      uploadedBy: "Receptionist",
      category: "Patient Photo",
      department: "Registration",
      module: "Admission",
      tags: ["current"],
      description: "Patient passport photo",
      url: "/demo/photo.jpg",
    },
    {
      id: "doc3",
      fileName: "Prescription_2024.pdf",
      fileSize: 450000,
      fileType: "application/pdf",
      uploadedAt: new Date(Date.now() - 172800000).toISOString(),
      uploadedBy: "Dr. Johnson",
      category: "Prescription",
      department: "OPD",
      module: "Consultation",
      tags: ["active"],
      description: "Current medications and dosage",
      url: "/demo/prescription.pdf",
    },
  ]);

  const [showCropEditor, setShowCropEditor] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);

  const handleDocumentDelete = (id: string) => {
    setDemoDocuments((docs) => docs.filter((d) => d.id !== id));
  };

  const handlePreview = (id: string) => {
    const doc = demoDocuments.find((d) => d.id === id);
    if (doc && doc.url) {
      setCropImageUrl(doc.url);
      setShowCropEditor(true);
    }
  };

  const handleCropSave = (croppedBlob: Blob) => {
    console.log("Cropped image saved:", croppedBlob);
    setShowCropEditor(false);
    setCropImageUrl(null);
  };

  return (
    <div className="space-y-4 p-4">
      <div className="pb-3">
        <h1 className="text-2xl font-bold">Document Management System Demo</h1>
        <p className="text-sm text-muted-foreground">
          Complete document upload, management, and processing workflow
        </p>
      </div>

      <Tabs defaultValue="upload" className="w-full">
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="browser">Browser</TabsTrigger>
          <TabsTrigger value="manager">Manager</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Documents
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Supports webcam capture, file selection, and mobile QR scanning
              </p>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <DocumentUpload
                  category="Identity"
                  patientId={1}
                  allowWebcam={true}
                  onDocumentsChange={(docs) => {
                    console.log("Identity docs:", docs);
                  }}
                />
                <DocumentUpload
                  category="Patient Photo"
                  patientId={1}
                  allowWebcam={true}
                  allowMobileQR={true}
                  onDocumentsChange={(docs) => {
                    console.log("Photo docs:", docs);
                  }}
                />
                <DocumentUpload
                  category="Reports"
                  onDocumentsChange={(docs) => {
                    console.log("Reports docs:", docs);
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="browser" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Document Browser
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Browse and preview documents with category filtering
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <DocumentBrowser
                documents={demoDocuments}
                onDelete={handleDocumentDelete}
                onDownload={(id) => console.log("Download:", id)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manager" className="space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Document Manager</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Advanced search, filtering, metadata management, and analytics
              </p>
            </CardHeader>
            <CardContent className="pt-2">
              <DocumentManager
                documents={demoDocuments}
                onDelete={handleDocumentDelete}
                onDownload={(id) => console.log("Download:", id)}
                onPreview={handlePreview}
                allowMetadataEdit={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Webcam Capture</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ Real-time video preview</p>
                <p>✓ 90° rotation controls</p>
                <p>✓ Auto-compression (1920×1080, 0.8 quality)</p>
                <p>✓ Error handling</p>
                <p>✓ Stream cleanup</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Mobile QR Workflow</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ QR code generation</p>
                <p>✓ Session-based links</p>
                <p>✓ Mobile-responsive UI</p>
                <p>✓ Secure validation</p>
                <p>✓ Auto-close on success</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Image Cropping</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ Interactive crop box</p>
                <p>✓ Scale & zoom controls</p>
                <p>✓ Rotation support</p>
                <p>✓ Size adjustment</p>
                <p>✓ Live preview</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Document Search</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ Full-text search</p>
                <p>✓ Category filtering</p>
                <p>✓ Department filtering</p>
                <p>✓ Tag-based search</p>
                <p>✓ Date range filtering</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Image Processing</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ Edge detection</p>
                <p>✓ Auto-crop extraction</p>
                <p>✓ Deskew correction (-45° to +45°)</p>
                <p>✓ Compression (configurable)</p>
                <p>✓ Format conversion</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs">Metadata Management</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <p>✓ Description & tags</p>
                <p>✓ Department/module tracking</p>
                <p>✓ Uploader information</p>
                <p>✓ Timestamp tracking</p>
                <p>✓ Bulk operations</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs">API Endpoints Required</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1 font-mono text-muted-foreground">
              <p>POST /api/patients/{"{patientId}"}/documents</p>
              <p>GET /api/patients/{"{patientId}"}/documents</p>
              <p>PATCH /api/patients/{"{patientId}"}/documents/{"{docId}"}/metadata</p>
              <p>DELETE /api/patients/{"{patientId}"}/documents/{"{docId}"}</p>
              <p>GET /api/patients/{"{patientId}"}/documents/{"{docId}"}/download</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Crop Editor */}
      {showCropEditor && cropImageUrl && (
        <ImageCropEditor
          imageUrl={cropImageUrl}
          onSave={handleCropSave}
          onCancel={() => setShowCropEditor(false)}
          title="Crop Document"
        />
      )}
    </div>
  );
}
