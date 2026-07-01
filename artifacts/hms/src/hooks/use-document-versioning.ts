import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface DocumentVersion {
  version: number;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedBy: string;
  changes: string;
  url: string;
}

export function useDocumentVersioning(patientId: number | string, docId: string) {
  const qc = useQueryClient();

  const versionsQuery = useQuery<DocumentVersion[]>({
    queryKey: ["/api/patients", patientId, "documents", docId, "versions"],
    queryFn: async () => {
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}/versions`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to fetch versions");
      const data = await r.json();
      return Array.isArray(data) ? data : data.versions || [];
    },
  });

  const revertToVersion = useMutation({
    mutationFn: async (version: number) => {
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}/versions/${version}/revert`, {
        method: "POST",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to revert version");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents", docId, "versions"] });
      toast.success("Reverted to previous version");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  const uploadNewVersion = useMutation({
    mutationFn: async ({ file, changes }: { file: File; changes: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("changes", changes);
      const r = await fetch(`/api/patients/${patientId}/documents/${docId}/versions`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!r.ok) throw new Error("Failed to upload new version");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/patients", patientId, "documents", docId, "versions"] });
      toast.success("New version uploaded");
    },
    onError: (e: Error) => {
      toast.error(e.message);
    },
  });

  return {
    versions: versionsQuery.data || [],
    isLoading: versionsQuery.isLoading,
    revertToVersion: (version: number) => revertToVersion.mutateAsync(version),
    uploadNewVersion: (file: File, changes: string) => uploadNewVersion.mutateAsync({ file, changes }),
    isReverting: revertToVersion.isPending,
    isUploading: uploadNewVersion.isPending,
  };
}
