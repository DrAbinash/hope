# Final Handover and Deployment Safety Guide

This document acts as the final handover manual, security audit log, and zero-downtime deployment playbook for the **Hope Neurotrauma & Multispeciality Hospital Management Software** upgraded packages (Phases 1, 2, and 3).

---

## 1. Features Completed

### Phase 1: Dashboard & Sidebar Modernization
- **Navigation Architecture:** Consolidated redundant links in a clean HSL slate sidebar grouped into logical departments (Clinical, Inventory & Pharmacy, Billing & Accounts, Reports, Admin).
- **Responsive Layout:** Responsive layout supporting full mobile responsiveness and sticky headers on long patient grid lists.
- **Role Dashboard Cards:** Refined landing dashboards showing dedicated counters for the logged-in role (Appointments for Doctors, Ward Occupancy for Nurses, Sales summaries for Pharmacists).

### Phase 2: Patient 360, Bed Dashboard, and Global Search
- **Unified Patient 360 Profile:** Integrated timeline displaying demographics, OPD visits, IPD admissions, lab diagnostic orders, pharmacy logs, billing adjustments, and active discharge summaries.
- **Live Bed Management Board:** Visual grid mapping ward beds categorized by occupancy status (Available, Occupied, Cleaning Pending, Maintenance).
- **Command Centers:** Built unified views for Doctors (appointments list, MRD summaries, OPD-to-IPD conversions) and Nurses (Medication administration logs, vital charting boards).
- **Global Search:** Fast query bar supporting matching patients by Name, Phone, and UHID across OPD, IPD, and billing.

### Phase 3: Clinical Workflows
- **Daily Progress Notes:** Multi-system systemic examinations, complaints log, vitals summary, and plan modifications.
- **Nursing Shift Handover:** Structured shift signoffs tracking shift transitions (given-by, taken-by) with checklists for tubes/catheters, IV fluids, critical care warnings, and fall risks.
- **Discharge Summary Builder:** Modular drafting workflow with automatic pharmacy consumption pulling, investigations logs, and lock-on-finalize states.

### Phase 3 Stabilization & RBAC Hardening
- **Route Authorization Guards:** Secured creation endpoints (`POST` and `PUT` routes) ensuring Nurses/Cashiers/Receptionists are blocked from writing Doctor progress notes or modifying Discharge Summaries.
- **Type safety:** Cleaned up implicit returns (TS7030 warnings) and resolved React client-side authorization property references.

---

## 2. Files Modified

| File Path | Description |
| :--- | :--- |
| `lib/db/src/schema/ipd_progress_notes.ts` | Schema file for the `ipd_progress_notes` database table. |
| `lib/db/src/schema/nursing_handovers.ts` | Schema file for the `nursing_handovers` database table. |
| `lib/db/src/schema/index.ts` | Main database schema registration file. |
| `artifacts/api-server/src/routes/progress_notes.ts` | Express router for progress notes (GET, POST, PUT). |
| `artifacts/api-server/src/routes/handovers.ts` | Express router for nursing shift handovers (GET, POST). |
| `artifacts/api-server/src/routes/discharge-summaries.ts` | Express router for discharge summaries with RBAC guards. |
| `artifacts/api-server/src/routes/index.ts` | Router index table mounting clinical prefixes and rules. |
| `artifacts/hms/src/components/ProgressNotesSection.tsx` | Reusable UI component managing progress notes. |
| `artifacts/hms/src/components/NursingHandoverSection.tsx` | Reusable UI component managing nursing handovers. |
| `artifacts/hms/src/pages/discharge-summary/index.tsx` | UI screen for drafting, locking, and printing discharge sheets. |
| `artifacts/hms/src/pages/doctor/index.tsx` | Doctor dashboard hosting daily rounding checklist tabs. |
| `artifacts/hms/src/pages/ipd/index.tsx` | IPD index hosting Nursing Task lists and Handover boards. |
| `artifacts/hms/src/pages/ipd/[id].tsx` | IPD patient profile details view rendering clinical sub-tabs. |

---

## 3. Database Changes
All database additions are **strictly additive** to preserve existing data.

-   **New Tables:** `ipd_progress_notes` and `nursing_handovers`.
-   **Migration Method:** Drizzle schema push is configured.
-   **Database Backups:** Propose a PostgreSQL dump before migrating schema changes:
    ```bash
    pg_dump -U postgres -d hospital_erp -h localhost -F c -b -v -f /backups/before_phase3.backup
    ```
-   **Sync Command:** Run the push script inside `lib/db`:
    ```bash
    pnpm --filter "@workspace/db" run push
    ```

---

## 4. APIs Added or Modified

### `GET /api/ipd/:admissionId/progress-notes`
-   **Purpose:** Fetches daily progress notes for a patient admission.
-   **Permissions:** Doctors, Nurses, Admins, Reception (View only).
-   **Tables Touched:** `ipd_progress_notes` (read), `doctors` (read).

### `POST /api/ipd/:admissionId/progress-notes`
-   **Purpose:** Log a daily progress note.
-   **Permissions:** Authorized `doctor` and `admin` roles only.
-   **Tables Touched:** `ipd_progress_notes` (write).

### `PUT /api/ipd/:admissionId/progress-notes/:noteId`
-   **Purpose:** Modify an existing daily progress note.
-   **Permissions:** Authorized `doctor` and `admin` roles only.
-   **Tables Touched:** `ipd_progress_notes` (write).

### `GET /api/ipd/:admissionId/handovers`
-   **Purpose:** Fetch nursing handovers log for an admission.
-   **Permissions:** Doctors, Nurses, Admins.
-   **Tables Touched:** `nursing_handovers` (read).

