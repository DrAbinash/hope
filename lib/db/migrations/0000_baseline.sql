-- ============================================================
-- Hope Hospital ERP — Baseline Migration
-- Generated from Drizzle schema (drizzle-kit generate output)
-- Run once on a fresh database. Skip if tables already exist.
-- ============================================================

-- Entities / multi-tenancy
CREATE TABLE IF NOT EXISTS "entities" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL UNIQUE,
  "type" text NOT NULL DEFAULT 'hospital',
  "address" text,
  "phone" text,
  "email" text,
  "gstin" text,
  "pan" text,
  "logo_url" text,
  "settings" jsonb DEFAULT '{}',
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Employees / auth
CREATE TABLE IF NOT EXISTS "employees" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "username" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "department" text,
  "pin_hash" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "google_id" text,
  "email" text,
  "phone" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Patients
CREATE TABLE IF NOT EXISTS "patients" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "uhid" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "age" integer NOT NULL,
  "gender" text NOT NULL,
  "phone" text NOT NULL,
  "email" text,
  "address" text,
  "blood_group" text,
  "allergies" text,
  "emergency_contact" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Doctors
CREATE TABLE IF NOT EXISTS "doctors" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "name" text NOT NULL,
  "specialization" text,
  "qualification" text,
  "registration_no" text,
  "phone" text,
  "email" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Wards & Beds
CREATE TABLE IF NOT EXISTS "wards" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'general',
  "floor" text,
  "total_beds" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "beds" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "ward_id" integer NOT NULL REFERENCES "wards"("id"),
  "bed_no" text NOT NULL,
  "bed_type" text DEFAULT 'general',
  "is_active" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- OPD Visits
CREATE TABLE IF NOT EXISTS "opd_visits" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "visit_no" text NOT NULL UNIQUE,
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "doctor_id" integer NOT NULL REFERENCES "doctors"("id"),
  "visit_date" text NOT NULL,
  "chief_complaints" text,
  "diagnosis" text,
  "medicines" jsonb DEFAULT '[]',
  "lab_tests" text,
  "radiology_tests" text,
  "advise" text,
  "special_advise" text,
  "next_visit_date" text,
  "vitals" jsonb DEFAULT '{}',
  "status" text DEFAULT 'pending' NOT NULL,
  "converted_to_ipd" boolean DEFAULT false NOT NULL,
  "ipd_admission_id" integer,
  "fee" numeric(10, 2),
  "ai_generated" boolean DEFAULT false,
  "doctor_edited" boolean DEFAULT false,
  "approved_by" integer REFERENCES "doctors"("id"),
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- IPD Admissions
CREATE TABLE IF NOT EXISTS "ipd_admissions" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL,
  "ipd_no" text NOT NULL UNIQUE,
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "linked_opd_id" integer,
  "consultant_doctor_id" integer NOT NULL REFERENCES "doctors"("id"),
  "ward_id" integer NOT NULL REFERENCES "wards"("id"),
  "bed_id" integer NOT NULL REFERENCES "beds"("id"),
  "admission_date" text NOT NULL,
  "discharge_date" text,
  "admission_note" text,
  "diagnosis" text,
  "status" text DEFAULT 'admitted' NOT NULL,
  "transfer_opd_billing" boolean DEFAULT false,
  "discharge_summary" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "admission_conversion_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "opd_visit_id" integer NOT NULL,
  "ipd_admission_id" integer NOT NULL,
  "patient_id" integer NOT NULL,
  "converted_at" timestamp DEFAULT now() NOT NULL,
  "converted_by" text,
  "notes" text
);

-- Billing
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" serial PRIMARY KEY NOT NULL,
  "invoice_no" text NOT NULL UNIQUE,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "ipd_admission_id" integer,
  "opd_visit_id" integer,
  "type" text NOT NULL,
  "items" jsonb NOT NULL DEFAULT '[]',
  "subtotal" numeric(10, 2) NOT NULL,
  "discount" numeric(10, 2) DEFAULT '0',
  "gst_amount" numeric(10, 2) DEFAULT '0',
  "total_amount" numeric(10, 2) NOT NULL,
  "paid_amount" numeric(10, 2) NOT NULL,
  "due_amount" numeric(10, 2) DEFAULT '0',
  "payment_mode" text NOT NULL,
  "collected_by" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "invoice_date" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Pharmacy
