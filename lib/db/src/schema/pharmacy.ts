import { pgTable, serial, text, integer, numeric, jsonb, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { patientsTable } from "./patients";
import { entitiesTable } from "./entities";
import { ipdAdmissionsTable } from "./ipd";

export const medicinesTable = pgTable("medicines", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  name: text("name").notNull(),
  genericName: text("generic_name"),
  brandName: text("brand_name"),
  strength: text("strength"),
  formulation: text("formulation"),
  category: text("category"),
  manufacturer: text("manufacturer"),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  barcode: text("barcode"),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }),
  saleRate: numeric("sale_rate", { precision: 10, scale: 2 }).notNull(),
  stock: integer("stock").default(0).notNull(),
  unit: text("unit").default("strip"),
  hsnCode: text("hsn_code"),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).default("12"),
  reorderLevel: integer("reorder_level").default(10),
  minStock: integer("min_stock").default(5),
  maxStock: integer("max_stock").default(100),
  leadTimeDays: integer("lead_time_days").default(3),
  avgDailyConsumption: numeric("avg_daily_consumption", { precision: 10, scale: 2 }).default("0"),
  scheduleType: text("schedule_type").default("general"),
  // --- v3 additions ---
  lasaFlag: boolean("lasa_flag").default(false),
  highAlertFlag: boolean("high_alert_flag").default(false),
  coldChainRequired: boolean("cold_chain_required").default(false),
  implantTrackingRequired: boolean("implant_tracking_required").default(false),
  antibioticClass: text("antibiotic_class"),
  rackLocation: text("rack_location"),
  shelfLocation: text("shelf_location"),
  unitsPerPack: integer("units_per_pack").default(1),
  unitsPerStrip: integer("units_per_strip").default(1),
  minMarginPercent: numeric("min_margin_percent", { precision: 5, scale: 2 }),
  quarantineStock: integer("quarantine_stock").default(0),
  damagedStock: integer("damaged_stock").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_medicines_entity_id").on(table.entityId),
  index("idx_medicines_name").on(table.name),
  index("idx_medicines_barcode").on(table.barcode),
  index("idx_medicines_expiry_date").on(table.expiryDate),
  index("idx_medicines_schedule_type").on(table.scheduleType),
  index("idx_medicines_generic_name").on(table.genericName),
]);

export const medicineBatchesTable = pgTable("medicine_batches", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  batchNo: text("batch_no").notNull(),
  expiryDate: text("expiry_date").notNull(),
  mrp: numeric("mrp", { precision: 10, scale: 2 }).notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 10, scale: 2 }),
  saleRate: numeric("sale_rate", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_medicine_batches_medicine_id").on(table.medicineId),
  index("idx_medicine_batches_entity_id").on(table.entityId),
  index("idx_medicine_batches_expiry_date").on(table.expiryDate),
  index("idx_medicine_batches_is_active").on(table.isActive),
]);

export const stockMovementsTable = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  batchId: integer("batch_id"),
  movementType: text("movement_type").notNull(),
  quantity: integer("quantity").notNull(),
  balanceAfter: integer("balance_after").default(0),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  referenceNo: text("reference_no"),
  reason: text("reason"),
  userId: integer("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_stock_movements_medicine_id").on(table.medicineId),
  index("idx_stock_movements_entity_id").on(table.entityId),
  index("idx_stock_movements_created_at").on(table.createdAt),
  index("idx_stock_movements_movement_type").on(table.movementType),
]);

