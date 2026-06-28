import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import PatientsList from "@/pages/patients";
import PatientProfilePage from "@/pages/patients/[id]";
import OPDPage from "@/pages/opd";
import OPDDetail from "@/pages/opd/[id]";
import PrescriptionPrint from "@/pages/opd/print";
import IPDPage from "@/pages/ipd";
import IPDDetail from "@/pages/ipd/[id]";
import DoctorsPage from "@/pages/doctors";
import WardsPage from "@/pages/wards";
import PharmacyPage from "@/pages/pharmacy";
import PharmacyCommandCenterPage from "@/pages/pharmacy/command-center";
import PharmacyDashboardPage from "@/pages/pharmacy/dashboard";
import ScheduleHRegisterPage from "@/pages/pharmacy/schedule-h-register";
import PurchaseReturnsPage from "@/pages/pharmacy/purchase-returns";
import SalesReturnsPage from "@/pages/pharmacy/sales-returns";
import NdpsRegisterPage from "@/pages/pharmacy/ndps-register";
import ShiftClosingPage from "@/pages/pharmacy/shift-closing";
import PharmacyAuditLogPage from "@/pages/pharmacy/audit-log";
import ReorderSuggestionsPage from "@/pages/pharmacy/reorder";
import ExpiryManagementPage from "@/pages/pharmacy/expiry";
import WardStockPage from "@/pages/pharmacy/ward-stock";
import IpdLedgerPage from "@/pages/pharmacy/ipd-ledger";
import MARPage from "@/pages/pharmacy/mar";
import PrescriptionQueuePage from "@/pages/pharmacy/prescription-queue";
import KitsPage from "@/pages/pharmacy/kits";
import ImplantsPage from "@/pages/pharmacy/implants";
import StockVerificationPage from "@/pages/pharmacy/stock-verification";
import ExpiryLossPage from "@/pages/pharmacy/expiry-loss";
import StaffIssuePage from "@/pages/pharmacy/staff-issue";
import PurchaseIndentPage from "@/pages/pharmacy/purchase-indent";
import PharmacyAnalyticsPage from "@/pages/pharmacy/analytics";
import RateHistoryPage from "@/pages/pharmacy/rate-history";
import PediatricSafetyPage from "@/pages/pharmacy/pediatric-safety";
import InsuranceBillingPage from "@/pages/pharmacy/insurance-billing";
import FraudMonitorPage from "@/pages/pharmacy/fraud-monitor";
import CreditLimitsPage from "@/pages/pharmacy/credit-limits";
import RateContractsPage from "@/pages/pharmacy/rate-contracts";
import GstReconciliationPage from "@/pages/pharmacy/gst-reconciliation";
import TallyExportPage from "@/pages/pharmacy/tally-export";
import StockHeatmapPage from "@/pages/pharmacy/stock-heatmap";
import CounsellingSlipPage from "@/pages/pharmacy/counselling-slip";
import PatientReturnsEnhancedPage from "@/pages/pharmacy/patient-returns-enhanced";
import BarcodeScanPage from "@/pages/pharmacy/barcode-scan";
import PmjayClaimsPage from "@/pages/pharmacy/pmjay-claims";
import DrugLicencesPage from "@/pages/pharmacy/drug-licences";
import ConsignmentStockPage from "@/pages/pharmacy/consignment-stock";
import AbcVedFsnPage from "@/pages/pharmacy/abc-ved-fsn";
import VendorSchemesPage from "@/pages/pharmacy/vendor-schemes";
import KpiScorecardPage from "@/pages/pharmacy/kpi-scorecard";
import InventoryPage from "@/pages/inventory";
import BillingPage from "@/pages/billing";
import AccountingPage from "@/pages/accounting";
import AIFinanceAssistantPage from "@/pages/accounting/ai-finance";
import BankDetailsPage from "@/pages/accounting/banks";
import LedgerDetailsPage from "@/pages/accounting/ledgers";
import DiscountsPage from "@/pages/discounts";
import ReportsPage from "@/pages/reports";
import PrescriptionTemplatesPage from "@/pages/prescription-templates";
import EntitiesPage from "@/pages/entities";
import EmployeesPage from "@/pages/employees";
import BillingHeadsPage from "@/pages/billing-heads";
import SettingsPage from "@/pages/settings";
import PackagesPage from "@/pages/packages";
import CollectionReportPage from "@/pages/collection-report";
import BillingDeskPage from "@/pages/billing-desk";
import DiagnosticsPage from "@/pages/diagnostics";
import OtPage from "@/pages/ot";
import ConsentFormsPage from "@/pages/consent-forms";
import DischargeSummaryPage from "@/pages/discharge-summary";
import InsurancePage from "@/pages/insurance";
import IndentsPage from "@/pages/indents";
import VendorsPage from "@/pages/vendors";
import BankReconciliationPage from "@/pages/bank-reconciliation";
import DoctorDashboard from "@/pages/doctor";
import DoctorToday from "@/pages/doctor/today";
import DoctorHistory from "@/pages/doctor/history";
import DoctorReprint from "@/pages/doctor/reprint";
import DoctorOpdToIpd from "@/pages/doctor/opd-to-ipd";
import DoctorMrd from "@/pages/doctor/mrd";
import PatientDemographicPage from "@/pages/masters/demographic";
import HospitalStatsPage from "@/pages/reports/hospital-stats";
import IpdReportsPage from "@/pages/reports/ipd";
import OpdReportsPage from "@/pages/reports/opd";
import PharmacyReportsPage from "@/pages/reports/pharmacy";
import FinanceReportsPage from "@/pages/reports/finance";
import StockReportsPage from "@/pages/reports/stock";
import PatientLedgerPage from "@/pages/reports/patient-ledger";
import GstReportsPage from "@/pages/reports/gst";
import DoctorPerformancePage from "@/pages/reports/doctor-performance";
import DepartmentRevenuePage from "@/pages/reports/department-revenue";
import ReportsHubPage from "@/pages/reports/hub";
import CertificatesPage from "@/pages/documents/certificates";
import EstimationsHub from "@/pages/estimations";
import NewEstimation from "@/pages/estimations/new";
import EstimationDetail from "@/pages/estimations/[id]";
import ReferralsHub from "@/pages/referrals";
import ReferralDoctorsList from "@/pages/referrals/doctors";
import ReferralDoctorForm from "@/pages/referrals/doctors/form";
import ReferralPayouts from "@/pages/referrals/payouts";
import ReferralReport from "@/pages/referrals/report";
import ConsultantsHub from "@/pages/consultants";
import ConsultantsList from "@/pages/consultants/list";
import ConsultantForm from "@/pages/consultants/form";
import ConsultantEngagements from "@/pages/consultants/engagements";
import ConsultantReport from "@/pages/consultants/report";
import LoginPage from "@/pages/login";
import PermissionsPage from "@/pages/permissions";
import { AuthProvider, useAuth, canAccess } from "@/lib/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center border-2 border-dashed rounded-lg border-muted bg-muted/20">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-2">This module is under construction.</p>
    </div>
  );
}

