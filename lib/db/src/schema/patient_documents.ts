import { pgTable, serial, text, integer, timestamp, customType } from "drizzle-orm/pg-core";
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
  remark: text("remark"),
  uploadedBy: integer("uploaded_by").references(() => employeesTable.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

export type PatientDocument = typeof patientDocumentsTable.$inferSelect;
