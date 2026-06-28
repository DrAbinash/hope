import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { doctorsTable } from "./doctors";
import { billingHeadsTable } from "./billing_heads";

export const otBookingsTable = pgTable("ot_bookings", {
  id: serial("id").primaryKey(),
  bookingNo: text("booking_no").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  ipdAdmissionId: integer("ipd_admission_id"),
  otRoom: text("ot_room").notNull(),
  surgeonId: integer("surgeon_id").references(() => doctorsTable.id),
  anaesthetistId: integer("anaesthetist_id").references(() => doctorsTable.id),
  procedureBillingHeadId: integer("procedure_billing_head_id").references(() => billingHeadsTable.id),
  procedureName: text("procedure_name").notNull(),
  procedureCharge: numeric("procedure_charge", { precision: 10, scale: 2 }).notNull(),
  anaesthesiaType: text("anaesthesia_type"),
  anaesthesiaNotes: text("anaesthesia_notes"),
  preOpChecklist: jsonb("pre_op_checklist").default({}),
  consumables: jsonb("consumables").notNull().default([]),
  notes: text("notes"),
  status: text("status").default("scheduled").notNull(),
  invoiceId: integer("invoice_id"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertOtBookingSchema = createInsertSchema(otBookingsTable).omit({
  id: true, bookingNo: true, createdAt: true, updatedAt: true,
});
export type InsertOtBooking = z.infer<typeof insertOtBookingSchema>;
export type OtBooking = typeof otBookingsTable.$inferSelect;
