import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull().unique(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  ipdAdmissionId: integer("ipd_admission_id"),
  opdVisitId: integer("opd_visit_id"),
  type: text("type").notNull(),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMode: text("payment_mode").notNull(),
  collectedBy: text("collected_by"),
  status: text("status").default("pending").notNull(),
  invoiceDate: text("invoice_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({ id: true, invoiceNo: true, createdAt: true, updatedAt: true });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
