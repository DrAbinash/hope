import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { doctorsTable } from "./doctors";
import { wardsTable, bedsTable } from "./wards";

export const ipdAdmissionsTable = pgTable("ipd_admissions", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  ipdNo: text("ipd_no").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  linkedOpdId: integer("linked_opd_id"),
  consultantDoctorId: integer("consultant_doctor_id").references(() => doctorsTable.id).notNull(),
  wardId: integer("ward_id").references(() => wardsTable.id).notNull(),
  bedId: integer("bed_id").references(() => bedsTable.id).notNull(),
  admissionDate: text("admission_date").notNull(),
  dischargeDate: text("discharge_date"),
  admissionNote: text("admission_note"),
  diagnosis: text("diagnosis"),
  status: text("status").default("admitted").notNull(),
  transferOpdBilling: boolean("transfer_opd_billing").default(false),
  dischargeSummary: text("discharge_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const admissionConversionLogTable = pgTable("admission_conversion_log", {
  id: serial("id").primaryKey(),
  opdVisitId: integer("opd_visit_id").notNull(),
  ipdAdmissionId: integer("ipd_admission_id").notNull(),
  patientId: integer("patient_id").notNull(),
  convertedAt: timestamp("converted_at").defaultNow().notNull(),
  convertedBy: text("converted_by"),
  notes: text("notes"),
});

export const insertIpdAdmissionSchema = createInsertSchema(ipdAdmissionsTable).omit({ id: true, ipdNo: true, createdAt: true, updatedAt: true });
export type InsertIpdAdmission = z.infer<typeof insertIpdAdmissionSchema>;
export type IpdAdmission = typeof ipdAdmissionsTable.$inferSelect;
