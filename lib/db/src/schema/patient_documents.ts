import { pgTable, serial, text, integer, timestamp, customType, varchar, boolean } from "drizzle-orm/pg-core";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { employeesTable } from "./employees";

const bytea = customType<{ data: Buffer; default: false }>({
  dataType() { return "bytea"; },
});

export const patientDocumentsTable = pgTable("patient_documents", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  documentDate: text("document_date").notNull(),
  reportName: text("report_name").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: bytea("file_data").notNull(),
  fileHash: text("file_hash"), // SHA-256 for duplicate detection
  remark: text("remark"),
  category: varchar("category", { length: 50 }), // e.g., "Identity", "Prescription", "Radiology"
  tags: text("tags").array(), // Array of tags for categorization
  description: text("description"), // Document description
  department: varchar("department", { length: 50 }), // e.g., "OPD", "Billing", "Radiology"
  module: varchar("module", { length: 50 }), // e.g., "Admission", "Consultation", "Treatment"
  version: integer("version").default(1), // For document versioning
  isArchived: boolean("is_archived").default(false), // Soft delete support
  uploadedBy: integer("uploaded_by").references(() => employeesTable.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PatientDocument = typeof patientDocumentsTable.$inferSelect;
