import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import storageRouter from "./storage";
import entitiesRouter from "./entities";
import employeesRouter from "./employees";
import billingHeadsRouter from "./billing_heads";
import hospitalSettingsRouter from "./hospital_settings";
import packagesRouter from "./packages";
import collectionReportsRouter from "./collection_reports";
import patientsRouter from "./patients";
import doctorsRouter from "./doctors";
import prescriptionTemplatesRouter from "./prescription_templates";
import wardsRouter from "./wards";
import opdRouter from "./opd";
import ipdRouter from "./ipd";
import pharmacyRouter from "./pharmacy";
import pharmacyV2Router from "./pharmacy-v2";
import pharmacyV3Router from "./pharmacy-v3";
import pharmacyV4Router from "./pharmacy-v4";
import pharmacyV5Router from "./pharmacy-v5";
import inventoryRouter from "./inventory";
import billingRouter from "./billing";
import accountingRouter from "./accounting";
import dashboardRouter from "./dashboard";
import reportsRouter from "./reports";
import diagnosticOrdersRouter from "./diagnostic-orders";
import otRouter from "./ot";
import consentFormsRouter from "./consent-forms";
import dischargeSummariesRouter from "./discharge-summaries";
import progressNotesRouter from "./progress_notes";
import nursingHandoversRouter from "./handovers";
import aiAssistantRouter from "./ai_assistant";
import insuranceRouter from "./insurance";
import indentsRouter from "./indents";
import bankReconRouter from "./bank_reconciliation";
import vendorsRouter from "./vendors";
import gstExportRouter from "./gst_export";
import estimationsRouter from "./estimations";
import referralsRouter from "./referrals";
import consultantsRouter from "./consultants";
import discountsRouter from "./discounts";
import banksRouter from "./banks";
import patientDocumentsRouter from "./patient_documents";
import patientLookupsRouter from "./patient_lookups";
import hospitalStatsRouter from "./hospital_stats";
import ipdReportsRouter from "./ipd_reports";
import patientCertificatesRouter from "./patient_certificates";
import opdReportsRouter from "./opd_reports";
import pharmacyReportsRouter from "./pharmacy_reports";
import financeReportsRouter from "./finance_reports";
import stockReportsRouter from "./stock_reports";
import patientLedgerRouter from "./patient_ledger";
import gstReportsRouter from "./gst_reports";
import doctorPerformanceRouter from "./doctor_performance";
import departmentRevenueRouter from "./department_revenue";
import authRouter, { requireAuth } from "./auth";
import permissionsRouter from "./permissions";
import { getEffectivePermissions } from "../lib/permissions";
import searchRouter from "./search";
import bedTransfersRouter from "./bed-transfers";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);
router.use(authRouter);

// Everything below requires authentication
router.use(requireAuth);
router.use(storageRouter);

// Reference-data prefixes: GET allowed for any authenticated user; writes admin-only.
const REFERENCE_DATA_PREFIXES = ["/entities", "/billing-heads", "/hospital-settings"];

