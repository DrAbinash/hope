# HOPE HOSPITAL MASTER SYSTEM BLUEPRINT
**Hope NeuroTrauma & MultiSpeciality Hospital — Hospital Management System (HMS)**
**Version:** 1.0.0 (June 2026)

---

# 1. Executive Overview

### Purpose of the Hospital ERP
The Hope NeuroTrauma & MultiSpeciality Hospital HMS is a comprehensive, mission-critical Enterprise Resource Planning (ERP) software designed to manage clinical, financial, administrative, and inventory workflows under a single monorepo. It serves as the primary system of record for patient care, medication administration, billing audits, double-entry accounting, and regulatory compliance.

### Current Deployment Status
Originally built on Replit as a sandbox/prototype environment, the software has been fully migrated and deployed on **Synology NAS** hardware using a dockerized container architecture. The application is containerized with multi-stage Docker builds using Alpine Linux and runs behind a local/remote network layout configured to support clinical users on the local area network (LAN) and external remote connections.

### Main Hospital Workflows Supported
1. **Front Office & Registration:** Patient demographics, Unique Health ID (UHID) generation, and registration.
2. **Clinical Outpatient (OPD):** Doctor consultations, vitals check, templates, diagnostic orders, and electronic prescriptions.
3. **Clinical Inpatient (IPD):** Bed allocation, ward transfers, clinical round notes, Medication Administration Record (MAR), and nurse charting.
4. **Operation Theatre (OT):** Consent form tracking, procedure kit assignment, surgery bookings, and anesthesia logs.
5. **Pharmacy & Retail Operations:** Automated inventory deduction, expiry warning notifications, Schedule H and NDPS narcotic logs, PMJAY claim verification.
6. **Financial Bookkeeping:** Custom bill prints (GST-compliant A5/A4 configurations), double-entry accounting registers, bank reconciliations, and referring doctor payout commission reporting.

### Departments Covered
- Outpatient Department (OPD)
- Inpatient Department (IPD)
- Intensive Care Unit (ICU)
- Operation Theatre (OT)
- Pharmacy & Medical Stores
- Pathology & Radiology Diagnostics
- Finance, Billing & Accounts
- HR & Employee Management

### Current Production Readiness
*   **Production-Ready:** Core registration, patient database, OPD check-ins, IPD admissions, basic billing, pharmacy sales, and permissions.
*   **Needs Testing & Refactoring:** Double-entry ledger integration, automated bank reconciliation, ICU nurse flow tracking.
*   **Prototype / Partial:** Lab machine integration, online booking engine (currently mock/placeholder), PACS/DICOM links.

### Major Strengths
*   **Fine-Grained RBAC:** Modular permissions layout allowing runtime custom overrides per employee.
*   **Compliance registers:** Dedicated Schedule H and NDPS narcotics registers with automated stock log correlation.
*   **Unified Monorepo:** Shared OpenAPI, Zod schemas, and Drizzle models prevent schema drifts between client and server.

### Major Risks
*   **Hardware Point-of-Failure:** Synology NAS operates as a single host; disk failures or docker container crashes halt the entire clinic.
*   **Data Integrity on Updates:** Casualty of running schema updates on database-heavy modules (e.g. billing, pharmacy ledger) without proper snapshots.
*   **Network Latency & IP Changes:** Local DNS / LAN IP changes could break local printing and client connection URLs.

### Recommended Next Steps
1. Establish automated daily database and uploads backup routines onto offsite services.
2. Formally lock database schema updates using Drizzle migrations and prohibit direct `db push` operations in production.
3. Set up a testing/staging container to validate software updates before pushing to the live Synology container.

---

# 2. Complete Module Inventory

All discovered modules and sub-modules mapped from the active system configurations:

