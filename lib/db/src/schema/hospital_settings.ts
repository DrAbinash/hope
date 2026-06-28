import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const hospitalSettingsTable = pgTable("hospital_settings", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").notNull().unique(),
  hospitalName: text("hospital_name").notNull(),
  tagline: text("tagline"),
  address: text("address"),
  city: text("city"),
  state: text("state"),
  pincode: text("pincode"),
  gstin: text("gstin"),
  pan: text("pan"),
  mobile: text("mobile"),
  email: text("email"),
  website: text("website"),
  logoUrl: text("logo_url"),
  letterheadUrl: text("letterhead_url"),
  letterheadFooterUrl: text("letterhead_footer_url"),
  signatureUrl: text("signature_url"),
  prescriptionPrintMode: text("prescription_print_mode").notNull().default("plain"),
  billHeader: text("bill_header"),
  billFooter: text("bill_footer"),
  termsConditions: text("terms_conditions"),
  invoicePrefix: text("invoice_prefix").default("INV"),
  receiptPrefix: text("receipt_prefix").default("RCP"),
  uhidPrefix: text("uhid_prefix").default("UHID"),
  currency: text("currency").default("INR"),
  financialYearStart: text("financial_year_start").default("04-01"),
  defaultBillType: text("default_bill_type").notNull().default("final"),
  quickServices: jsonb("quick_services").$type<number[]>().default([]).notNull(),
  aiConfig: jsonb("ai_config").default({ provider: "mock" }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHospitalSettingsSchema = createInsertSchema(hospitalSettingsTable).omit({ id: true, updatedAt: true });
export type InsertHospitalSettings = z.infer<typeof insertHospitalSettingsSchema>;
export type HospitalSettings = typeof hospitalSettingsTable.$inferSelect;
