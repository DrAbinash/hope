import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  category: string;
  uploadedAt: Date;
  uploadedBy?: string;
  url?: string;
}

export function useDocumentUpload(patientId: number | string, category: string) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const r = await fetch(`/api/patients/${patientId}/documents`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) throw new Error("Failed to upload documents");
      return r.json();
    },
    onSuccess: (response) => {
      setFiles((prev) => [...prev, ...(response.documents || [])]);
      toast.success("Documents uploaded successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleAddFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList) return;

      const formData = new FormData();
      Array.from(fileList).forEach((file) => {
        formData.append("files", file);
        formData.append("category", category);
      });

      setIsLoading(true);
      try {
        await uploadMutation.mutateAsync(formData);
      } finally {
        setIsLoading(false);
      }
    },
    [category, uploadMutation]
  );

  const handleDeleteFile = useCallback(async (fileId: string) => {
    try {
      const r = await fetch(`/api/patients/${patientId}/documents/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to delete document");
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("Document deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete document");
    }
  }, [patientId]);

  return {
    files,
    setFiles,
    isLoading: isLoading || uploadMutation.isPending,
    handleAddFiles,
    handleDeleteFile,
  };
}
