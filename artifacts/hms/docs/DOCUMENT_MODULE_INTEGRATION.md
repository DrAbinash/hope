# Document Management Module Integration Guide

This guide explains how to integrate document management functionality into different modules (OPD, IPD, Radiology, Lab, Billing, etc.) in the HMS application.

## Quick Start

### 1. Basic Integration (Recommended for most pages)

Add the `DocumentIntegration` component to any patient page:

```tsx
import { DocumentIntegration } from "@/components/document-integration";

export function MyModulePage({ patientId }) {
  return (
    <div className="space-y-4">
      {/* Your existing content */}
      
      {/* Add this for documents */}
      <DocumentIntegration 
        patientId={patientId}
        module="OPD"
        title="OPD Documents"
        showUpload={true}
      />
    </div>
  );
}
```

### 2. Full Document Management with Upload Dialog

Use the complete `DocumentManagement` hook for advanced control:

```tsx
import { useDocumentManagement } from "@/hooks/use-document-management";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentBrowser } from "@/components/document-browser";
import { DocumentManager } from "@/components/document-manager";

export function AdvancedDocumentPage({ patientId }) {
  const { 
    documents, 
    isLoading,
    bulkUpload,
    updateMetadata,
    deleteDocument 
  } = useDocumentManagement(patientId);

  const handleUpload = async (files: File[]) => {
    await bulkUpload(files, "Prescription", {
      department: "OPD",
      module: "Consultation"
    });
  };

  return (
    <div className="space-y-4">
      <DocumentUpload 
        category="Prescription"
        patientId={patientId}
        module="OPD"
        department="OPD"
      />
      
      <DocumentBrowser 
        documents={documents}
        isLoading={isLoading}
      />
    </div>
  );
}
```

## Component Reference

### DocumentIntegration
**Purpose:** High-level wrapper for document management in any module.

**Props:**
- `patientId: number | string` - Patient identifier
- `module: "OPD" | "IPD" | "Radiology" | "Lab" | "Billing" | "Registration"` - Module context
- `title?: string` - Custom heading
- `showUpload?: boolean` - Show upload button (default: true)
- `maxDocuments?: number` - Display limit (default: 50)

**Features:**
- Displays documents for specific module
- Download and delete functionality
- Category badges
- Automatic scrolling for many documents

### DocumentUpload
**Purpose:** Multi-mode file upload component.

**Props:**
- `category?: string` - Document category
- `patientId?: number | string` - Patient identifier
- `module?: "OPD" | "IPD" | ...` - Module context
- `department?: string` - Department name
- `description?: string` - Document description
- `tags?: string[]` - Document tags
- `allowWebcam?: boolean` - Enable webcam capture
- `allowMobileQR?: boolean` - Enable mobile QR workflow
- `maxSize?: number` - File size limit (default: 10MB)
- `multiple?: boolean` - Allow multiple files (default: true)

**Features:**
- Drag & drop support
- Batch upload with progress tracking
- Webcam capture
- Mobile QR code workflow
- Duplicate detection via SHA-256
- Image compression

### DocumentBrowser
**Purpose:** Simple document list viewer.

**Features:**
- Paginated list view
- Category filtering
- Search capabilities
- Document preview

### DocumentManager
**Purpose:** Advanced search, filter, and tag management.

**Features:**
- Full-text search
- Multi-field filtering
- Tag management
- Bulk operations
- Statistics display

### DocumentComparison
**Purpose:** Side-by-side document viewer.

**Features:**
- Before/after comparison
- Zoom controls
- PDF and image support
- Metadata display

## Integration Examples

### OPD Module

```tsx
// pages/opd/consultation.tsx
import { DocumentIntegration } from "@/components/document-integration";

export function OPDConsultation({ patientId }) {
  return (
    <div className="space-y-4">
      {/* Consultation form */}
      
      {/* Add documents section */}
      <DocumentIntegration 
        patientId={patientId}
        module="OPD"
        title="Consultation Documents"
      />
    </div>
  );
}
```

### Radiology Module

```tsx
// pages/radiology/report.tsx
import { DocumentUpload } from "@/components/document-upload";
import { useDocumentManagement } from "@/hooks/use-document-management";

export function RadiologyReport({ patientId }) {
  const { documents, bulkUpload } = useDocumentManagement(patientId);

  const radDocuments = documents.filter(
    d => d.category === "Radiology" || d.module === "Radiology"
  );

  return (
    <div className="space-y-4">
      {/* Report form */}
      
      <DocumentUpload
        category="Radiology"
        patientId={patientId}
        module="Radiology"
        department="Radiology"
        description="Radiology report image"
        tags={["radiology", "scan"]}
        multiple={true}
      />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Uploaded Images</h3>
        {radDocuments.map(doc => (
          <div key={doc.id} className="flex items-center gap-2 p-2 border rounded">
            <span>{doc.fileName}</span>
            <button onClick={() => downloadDocument(doc.id, doc.fileName)}>
              Download
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Billing Module

```tsx
// pages/billing/invoice.tsx
import { DocumentIntegration } from "@/components/document-integration";