CREATE TABLE IF NOT EXISTS "medicines" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "name" text NOT NULL,
  "generic_name" text,
  "brand_name" text,
  "strength" text,
  "formulation" text,
  "category" text,
  "manufacturer" text,
  "batch_no" text,
  "expiry_date" text,
  "barcode" text,
  "mrp" numeric(10, 2) NOT NULL,
  "purchase_rate" numeric(10, 2),
  "sale_rate" numeric(10, 2) NOT NULL,
  "stock" integer DEFAULT 0 NOT NULL,
  "unit" text DEFAULT 'strip',
  "hsn_code" text,
  "gst_percent" numeric(5, 2) DEFAULT '12',
  "reorder_level" integer DEFAULT 10,
  "min_stock" integer DEFAULT 5,
  "max_stock" integer DEFAULT 100,
  "lead_time_days" integer DEFAULT 3,
  "avg_daily_consumption" numeric(10, 2) DEFAULT '0',
  "schedule_type" text DEFAULT 'general',
  "lasa_flag" boolean DEFAULT false,
  "high_alert_flag" boolean DEFAULT false,
  "cold_chain_required" boolean DEFAULT false,
  "implant_tracking_required" boolean DEFAULT false,
  "antibiotic_class" text,
  "rack_location" text,
  "shelf_location" text,
  "units_per_pack" integer DEFAULT 1,
  "units_per_strip" integer DEFAULT 1,
  "min_margin_percent" numeric(5, 2),
  "quarantine_stock" integer DEFAULT 0,
  "damaged_stock" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medicine_batches" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "batch_no" text NOT NULL,
  "expiry_date" text NOT NULL,
  "mrp" numeric(10, 2) NOT NULL,
  "purchase_rate" numeric(10, 2),
  "sale_rate" numeric(10, 2) NOT NULL,
  "quantity" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_movements" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "batch_id" integer,
  "movement_type" text NOT NULL,
  "quantity" integer NOT NULL,
  "balance_after" integer DEFAULT 0,
  "reference_type" text,
  "reference_id" integer,
  "reference_no" text,
  "reason" text,
  "user_id" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pharmacy_sales" (
  "id" serial PRIMARY KEY NOT NULL,
  "bill_no" text NOT NULL UNIQUE,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "patient_id" integer REFERENCES "patients"("id"),
  "ipd_admission_id" integer,
  "shift_id" integer,
  "items" jsonb NOT NULL DEFAULT '[]',
  "subtotal" numeric(10, 2) NOT NULL,
  "discount" numeric(10, 2) DEFAULT '0',
  "discount_approval_id" integer,
  "gst_amount" numeric(10, 2) DEFAULT '0',
  "cgst_amount" numeric(12, 2) DEFAULT '0',
  "sgst_amount" numeric(12, 2) DEFAULT '0',
  "igst_amount" numeric(12, 2) DEFAULT '0',
  "gst_state_type" text DEFAULT 'intra',
  "total_amount" numeric(10, 2) NOT NULL,
  "paid_amount" numeric(10, 2) NOT NULL,
  "due_amount" numeric(10, 2) DEFAULT '0',
  "payment_mode" text NOT NULL,
  "bill_date" text NOT NULL,
  "posted_to_accounting" boolean DEFAULT false,
  "voucher_id" integer,
  "bill_status" text NOT NULL DEFAULT 'final',
  "finalized_at" timestamp,
  "finalized_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pharmacy_audit_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "action_type" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_ref_id" integer,
  "old_value" jsonb,
  "new_value" jsonb,
  "reason" text,
  "user_id" integer,
  "user_role" text,
  "ip_address" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pharmacy_shifts" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "shift_date" text NOT NULL,
  "opening_cash" numeric(12, 2) DEFAULT '0',
  "sales_total" numeric(12, 2) DEFAULT '0',
  "cash_received" numeric(12, 2) DEFAULT '0',
  "upi_received" numeric(12, 2) DEFAULT '0',
  "card_received" numeric(12, 2) DEFAULT '0',
  "refunds" numeric(12, 2) DEFAULT '0',
  "expected_cash" numeric(12, 2) DEFAULT '0',
  "counted_cash" numeric(12, 2) DEFAULT '0',
  "difference" numeric(12, 2) DEFAULT '0',
  "remarks" text,
  "closed_by" integer,
  "closed_by_name" text,
  "closed_at" timestamp,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sales_returns" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "return_no" text NOT NULL UNIQUE,
  "original_sale_id" integer REFERENCES "pharmacy_sales"("id"),
  "original_bill_no" text,
  "patient_id" integer REFERENCES "patients"("id"),
  "return_date" text NOT NULL,
  "reason" text NOT NULL,
  "subtotal" numeric(14, 2) NOT NULL,
  "gst_amount" numeric(14, 2) DEFAULT '0',
  "cgst_amount" numeric(14, 2) DEFAULT '0',
  "sgst_amount" numeric(14, 2) DEFAULT '0',
  "igst_amount" numeric(14, 2) DEFAULT '0',
  "total_amount" numeric(14, 2) NOT NULL,
  "refund_mode" text DEFAULT 'cash',
  "refund_amount" numeric(14, 2) DEFAULT '0',
  "status" text NOT NULL DEFAULT 'draft',
  "notes" text,
  "processed_by" integer,
  "processed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "sales_return_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "return_id" integer NOT NULL REFERENCES "sales_returns"("id") ON DELETE CASCADE,
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "batch_no" text,
  "quantity_returned" integer NOT NULL,
  "rate" numeric(14, 2) NOT NULL,
  "gst_percent" numeric(5, 2) DEFAULT '12',
  "amount" numeric(14, 2) NOT NULL,
  "hsn_code" text,
  "is_usable" boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS "indents" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "indent_no" text NOT NULL UNIQUE,
  "department" text NOT NULL,
  "requested_by" text NOT NULL,
  "notes" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "approved_at" timestamp,
  "issued_at" timestamp
);