const ROLE_RULES: Array<{ prefix: string; roles: string[]; readOnlyRoles?: string[] }> = [
  { prefix: "/employees", roles: ["admin"] },
  { prefix: "/permissions/role", roles: ["admin"] },
  { prefix: "/permissions/user", roles: ["admin"] },
  { prefix: "/accounting", roles: ["admin"] },
  { prefix: "/banks", roles: ["admin", "cashier"], readOnlyRoles: ["cashier"] },
  { prefix: "/reports", roles: ["admin"] },
  { prefix: "/bank-reconciliation", roles: ["admin"] },
  { prefix: "/insurance-claims", roles: ["admin", "cashier"] },
  { prefix: "/tpa-providers", roles: ["admin", "cashier"] },
  { prefix: "/patient-insurance", roles: ["admin", "cashier"] },
  { prefix: "/collection-reports", roles: ["admin", "cashier", "receptionist"] },
  { prefix: "/packages", roles: ["admin", "cashier", "receptionist"] },
  { prefix: "/billing", roles: ["admin", "cashier", "receptionist"] },
  { prefix: "/prescription-templates", roles: ["admin", "doctor"] },
  { prefix: "/discharge-summaries", roles: ["admin", "doctor", "nurse"] },
  { prefix: "/ot", roles: ["admin", "doctor", "nurse"] },
  { prefix: "/diagnostic-orders", roles: ["admin", "doctor", "lab_tech", "nurse"] },
  { prefix: "/pharmacy/medicines", roles: ["admin", "pharmacist", "cashier", "doctor", "nurse"], readOnlyRoles: ["doctor", "nurse"] },
  { prefix: "/pharmacy", roles: ["admin", "pharmacist", "cashier"] },
  { prefix: "/opd", roles: ["admin", "doctor", "nurse", "receptionist"] },
  { prefix: "/ipd", roles: ["admin", "doctor", "nurse", "receptionist"] },
  { prefix: "/patients", roles: ["admin", "doctor", "nurse", "receptionist", "cashier"] },
  { prefix: "/patient-documents", roles: ["admin", "doctor", "nurse", "receptionist"] },
  { prefix: "/lookups", roles: ["admin", "doctor", "nurse", "receptionist", "cashier", "pharmacist"], readOnlyRoles: ["doctor", "nurse", "receptionist", "cashier", "pharmacist"] },
  { prefix: "/stats", roles: ["admin"] },
  { prefix: "/reports/ipd", roles: ["admin", "doctor", "nurse", "receptionist"] },
  { prefix: "/reports/opd", roles: ["admin", "doctor", "nurse", "receptionist", "cashier"] },
  { prefix: "/reports/pharmacy", roles: ["admin", "pharmacist", "cashier"] },
  { prefix: "/reports/finance", roles: ["admin", "cashier"] },
  { prefix: "/reports/stock", roles: ["admin", "pharmacist"] },
  { prefix: "/reports/patient-ledger", roles: ["admin", "cashier", "receptionist"] },
  { prefix: "/reports/gst", roles: ["admin"] },
  { prefix: "/reports/doctor-performance", roles: ["admin", "doctor"] },
  { prefix: "/reports/department-revenue", roles: ["admin", "cashier"] },
  { prefix: "/certificates", roles: ["admin", "doctor", "nurse", "receptionist"], readOnlyRoles: ["nurse"] },
  { prefix: "/estimations", roles: ["admin", "doctor", "receptionist", "cashier"] },
  { prefix: "/referral-doctors", roles: ["admin", "receptionist", "cashier", "doctor"], readOnlyRoles: ["doctor"] },
  { prefix: "/referral-payouts", roles: ["admin", "cashier"] },
  { prefix: "/consultants", roles: ["admin", "receptionist", "cashier", "doctor"], readOnlyRoles: ["doctor"] },
  { prefix: "/consultant-engagements", roles: ["admin", "cashier"] },
  { prefix: "/discounts-report", roles: ["admin"] },
  { prefix: "/discounts", roles: ["admin", "cashier", "receptionist", "doctor"] },
  { prefix: "/inventory", roles: ["admin", "pharmacist"] },
  { prefix: "/indents", roles: ["admin", "pharmacist", "nurse"] },
  { prefix: "/vendors", roles: ["admin", "pharmacist"] },
  { prefix: "/vendor-purchases", roles: ["admin", "pharmacist"] },
  { prefix: "/vendor-payments", roles: ["admin", "pharmacist"] },
  { prefix: "/vendor-outstanding", roles: ["admin", "pharmacist"] },
  { prefix: "/nursing", roles: ["admin", "doctor", "nurse"] },
].sort((a, b) => b.prefix.length - a.prefix.length);

