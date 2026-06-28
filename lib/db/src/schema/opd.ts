import { pgTable, serial, text, integer, numeric, jsonb, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { doctorsTable } from "./doctors";

export const opdVisitsTable = pgTable("opd_visits", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull(),
  visitNo: text("visit_no").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  doctorId: integer("doctor_id").references(() => doctorsTable.id).notNull(),
  visitDate: text("visit_date").notNull(),
  chiefComplaints: text("chief_complaints"),
  diagnosis: text("diagnosis"),
  medicines: jsonb("medicines").default([]),
  labTests: text("lab_tests"),
  radiologyTests: text("radiology_tests"),
  advise: text("advise"),
  specialAdvise: text("special_advise"),
  nextVisitDate: text("next_visit_date"),
  vitals: jsonb("vitals").default({}),
  status: text("status").default("pending").notNull(),
  convertedToIpd: boolean("converted_to_ipd").default(false).notNull(),
  ipdAdmissionId: integer("ipd_admission_id"),
  fee: numeric("fee", { precision: 10, scale: 2 }),
  aiGenerated: boolean("ai_generated").default(false),
  doctorEdited: boolean("doctor_edited").default(false),
  approvedBy: integer("approved_by").references(() => doctorsTable.id),
  approvedAt: timestamp("approved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_opd_visits_patient_id").on(table.patientId),
  index("idx_opd_visits_entity_id").on(table.entityId),
  index("idx_opd_visits_doctor_id").on(table.doctorId),
  index("idx_opd_visits_visit_date").on(table.visitDate),
  index("idx_opd_visits_status").on(table.status),
]);

export const insertOpdVisitSchema = createInsertSchema(opdVisitsTable).omit({ id: true, visitNo: true, createdAt: true, updatedAt: true });
export type InsertOpdVisit = z.infer<typeof insertOpdVisitSchema>;
export type OpdVisit = typeof opdVisitsTable.$inferSelect;
