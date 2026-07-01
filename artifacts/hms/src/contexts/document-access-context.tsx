import { createContext, useContext, ReactNode } from "react";

export type DocumentRole = "patient" | "doctor" | "receptionist" | "admin" | "nurse" | "technician";

export interface DocumentPermissions {
  canView: boolean;
  canUpload: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canEditMetadata: boolean;
  canShare: boolean;
  canViewAuditLog: boolean;
  canExport: boolean;
  canArchive: boolean;
}

const rolePermissions: Record<DocumentRole, DocumentPermissions> = {
  patient: {
    canView: true,
    canUpload: false,
    canDownload: true,
    canDelete: false,
    canEditMetadata: false,
    canShare: false,
    canViewAuditLog: false,
    canExport: false,
    canArchive: false,
  },
  doctor: {
    canView: true,
    canUpload: true,
    canDownload: true,
    canDelete: true,
    canEditMetadata: true,
    canShare: true,
    canViewAuditLog: true,
    canExport: true,
    canArchive: true,
  },
  receptionist: {
    canView: true,
    canUpload: true,
    canDownload: true,
    canDelete: false,
    canEditMetadata: false,
    canShare: false,
    canViewAuditLog: false,
    canExport: false,
    canArchive: false,
  },
  nurse: {
    canView: true,
    canUpload: true,
    canDownload: true,
    canDelete: false,
    canEditMetadata: false,
    canShare: false,
    canViewAuditLog: false,
    canExport: false,
    canArchive: false,
  },
  technician: {
    canView: true,
    canUpload: true,
    canDownload: true,
    canDelete: false,
    canEditMetadata: false,
    canShare: false,
    canViewAuditLog: false,
    canExport: false,
    canArchive: false,
  },
  admin: {
    canView: true,
    canUpload: true,
    canDownload: true,
    canDelete: true,
    canEditMetadata: true,
    canShare: true,
    canViewAuditLog: true,
    canExport: true,
    canArchive: true,
  },
};

interface DocumentAccessContextType {
  userRole: DocumentRole;
  permissions: DocumentPermissions;
  setUserRole: (role: DocumentRole) => void;
  hasPermission: (action: keyof DocumentPermissions) => boolean;
}

const DocumentAccessContext = createContext<DocumentAccessContextType | undefined>(undefined);

export function DocumentAccessProvider({ children, initialRole = "doctor" }: { children: ReactNode; initialRole?: DocumentRole }) {
  const permissions = rolePermissions[initialRole];

  const hasPermission = (action: keyof DocumentPermissions): boolean => {
    return permissions[action];
  };

  const value: DocumentAccessContextType = {
    userRole: initialRole,
    permissions,
    setUserRole: () => {}, // Implement based on your auth system
    hasPermission,
  };

  return <DocumentAccessContext.Provider value={value}>{children}</DocumentAccessContext.Provider>;
}

export function useDocumentAccess() {
  const context = useContext(DocumentAccessContext);
  if (!context) {
    throw new Error("useDocumentAccess must be used within DocumentAccessProvider");
  }
  return context;
}

export function useDocumentPermission(action: keyof DocumentPermissions): boolean {
  const { hasPermission } = useDocumentAccess();
  return hasPermission(action);
}