| Module Key | Front-End Page Route | Database Tables Used | Status | Key Risks / Improvements |
| :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `/` | `patients`, `opd_visits`, `ipd_admissions` | Production-Ready | High query load. Needs caching for statistical widgets. |
| **Patients** | `/patients` | `patients` | Production-Ready | Risks: Duplicate UHID. Add soundex-based duplicate search. |
| **Billing Desk** | `/billing-desk` | `bills`, `bill_items` | Production-Ready | Needs validation on final check-out discounts. |
| **Estimations** | `/estimations` | `estimations`, `billing_heads` | Production-Ready | Disconnected from actual admissions. Auto-convert to Bill. |
| **Referrals** | `/referrals` | `referral_sources` | Production-Ready | Risks: Wrong payout calculations. Add audit log on payments. |
| **Consultants** | `/consultants` | `consultants` | Production-Ready | Ensure contract terms are verified against monthly payouts. |
| **Entities** | `/entities` | `entities` | Production-Ready | Essential for multi-entity setups. Do not modify schema. |
| **Doctor Dashboard** | `/doctor` | `opd_visits`, `ipd_admissions` | Production-Ready | Performance bottleneck on loading histories. |
| **Doctors Master** | `/doctors` | `doctors` | Production-Ready | Add digital signature upload field. |
| **OPD** | `/opd` | `opd_visits` | Production-Ready | Print templates rely heavily on raw A5 canvas coordinates. |
| **IPD** | `/ipd` | `ipd_admissions`, `bed_transfers` | Production-Ready | Bed release validation logic is complex. Don't touch casually. |
| **Wards** | `/wards` | `wards`, `rooms`, `beds` | Production-Ready | Risk: Ghost bed occupancy. Add forced-vacate admin override. |
| **Diagnostics** | `/diagnostics` | `diagnostic_orders` | Partial | Lab results entry is manual. Needs LIS parser integration. |
| **OT** | `/ot` | `ot_bookings` | Production-Ready | Consumables deduction not automatically linked to inventory. |
| **Consent Forms** | `/consent-forms` | `consent_forms` | Production-Ready | PDF templates stored locally. Needs cloud replication. |
| **Discharge Summary**| `/discharge-summary` | `discharge_summaries` | Production-Ready | Ensure pharmacy prescriptions are imported correctly. |
| **TPA / Insurance** | `/insurance` | `insurance_claims` | Production-Ready | PMJAY claim pre-auth status tracking is offline. |
| **Pharmacy** | `/pharmacy` | `pharmacy_items`, `stock_ledger` | Production-Ready | High transaction volume. Batch management is strict. |
| **Inventory** | `/inventory` | `inventory_items` | Production-Ready | Add barcode scanning capability to expedite stock counts. |
| **Hospital Indents**| `/indents` | `indents` | Production-Ready | Multi-department approval workflow is currently basic. |
| **Vendors** | `/vendors` | `vendors` | Production-Ready | Add automatic vendor rate matching audits. |
| **Accounting** | `/accounting` | `ledgers`, `transactions` | Partial | Needs automated double-entry verification scripts. |
| **Bank Details** | `/accounting/banks`| `bank_accounts` | Production-Ready | High risk on editing accounts. Ensure strict admin permission. |
| **Ledger Master** | `/accounting/ledgers`| `ledgers` | Production-Ready | Modification of standard heads breaks financial reporting. |
| **Bank Recon** | `/bank-reconciliation` | `bank_accounts`, `transactions` | Needs Testing | High mismatch potential. Needs strict audit trails. |
| **Collection Report**| `/collection-report` | `transactions`, `bills` | Production-Ready | Critical for end-of-shift cash handovers. |

---

# 3. Database Architecture

The PostgreSQL database is organized into core clusters. The following defines the purpose, relationships, and risk factors of the key schemas:

### A. Patient Cluster (`patients.ts`)
*   **Table:** `patients`
*   **Purpose:** The central registry for all patients. Holds demographic info.
*   **Relationships:** Linked to `opd_visits.patient_id`, `ipd_admissions.patient_id`, and `bills.patient_id`.
*   **Risk Level:** **EXTREMELY HIGH**. Never drop or change column names. Schema migrations require a full snapshot. Altering `uhid` generation breaks historic record joins.

### B. Clinical Visit Cluster (`opd.ts`, `ipd.ts`, `wards.ts`, `bed_transfers.ts`)
*   **Tables:** `opd_visits`, `ipd_admissions`, `wards`, `rooms`, `beds`, `bed_transfers`
*   **Purpose:** Manages visits, room assignments, clinical logs, and patient transitions.
*   **Relationships:** `bed_transfers` references `ipd_admissions` and `beds`.
*   **Risk Level:** **HIGH**. Transition logic checks room availability. Modifying columns or states during active admissions can trap patients in virtual beds.

