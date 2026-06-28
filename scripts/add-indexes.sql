-- ============================================================
-- Hope Hospital ERP — Performance Indexes
-- Safe to run on a LIVE production database.
-- CREATE INDEX CONCURRENTLY does NOT lock the table.
-- Run this script once; IF NOT EXISTS makes it idempotent.
-- ============================================================

-- Patients
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_entity_id   ON patients (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_phone        ON patients (phone);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_name         ON patients (name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_created_at   ON patients (created_at);

-- OPD Visits
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opd_visits_patient_id ON opd_visits (patient_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opd_visits_entity_id  ON opd_visits (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opd_visits_doctor_id  ON opd_visits (doctor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opd_visits_visit_date ON opd_visits (visit_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opd_visits_status     ON opd_visits (status);

-- IPD Admissions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipd_admissions_patient_id    ON ipd_admissions (patient_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipd_admissions_entity_id     ON ipd_admissions (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipd_admissions_status        ON ipd_admissions (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipd_admissions_consultant    ON ipd_admissions (consultant_doctor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ipd_admissions_admission_date ON ipd_admissions (admission_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_log_patient_id    ON admission_conversion_log (patient_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversion_log_opd_visit     ON admission_conversion_log (opd_visit_id);

-- Billing / Invoices
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_patient_id    ON invoices (patient_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_entity_id     ON invoices (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_invoice_date  ON invoices (invoice_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_status        ON invoices (status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_ipd_admission ON invoices (ipd_admission_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_opd_visit     ON invoices (opd_visit_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_created_at    ON invoices (created_at);

-- Medicines
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_entity_id    ON medicines (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_name         ON medicines (name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_barcode      ON medicines (barcode);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_expiry_date  ON medicines (expiry_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_schedule_type ON medicines (schedule_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicines_generic_name ON medicines (generic_name);

-- Medicine Batches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_batches_medicine_id ON medicine_batches (medicine_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_batches_entity_id   ON medicine_batches (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_batches_expiry_date ON medicine_batches (expiry_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_medicine_batches_is_active   ON medicine_batches (is_active);

-- Stock Movements (high-volume ledger)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_medicine_id   ON stock_movements (medicine_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_entity_id     ON stock_movements (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_created_at    ON stock_movements (created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements (movement_type);

-- Pharmacy Sales
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_entity_id     ON pharmacy_sales (entity_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_patient_id    ON pharmacy_sales (patient_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_bill_date     ON pharmacy_sales (bill_date);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_ipd_admission ON pharmacy_sales (ipd_admission_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_shift_id      ON pharmacy_sales (shift_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pharmacy_sales_created_at    ON pharmacy_sales (created_at);
