# Document Management API Specification

## Overview
Complete REST API for patient document management across the ERP system. Supports file uploads, metadata management, search, filtering, and document operations.

## Base URL
```
/api/patients/{patientId}/documents
```

## Authentication
All endpoints require `credentials: include` for session-based authentication.

---

## Endpoints

### 1. Upload Documents
**POST** `/api/patients/{patientId}/documents`

Upload single or multiple files with optional metadata.

**Request:**
- `Content-Type: multipart/form-data`
- Fields:
  - `files` (File[], required): Document files
  - `category` (string, required): Document category
  - `metadata[description]` (string, optional): Document description
  - `metadata[tags]` (string[], optional): Tags for categorization
  - `metadata[department]` (string, optional): Department name
  - `metadata[module]` (string, optional): Module/workflow name

**Response:**
```json
{
  "success": true,
  "documents": [
    {
      "id": "doc123",
      "fileName": "patient_id.jpg",
      "fileSize": 245000,
      "fileType": "image/jpeg",
      "uploadedAt": "2026-07-01T12:34:56Z",
      "uploadedBy": "DR001",
      "category": "Identity",
      "url": "/api/patients/1/documents/doc123"
    }
  ]
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid input (missing category, invalid file)
- `413`: File size exceeds limit (>10MB)
- `415`: Unsupported file type
- `401`: Unauthorized
- `404`: Patient not found

---

### 2. Get All Documents
**GET** `/api/patients/{patientId}/documents`

Retrieve all documents for a patient with optional filtering.

**Query Parameters:**
- `category` (string, optional): Filter by category
- `department` (string, optional): Filter by department
- `uploadedBy` (string, optional): Filter by uploader
- `startDate` (ISO8601, optional): Filter by start date
- `endDate` (ISO8601, optional): Filter by end date
- `tags` (string[], optional): Filter by tags (comma-separated)
- `search` (string, optional): Full-text search in name/description

**Response:**
```json
{
  "documents": [
    {
      "id": "doc123",
      "fileName": "patient_id.jpg",
      "fileSize": 245000,
      "fileType": "image/jpeg",
      "uploadedAt": "2026-07-01T12:34:56Z",
      "uploadedBy": "DR001",
      "category": "Identity",
      "department": "Registration",
      "module": "Admission",
      "description": "Aadhar card front",
      "tags": ["verified", "primary"],
      "url": "/api/patients/1/documents/doc123"
    }
  ],
  "total": 1,
  "filtered": 1
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Patient not found

---

### 3. Get Document Details
**GET** `/api/patients/{patientId}/documents/{docId}`

Retrieve metadata for a specific document.

**Response:**
```json
{
  "id": "doc123",
  "fileName": "patient_id.jpg",
  "fileSize": 245000,
  "fileType": "image/jpeg",
  "uploadedAt": "2026-07-01T12:34:56Z",
  "uploadedBy": "DR001",
  "category": "Identity",
  "department": "Registration",
  "module": "Admission",
  "description": "Aadhar card front",
  "tags": ["verified", "primary"],
  "url": "/api/patients/1/documents/doc123"
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Document not found

---

### 4. Update Document Metadata
**PATCH** `/api/patients/{patientId}/documents/{docId}/metadata`

Update document metadata (description, tags, etc.) without replacing the file.

**Request Body:**
```json
{
  "description": "Updated description",
  "tags": ["verified", "important", "new-tag"],
  "department": "OPD",
  "module": "Consultation"
}
```

**Response:**
```json
{
  "id": "doc123",
  "fileName": "patient_id.jpg",
  "description": "Updated description",
  "tags": ["verified", "important", "new-tag"],
  "department": "OPD",
  "module": "Consultation",
  "updatedAt": "2026-07-01T14:00:00Z"
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid input
- `401`: Unauthorized
- `404`: Document not found

---

### 5. Download Document
**GET** `/api/patients/{patientId}/documents/{docId}/download`

Download the actual document file.

**Query Parameters:**
- `inline` (boolean, optional): Display inline instead of download. Default: false

**Response:**
- Binary file content with appropriate `Content-Type` header
- `Content-Disposition: attachment; filename="patient_id.jpg"` (or inline if requested)

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Document not found
- `410`: File deleted or expired

---

### 6. Delete Document
**DELETE** `/api/patients/{patientId}/documents/{docId}`

Permanently delete a document and its metadata.

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Document not found

---

### 7. Batch Operations
**POST** `/api/patients/{patientId}/documents/batch`

Perform bulk operations on multiple documents.

**Request Body:**
```json
{
  "action": "delete|tag|untag",
  "documentIds": ["doc1", "doc2", "doc3"],
  "tags": ["archive", "reviewed"]
}
```

**Response:**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0
}
```

**Status Codes:**
- `200`: Success
- `400`: Invalid action or input
- `401`: Unauthorized

---

### 8. Document Statistics
**GET** `/api/patients/{patientId}/documents/stats`

Get aggregated document statistics.

**Response:**
```json
{
  "total": 15,
  "totalSize": 3500000,
  "byCategory": [
    { "category": "Identity", "count": 2 },
    { "category": "Prescription", "count": 5 },
    { "category": "Radiology", "count": 8 }
  ],
  "byDepartment": [
    { "department": "Registration", "count": 2 },
    { "department": "OPD", "count": 8 },
    { "department": "Radiology", "count": 5 }
  ],
  "uploadedBy": ["DR001", "RECEPTIONIST001", "TECH001"],
  "oldestDocument": "2024-01-15T10:00:00Z",
  "newestDocument": "2026-07-01T14:00:00Z"
}
```

**Status Codes:**
- `200`: Success
- `401`: Unauthorized
- `404`: Patient not found

---

## Data Models

### DocumentMetadata
```typescript
interface DocumentMetadata {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  uploadedAt: string; // ISO8601
  uploadedBy?: string;
  category: string; // From DOCUMENT_CATEGORIES
  tags?: string[];
  description?: string;
  department?: string; // From DOCUMENT_DEPARTMENTS
  module?: string; // From DOCUMENT_MODULES
  patientId?: number | string;
  url?: string;
}
```

### Document Categories
```
Patient Photo
Identity
Prescription
Radiology
Laboratory
Clinical Photograph
Consent
Insurance
Referral
ECG
Echo
Operation Notes
Discharge Summary
Other
```

### Document Departments
```
Registration
Billing
OPD
IPD
ICU
Radiology
Laboratory
Pharmacy
Surgery
Discharge
```

### Document Modules
```
Admission
Consultation
Investigation
Treatment
Discharge
Follow-up
Insurance
Legal
```

---

## Storage Requirements

### File Storage
- **Location**: Secure file storage (cloud or on-premise)
- **Organization**: `/patients/{patientId}/documents/{docId}`
- **Retention**: Per hospital policy (default: 7 years)
- **Backup**: Daily incremental, weekly full backup

### Database Storage
- **Metadata**: Indexed for search performance
- **Full-text Index**: On fileName, description, tags
- **Audit Log**: Track all CRUD operations with user/timestamp

### Size Limits
- **Single File**: 10 MB default (configurable)
- **Patient Total**: 1 GB default (configurable)
- **Daily Upload**: 500 MB default (configurable)

---

## Search & Filtering

### Full-Text Search
Search across:
- Document file names
- Document descriptions
- Document tags

**Example:**
```
GET /api/patients/1/documents?search=aadhar
```

### Category Filtering
Filter by document category.

**Example:**
```
GET /api/patients/1/documents?category=Identity&category=Prescription
```

### Date Range Filtering
Filter by upload date.

**Example:**
```
GET /api/patients/1/documents?startDate=2026-01-01&endDate=2026-07-01
```

### Tag-Based Filtering
Filter by tags (AND logic).

**Example:**
```
GET /api/patients/1/documents?tags=verified&tags=primary
```

---

## Error Handling

### Standard Error Response
```json
{
  "error": "Invalid file type",
  "message": "Only JPEG, PNG, PDF files are allowed",
  "code": "INVALID_FILE_TYPE",
  "details": {
    "allowed": ["image/jpeg", "image/png", "application/pdf"],
    "received": "image/svg+xml"
  }
}
```

### Common Errors
- `INVALID_FILE_TYPE`: Unsupported file format
- `FILE_TOO_LARGE`: File exceeds size limit
- `QUOTA_EXCEEDED`: Patient/hospital storage quota exceeded
- `DOCUMENT_NOT_FOUND`: Document doesn't exist
- `UNAUTHORIZED`: User lacks permissions
- `INVALID_METADATA`: Metadata validation failed

---

## Performance Considerations

### Pagination
For large document lists, implement pagination:
```
GET /api/patients/1/documents?page=1&limit=20
```

### Caching
- Cache document list for 5 minutes per patient
- Invalidate on upload/delete/update
- Cache category counts

### Indexing
- Index on: patientId, category, uploadedAt, tags, department
- Full-text index on: fileName, description

### Compression
- Store compressed images (JPEG, PNG)
- Support PDF compression
- Maintain original for archive

---

## Security Considerations

### Access Control
- Patients can only access their own documents
- Staff can access patient documents per permissions
- Admins can access all documents with audit logging

### Encryption
- Encrypt files at rest (AES-256)
- Use TLS for in-transit encryption
- Encrypt sensitive metadata

### Audit Logging
- Log all document access (view, download)
- Log all metadata changes
- Track deletion with user/timestamp
- Retention: Minimum 7 years

### Validation
- Validate file types (magic bytes, not just extension)
- Scan for malware
- Reject suspicious files
- Log validation failures

---

## Integration Points

### Billing Module
- Link documents to billing invoices
- Insurance documents for claims
- Consent documents for procedures

### Registration Module
- Patient identity documents
- Guardian information (for minors/IPD)
- Insurance card images

### OPD Module
- Consultation notes (scan/upload)
- Prescription documents
- Follow-up reports

### IPD Module
- Admission documents
- Clinical photographs
- Discharge summaries
- Operation notes

### Radiology Module
- Automated DICOM integration
- Report PDFs
- Comparison tools

### Lab Module
- Lab reports integration
- Results with timestamps

---

## Implementation Checklist

- [ ] Database schema for documents & metadata
- [ ] File storage setup (local/cloud)
- [ ] Upload endpoint with validation
- [ ] Metadata storage and indexing
- [ ] Search and filtering implementation
- [ ] Download with proper headers
- [ ] Delete with archival
- [ ] Batch operations
- [ ] Statistics aggregation
- [ ] Audit logging
- [ ] Encryption setup
- [ ] Performance optimization
- [ ] Error handling & validation
- [ ] Unit tests (80%+ coverage)
- [ ] Integration tests
- [ ] Load testing (1000+ concurrent)
- [ ] Security audit
- [ ] Documentation