### C. Financial & Billing Cluster (`billing.ts`, `billing_heads.ts`, `discounts.ts`)
*   **Tables:** `bills`, `bill_items`, `billing_heads`, `discounts`
*   **Purpose:** Invoices patients for consultations, diagnostics, ward stays, and stores records of discounts granted.
*   **Relationships:** `bill_items` maps to `billing_heads` and is grouped under `bills`.
*   **Risk Level:** **CRITICAL**. Financial data must remain immutable. Any schema modifications must support older records. Always back up before altering calculation methods.

### D. Pharmacy & Stock Ledger (`pharmacy.ts`)
*   **Tables:** `pharmacy_items`, `prescriptions`, `stock_ledger`
*   **Purpose:** Tracks purchase receipts, retail sales, expiry alerts, and stock adjustments.
*   **Relationships:** `stock_ledger` logs all transactions pointing to `pharmacy_items`.
*   **Risk Level:** **EXTREMELY HIGH**. Running inventory totals are calculated dynamically from transactional logs. Dropping columns or messing with signs (positive/negative stock inputs) can corrupt stock totals.

### E. Diagnostic & Clinical Files (`diagnostic_orders.ts`, `consent_forms.ts`, `discharge_summaries.ts`)
*   **Tables:** `diagnostic_orders`, `consent_forms`, `discharge_summaries`
*   **Purpose:** Lab orders, patient consents, and medical release letters.
*   **Risk Level:** **MEDIUM**. Ensure linked file paths point to stable directory structures.

### F. User, Employee & Role Management (`employees.ts`, `permissions.ts`)
*   **Tables:** `employees`, `role_permissions`, `user_permission_overrides`
*   **Purpose:** Authentication, role mappings, and modules access settings.
*   **Risk Level:** **HIGH**. Modifying columns might lock all employees out of the ERP. Always verify admin fallback access before running migrations on permissions tables.

---

# 4. Workflow Mapping

### Patient Registration Flow
```
[ Patient Arrives ] 
   └───► Search Database / Create New UHID
            └───► Capture Demographics, Mobile, Address
                     ├───► OPD Check-In -> Token Issued
                     ├───► IPD Check-In -> Bed Allocated
                     └───► Emergency Triage -> Urgent Care Assigned
```

### OPD Flow
```
[ OPD Token Issued ]
   └───► Doctor Dashboard Consultation
            ├───► Record Vitals & Clinical Notes
            ├───► Issue Electronic Prescription
            └───► Order Diagnostics (Lab / X-Ray)
                     ├───► Cashier Desk (Billing Settlement)
                     └───► Pharmacy Dispensation
```

### IPD Flow
```
[ Admission Request ]
   └───► Bed Selection & Allocation (Ward / ICU)
            └───► Daily Clinical Rounds & Nurse Charting
                     ├───► Order Drugs via Pharmacy Ward Stock
                     ├───► Administer Drugs via Nursing MAR Log
                     └───► Periodic Lab / Procedural Audits
                              └───► Billing Desk (Auto-accumulate Charges)
                                       └───► Discharge Summary & Bed Release
```

### ICU Flow
*   Same as IPD flow, but adds continuous Nursing Vital Charting, highly-monitored drug administration records, and rapid procedural consumable logs.

### OT Flow
```
[ Surgery Booking ]
   └───► Consent Forms Signed & Archived
            └───► OT Procedure Kit Prepared (Pharmacy Consumables)
                     └───► Surgery Execution & Anesthesia Logging
                              └───► Charge Updates on Billing Ledger
                                       └───► Post-Op Ward Transfer
```

### Emergency Flow
*   Triage Assessment (Red / Yellow / Green) → Quick Demographics Capture → Immediate Doctor Consultation & Life Support Procedures → Diagnostic Orders (CT / Ultrasound) → Decision: IPD Admission, Discharge, or Outbound Referral.

