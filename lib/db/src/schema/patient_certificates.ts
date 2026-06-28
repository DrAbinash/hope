import { pgTable, serial, text, integer, jsonb, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";
import { patientsTable } from "./patients";
import { employeesTable } from "./employees";

export const PATIENT_CERTIFICATE_TYPES = ["birth", "death"] as const;
export type PatientCertificateType = (typeof PATIENT_CERTIFICATE_TYPES)[number];

export const patientCertificatesTable = pgTable(
  "patient_certificates",
  {
    id: serial("id").primaryKey(),
    entityId: integer("entity_id").references(() => entitiesTable.id),
    type: text("type").notNull(), // 'birth' | 'death'
    certificateNo: text("certificate_no").notNull(),
    patientId: integer("patient_id").references(() => patientsTable.id),
    issuedDate: text("issued_date").notNull(),
    issuedById: integer("issued_by").references(() => employeesTable.id),
    details: jsonb("details").notNull().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("patient_certificates_no_uq").on(t.certificateNo)],
);

export type PatientCertificate = typeof patientCertificatesTable.$inferSelect;
export type InsertPatientCertificate = typeof patientCertificatesTable.$inferInsert;