// Maps API path prefixes to UI module keys for dynamic permission enforcement.
// Most-specific first (sorted below).
const API_TO_MODULE: Array<{ prefix: string; module: string }> = [
  { prefix: "/reports/doctor-performance", module: "/reports/doctor-performance" },
  { prefix: "/reports/department-revenue", module: "/reports/department-revenue" },
  { prefix: "/reports/patient-ledger", module: "/reports/patient-ledger" },
  { prefix: "/reports/pharmacy", module: "/reports/pharmacy" },
  { prefix: "/reports/finance", module: "/reports/finance" },
  { prefix: "/reports/stock", module: "/reports/stock" },
  { prefix: "/reports/gst", module: "/reports/gst" },
  { prefix: "/reports/opd", module: "/reports/opd" },
  { prefix: "/reports/ipd", module: "/reports/ipd" },
  { prefix: "/reports", module: "/reports" },
  { prefix: "/stats", module: "/reports/hospital-stats" },
  { prefix: "/gst-export", module: "/reports/gst" },
  { prefix: "/pharmacy", module: "/pharmacy" },
  { prefix: "/inventory", module: "/inventory" },
  { prefix: "/indents", module: "/indents" },
  { prefix: "/vendor-purchases", module: "/vendors" },
  { prefix: "/vendor-payments", module: "/vendors" },
  { prefix: "/vendor-outstanding", module: "/vendors" },
  { prefix: "/vendors", module: "/vendors" },
  { prefix: "/banks", module: "/accounting/banks" },
  { prefix: "/accounting", module: "/accounting" },
  { prefix: "/bank-reconciliation", module: "/bank-reconciliation" },
  { prefix: "/collection-reports", module: "/collection-report" },
  { prefix: "/billing-heads", module: "/billing-heads" },
  { prefix: "/billing", module: "/billing" },
  { prefix: "/discounts-report", module: "/discounts" },
  { prefix: "/discounts", module: "/discounts" },
  { prefix: "/estimations", module: "/estimations" },
  { prefix: "/referral-doctors", module: "/referrals" },
  { prefix: "/referral-payouts", module: "/referrals" },
  { prefix: "/consultant-engagements", module: "/consultants" },
  { prefix: "/consultants", module: "/consultants" },
  { prefix: "/insurance-claims", module: "/insurance" },
  { prefix: "/tpa-providers", module: "/insurance" },
  { prefix: "/patient-insurance", module: "/insurance" },
  { prefix: "/insurance", module: "/insurance" },
  { prefix: "/diagnostic-orders", module: "/diagnostics" },
  { prefix: "/ot-bookings", module: "/ot" },
  { prefix: "/ot", module: "/ot" },
  { prefix: "/beds", module: "/wards" },
  { prefix: "/consent-forms", module: "/consent-forms" },
  { prefix: "/discharge-summaries", module: "/discharge-summary" },
  { prefix: "/bed-transfers", module: "/ipd" },
  { prefix: "/nursing", module: "/ipd" },
  { prefix: "/wards", module: "/wards" },
  { prefix: "/opd", module: "/opd" },
  { prefix: "/ipd", module: "/ipd" },
  { prefix: "/patient-documents", module: "/documents" },
  { prefix: "/patient-certificates", module: "/documents" },
  { prefix: "/certificates", module: "/documents" },
  { prefix: "/patient-lookups", module: "/masters/demographic" },
  { prefix: "/lookups", module: "/masters/demographic" },
  { prefix: "/prescription-templates", module: "/prescription-templates" },
  { prefix: "/packages", module: "/packages" },
  { prefix: "/employees", module: "/employees" },
  { prefix: "/entities", module: "/entities" },
  { prefix: "/hospital-settings", module: "/settings" },
  { prefix: "/doctors", module: "/doctors" },
  { prefix: "/patients", module: "/patients" },
  { prefix: "/permissions/role", module: "/permissions" },
  { prefix: "/permissions/user", module: "/permissions" },
].sort((a, b) => b.prefix.length - a.prefix.length);

