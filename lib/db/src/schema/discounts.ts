import { pgTable, serial, text, integer, numeric, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";
import { patientsTable } from "./patients";
import { invoicesTable } from "./billing";

export const discountApprovalsTable = pgTable("discount_approvals", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  invoiceId: integer("invoice_id").references(() => invoicesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  patientName: text("patient_name"),
  invoiceType: text("invoice_type"),
  originalAmount: numeric("original_amount", { precision: 12, scale: 2 }).notNull(),
  discountType: text("discount_type").notNull().default("fixed"),
  discountValue: numeric("discount_value", { precision: 12, scale: 2 }).notNull(),
  discountAmount: numeric("discount_amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  requestedBy: text("requested_by").notNull(),
  requestedRole: text("requested_role"),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  appliedToInvoice: boolean("applied_to_invoice").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDiscountApprovalSchema = createInsertSchema(discountApprovalsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDiscountApproval = z.infer<typeof insertDiscountApprovalSchema>;
export type DiscountApproval = typeof discountApprovalsTable.$inferSelect;