function Forbidden({ path }: { path: string }) {
  const { user } = useAuth();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="text-6xl mb-4">🔒</div>
      <h2 className="text-2xl font-semibold">Access Restricted</h2>
      <p className="text-muted-foreground mt-2 max-w-md">
        Your role <strong>{user?.role}</strong> doesn't have permission to view <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{path}</code>.
      </p>
      <p className="text-sm text-muted-foreground mt-4">Contact your administrator if you need access.</p>
    </div>
  );
}

function Guard({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!canAccess(user, path)) return <Forbidden path={path} />;
  return <>{children}</>;
}

function ProtectedRouter() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;
  if (!user) return <LoginPage />;
  return (
    <Switch>
      <Route path="/opd/:id/print" component={() => <Guard path="/opd"><PrescriptionPrint /></Guard>} />
      <Route>
    <AppLayout>
      <Switch>
        <Route path="/" component={() => <Guard path="/"><Dashboard /></Guard>} />
        <Route path="/patients" component={() => <Guard path="/patients"><PatientsList /></Guard>} />
        <Route path="/patients/:id" component={() => <Guard path="/patients"><PatientProfilePage /></Guard>} />
        <Route path="/opd" component={() => <Guard path="/opd"><OPDPage /></Guard>} />
        <Route path="/opd/:id" component={() => <Guard path="/opd"><OPDDetail /></Guard>} />
        <Route path="/ipd" component={() => <Guard path="/ipd"><IPDPage /></Guard>} />
        <Route path="/ipd/:id" component={() => <Guard path="/ipd"><IPDDetail /></Guard>} />
        <Route path="/doctors" component={() => <Guard path="/doctors"><DoctorsPage /></Guard>} />
        <Route path="/wards" component={() => <Guard path="/wards"><WardsPage /></Guard>} />
        <Route path="/pharmacy/command-center" component={() => <Guard path="/pharmacy/command-center"><PharmacyCommandCenterPage /></Guard>} />
        <Route path="/pharmacy/dashboard" component={() => <Guard path="/pharmacy/dashboard"><PharmacyDashboardPage /></Guard>} />
        <Route path="/pharmacy/schedule-h-register" component={() => <Guard path="/pharmacy/schedule-h-register"><ScheduleHRegisterPage /></Guard>} />
        <Route path="/pharmacy/purchase-returns" component={() => <Guard path="/pharmacy/purchase-returns"><PurchaseReturnsPage /></Guard>} />
        <Route path="/pharmacy/sales-returns" component={() => <Guard path="/pharmacy/sales-returns"><SalesReturnsPage /></Guard>} />
        <Route path="/pharmacy/ndps-register" component={() => <Guard path="/pharmacy/ndps-register"><NdpsRegisterPage /></Guard>} />
        <Route path="/pharmacy/shift-closing" component={() => <Guard path="/pharmacy/shift-closing"><ShiftClosingPage /></Guard>} />
        <Route path="/pharmacy/audit-log" component={() => <Guard path="/pharmacy/audit-log"><PharmacyAuditLogPage /></Guard>} />
        <Route path="/pharmacy/reorder" component={() => <Guard path="/pharmacy/reorder"><ReorderSuggestionsPage /></Guard>} />
        <Route path="/pharmacy/expiry" component={() => <Guard path="/pharmacy/expiry"><ExpiryManagementPage /></Guard>} />
        <Route path="/pharmacy/ward-stock" component={() => <Guard path="/pharmacy/ward-stock"><WardStockPage /></Guard>} />
        <Route path="/pharmacy/ipd-ledger" component={() => <Guard path="/pharmacy/ipd-ledger"><IpdLedgerPage /></Guard>} />
        <Route path="/pharmacy/mar" component={() => <Guard path="/pharmacy/mar"><MARPage /></Guard>} />
        <Route path="/pharmacy/prescription-queue" component={() => <Guard path="/pharmacy/prescription-queue"><PrescriptionQueuePage /></Guard>} />
        <Route path="/pharmacy/kits" component={() => <Guard path="/pharmacy/kits"><KitsPage /></Guard>} />
        <Route path="/pharmacy/implants" component={() => <Guard path="/pharmacy/implants"><ImplantsPage /></Guard>} />
        <Route path="/pharmacy/stock-verification" component={() => <Guard path="/pharmacy/stock-verification"><StockVerificationPage /></Guard>} />
        <Route path="/pharmacy/expiry-loss" component={() => <Guard path="/pharmacy/expiry-loss"><ExpiryLossPage /></Guard>} />
        <Route path="/pharmacy/staff-issue" component={() => <Guard path="/pharmacy/staff-issue"><StaffIssuePage /></Guard>} />
        <Route path="/pharmacy/purchase-indent" component={() => <Guard path="/pharmacy/purchase-indent"><PurchaseIndentPage /></Guard>} />
        <Route path="/pharmacy/analytics" component={() => <Guard path="/pharmacy/analytics"><PharmacyAnalyticsPage /></Guard>} />
        <Route path="/pharmacy/rate-history" component={() => <Guard path="/pharmacy/rate-history"><RateHistoryPage /></Guard>} />
        <Route path="/pharmacy/pediatric-safety" component={() => <Guard path="/pharmacy/pediatric-safety"><PediatricSafetyPage /></Guard>} />
        <Route path="/pharmacy/insurance-billing" component={() => <Guard path="/pharmacy/insurance-billing"><InsuranceBillingPage /></Guard>} />
        <Route path="/pharmacy/fraud-monitor" component={() => <Guard path="/pharmacy/fraud-monitor"><FraudMonitorPage /></Guard>} />
        <Route path="/pharmacy/credit-limits" component={() => <Guard path="/pharmacy/credit-limits"><CreditLimitsPage /></Guard>} />
        <Route path="/pharmacy/rate-contracts" component={() => <Guard path="/pharmacy/rate-contracts"><RateContractsPage /></Guard>} />
        <Route path="/pharmacy/gst-reconciliation" component={() => <Guard path="/pharmacy/gst-reconciliation"><GstReconciliationPage /></Guard>} />
        <Route path="/pharmacy/tally-export" component={() => <Guard path="/pharmacy/tally-export"><TallyExportPage /></Guard>} />
        <Route path="/pharmacy/stock-heatmap" component={() => <Guard path="/pharmacy/stock-heatmap"><StockHeatmapPage /></Guard>} />
        <Route path="/pharmacy/counselling-slip" component={() => <Guard path="/pharmacy/counselling-slip"><CounsellingSlipPage /></Guard>} />
        <Route path="/pharmacy/patient-returns" component={() => <Guard path="/pharmacy/patient-returns"><PatientReturnsEnhancedPage /></Guard>} />
        <Route path="/pharmacy/barcode-scan" component={() => <Guard path="/pharmacy/barcode-scan"><BarcodeScanPage /></Guard>} />
        <Route path="/pharmacy/pmjay-claims" component={() => <Guard path="/pharmacy/pmjay-claims"><PmjayClaimsPage /></Guard>} />
        <Route path="/pharmacy/drug-licences" component={() => <Guard path="/pharmacy/drug-licences"><DrugLicencesPage /></Guard>} />
        <Route path="/pharmacy/consignment-stock" component={() => <Guard path="/pharmacy/consignment-stock"><ConsignmentStockPage /></Guard>} />
        <Route path="/pharmacy/abc-ved-fsn" component={() => <Guard path="/pharmacy/abc-ved-fsn"><AbcVedFsnPage /></Guard>} />
        <Route path="/pharmacy/vendor-schemes" component={() => <Guard path="/pharmacy/vendor-schemes"><VendorSchemesPage /></Guard>} />
        <Route path="/pharmacy/kpi-scorecard" component={() => <Guard path="/pharmacy/kpi-scorecard"><KpiScorecardPage /></Guard>} />
        <Route path="/pharmacy" component={() => <Guard path="/pharmacy"><PharmacyPage /></Guard>} />
        <Route path="/inventory" component={() => <Guard path="/inventory"><InventoryPage /></Guard>} />
        <Route path="/billing" component={() => <Guard path="/billing"><BillingPage /></Guard>} />
        <Route path="/accounting" component={() => <Guard path="/accounting"><AccountingPage /></Guard>} />
        <Route path="/accounting/ai-finance" component={() => <Guard path="/accounting"><AIFinanceAssistantPage /></Guard>} />
        <Route path="/accounting/banks" component={() => <Guard path="/accounting/banks"><BankDetailsPage /></Guard>} />
        <Route path="/accounting/ledgers" component={() => <Guard path="/accounting/ledgers"><LedgerDetailsPage /></Guard>} />
        <Route path="/discounts" component={() => <Guard path="/discounts"><DiscountsPage /></Guard>} />
        <Route path="/reports" component={() => <Guard path="/reports"><ReportsHubPage /></Guard>} />
        <Route path="/reports/analytics" component={() => <Guard path="/reports"><ReportsPage /></Guard>} />
        <Route path="/reports/ipd" component={() => <Guard path="/reports/ipd"><IpdReportsPage /></Guard>} />
        <Route path="/reports/opd" component={() => <Guard path="/reports/opd"><OpdReportsPage /></Guard>} />
        <Route path="/reports/pharmacy" component={() => <Guard path="/reports/pharmacy"><PharmacyReportsPage /></Guard>} />
        <Route path="/reports/finance" component={() => <Guard path="/reports/finance"><FinanceReportsPage /></Guard>} />
        <Route path="/reports/stock" component={() => <Guard path="/reports/stock"><StockReportsPage /></Guard>} />
        <Route path="/reports/patient-ledger" component={() => <Guard path="/reports/patient-ledger"><PatientLedgerPage /></Guard>} />
        <Route path="/reports/gst" component={() => <Guard path="/reports/gst"><GstReportsPage /></Guard>} />
        <Route path="/reports/doctor-performance" component={() => <Guard path="/reports/doctor-performance"><DoctorPerformancePage /></Guard>} />
        <Route path="/reports/department-revenue" component={() => <Guard path="/reports/department-revenue"><DepartmentRevenuePage /></Guard>} />
        <Route path="/reports/hospital-stats" component={() => <Guard path="/reports/hospital-stats"><HospitalStatsPage /></Guard>} />
        <Route path="/documents" component={() => <Guard path="/documents"><CertificatesPage /></Guard>} />
        <Route path="/masters/demographic" component={() => <Guard path="/masters/demographic"><PatientDemographicPage /></Guard>} />
        <Route path="/prescription-templates" component={() => <Guard path="/prescription-templates"><PrescriptionTemplatesPage /></Guard>} />
        <Route path="/entities" component={() => <Guard path="/entities"><EntitiesPage /></Guard>} />
        <Route path="/employees" component={() => <Guard path="/employees"><EmployeesPage /></Guard>} />
        <Route path="/billing-heads" component={() => <Guard path="/billing-heads"><BillingHeadsPage /></Guard>} />
        <Route path="/packages" component={() => <Guard path="/packages"><PackagesPage /></Guard>} />
        <Route path="/collection-report" component={() => <Guard path="/collection-report"><CollectionReportPage /></Guard>} />
        <Route path="/billing-desk" component={() => <Guard path="/billing-desk"><BillingDeskPage /></Guard>} />
        <Route path="/diagnostics" component={() => <Guard path="/diagnostics"><DiagnosticsPage /></Guard>} />
        <Route path="/ot" component={() => <Guard path="/ot"><OtPage /></Guard>} />
        <Route path="/consent-forms" component={() => <Guard path="/consent-forms"><ConsentFormsPage /></Guard>} />
        <Route path="/discharge-summary" component={() => <Guard path="/discharge-summary"><DischargeSummaryPage /></Guard>} />
        <Route path="/insurance" component={() => <Guard path="/insurance"><InsurancePage /></Guard>} />
        <Route path="/indents" component={() => <Guard path="/indents"><IndentsPage /></Guard>} />
        <Route path="/vendors" component={() => <Guard path="/vendors"><VendorsPage /></Guard>} />
        <Route path="/bank-reconciliation" component={() => <Guard path="/bank-reconciliation"><BankReconciliationPage /></Guard>} />
        <Route path="/doctor" component={() => <Guard path="/doctor"><DoctorDashboard /></Guard>} />
        <Route path="/doctor/today" component={() => <Guard path="/doctor"><DoctorToday /></Guard>} />
        <Route path="/doctor/history" component={() => <Guard path="/doctor"><DoctorHistory /></Guard>} />
        <Route path="/doctor/reprint" component={() => <Guard path="/doctor"><DoctorReprint /></Guard>} />
        <Route path="/doctor/opd-to-ipd" component={() => <Guard path="/doctor"><DoctorOpdToIpd /></Guard>} />
        <Route path="/doctor/mrd" component={() => <Guard path="/doctor"><DoctorMrd /></Guard>} />
        <Route path="/estimations" component={() => <Guard path="/estimations"><EstimationsHub /></Guard>} />
        <Route path="/estimations/new" component={() => <Guard path="/estimations"><NewEstimation /></Guard>} />
        <Route path="/estimations/:id" component={() => <Guard path="/estimations"><EstimationDetail /></Guard>} />
        <Route path="/referrals" component={() => <Guard path="/referrals"><ReferralsHub /></Guard>} />
        <Route path="/referrals/doctors" component={() => <Guard path="/referrals"><ReferralDoctorsList /></Guard>} />
        <Route path="/referrals/doctors/new" component={() => <Guard path="/referrals"><ReferralDoctorForm /></Guard>} />
        <Route path="/referrals/doctors/:id/edit" component={() => <Guard path="/referrals"><ReferralDoctorForm /></Guard>} />
        <Route path="/referrals/payouts" component={() => <Guard path="/referrals"><ReferralPayouts /></Guard>} />
        <Route path="/referrals/report" component={() => <Guard path="/referrals"><ReferralReport /></Guard>} />
        <Route path="/consultants" component={() => <Guard path="/consultants"><ConsultantsHub /></Guard>} />
        <Route path="/consultants/list" component={() => <Guard path="/consultants"><ConsultantsList /></Guard>} />
        <Route path="/consultants/new" component={() => <Guard path="/consultants"><ConsultantForm /></Guard>} />
        <Route path="/consultants/:id/edit" component={() => <Guard path="/consultants"><ConsultantForm /></Guard>} />
        <Route path="/consultants/engagements" component={() => <Guard path="/consultants"><ConsultantEngagements /></Guard>} />
        <Route path="/consultants/report" component={() => <Guard path="/consultants"><ConsultantReport /></Guard>} />
        <Route path="/settings" component={() => <Guard path="/settings"><SettingsPage /></Guard>} />
        <Route path="/permissions" component={() => <Guard path="/permissions"><PermissionsPage /></Guard>} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <ProtectedRouter />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