export const pharmacyAuditLogTable = pgTable("pharmacy_audit_log", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  actionType: text("action_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityRefId: integer("entity_ref_id"),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  reason: text("reason"),
  userId: integer("user_id"),
  userRole: text("user_role"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pharmacyShiftsTable = pgTable("pharmacy_shifts", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  shiftDate: text("shift_date").notNull(),
  openingCash: numeric("opening_cash", { precision: 12, scale: 2 }).default("0"),
  salesTotal: numeric("sales_total", { precision: 12, scale: 2 }).default("0"),
  cashReceived: numeric("cash_received", { precision: 12, scale: 2 }).default("0"),
  upiReceived: numeric("upi_received", { precision: 12, scale: 2 }).default("0"),
  cardReceived: numeric("card_received", { precision: 12, scale: 2 }).default("0"),
  refunds: numeric("refunds", { precision: 12, scale: 2 }).default("0"),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }).default("0"),
  countedCash: numeric("counted_cash", { precision: 12, scale: 2 }).default("0"),
  difference: numeric("difference", { precision: 12, scale: 2 }).default("0"),
  remarks: text("remarks"),
  closedBy: integer("closed_by"),
  closedByName: text("closed_by_name"),
  closedAt: timestamp("closed_at"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesReturnsTable = pgTable("sales_returns", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  returnNo: text("return_no").notNull().unique(),
  originalSaleId: integer("original_sale_id").references(() => pharmacySalesTable.id),
  originalBillNo: text("original_bill_no"),
  patientId: integer("patient_id").references(() => patientsTable.id),
  returnDate: text("return_date").notNull(),
  reason: text("reason").notNull(),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 14, scale: 2 }).default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 14, scale: 2 }).default("0"),
  igstAmount: numeric("igst_amount", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  refundMode: text("refund_mode").default("cash"),
  refundAmount: numeric("refund_amount", { precision: 14, scale: 2 }).default("0"),
  status: text("status").notNull().default("draft"),
  notes: text("notes"),
  processedBy: integer("processed_by"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const salesReturnItemsTable = pgTable("sales_return_items", {
  id: serial("id").primaryKey(),
  returnId: integer("return_id").notNull().references(() => salesReturnsTable.id, { onDelete: "cascade" }),
  medicineId: integer("medicine_id").notNull().references(() => medicinesTable.id),
  batchNo: text("batch_no"),
  quantityReturned: integer("quantity_returned").notNull(),
  rate: numeric("rate", { precision: 14, scale: 2 }).notNull(),
  gstPercent: numeric("gst_percent", { precision: 5, scale: 2 }).default("12"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  hsnCode: text("hsn_code"),
  isUsable: boolean("is_usable").default(true),
});

export const pharmacySalesTable = pgTable("pharmacy_sales", {
  id: serial("id").primaryKey(),
  billNo: text("bill_no").notNull().unique(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id),
  ipdAdmissionId: integer("ipd_admission_id"),
  shiftId: integer("shift_id"),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).default("0"),
  discountApprovalId: integer("discount_approval_id"),
  gstAmount: numeric("gst_amount", { precision: 10, scale: 2 }).default("0"),
  cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).default("0"),
  sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).default("0"),
  igstAmount: numeric("igst_amount", { precision: 12, scale: 2 }).default("0"),
  gstStateType: text("gst_state_type").default("intra"),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull(),
  dueAmount: numeric("due_amount", { precision: 10, scale: 2 }).default("0"),
  paymentMode: text("payment_mode").notNull(),
  billDate: text("bill_date").notNull(),
  postedToAccounting: boolean("posted_to_accounting").default(false),
  voucherId: integer("voucher_id"),
  billStatus: text("bill_status").notNull().default("final"),
  finalizedAt: timestamp("finalized_at"),
  finalizedBy: integer("finalized_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pharmacy_sales_entity_id").on(table.entityId),
  index("idx_pharmacy_sales_patient_id").on(table.patientId),
  index("idx_pharmacy_sales_bill_date").on(table.billDate),
  index("idx_pharmacy_sales_ipd_admission").on(table.ipdAdmissionId),
  index("idx_pharmacy_sales_shift_id").on(table.shiftId),
  index("idx_pharmacy_sales_created_at").on(table.createdAt),
]);