export function BillingInvoice({ patientId }) {
  return (
    <div className="space-y-4">
      {/* Billing details */}
      
      <DocumentIntegration 
        patientId={patientId}
        module="Billing"
        title="Billing Documents (Insurance, Receipts, etc.)"
        maxDocuments={20}
      />
    </div>
  );
}
```

### IPD Module

```tsx
// pages/ipd/admission.tsx
import { DocumentIntegration } from "@/components/document-integration";

export function IPDAdmission({ patientId }) {
  return (
    <div className="space-y-4">
      {/* Admission form */}
      
      <DocumentIntegration 
        patientId={patientId}
        module="IPD"
        title="Admission Documents"
      />
      
      {/* Later: discharge documents */}
      <DocumentIntegration 
        patientId={patientId}
        module="IPD"
        title="Discharge Documents"
      />
    </div>
  );
}
```

## Backend API

All document operations go through these REST endpoints:

### Upload Documents
```
POST /api/patients/{patientId}/documents
Content-Type: multipart/form-data

Fields:
- files: File[] (required)
- category: string (required)
- description: string (optional)
- tags: string[] (optional)
- department: string (optional)
- module: string (optional)
```

### List Documents
```
GET /api/patients/{patientId}/documents?category=Prescription&search=report

Query Parameters:
- category: Filter by category
- department: Filter by department
- tags: Filter by tags (comma-separated)
- search: Full-text search
- startDate: Filter by date range
- endDate: Filter by date range
```

### Get Document Details
```
GET /api/patients/{patientId}/documents/{docId}
```

### Update Metadata
```
PATCH /api/patients/{patientId}/documents/{docId}/metadata
Content-Type: application/json

{
  "description": "Updated description",
  "tags": ["tag1", "tag2"],
  "department": "OPD",
  "module": "Consultation"
}
```

### Download Document
```
GET /api/patients/{patientId}/documents/{docId}/download?inline=false
```

### Delete Document
```
DELETE /api/patients/{patientId}/documents/{docId}
```

### Batch Operations
```
POST /api/patients/{patientId}/documents/batch

{
  "action": "delete|tag|untag",
  "documentIds": [1, 2, 3],
  "tags": ["archived", "reviewed"]
}
```

### Statistics
```
GET /api/patients/{patientId}/documents/stats
```

## Document Categories

Predefined categories for organization:

- Patient Photo
- Identity
- Prescription
- Radiology
- Laboratory
- Clinical Photograph
- Consent
- Insurance
- Referral
- ECG
- Echo
- Operation Notes
- Discharge Summary
- Other

## Supported File Types

- Images: JPEG, PNG, WebP
- Documents: PDF, Excel (.xlsx), Word (.docx)
- Maximum file size: 10MB per file

## Features

### Duplicate Detection
Files are automatically checked for duplicates using SHA-256 hashing. Duplicate uploads are prevented.

### Offline Support
Documents can be cached offline using IndexedDB and automatically synced when connectivity is restored.

### Role-Based Access Control
Document access is controlled by user role:
- **Patient:** View own documents only
- **Doctor/Nurse:** View and manage patient documents
- **Admin:** Full access with audit logging

### Audit Logging
All document operations are logged with:
- User ID
- Action (view, download, upload, delete)
- Timestamp
- Result (success/failure)
- IP address

### Export Functionality
Bulk export documents as:
- ZIP file (all documents)
- CSV (metadata only)
- JSON (full metadata)
- PDF (merge multiple PDFs)

## Performance Tips

1. **Limit Initial Load:** Use the `maxDocuments` prop to limit displayed documents
2. **Filter Early:** Implement category/department filtering before rendering large lists
3. **Lazy Load:** Load additional documents on scroll
4. **Compress Images:** The upload component automatically compresses images
5. **Batch Operations:** Use batch API for bulk delete/tag operations

## Troubleshooting

### Upload Fails with "Category is required"
Ensure the `category` prop is provided to the `DocumentUpload` component.

### Files Not Appearing After Upload
Check that:
- User has upload permissions
- File type is supported
- File size is under 10MB
- Network request completed successfully (check browser console)

### Duplicate Detection Too Strict
The system uses exact SHA-256 matching. Even slight file modifications (compression) create new hashes. This is by design for file integrity.

### Performance Slow with Many Documents
Consider:
- Implementing pagination (API supports pagination via query params)
- Using the module filter to show only relevant documents
- Archiving old documents instead of deleting

## Future Enhancements

- [ ] Google Vision API integration for OCR
- [ ] Scanner device integration (Windows WIA/TWAIN)
- [ ] Digital signature support
- [ ] Document watermarking
- [ ] Advanced analytics dashboard
- [ ] Document templates (consent forms, discharge summaries)
- [ ] Time-limited sharing links
- [ ] Real-time collaboration features
