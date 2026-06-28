import { pgTable, serial, text, integer, numeric, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";

export const tpaProvidersTable = pgTable("tpa_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  paymentTermDays: integer("payment_term_days").default(30),
  tdsPercent: numeric("tds_percent", { precision: 5, scale: 2 }).default("0"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const patientInsuranceTable = pgTable("patient_insurance", {
  id: serial("id").primaryKey(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  tpaId: integer("tpa_id").references(() => tpaProvidersTable.id).notNull(),
  policyNo: text("policy_no").notNull(),
  policyHolderName: text("policy_holder_name"),
  relationToHolder: text("relation_to_holder"),
  policyStart: text("policy_start"),
  policyEnd: text("policy_end"),
  sumInsured: numeric("sum_insured", { precision: 12, scale: 2 }),
  copayPercent: numeric("copay_percent", { precision: 5, scale: 2 }).default("0"),
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insuranceClaimsTable = pgTable("insurance_claims", {
  id: serial("id").primaryKey(),
  claimNo: text("claim_no").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  ipdAdmissionId: integer("ipd_admission_id"),
  tpaId: integer("tpa_id").references(() => tpaProvidersTable.id).notNull(),
  policyId: integer("policy_id").references(() => patientInsuranceTable.id),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  invoiceId: integer("invoice_id"),
  preauthAmount: numeric("preauth_amount", { precision: 12, scale: 2 }).default("0"),
  preauthDate: text("preauth_date"),
  preauthApprovalNo: text("preauth_approval_no"),
  preauthApprovedAmount: numeric("preauth_approved_amount", { precision: 12, scale: 2 }).default("0"),
  claimAmount: numeric("claim_amount", { precision: 12, scale: 2 }).default("0"),
  claimSubmittedDate: text("claim_submitted_date"),
  approvedAmount: numeric("approved_amount", { precision: 12, scale: 2 }).default("0"),
  disallowedAmount: numeric("disallowed_amount", { precision: 12, scale: 2 }).default("0"),
  copayAmount: numeric("copay_amount", { precision: 12, scale: 2 }).default("0"),
  tdsAmount: numeric("tds_amount", { precision: 12, scale: 2 }).default("0"),
  settledAmount: numeric("settled_amount", { precision: 12, scale: 2 }).default("0"),
  settlementDate: text("settlement_date"),
  utrNumber: text("utr_number"),
  status: text("status").default("preauth_pending").notNull(),
  deductions: jsonb("deductions").default([]),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTpaProviderSchema = createInsertSchema(tpaProvidersTable).omit({ id: true, createdAt: true });
export type InsertTpaProvider = z.infer<typeof insertTpaProviderSchema>;
export type TpaProvider = typeof tpaProvidersTable.$inferSelect;

export const insertPatientInsuranceSchema = createInsertSchema(patientInsuranceTable).omit({ id: true, createdAt: true });
export type PatientInsurance = typeof patientInsuranceTable.$inferSelect;

export const insertInsuranceClaimSchema = createInsertSchema(insuranceClaimsTable).omit({ id: true, claimNo: true, createdAt: true, updatedAt: true });
export type InsuranceClaim = typeof insuranceClaimsTable.$inferSelect;
