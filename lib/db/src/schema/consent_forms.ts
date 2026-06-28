import { pgTable, serial, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { doctorsTable } from "./doctors";

export const consentFormsTable = pgTable("consent_forms", {
  id: serial("id").primaryKey(),
  formNo: text("form_no").notNull().unique(),
  formType: text("form_type").notNull(),
  title: text("title").notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  doctorId: integer("doctor_id").references(() => doctorsTable.id),
  ipdAdmissionId: integer("ipd_admission_id"),
  otBookingId: integer("ot_booking_id"),
  variables: jsonb("variables").notNull().default({}),
  body: text("body").notNull(),
  patientSigned: boolean("patient_signed").default(false).notNull(),
  witnessName: text("witness_name"),
  signedAt: timestamp("signed_at"),
  status: text("status").default("draft").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertConsentFormSchema = createInsertSchema(consentFormsTable).omit({
  id: true, formNo: true, createdAt: true, updatedAt: true,
});
export type InsertConsentForm = z.infer<typeof insertConsentFormSchema>;
export type ConsentForm = typeof consentFormsTable.$inferSelect;
