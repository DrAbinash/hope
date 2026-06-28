import { pgTable, serial, text, integer, numeric, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { entitiesTable } from "./entities";

export const ledgerGroupsTable = pgTable("ledger_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  parent: text("parent"),
  nature: text("nature").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const ledgersTable = pgTable("ledgers", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  name: text("name").notNull().unique(),
  groupId: integer("group_id").references(() => ledgerGroupsTable.id).notNull(),
  openingBalance: numeric("opening_balance", { precision: 12, scale: 2 }).default("0"),
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const vouchersTable = pgTable("vouchers", {
  id: serial("id").primaryKey(),
  voucherNo: text("voucher_no").notNull().unique(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  type: text("type").notNull(),
  date: text("date").notNull(),
  narration: text("narration"),
  entries: jsonb("entries").notNull().default([]),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLedgerGroupSchema = createInsertSchema(ledgerGroupsTable).omit({ id: true, createdAt: true });
export const insertLedgerSchema = createInsertSchema(ledgersTable).omit({ id: true, createdAt: true });
export const insertVoucherSchema = createInsertSchema(vouchersTable).omit({ id: true, voucherNo: true, createdAt: true });
export type InsertLedgerGroup = z.infer<typeof insertLedgerGroupSchema>;
export type InsertLedger = z.infer<typeof insertLedgerSchema>;
export type InsertVoucher = z.infer<typeof insertVoucherSchema>;
export type LedgerGroup = typeof ledgerGroupsTable.$inferSelect;
export type Ledger = typeof ledgersTable.$inferSelect;
export type Voucher = typeof vouchersTable.$inferSelect;

export const financialDocumentsTable = pgTable("financial_documents", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  documentUrl: text("document_url").notNull(),
  documentName: text("document_name").notNull(),
  ocrText: text("ocr_text"),
  extractedFields: jsonb("extracted_fields").default({}),
  ledgerRecommendations: jsonb("ledger_recommendations").default({}),
  status: text("status").default("draft").notNull(), // draft | pending_review | approved | rejected
  linkedVoucherId: integer("linked_voucher_id").references(() => vouchersTable.id),
  approvalHistory: jsonb("approval_history").default([]),
  auditTrail: jsonb("audit_trail").default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const organizationLearningsTable = pgTable("organization_learnings", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  pattern: text("pattern").notNull(),
  recommendedLedgerId: integer("recommended_ledger_id").references(() => ledgersTable.id).notNull(),
  count: integer("count").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