CREATE TABLE IF NOT EXISTS "indent_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "indent_id" integer NOT NULL REFERENCES "indents"("id") ON DELETE CASCADE,
  "item_type" text NOT NULL,
  "item_id" integer NOT NULL,
  "item_name" text NOT NULL,
  "unit" text,
  "requested_qty" numeric(12, 2) NOT NULL,
  "issued_qty" numeric(12, 2) DEFAULT '0'
);

CREATE TABLE IF NOT EXISTS "schedule_h_register" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "sale_id" integer REFERENCES "pharmacy_sales"("id"),
  "patient_id" integer REFERENCES "patients"("id"),
  "doctor_id" integer,
  "doctor_name" text,
  "prescription_ref" text,
  "quantity_dispensed" numeric(12, 2) NOT NULL,
  "batch_no" text,
  "dispensed_at" text NOT NULL,
  "pharmacist_id" integer,
  "issued_by" text,
  "verified_by" text,
  "running_balance" numeric(12, 2),
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "bank_transactions" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer REFERENCES "entities"("id"),
  "txn_date" text NOT NULL,
  "description" text,
  "reference" text,
  "amount" numeric(14, 2) NOT NULL,
  "txn_type" text NOT NULL,
  "mode" text,
  "matched_invoice_id" integer,
  "matched_pharmacy_sale_id" integer,
  "reconciled" boolean NOT NULL DEFAULT false,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- V3 pharmacy tables
