import { pgTable, serial, text, integer, numeric, jsonb, timestamp, boolean, date } from "drizzle-orm/pg-core";
import { entitiesTable } from "./entities";
import { medicinesTable } from "./pharmacy";

export const vendorsTable = pgTable("vendors", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  name: text("name").notNull(),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  gstin: text("gstin"),
  pan: text("pan"),
  drugLicenseNo: text("drug_license_no"),
  paymentTerms: text("payment_terms").default("Net 30"),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).default("0"),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const vendorPurchasesTable = pgTable("vendor_purchases", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  invoiceNo: text("invoice_no").notNull(),
  invoiceDate: date("invoice_date").notNull(),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).default("0"),
  gstStateType: text("gst_state_type").default("intra"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).default("0"),
  dueAmount: numeric("due_amount", { precision: 14, scale: 2 }).default("0"),
  status: text("status").notNull().default("received"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseReturnsTable = pgTable("purchase_returns", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  purchaseId: integer("purchase_id").references(() => vendorPurchasesTable.id),
  returnNo: text("return_no").notNull().unique(),
  returnDate: date("return_date").notNull(),
  reason: text("reason").notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 14, scale: 2 }).default("0"),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).default("0"),
  gstStateType: text("gst_state_type").default("intra"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  completedAt: timestamp("completed_at"),
});

export const purchaseReturnItemsTable = pgTable("purchase_return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull().references(() => purchaseReturnsTable.id, { onDelete: "cascade" }),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  batchNo: text("batch_no"),
  quantityReturned: integer("quantity_returned").notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).default("12"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  hsnCode: text("hsn_code"),
});

export const vendorPaymentsTable = pgTable("vendor_payments", {
  id: serial("id").primaryKey(),
  vendorId: integer("vendor_id").notNull().references(() => vendorsTable.id),
  purchaseId: integer("purchase_id").references(() => vendorPurchasesTable.id),
  paymentDate: date("payment_date").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  mode: text("mode").notNull(),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Vendor = typeof vendorsTable.$inferSelect;
export type VendorPurchase = typeof vendorPurchasesTable.$inferSelect;
export type VendorPayment = typeof vendorPaymentsTable.$inferSelect;
export type PurchaseReturn = typeof purchaseReturnsTable.$inferSelect;
export type PurchaseReturnItem = typeof purchaseReturnItemsTable.$inferSelect;
