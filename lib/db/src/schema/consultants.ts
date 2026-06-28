import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";
import { patientsTable } from "./patients";
import { invoicesTable } from "./billing";

export const consultantsTable = pgTable("consultants", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  name: text("name").notNull(),
  specialization: text("specialization"),
  qualification: text("qualification"),
  phone: text("phone"),
  email: text("email"),
  registrationNo: text("registration_no"),
  paymentType: text("payment_type").notNull().default("percentage"), // percentage | fixed
  paymentValue: numeric("payment_value", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsultantSchema = createInsertSchema(consultantsTable).omit({ id: true, createdAt: true });
export type InsertConsultant = z.infer<typeof insertConsultantSchema>;
export type Consultant = typeof consultantsTable.$inferSelect;

export const consultantEngagementsTable = pgTable("consultant_engagements", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  consultantId: integer("consultant_id").references(() => consultantsTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  serviceDate: text("service_date").notNull(),
  serviceDescription: text("service_description"),
  serviceAmount: numeric("service_amount", { precision: 12, scale: 2 }).notNull(),
  paymentType: text("payment_type").notNull(), // percentage | fixed (snapshot)
  paymentValue: numeric("payment_value", { precision: 10, scale: 2 }).notNull(),
  payoutAmount: numeric("payout_amount", { precision: 12, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending | paid
  paidOn: text("paid_on"),
  paymentMode: text("payment_mode"),
  reference: text("reference"),
  notes: text("notes"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsultantEngagementSchema = createInsertSchema(consultantEngagementsTable).omit({ id: true, createdAt: true });
export type InsertConsultantEngagement = z.infer<typeof insertConsultantEngagementSchema>;
export type ConsultantEngagement = typeof consultantEngagementsTable.$inferSelect;