CREATE TABLE IF NOT EXISTS "pharmacy_locations" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "name" text NOT NULL,
  "location_type" text NOT NULL DEFAULT 'ward',
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_stock" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "location_id" integer NOT NULL REFERENCES "pharmacy_locations"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "batch_id" integer REFERENCES "medicine_batches"("id"),
  "batch_no" text,
  "expiry_date" text,
  "quantity" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "location_transfers" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "transfer_no" text NOT NULL UNIQUE,
  "from_location_id" integer NOT NULL REFERENCES "pharmacy_locations"("id"),
  "to_location_id" integer NOT NULL REFERENCES "pharmacy_locations"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "batch_id" integer REFERENCES "medicine_batches"("id"),
  "batch_no" text,
  "quantity" integer NOT NULL,
  "reason" text,
  "transferred_by" integer,
  "transferred_by_name" text,
  "status" text DEFAULT 'completed' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "ipd_medicine_issues" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "ipd_admission_id" integer NOT NULL REFERENCES "ipd_admissions"("id"),
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "issue_no" text NOT NULL UNIQUE,
  "issue_date" text NOT NULL,
  "items" jsonb NOT NULL DEFAULT '[]',
  "subtotal" numeric(14, 2) NOT NULL,
  "gst_amount" numeric(14, 2) DEFAULT '0',
  "total_amount" numeric(14, 2) NOT NULL,
  "return_amount" numeric(14, 2) DEFAULT '0',
  "net_amount" numeric(14, 2) NOT NULL,
  "status" text NOT NULL DEFAULT 'issued',
  "posted_to_bill" boolean DEFAULT false,
  "issued_by" integer,
  "issued_by_name" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "medication_admin_records" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "ipd_admission_id" integer NOT NULL REFERENCES "ipd_admissions"("id"),
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "medicine_name" text NOT NULL,
  "dose" text,
  "route" text,
  "frequency" text,
  "scheduled_at" timestamp NOT NULL,
  "administered_at" timestamp,
  "status" text NOT NULL DEFAULT 'pending',
  "nurse_id" integer,
  "nurse_name" text,
  "reason" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "procedure_kits" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "kit_name" text NOT NULL,
  "kit_code" text NOT NULL,
  "procedure_type" text,
  "description" text,
  "estimated_cost" numeric(14, 2) DEFAULT '0',
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "procedure_kit_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "kit_id" integer NOT NULL REFERENCES "procedure_kits"("id") ON DELETE CASCADE,
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "quantity" integer NOT NULL DEFAULT 1,
  "unit" text,
  "notes" text
);