### `POST /api/ipd/:admissionId/handovers`
-   **Purpose:** Signs off shift handover checklist.
-   **Permissions:** Authorized `nurse` and `admin` roles only.
-   **Tables Touched:** `nursing_handovers` (write).

---

## 5. Role Permission Matrix

| Role | Progress Notes (View) | Progress Notes (Write/Edit) | Handover (Write) | Discharge Summary (Draft/Lock) | Billing (Edit) | Pharmacy (Sales) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Admin** | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| **Doctor** | Allowed | **Allowed** | View Only | **Allowed** | View Only | View Only |
| **Nurse** | Allowed | View Only | **Allowed** | View Only | Blocked | Blocked |
| **Receptionist**| Allowed | Blocked | Blocked | View Only | Allowed | Blocked |
| **Cashier** | Allowed | Blocked | Blocked | View Only | **Allowed** | Blocked |
| **Pharmacist** | Blocked | Blocked | Blocked | Blocked | Blocked | **Allowed** |
| **Lab/Rad Tech**| Blocked | Blocked | Blocked | Blocked | Blocked | Blocked |
| **Limited User**| Blocked | Blocked | Blocked | Blocked | Blocked | Blocked |

---

## 6. Pre-Deployment Checklist

-   [ ] **DB Backup:** Execute `pg_dump` to create a binary SQL snapshot.
-   [ ] **Directory Backup:** Tar the `/app/uploads` and `/app/reports` assets directory.
-   [ ] **Configuration Backup:** Backup `.env` and `docker-compose.yml` configs.
-   [ ] **User Notification:** Confirm no active clinical staff are checking in patients.
-   [ ] **Build Verification:** Run `pnpm run build` locally to verify client/server compilations pass.
-   [ ] **Rollback Checklist:** Ensure rollback procedures are reviewed and verified.

---

## 7. Synology Container Manager Deployment Steps

Follow these instructions to deploy safely on Synology Container Manager:

1.  **Export the Docker Image:**
    Build and export the image from the staging host:
    ```bash
    docker build -t hope_hospital_hms:latest .
    docker save hope_hospital_hms:latest | gzip > hope_hospital_hms_latest.tar.gz
    ```
2.  **Upload to Synology:**
    Upload the gzip archive to a shared folder on your Synology NAS (e.g. `/volume1/docker/hms/`).
3.  **Import Image in Container Manager:**
    - Open Container Manager on Synology.
    - Go to **Image** > **Add** > **Add from file** and select `hope_hospital_hms_latest.tar.gz`.
4.  **Execute Database Migrations:**
    Run Drizzle push inside a temporary container to sync the database schema:
    ```bash
    docker run --rm --env-file /volume1/docker/hms/.env hope_hospital_hms:latest pnpm --filter "@workspace/db" run push
    ```
5.  **Restart the Container Stack:**
    In Container Manager, go to **Project** and click **Clean Build / Restart** on your docker-compose stack. Alternatively, run via SSH:
    ```bash
    docker compose down && docker compose up -d
    ```
6.  **Verify Logs:**
    Inspect logs via Container Manager GUI or run:
    ```bash
    docker logs -f hms-app-container-id
    ```
7.  **Check Health Endpoint:**
    Navigate to `http://<synology-ip>:5000/api/health` to confirm the API replies with status 200.

---

## 8. Post-Deployment Testing Checklist

-   [ ] **Access Control:** Log in as a Doctor. Confirm the Daily Round tab works and you can log progress notes.
-   [ ] **Nursing Check:** Log in as a Nurse. Confirm you can complete task items on the IPD board and create handovers, but cannot edit progress notes or discharge summaries.
-   [ ] **Billing Audit:** Navigate to accounts / billing desks. Confirm outstanding dues remain unaffected.
-   [ ] **Patient 360 Check:** Pull up an active patient record. Confirm the medical record history displays OPD, IPD, and diagnostics tabs cleanly.

---

## 9. Rollback Plan

If unexpected failures (e.g., app crash, database schema mismatch) occur:

1.  **Stop Active Containers:**
    ```bash
    docker compose down
    ```
2.  **Restore the Code/Image Version:**
    Import the backup docker image from the previous release and update the compose tag back to the stable image version.
3.  **Restore Database Snapshot:**
    Drop and recreate the database, then load the backup dump:
    ```bash
    dropdb -h localhost -U postgres hospital_erp
    createdb -h localhost -U postgres hospital_erp
    pg_restore -h localhost -U postgres -d hospital_erp -v /backups/before_phase3.backup
    ```
4.  **Launch Stack:**
    ```bash
    docker compose up -d
    ```

---

## 10. Remaining Risks
-   **Manual Migration Syncs:** Syncing database schema via schema push on live production instances carries a minor risk of locks if not executed during low-traffic windows. Always backup before running migrations.
-   **Express Session Persistence:** Sessions reside in memory. Redeploying containers will log out currently active users. Coordinate deployments during shift changes.

---

## 11. Next Month Roadmap

1.  **ICU Intake/Output Charting:** Add fluid balance charts, ventilator settings logs, and continuous vitals integration.
2.  **OT Anesthesia & Procedure Tracking:** Create pre-anesthetic check sheets and postoperative notes.
3.  **Pharmacy Hardening:** Set up automatic stock reservation queues and alerts for low stock levels.
4.  **Automatic Backup Cron:** Schedule an automatic backup cron job on Synology.
5.  **Monitoring Stack:** Deploy Prometheus/Grafana dashboards for performance metrics.
