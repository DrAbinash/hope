// Mirror of artifacts/hms/src/lib/permissions-catalog.ts default role assignments.
// Used to seed role_permissions table on first access for a role.

const ALL_MODULES: string[] = [
  "/", "/patients", "/billing-desk", "/estimations", "/referrals", "/consultants", "/entities",
  "/doctor", "/doctors", "/opd", "/ipd", "/wards", "/diagnostics", "/ot", "/consent-forms",
  "/discharge-summary", "/insurance",
  "/pharmacy", "/inventory", "/indents", "/vendors",
  "/billing", "/discounts", "/accounting", "/accounting/banks", "/accounting/ledgers",
  "/bank-reconciliation", "/collection-report",
  "/reports", "/reports/hospital-stats", "/reports/ipd", "/reports/opd", "/reports/pharmacy",
  "/reports/finance", "/reports/stock", "/reports/patient-ledger", "/reports/gst",
  "/reports/doctor-performance", "/reports/department-revenue",
  "/documents", "/masters/demographic", "/prescription-templates", "/employees",
  "/billing-heads", "/packages", "/settings", "/permissions",
];

export const ALL_MODULE_KEYS = ALL_MODULES;

export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ALL_MODULES,
  doctor: [
    "/", "/patients", "/doctor", "/estimations", "/referrals", "/consultants",
    "/opd", "/ipd", "/doctors", "/diagnostics", "/ot", "/consent-forms",
    "/discharge-summary", "/wards", "/discounts", "/documents",
    "/masters/demographic", "/prescription-templates",
    "/reports", "/reports/ipd", "/reports/opd", "/reports/doctor-performance",
  ],
  nurse: [
    "/", "/patients", "/ipd", "/wards", "/diagnostics", "/ot", "/consent-forms",
    "/discharge-summary", "/indents", "/documents", "/masters/demographic",
    "/reports", "/reports/ipd", "/reports/opd",
  ],
  receptionist: [
    "/", "/patients", "/billing-desk", "/estimations", "/referrals", "/consultants",
    "/opd", "/ipd", "/doctors", "/consent-forms", "/packages", "/documents",
    "/masters/demographic",
    "/reports", "/reports/hospital-stats", "/reports/ipd", "/reports/opd",
    "/reports/patient-ledger",
  ],
  cashier: [
    "/", "/patients", "/billing-desk", "/billing", "/discounts", "/estimations",
    "/referrals", "/consultants", "/opd", "/ipd", "/insurance", "/packages",
    "/pharmacy", "/accounting/banks", "/collection-report",
    "/masters/demographic",
    "/reports", "/reports/opd", "/reports/pharmacy", "/reports/finance",
    "/reports/patient-ledger", "/reports/department-revenue",
  ],
  lab_tech: ["/", "/diagnostics", "/masters/demographic"],
  radiology_tech: ["/", "/diagnostics", "/masters/demographic"],
  pharmacist: [
    "/", "/pharmacy", "/inventory", "/indents", "/vendors",
    "/masters/demographic",
    "/reports", "/reports/pharmacy", "/reports/stock",
  ],
  house_keeping: ["/"],
};