export const indentsTable = pgTable("indents", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  indentNo: text("indent_no").notNull().unique(),
  department: text("department").notNull(),
  requestedBy: text("requested_by").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  approvedAt: timestamp("approved_at"),
  issuedAt: timestamp("issued_at"),
});

export const indentItemsTable = pgTable("indent_items", {
  id: serial("id").primaryKey(),
  indentId: integer("indent_id").notNull().references(() => indentsTable.id, { onDelete: "cascade" }),
  itemType: text("item_type").notNull(),
  itemId: integer("item_id").notNull(),
  itemName: text("item_name").notNull(),
  unit: text("unit"),
  requestedQty: numeric("requested_qty", { precision: 12, scale: 2 }).notNull(),
  issuedQty: numeric("issued_qty", { precision: 12, scale: 2 }).default("0"),
});

export const scheduleHRegisterTable = pgTable("schedule_h_register", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  saleId: integer("sale_id").references(() => pharmacySalesTable.id),
  patientId: integer("patient_id").references(() => patientsTable.id),
  doctorId: integer("doctor_id"),
  doctorName: text("doctor_name"),
  prescriptionRef: text("prescription_ref"),
  quantityDispensed: numeric("quantity_dispensed", { precision: 12, scale: 2 }).notNull(),
  batchNo: text("batch_no"),
  dispensedAt: text("dispensed_at").notNull(),
  pharmacistId: integer("pharmacist_id"),
  issuedBy: text("issued_by"),
  verifiedBy: text("verified_by"),
  runningBalance: numeric("running_balance", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id),
  txnDate: text("txn_date").notNull(),
  description: text("description"),
  reference: text("reference"),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  txnType: text("txn_type").notNull(),
  mode: text("mode"),
  matchedInvoiceId: integer("matched_invoice_id"),
  matchedPharmacySaleId: integer("matched_pharmacy_sale_id"),
  reconciled: boolean("reconciled").notNull().default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────
// V3 NEW TABLES
// ─────────────────────────────────────────────

/** Ward / ICU / OT physical stock locations */
export const pharmacyLocationsTable = pgTable("pharmacy_locations", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  name: text("name").notNull(),
  locationType: text("location_type").notNull().default("ward"), // ward | icu | ot | emergency | store
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Stock per location per medicine (and optionally batch) */
export const locationStockTable = pgTable("location_stock", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  locationId: integer("location_id").references(() => pharmacyLocationsTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  batchId: integer("batch_id").references(() => medicineBatchesTable.id),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  quantity: integer("quantity").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Stock transfer between locations */
export const locationTransfersTable = pgTable("location_transfers", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  transferNo: text("transfer_no").notNull().unique(),
  fromLocationId: integer("from_location_id").references(() => pharmacyLocationsTable.id).notNull(),
  toLocationId: integer("to_location_id").references(() => pharmacyLocationsTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  batchId: integer("batch_id").references(() => medicineBatchesTable.id),
  batchNo: text("batch_no"),
  quantity: integer("quantity").notNull(),
  reason: text("reason"),
  transferredBy: integer("transferred_by"),
  transferredByName: text("transferred_by_name"),
  status: text("status").default("completed").notNull(), // pending | completed | cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** IPD patient medicine issue ledger */
export const ipdMedicineIssuesTable = pgTable("ipd_medicine_issues", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  ipdAdmissionId: integer("ipd_admission_id").references(() => ipdAdmissionsTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  issueNo: text("issue_no").notNull().unique(),
  issueDate: text("issue_date").notNull(),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  gstAmount: numeric("gst_amount", { precision: 14, scale: 2 }).default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  returnAmount: numeric("return_amount", { precision: 14, scale: 2 }).default("0"),
  netAmount: numeric("net_amount", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("issued"), // issued | partially_returned | fully_returned | billed
  postedToBill: boolean("posted_to_bill").default(false),
  issuedBy: integer("issued_by"),
  issuedByName: text("issued_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Medication Administration Record — nurse confirms dose given */
export const medicationAdminRecordsTable = pgTable("medication_admin_records", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  ipdAdmissionId: integer("ipd_admission_id").references(() => ipdAdmissionsTable.id).notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  medicineName: text("medicine_name").notNull(),
  dose: text("dose"),
  route: text("route"), // oral | iv | im | sc | topical | inhaled
  frequency: text("frequency"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  administeredAt: timestamp("administered_at"),
  status: text("status").notNull().default("pending"), // pending | given | missed | held | refused | returned
  nurseId: integer("nurse_id"),
  nurseName: text("nurse_name"),
  reason: text("reason"), // for missed/held/refused
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Procedure / surgery kits (pre-defined item bundles) */
export const procedureKitsTable = pgTable("procedure_kits", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  kitName: text("kit_name").notNull(),
  kitCode: text("kit_code").notNull(),
  procedureType: text("procedure_type"), // surgery | dressing | central_line | etc.
  description: text("description"),
  estimatedCost: numeric("estimated_cost", { precision: 14, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const procedureKitItemsTable = pgTable("procedure_kit_items", {
  id: serial("id").primaryKey(),
  kitId: integer("kit_id").references(() => procedureKitsTable.id, { onDelete: "cascade" }).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  unit: text("unit"),
  notes: text("notes"),
});

/** Kit issue log — records each time a kit is issued for a procedure */
export const kitIssueLogTable = pgTable("kit_issue_log", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  kitId: integer("kit_id").references(() => procedureKitsTable.id).notNull(),
  issueNo: text("issue_no").notNull().unique(),
  issueDate: text("issue_date").notNull(),
  patientId: integer("patient_id").references(() => patientsTable.id),
  ipdAdmissionId: integer("ipd_admission_id"),
  otId: integer("ot_id"),
  issuedItems: jsonb("issued_items").notNull().default([]),
  returnedItems: jsonb("returned_items").notNull().default([]),
  totalCost: numeric("total_cost", { precision: 14, scale: 2 }).default("0"),
  status: text("status").notNull().default("issued"), // issued | partially_returned | closed
  issuedBy: integer("issued_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Implant / high-value item patient linkage */
export const implantTrackingTable = pgTable("implant_tracking", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  medicineName: text("medicine_name").notNull(),
  serialNo: text("serial_no"),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  ipdAdmissionId: integer("ipd_admission_id"),
  surgeonId: integer("surgeon_id"),
  surgeonName: text("surgeon_name"),
  implantDate: text("implant_date").notNull(),
  anatomicalSite: text("anatomical_site"),
  consentRef: text("consent_ref"),
  purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 }),
  saleRate: numeric("sale_rate", { precision: 14, scale: 2 }),
  mrp: numeric("mrp", { precision: 14, scale: 2 }),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Prescription → Pharmacy dispensing queue */
export const prescriptionQueueTable = pgTable("prescription_queue", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  queueNo: text("queue_no").notNull().unique(),
  patientId: integer("patient_id").references(() => patientsTable.id).notNull(),
  opdVisitId: integer("opd_visit_id"),
  ipdAdmissionId: integer("ipd_admission_id"),
  doctorId: integer("doctor_id"),
  doctorName: text("doctor_name"),
  prescriptionItems: jsonb("prescription_items").notNull().default([]),
  priority: text("priority").notNull().default("normal"), // normal | urgent | icu | ot
  status: text("status").notNull().default("pending"), // pending | dispensing | partial | completed | cancelled
  dispensedItems: jsonb("dispensed_items").notNull().default([]),
  unavailableItems: jsonb("unavailable_items").notNull().default([]),
  saleId: integer("sale_id").references(() => pharmacySalesTable.id),
  assignedTo: integer("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Expiry loss register — tracks expired stock disposal */
export const expiryLossRegisterTable = pgTable("expiry_loss_register", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  lossNo: text("loss_no").notNull().unique(),
  disposalDate: text("disposal_date").notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  medicineName: text("medicine_name").notNull(),
  batchNo: text("batch_no"),
  expiryDate: text("expiry_date"),
  quantity: integer("quantity").notNull(),
  purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 }),
  lossValue: numeric("loss_value", { precision: 14, scale: 2 }).notNull(),
  gstValue: numeric("gst_value", { precision: 14, scale: 2 }).default("0"),
  disposalReason: text("disposal_reason").notNull().default("expired"),
  disposalMethod: text("disposal_method"), // incineration | return_to_vendor | municipal_waste
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  status: text("status").notNull().default("pending"), // pending | approved | disposed
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Physical stock verification / audit sessions */
export const stockVerificationSessionsTable = pgTable("stock_verification_sessions", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  sessionNo: text("session_no").notNull().unique(),
  verificationDate: text("verification_date").notNull(),
  status: text("status").notNull().default("open"), // open | counting | completed | approved
  frozenAt: timestamp("frozen_at"),
  completedAt: timestamp("completed_at"),
  approvedBy: integer("approved_by"),
  approvedAt: timestamp("approved_at"),
  totalVarianceValue: numeric("total_variance_value", { precision: 14, scale: 2 }).default("0"),
  notes: text("notes"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const stockVerificationItemsTable = pgTable("stock_verification_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => stockVerificationSessionsTable.id, { onDelete: "cascade" }).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  medicineName: text("medicine_name").notNull(),
  batchNo: text("batch_no"),
  systemQty: integer("system_qty").notNull(),
  physicalQty: integer("physical_qty"),
  variance: integer("variance"),
  purchaseRate: numeric("purchase_rate", { precision: 14, scale: 2 }),
  varianceValue: numeric("variance_value", { precision: 14, scale: 2 }),
  reason: text("reason"),
  adjustmentApproved: boolean("adjustment_approved").default(false),
});

/** MRP / rate change history */
export const mrpRateHistoryTable = pgTable("mrp_rate_history", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  changedField: text("changed_field").notNull(), // mrp | sale_rate | purchase_rate
  oldValue: numeric("old_value", { precision: 14, scale: 2 }),
  newValue: numeric("new_value", { precision: 14, scale: 2 }).notNull(),
  changeReason: text("change_reason"),
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  effectiveDate: text("effective_date").notNull(),
  changedBy: integer("changed_by"),
  changedByName: text("changed_by_name"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Staff / internal department medicine issuance */
export const staffMedicineIssuesTable = pgTable("staff_medicine_issues", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  issueNo: text("issue_no").notNull().unique(),
  issueDate: text("issue_date").notNull(),
  recipientType: text("recipient_type").notNull().default("staff"), // staff | department
  recipientName: text("recipient_name").notNull(),
  recipientId: integer("recipient_id"),
  department: text("department"),
  items: jsonb("items").notNull().default([]),
  totalValue: numeric("total_value", { precision: 14, scale: 2 }).default("0"),
  purpose: text("purpose"),
  status: text("status").notNull().default("pending"), // pending | approved | issued
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  issuedBy: integer("issued_by"),
  issuedByName: text("issued_by_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Pharmacy notification engine */
export const pharmacyNotificationsTable = pgTable("pharmacy_notifications", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  notificationType: text("notification_type").notNull(), // low_stock | expiry | pending_approval | ndps_mismatch | high_discount | stock_adjustment | vendor_payment | po_pending | return_pending
  priority: text("priority").notNull().default("normal"), // low | normal | high | critical
  title: text("title").notNull(),
  message: text("message").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  isRead: boolean("is_read").default(false).notNull(),
  readBy: integer("read_by"),
  readAt: timestamp("read_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Purchase indent / purchase request */
export const purchaseIndentsTable = pgTable("purchase_indents", {
  id: serial("id").primaryKey(),
  entityId: integer("entity_id").references(() => entitiesTable.id).notNull(),
  indentNo: text("indent_no").notNull().unique(),
  indentDate: text("indent_date").notNull(),
  requestedBy: integer("requested_by"),
  requestedByName: text("requested_by_name").notNull(),
  department: text("department"),
  urgency: text("urgency").notNull().default("routine"), // routine | urgent | emergency
  status: text("status").notNull().default("pending"), // pending | approved | rejected | po_generated
  approvedBy: integer("approved_by"),
  approvedByName: text("approved_by_name"),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const purchaseIndentItemsTable = pgTable("purchase_indent_items", {
  id: serial("id").primaryKey(),
  indentId: integer("indent_id").references(() => purchaseIndentsTable.id, { onDelete: "cascade" }).notNull(),
  medicineId: integer("medicine_id").references(() => medicinesTable.id).notNull(),
  medicineName: text("medicine_name").notNull(),
  requiredQty: integer("required_qty").notNull(),
  approvedQty: integer("approved_qty"),
  unit: text("unit"),
  lastPurchaseRate: numeric("last_purchase_rate", { precision: 14, scale: 2 }),
  estimatedRate: numeric("estimated_rate", { precision: 14, scale: 2 }),
  reason: text("reason"),
});

// ─────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────

export const insertMedicineSchema = createInsertSchema(medicinesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPharmacySaleSchema = createInsertSchema(pharmacySalesTable).omit({ id: true, billNo: true, createdAt: true });
export type InsertMedicine = z.infer<typeof insertMedicineSchema>;
export type InsertPharmacySale = z.infer<typeof insertPharmacySaleSchema>;
export type Medicine = typeof medicinesTable.$inferSelect;
export type PharmacySale = typeof pharmacySalesTable.$inferSelect;
export type Indent = typeof indentsTable.$inferSelect;
export type IndentItem = typeof indentItemsTable.$inferSelect;
export type BankTransaction = typeof bankTransactionsTable.$inferSelect;
export type MedicineBatch = typeof medicineBatchesTable.$inferSelect;
export type StockMovement = typeof stockMovementsTable.$inferSelect;
export type PharmacyShift = typeof pharmacyShiftsTable.$inferSelect;
export type SalesReturn = typeof salesReturnsTable.$inferSelect;
export type SalesReturnItem = typeof salesReturnItemsTable.$inferSelect;
export type PharmacyAuditLog = typeof pharmacyAuditLogTable.$inferSelect;
export type PharmacyLocation = typeof pharmacyLocationsTable.$inferSelect;
export type LocationStock = typeof locationStockTable.$inferSelect;
export type LocationTransfer = typeof locationTransfersTable.$inferSelect;
export type IpdMedicineIssue = typeof ipdMedicineIssuesTable.$inferSelect;
export type MedicationAdminRecord = typeof medicationAdminRecordsTable.$inferSelect;
export type ProcedureKit = typeof procedureKitsTable.$inferSelect;
export type ProcedureKitItem = typeof procedureKitItemsTable.$inferSelect;
export type KitIssueLog = typeof kitIssueLogTable.$inferSelect;
export type ImplantTracking = typeof implantTrackingTable.$inferSelect;
export type PrescriptionQueue = typeof prescriptionQueueTable.$inferSelect;
export type ExpiryLossRegister = typeof expiryLossRegisterTable.$inferSelect;
export type StockVerificationSession = typeof stockVerificationSessionsTable.$inferSelect;
export type StockVerificationItem = typeof stockVerificationItemsTable.$inferSelect;
export type MrpRateHistory = typeof mrpRateHistoryTable.$inferSelect;
export type StaffMedicineIssue = typeof staffMedicineIssuesTable.$inferSelect;
export type PharmacyNotification = typeof pharmacyNotificationsTable.$inferSelect;
export type PurchaseIndent = typeof purchaseIndentsTable.$inferSelect;
export type PurchaseIndentItem = typeof purchaseIndentItemsTable.$inferSelect;