CREATE TABLE IF NOT EXISTS "kit_issue_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "kit_id" integer NOT NULL REFERENCES "procedure_kits"("id"),
  "issue_no" text NOT NULL UNIQUE,
  "issue_date" text NOT NULL,
  "patient_id" integer REFERENCES "patients"("id"),
  "ipd_admission_id" integer,
  "ot_id" integer,
  "issued_items" jsonb NOT NULL DEFAULT '[]',
  "returned_items" jsonb NOT NULL DEFAULT '[]',
  "total_cost" numeric(14, 2) DEFAULT '0',
  "status" text NOT NULL DEFAULT 'issued',
  "issued_by" integer,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "implant_tracking" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "medicine_name" text NOT NULL,
  "serial_no" text,
  "batch_no" text,
  "expiry_date" text,
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "ipd_admission_id" integer,
  "surgeon_id" integer,
  "surgeon_name" text,
  "implant_date" text NOT NULL,
  "anatomical_site" text,
  "consent_ref" text,
  "purchase_rate" numeric(14, 2),
  "sale_rate" numeric(14, 2),
  "mrp" numeric(14, 2),
  "notes" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "prescription_queue" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "queue_no" text NOT NULL UNIQUE,
  "patient_id" integer NOT NULL REFERENCES "patients"("id"),
  "opd_visit_id" integer,
  "ipd_admission_id" integer,
  "doctor_id" integer,
  "doctor_name" text,
  "prescription_items" jsonb NOT NULL DEFAULT '[]',
  "priority" text NOT NULL DEFAULT 'normal',
  "status" text NOT NULL DEFAULT 'pending',
  "dispensed_items" jsonb NOT NULL DEFAULT '[]',
  "unavailable_items" jsonb NOT NULL DEFAULT '[]',
  "sale_id" integer REFERENCES "pharmacy_sales"("id"),
  "assigned_to" integer,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "expiry_loss_register" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "loss_no" text NOT NULL UNIQUE,
  "disposal_date" text NOT NULL,
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "medicine_name" text NOT NULL,
  "batch_no" text,
  "expiry_date" text,
  "quantity" integer NOT NULL,
  "purchase_rate" numeric(14, 2),
  "loss_value" numeric(14, 2) NOT NULL,
  "gst_value" numeric(14, 2) DEFAULT '0',
  "disposal_reason" text NOT NULL DEFAULT 'expired',
  "disposal_method" text,
  "approved_by" integer,
  "approved_by_name" text,
  "status" text NOT NULL DEFAULT 'pending',
  "notes" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_verification_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "session_no" text NOT NULL UNIQUE,
  "verification_date" text NOT NULL,
  "status" text NOT NULL DEFAULT 'open',
  "frozen_at" timestamp,
  "completed_at" timestamp,
  "approved_by" integer,
  "approved_at" timestamp,
  "total_variance_value" numeric(14, 2) DEFAULT '0',
  "notes" text,
  "created_by" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stock_verification_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "session_id" integer NOT NULL REFERENCES "stock_verification_sessions"("id") ON DELETE CASCADE,
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "medicine_name" text NOT NULL,
  "batch_no" text,
  "system_qty" integer NOT NULL,
  "physical_qty" integer,
  "variance" integer,
  "purchase_rate" numeric(14, 2),
  "variance_value" numeric(14, 2),
  "reason" text,
  "adjustment_approved" boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS "mrp_rate_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "changed_field" text NOT NULL,
  "old_value" numeric(14, 2),
  "new_value" numeric(14, 2) NOT NULL,
  "change_reason" text,
  "approved_by" integer,
  "approved_by_name" text,
  "effective_date" text NOT NULL,
  "changed_by" integer,
  "changed_by_name" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "staff_medicine_issues" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "issue_no" text NOT NULL UNIQUE,
  "issue_date" text NOT NULL,
  "recipient_type" text NOT NULL DEFAULT 'staff',
  "recipient_name" text NOT NULL,
  "recipient_id" integer,
  "department" text,
  "items" jsonb NOT NULL DEFAULT '[]',
  "total_value" numeric(14, 2) DEFAULT '0',
  "purpose" text,
  "status" text NOT NULL DEFAULT 'pending',
  "approved_by" integer,
  "approved_by_name" text,
  "approved_at" timestamp,
  "issued_by" integer,
  "issued_by_name" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "pharmacy_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "notification_type" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'normal',
  "title" text NOT NULL,
  "message" text NOT NULL,
  "reference_type" text,
  "reference_id" integer,
  "is_read" boolean DEFAULT false NOT NULL,
  "read_by" integer,
  "read_at" timestamp,
  "expires_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_indents" (
  "id" serial PRIMARY KEY NOT NULL,
  "entity_id" integer NOT NULL REFERENCES "entities"("id"),
  "indent_no" text NOT NULL UNIQUE,
  "indent_date" text NOT NULL,
  "requested_by" integer,
  "requested_by_name" text NOT NULL,
  "department" text,
  "urgency" text NOT NULL DEFAULT 'routine',
  "status" text NOT NULL DEFAULT 'pending',
  "approved_by" integer,
  "approved_by_name" text,
  "approved_at" timestamp,
  "rejection_reason" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "purchase_indent_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "indent_id" integer NOT NULL REFERENCES "purchase_indents"("id") ON DELETE CASCADE,
  "medicine_id" integer NOT NULL REFERENCES "medicines"("id"),
  "medicine_name" text NOT NULL,
  "required_qty" integer NOT NULL,
  "approved_qty" integer,
  "unit" text,
  "last_purchase_rate" numeric(14, 2),
  "estimated_rate" numeric(14, 2),
  "reason" text
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Patients
CREATE INDEX IF NOT EXISTS "idx_patients_entity_id" ON "patients"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_patients_phone" ON "patients"("phone");
CREATE INDEX IF NOT EXISTS "idx_patients_name" ON "patients"("name");
CREATE INDEX IF NOT EXISTS "idx_patients_created_at" ON "patients"("created_at");

-- OPD Visits
CREATE INDEX IF NOT EXISTS "idx_opd_visits_patient_id" ON "opd_visits"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_opd_visits_entity_id" ON "opd_visits"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_opd_visits_doctor_id" ON "opd_visits"("doctor_id");
CREATE INDEX IF NOT EXISTS "idx_opd_visits_visit_date" ON "opd_visits"("visit_date");
CREATE INDEX IF NOT EXISTS "idx_opd_visits_status" ON "opd_visits"("status");

-- IPD Admissions
CREATE INDEX IF NOT EXISTS "idx_ipd_admissions_patient_id" ON "ipd_admissions"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_ipd_admissions_entity_id" ON "ipd_admissions"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_ipd_admissions_status" ON "ipd_admissions"("status");
CREATE INDEX IF NOT EXISTS "idx_ipd_admissions_consultant" ON "ipd_admissions"("consultant_doctor_id");
CREATE INDEX IF NOT EXISTS "idx_ipd_admissions_admission_date" ON "ipd_admissions"("admission_date");
CREATE INDEX IF NOT EXISTS "idx_conversion_log_patient_id" ON "admission_conversion_log"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_conversion_log_opd_visit" ON "admission_conversion_log"("opd_visit_id");

-- Billing
CREATE INDEX IF NOT EXISTS "idx_invoices_patient_id" ON "invoices"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_entity_id" ON "invoices"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_invoice_date" ON "invoices"("invoice_date");
CREATE INDEX IF NOT EXISTS "idx_invoices_status" ON "invoices"("status");
CREATE INDEX IF NOT EXISTS "idx_invoices_ipd_admission" ON "invoices"("ipd_admission_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_opd_visit" ON "invoices"("opd_visit_id");
CREATE INDEX IF NOT EXISTS "idx_invoices_created_at" ON "invoices"("created_at");

-- Medicines
CREATE INDEX IF NOT EXISTS "idx_medicines_entity_id" ON "medicines"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_medicines_name" ON "medicines"("name");
CREATE INDEX IF NOT EXISTS "idx_medicines_barcode" ON "medicines"("barcode");
CREATE INDEX IF NOT EXISTS "idx_medicines_expiry_date" ON "medicines"("expiry_date");
CREATE INDEX IF NOT EXISTS "idx_medicines_schedule_type" ON "medicines"("schedule_type");
CREATE INDEX IF NOT EXISTS "idx_medicines_generic_name" ON "medicines"("generic_name");

-- Medicine Batches
CREATE INDEX IF NOT EXISTS "idx_medicine_batches_medicine_id" ON "medicine_batches"("medicine_id");
CREATE INDEX IF NOT EXISTS "idx_medicine_batches_entity_id" ON "medicine_batches"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_medicine_batches_expiry_date" ON "medicine_batches"("expiry_date");
CREATE INDEX IF NOT EXISTS "idx_medicine_batches_is_active" ON "medicine_batches"("is_active");

-- Stock Movements
CREATE INDEX IF NOT EXISTS "idx_stock_movements_medicine_id" ON "stock_movements"("medicine_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_entity_id" ON "stock_movements"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_created_at" ON "stock_movements"("created_at");
CREATE INDEX IF NOT EXISTS "idx_stock_movements_movement_type" ON "stock_movements"("movement_type");

-- Pharmacy Sales
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_entity_id" ON "pharmacy_sales"("entity_id");
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_patient_id" ON "pharmacy_sales"("patient_id");
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_bill_date" ON "pharmacy_sales"("bill_date");
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_ipd_admission" ON "pharmacy_sales"("ipd_admission_id");
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_shift_id" ON "pharmacy_sales"("shift_id");
CREATE INDEX IF NOT EXISTS "idx_pharmacy_sales_created_at" ON "pharmacy_sales"("created_at");

-- ============================================================
-- Drizzle migrations tracking table
-- ============================================================
CREATE TABLE IF NOT EXISTS "drizzle_migrations" (
  "id" serial PRIMARY KEY NOT NULL,
  "hash" text NOT NULL,
  "created_at" bigint
);