### Billing Flow
```
[ Service Executed ]
   └───► Billing Desk Accumulates Charges (Room Rent, Consumables, Doctor Fees)
            └───► Optional Discount Review (Requires Authorized Override/Discount approval)
                     └───► Payment Collection (Cash, Card, UPI, TPA/Insurance)
                              └───► Ledger Transaction Posted & Receipt Printed
```

### Pharmacy Flow
```
[ Prescription Issued ]
   └───► Pharmacist Verification (Queue)
            └───► Stock Verification (Batch/Expiry Selection)
                     └───► Final Billing Generation
                              └───► Stock Ledger Deduction & Drug Dispensation
```

---

# 5. User Roles and Permissions

Hope Hospital HMS enforces a strict permission hierarchy defined in [`permissions-catalog.ts`](file:///c:/Users/abina/.gemini/antigravity/scratch/hospital_erp_synology_perfect/hospital_erp/artifacts/hms/src/lib/permissions-catalog.ts):

| Role Key | Landing Page | Accessible Modules | Restricted Modules | Risks & Recommendations |
| :--- | :--- | :--- | :--- | :--- |
| **admin** | `/` | **All Modules** (Bypasses checks) | None | Full access. Audit all actions. |
| **doctor** | `/doctor` | Clinical, OPD, IPD, Diagnostics, Wards, Prescriptions, Reports | HR, Settings, Accounts, Billing, Admin | Avoid access to financial discount settings. |
| **nurse** | `/ipd` | Patients, IPD, Wards, Diagnostics, OT, Consent, Indents, MAR | Accounts, Pharmacy Billing, HR, Settings | Ensure restricted access to master stock adjustments. |
| **receptionist**| `/patients`| Front Office, Demographics, Estimations, Referrals, Basic Reports | Clinical Dashboard, Pharmacy, Accounts, Settings | Block access to edit diagnostics records. |
| **cashier** | `/billing` | Patients, Billing, Billing Desk, Collection Report, Pharmacy, TPA | Clinical logs, HR, Settings, Wards layout | Lock discount fields with supervisor permissions. |
| **lab_tech** | `/diagnostics`| Diagnostics, Demographics lookup | Clinical Dashboards, Billing, Admin, Pharmacy | Lock ability to finalize report signatures. |
| **radiology_tech**| `/diagnostics`| Diagnostics, Demographics lookup | Clinical Dashboards, Billing, Admin, Pharmacy | Lock ability to finalize report signatures. |
| **pharmacist** | `/pharmacy` | Pharmacy Command Center, Sales, Inventory, Expiry, Registers | Accounting, General IPD Clinical, HR, Settings | Restrict editing of purchase rates to store-incharge. |
| **house_keeping**| `/` | Dashboard (landing fallback) | All operational clinical & financial modules | Limit access to ward occupancy visualization only. |

---

# 6. Synology Deployment Architecture

The production environment on Synology is hosted inside the Container Manager service:

```mermaid
graph TD
    user((User Browser)) -->|LAN IP / Domain:5000| app[hospital_erp_app]
    app -->|Postgres Port 5432| db[(hospital_erp_db)]
    app -->|Local Mount| uploads[uploads_data]
    app -->|Local Mount| reports[reports_data]
```

### Container Stack Specification

| Container Name | Purpose | Image | Host Port | Container Port | Volume Mounts | Env File | Risk Level |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **hospital_erp_db** | DB Engine | `postgres:16-alpine` | None (internal) | `5432` | `pgdata` | `.env` | **EXTREMELY HIGH** |
| **hospital_erp_app**| Application Server | `hospital_erp_app:latest` | `5000` | `5000` | `uploads_data`, `reports_data` | `.env` | **HIGH** |

### Key Environment Configuration (Without Secrets)
- `DATABASE_URL`: Connection string connecting the app to Postgres (`postgresql://postgres:***@postgres:5432/hospital_erp`).
- `PORT`: Set to `5000`.
- `SERVE_STATIC_DIR`: Directs express to serve the built frontend (`/app/artifacts/hms/dist`).
- `SESSION_SECRET`: Session encryption key.
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`: Database credential definitions.

---

# 7. Container Networking

### Networking Overview
- **Network Name:** `erp_network` (Docker Bridge Network)
- **Database Connection:** The backend connects to `hospital_erp_db` internally using the network alias `postgres:5432`.
- **Client Connection:** Users connect to Synology's host IP (e.g. `192.168.1.100:5000`) or a custom reverse proxy domain mapped to port `5000`.
- **CORS Configuration:** Express enables CORS for local assets and requests originating from within the internal networks.

### Traffic Flow Map
```
[ User Browser ] 
       │ (Accesses https://hms.hopehospital.lan or http://192.168.1.100:5000)
       ▼
[ Synology Reverse Proxy / Firewall ] 
       │ (Terminates SSL, maps incoming traffic to Port 5000)
       ▼
[ hospital_erp_app Container ] 
       ├── (Serves static React assets to client browser)
       ├── (Processes API requests on /api/*)
       │         └── (Queries postgres:5432 container database)
       └── (Saves files to locally mounted /app/uploads)
```

---

# 8. Backup Architecture

### Safe Backup Routine

1.  **Daily Backup:**
    *   Dump database schema and data using `pg_dump`:
        `docker exec -t hospital_erp_db pg_dump -U postgres hospital_erp > backup_daily.sql`
    *   Replicate `uploads/` and `reports/` folder contents using Synology's Hyper Backup or a local cron job.
2.  **Weekly Backup:**
    *   Verify offline copies of the environment file `.env` and `docker-compose.yml`.
    *   Store weekly snapshot on a secondary Synology drive or external NAS.
3.  **Monthly Backup:**
    *   Full offline snapshot test: spin up the database and app containers on a local laptop using the backup SQL dump and uploads to confirm recovery.

### Safety Checklist: Before Making Code Changes
- [ ] Run manual database dump.
- [ ] Copy current `.env` file to `.env.bak`.
- [ ] Confirm no active users are on the system (check connection counters/logs).

---

# 9. Integration Architecture

| Integration | Purpose | Key Files involved | Env variables | Safe Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **GCS Storage** | Backup file storage | `api-server/src/lib/storage.ts` | `GOOGLE_APPLICATION_CREDENTIALS` | Defaults to local filesystem storage if unavailable |
| **Receipt Printer** | A5/A4 thermal printing | `hms/src/pages/opd/print.tsx` | Local OS printer settings | Standard PDF print output popup |
| **Authentication** | Google Auth fallback | `api-server/src/routes/auth.ts` | `GOOGLE_CLIENT_ID` | Standard username/password logins |

---

# 10. Deployment Flow

### Deployed via Scripts

To update the system safely:
1.  **Commit Code:** Commit and push stable changes to the repository.
2.  **Deploy Command:** On the Synology SSH terminal, navigate to the codebase and run:
    ```bash
    pnpm run build
    docker compose down
    docker compose up --build -d
    ```
3.  **Run Migrations:** If schemas changed:
    `pnpm --filter @workspace/db run drizzle-kit migrate`
4.  **Confirm logs:**
    `docker logs -f hospital_erp_app`

### Rollback Strategy
If the container crashes or data integrity fails:
1. Stop the current containers: `docker compose down`
2. Restore database from the pre-deployment backup:
   `cat backup_pre_deploy.sql | docker exec -i hospital_erp_db psql -U postgres -d hospital_erp`
3. Git checkout the last known good commit: `git checkout <commit_hash>`
4. Rebuild stack: `docker compose up --build -d`

---

# 11. Critical Files and Dangerous Refactors

### ⚠️ Files That Should Almost Never Be Changed Casually
1.  [`lib/db/src/schema/pharmacy.ts`](file:///c:/Users/abina/.gemini/antigravity/scratch/hospital_erp_synology_perfect/hospital_erp/lib/db/src/schema/pharmacy.ts): Defines critical ledger balances. Small typos in numeric types will break inventory calculations.
2.  [`lib/db/src/schema/billing.ts`](file:///c:/Users/abina/.gemini/antigravity/scratch/hospital_erp_synology_perfect/hospital_erp/lib/db/src/schema/billing.ts): Financial tables mapping patient payments.
3.  [`artifacts/hms/src/lib/auth.tsx`](file:///c:/Users/abina/.gemini/antigravity/scratch/hospital_erp_synology_perfect/hospital_erp/artifacts/hms/src/lib/auth.tsx): Main security lock. Modifying may bypass route guards or lock out admins.

### Strict Verification Rules
*   **Billing updates:** Always test checkout on test OPD/IPD tickets.
*   **Pharmacy schema updates:** Test adding stock, selling, returning, and verifying audit logs in a local sandboxed environment.
*   **Registration updates:** Test patient details loading across both doctor pages and bills.

---

# 12. UI and Navigation Architecture

The sidebar structure is governed by [`App.tsx`](file:///c:/Users/abina/.gemini/antigravity/scratch/hospital_erp_synology_perfect/hospital_erp/artifacts/hms/src/App.tsx) and dynamically filtered based on permissions. 

### Structure Overview
*   **Dashboard (`/`):** Summary metrics (active beds, today's OPD, revenue counters).
*   **Front Office (`/patients`, `/billing-desk`, `/estimations`):** Patient onboarding and receipt processing.
*   **Clinical (`/doctor`, `/opd`, `/ipd`, `/wards`, `/diagnostics`):** Inpatient and outpatient clinical activities.
*   **Back Office (`/pharmacy`, `/inventory`, `/accounting`, `/settings`):** Logistics, finances, and systems administration.

### Navigation Debt
- Some pharmacy pages (e.g. ward stock vs. pharmacy store stock) have overlapping UI components.
- The diagnostics section splits pathology and radiology into a unified page, which can be confusing for clinical staff. These should be split visually with simple filter toggles.

---

# 13. Current Technical Debt

*   **Database Push in Production:** Avoid using `drizzle-kit push` in production. Always generate SQL migrations and run them sequentially.
*   **Manual Lab Entries:** Results entry is completely typing-based. Missing interfaces to parse automated lab machine outputs.
*   **No Caching:** Highly repetitive metrics on the main dashboard query raw PostgreSQL tables on every refresh, adding load as database size increases.

---

# 14. Production Readiness Checklist

| Module | Status | Main Risk | Minimum Fix Needed | Priority |
| :--- | :--- | :--- | :--- | :--- |
| **Registration** | Production Ready | Minor duplicate check gaps | Soundex lookup integration | Low |
| **OPD** | Production Ready | Custom printers layout shift | Standardize PDF layouts | Medium |
| **Billing** | Production Ready | Discount approval bypassing | Mandatory admin passcode popup | High |
| **Pharmacy** | Production Ready | Rapid stock operations race | Add database transactions lock | High |
| **Accounting** | Needs Testing | Mismatch in double entry logs | Audit trail verification script| Critical |
| **Diagnostics** | Prototype | Human data-entry typos | Machine integration parser | Medium |

---

# 15. AI Enhancement Opportunities

1.  **OPD Consultation Summary:** Autofill prescription details from voice notes.
2.  **Discharge Summary Drafts:** Automatically compile room rent, medication logs, and clinical history into a release note.
3.  **Billing Anomaly Detection:** Highlight bills with mismatched price catalogs or unauthorized discounts.
*   *Note: Human supervisor signoff must remain mandatory for all AI-generated drafts.*

---

# 16. Future Roadmap

### Immediate (Month 1)
- Automate nightly database snapshots.
- Secure session management and block concurrent logins for identical user profiles.

### Short Term (Months 2-3)
- Refactor the accounting ledger views to render strict debits/credits tables.
- Add barcode scanning to pharmacy retail billing counters.

### Medium Term (Months 4-6)
- Integrate LIS machine parsers for pathology tests.
- Support automated WhatsApp triggers for PDF prescription delivery.

---

# 17. Handover Summary

### What is Working
- The patient registration pipelines, OPD/IPD flows, pharmacy sales, and billing desk are fully functional.

### What is Risky
- Running raw schema pushes onto the live PostgreSQL database.
- Direct adjustments to pharmacy stock entries without creating matching adjustments logs.

### Best Next Prompt for Antigravity
> "Audit the database transactions within `artifacts/api-server` to confirm that all pharmacy sales and stock updates are wrapped inside SQL transactions to avoid partial state updates."
