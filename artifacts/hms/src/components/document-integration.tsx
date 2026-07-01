import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Download, Trash2, Clock, User, FolderOpen } from "lucide-react";
import { useDocumentManagement } from "@/hooks/use-document-management";
import { DocumentUpload } from "./document-upload";
import { toast } from "sonner";

interface DocumentIntegrationProps {
  patientId: number | string;
  module: "OPD" | "IPD" | "Radiology" | "Lab" | "Billing" | "Registration";
  title?: string;
  showUpload?: boolean;
  maxDocuments?: number;
}

export function DocumentIntegration({
  patientId,
  module,
  title,
  showUpload = true,
  maxDocuments = 50,
}: DocumentIntegrationProps) {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const {
    documents,
    isLoading,
    isDeleting,
    downloadDocument,
    deleteDocument,
  } = useDocumentManagement(patientId);

  // Filter documents by module
  const moduleDocuments = documents.filter(
    (doc) => !doc.module || doc.module === module || doc.department === module
  );

  const handleDelete = async (docId: string | number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await deleteDocument(String(docId));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to delete");
      }
    }
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-3">
      <Card className="bg-gradient-to-r from-blue-50 to-cyan-50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">
                {title || `${module} Documents`}
              </CardTitle>
              <Badge variant="secondary" className="text-xs">
                {moduleDocuments.length}/{maxDocuments}
              </Badge>
            </div>
            {showUpload && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => setShowUploadDialog(true)}
              >
                <Upload className="w-3 h-3 mr-1" />
                Upload
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              Loading documents...
            </p>
          ) : moduleDocuments.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No documents uploaded for this {module.toLowerCase()}
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {moduleDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-2 bg-white rounded border hover:bg-gray-50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{doc.fileName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(doc.uploadedAt)}
                      {doc.category && (
                        <>
                          <Badge variant="outline" className="text-xs">
                            {doc.category}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => downloadDocument(String(doc.id), doc.fileName)}
                      title="Download"
                    >
                      <Download className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-800"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting}
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {showUploadDialog && (
        <DocumentUpload
          patientId={patientId}
          module={module}
          onClose={() => setShowUploadDialog(false)}
        />
      )}
    </div>
  );
}