// Endpoints that bypass dynamic permission checks (still require auth).
const EXEMPT_PREFIXES = ["/dashboard", "/permissions/me", "/storage"];

router.use(async (req: Request, res: Response, next: NextFunction) => {
  const role = req.session.role;
  if (!role) return res.status(401).json({ error: "Not authenticated" });
  if (role === "admin") return next();

  const isRefData = REFERENCE_DATA_PREFIXES.some(
    (p) => req.path === p || req.path.startsWith(p + "/"),
  );
  if (isRefData) {
    if (req.method === "GET") return next();
    return res.status(403).json({ error: "Forbidden" });
  }

  const rule = ROLE_RULES.find((r) => req.path === r.prefix || req.path.startsWith(r.prefix + "/"));
  if (rule) {
    if (!rule.roles.includes(role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (rule.readOnlyRoles?.includes(role) && req.method !== "GET") {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  // Dynamic effective-permission enforcement based on role defaults + per-user overrides.
  const isExempt = EXEMPT_PREFIXES.some(
    (p) => req.path === p || req.path.startsWith(p + "/"),
  );
  if (!isExempt) {
    const apiMatch = API_TO_MODULE.find(
      (m) => req.path === m.prefix || req.path.startsWith(m.prefix + "/"),
    );
    if (apiMatch) {
      const employeeId = req.session.userId;
      if (typeof employeeId !== "number") {
        return res.status(401).json({ error: "Not authenticated" });
      }
      try {
        const allowedList = await getEffectivePermissions(employeeId, role);
        const allowed = new Set(allowedList);
        if (!allowed.has(apiMatch.module)) {
          return res.status(403).json({ error: "Forbidden", module: apiMatch.module });
        }
      } catch (err) {
        req.log.error({ err }, "Permission lookup failed");
        return res.status(500).json({ error: "Permission lookup failed" });
      }
    }
  }
  next();
});

router.use(permissionsRouter);
router.use(dashboardRouter);
router.use(entitiesRouter);
router.use(employeesRouter);
router.use(billingHeadsRouter);
router.use(hospitalSettingsRouter);
router.use(packagesRouter);
router.use(collectionReportsRouter);
router.use(patientsRouter);
router.use(doctorsRouter);
router.use(prescriptionTemplatesRouter);
router.use(wardsRouter);
router.use(opdRouter);
router.use(ipdRouter);
router.use(pharmacyRouter);
router.use(pharmacyV2Router);
router.use(pharmacyV3Router);
router.use(pharmacyV4Router);
router.use(pharmacyV5Router);
router.use(inventoryRouter);
router.use(billingRouter);
router.use(accountingRouter);
router.use(reportsRouter);
router.use(diagnosticOrdersRouter);
router.use(otRouter);
router.use(consentFormsRouter);
router.use(progressNotesRouter);
router.use(nursingHandoversRouter);
router.use(aiAssistantRouter);
router.use(bedTransfersRouter);
router.use(insuranceRouter);
router.use(indentsRouter);
router.use(bankReconRouter);
router.use(vendorsRouter);
router.use(gstExportRouter);
router.use(estimationsRouter);
router.use(referralsRouter);
router.use(consultantsRouter);
router.use(discountsRouter);
router.use(banksRouter);
router.use(patientDocumentsRouter);
router.use(patientLookupsRouter);
router.use(hospitalStatsRouter);
router.use(ipdReportsRouter);
router.use(patientCertificatesRouter);
router.use(opdReportsRouter);
router.use(pharmacyReportsRouter);
router.use(financeReportsRouter);
router.use(stockReportsRouter);
router.use(patientLedgerRouter);
router.use(gstReportsRouter);
router.use(doctorPerformanceRouter);
router.use(departmentRevenueRouter);
router.use(searchRouter);

export default router;
