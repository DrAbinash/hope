import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { DocumentMetadata, DocumentSearchFilter, searchDocuments } from "@/lib/document-utils";

export function useDocumentManagement(patientId: number | string) {
  const qc = useQueryClient();
  const [filterState, setFilterState] = useState<DocumentSearchFilter>({});

  const documentsQuery = useQuery<DocumentMetadata[]>({
    queryKey: ["/api/patients", patientId, "documents"],
    queryFn: async () => {
      const r = await fetch(`/api/patients/${patientId}/documents`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch documents");
      const data = await r.json();
      return Array.isArray(data) ? data : data.documents || [];
    },
  });

  const filteredDocuments = searchDocuments(documentsQuery.data || [], filterState);

  const uploadDocument = useMutation({
    mutationFn: async (formData: FormData) => {
      const r = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) throw new Error("Failed to upload document");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast.success("Document uploaded successfully");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const updateDocumentMetadata = useMutation({
    mutationFn: async ({ docId, metadata }: { docId: string; metadata: Partial<DocumentMetadata> }) => {
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}/metadata`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      });
      if (!r.ok) throw new Error("Failed to update metadata");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast.success("Metadata updated");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const deleteDocument = useMutation({
    mutationFn: async (docId: string) => {
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete document");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents"] });
      toast.success("Document deleted");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const downloadDocument = useCallback(async (docId: string, fileName: string) => {
    try {
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}/download`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to download document");
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  }, [patientId]);

  const bulkUpload = useCallback(
    async (files: File[], category: string, metadata: Partial<DocumentMetadata> = {}) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      formData.append("category", category);

      // Add metadata fields directly to form data
      if (metadata.description) formData.append("description", metadata.description);
      if (metadata.tags) formData.append("tags", JSON.stringify(metadata.tags));
      if (metadata.department) formData.append("department", metadata.department);
      if (metadata.module) formData.append("module", metadata.module);

      return uploadDocument.mutateAsync(formData);
    },
    [uploadDocument]
  );

  return {
    documents: documentsQuery.data || [],
    filteredDocuments,
    isLoading: documentsQuery.isLoading,
    error: documentsQuery.error,
    filterState,
    setFilterState,

    // Mutations
    uploadDocument: (formData: FormData) => uploadDocument.mutateAsync(formData),
    bulkUpload,
    updateMetadata: (docId: string, metadata: Partial<DocumentMetadata>) =>
      updateDocumentMetadata.mutateAsync({ docId, metadata }),
    deleteDocument: (docId: string) => deleteDocument.mutateAsync(docId),
    downloadDocument,

    // Status
    isUploading: uploadDocument.isPending,
    isUpdating: updateDocumentMetadata.isPending,
    isDeleting: deleteDocument.isPending,
  };
}
