import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth, canAccess } from "@/lib/auth";
import {
  LayoutDashboard, Users, Stethoscope, BedDouble, FileText, Pill, Package, Receipt,
  Calculator, PieChart, UserRound, Building2, Briefcase, IdCard, Tag,
  Package as PackageIcon, Wallet, Settings, ScanLine, TestTube, Scissors,
  FileSignature, ClipboardList, Shield, LogOut, Landmark, Truck, Share2, Handshake,
  Percent, Coins, Activity, Clock, BarChart3, RefreshCcw, AlertTriangle, ShieldAlert,
  Command, Layers, BookOpen, CheckSquare, ListOrdered, Wrench, Cpu, Search,
  TrendingUp, History, UserCheck, Baby, RotateCcw, CreditCard,
  Thermometer, ScrollText, QrCode, FileWarning, Gift, Award, ShieldCheck,
} from "lucide-react";

const ROLE_BADGE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  doctor: "bg-blue-100 text-blue-700",
  cashier: "bg-green-100 text-green-700",
  nurse: "bg-pink-100 text-pink-700",
  pharmacist: "bg-purple-100 text-purple-700",
  lab_tech: "bg-amber-100 text-amber-700",
  receptionist: "bg-cyan-100 text-cyan-700",
};

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { name: "Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Doctor", href: "/doctor", icon: Stethoscope },
      { name: "Billing Desk", href: "/billing-desk", icon: ScanLine },
    ],
  },
  {
    label: "Clinical",
    items: [
      { name: "Patients", href: "/patients", icon: Users },
      { name: "OPD", href: "/opd", icon: Stethoscope },
      { name: "IPD", href: "/ipd", icon: BedDouble },
      { name: "Doctors", href: "/doctors", icon: UserRound },
      { name: "Pathology / Radiology", href: "/diagnostics", icon: TestTube },
      { name: "Operation Theatre", href: "/ot", icon: Scissors },
      { name: "Consent Forms", href: "/consent-forms", icon: FileSignature },
      { name: "Discharge Summary", href: "/discharge-summary", icon: ClipboardList },
      { name: "TPA / Insurance", href: "/insurance", icon: Shield },
      { name: "Wards", href: "/wards", icon: Building2 },
    ],
  },
  {
    label: "Pharmacy Core",
    items: [
      { name: "Command Center", href: "/pharmacy/command-center", icon: Command },
      { name: "Pharmacy Dashboard", href: "/pharmacy/dashboard", icon: BarChart3 },
      { name: "Pharmacy (Sales)", href: "/pharmacy", icon: Pill },
      { name: "Prescription Queue", href: "/pharmacy/prescription-queue", icon: ListOrdered },
      { name: "IPD Medicine Ledger", href: "/pharmacy/ipd-ledger", icon: BookOpen },
      { name: "Shift Closing", href: "/pharmacy/shift-closing", icon: Clock },
    ],
  },
  {
    label: "Pharmacy Inventory & Stock",
    items: [
      { name: "Ward / ICU Stock", href: "/pharmacy/ward-stock", icon: Layers },
      { name: "MAR Log", href: "/pharmacy/mar", icon: CheckSquare },
      { name: "OT Kits", href: "/pharmacy/kits", icon: Wrench },
      { name: "Implant Tracking", href: "/pharmacy/implants", icon: Cpu },
      { name: "Stock Verification", href: "/pharmacy/stock-verification", icon: Search },
      { name: "Expiry Loss Register", href: "/pharmacy/expiry-loss", icon: AlertTriangle },
      { name: "Stock Heatmap", href: "/pharmacy/stock-heatmap", icon: Thermometer },
      { name: "Consignment Stock", href: "/pharmacy/consignment-stock", icon: Package },
      { name: "Expiry Management", href: "/pharmacy/expiry", icon: AlertTriangle },
      { name: "Reorder Suggestions", href: "/pharmacy/reorder", icon: Package },
    ],
  },
  {
    label: "Pharmacy Procurement & Bills",
    items: [
      { name: "Purchase Indents", href: "/pharmacy/purchase-indent", icon: Truck },
      { name: "Purchase Returns", href: "/pharmacy/purchase-returns", icon: Truck },
      { name: "Sales Returns", href: "/pharmacy/sales-returns", icon: RefreshCcw },
      { name: "Patient Returns", href: "/pharmacy/patient-returns", icon: RotateCcw },
      { name: "Rate History", href: "/pharmacy/rate-history", icon: History },
      { name: "Pediatric Safety", href: "/pharmacy/pediatric-safety", icon: Baby },
      { name: "Insurance / TPA Billing", href: "/pharmacy/insurance-billing", icon: Shield },
      { name: "Credit Limits", href: "/pharmacy/credit-limits", icon: CreditCard },
      { name: "Rate Contracts", href: "/pharmacy/rate-contracts", icon: FileText },
      { name: "GST Reconciliation", href: "/pharmacy/gst-reconciliation", icon: Calculator },
      { name: "Tally Export", href: "/pharmacy/tally-export", icon: BookOpen },
      { name: "PMJAY Claims", href: "/pharmacy/pmjay-claims", icon: ShieldCheck },
      { name: "Drug Licence Tracker", href: "/pharmacy/drug-licences", icon: FileWarning },
      { name: "ABC / VED / FSN", href: "/pharmacy/abc-ved-fsn", icon: Layers },
      { name: "Vendor Schemes", href: "/pharmacy/vendor-schemes", icon: Gift },
      { name: "KPI Scorecard", href: "/pharmacy/kpi-scorecard", icon: Award },
      { name: "Pharmacy Audit Log", href: "/pharmacy/audit-log", icon: ClipboardList },
    ],
  },
  {
    label: "Stores & Procurement",
    items: [
      { name: "Inventory", href: "/inventory", icon: Package },
      { name: "Hospital Indents", href: "/indents", icon: ClipboardList },
      { name: "Vendors", href: "/vendors", icon: Truck },
    ],
  },
  {
    label: "Billing & Finance",
    items: [
      { name: "Estimations", href: "/estimations", icon: Calculator },
      { name: "Billing", href: "/billing", icon: Receipt },
      { name: "Bank Reconciliation", href: "/bank-reconciliation", icon: Landmark },
      { name: "AI Finance Assistant", href: "/accounting/ai-finance", icon: Cpu },
      { name: "Accounting", href: "/accounting", icon: Calculator },
      { name: "Bank Details", href: "/accounting/banks", icon: Landmark },
      { name: "Ledger Master", href: "/accounting/ledgers", icon: Calculator },
      { name: "Discounts", href: "/discounts", icon: Percent },
      { name: "Collection Report", href: "/collection-report", icon: Wallet },
    ],
  },
  {
    label: "Reports",
    items: [
      { name: "Reports", href: "/reports", icon: PieChart },
      { name: "Hospital Statistics", href: "/reports/hospital-stats", icon: PieChart },
      { name: "IPD Reports", href: "/reports/ipd", icon: BedDouble },
      { name: "OPD Reports", href: "/reports/opd", icon: Stethoscope },
      { name: "IP Pharmacy Reports", href: "/reports/pharmacy", icon: Pill },
      { name: "Finance Reports", href: "/reports/finance", icon: Coins },
      { name: "Stock Reports", href: "/reports/stock", icon: Package },
      { name: "Patient Ledger", href: "/reports/patient-ledger", icon: Wallet },
      { name: "GST Summary", href: "/reports/gst", icon: Percent },
      { name: "Doctor Performance", href: "/reports/doctor-performance", icon: Activity },
      { name: "Dept-wise Revenue", href: "/reports/department-revenue", icon: Building2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Referral Doctors", href: "/referrals", icon: Share2 },
      { name: "Consultants on Job", href: "/consultants", icon: Handshake },
      { name: "Documents", href: "/documents", icon: FileText },
      { name: "Patient Demographics", href: "/masters/demographic", icon: Users },
      { name: "Prescription Templates", href: "/prescription-templates", icon: FileText },
      { name: "Employees", href: "/employees", icon: IdCard },
      { name: "Billing Heads", href: "/billing-heads", icon: Tag },
      { name: "Health Packages", href: "/packages", icon: PackageIcon },
      { name: "Entities", href: "/entities", icon: Briefcase },
      { name: "Hospital Settings", href: "/settings", icon: Settings },
      { name: "Permissions Manager", href: "/permissions", icon: Shield },
    ],
  },
];

// Flat list used only for header title lookup
const allNav: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{
    patients: any[];
    employees: any[];
    medicines: any[];
    wards: any[];
  } | null>(null);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(search)}`)
        .then((r) => r.json())
        .then((res) => setSearchResults(res))
        .catch(() => setSearchResults(null));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccess(user, item.href)),
  })).filter((section) => section.items.length > 0);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar className="border-r">
          <SidebarContent>
            <div className="p-4 flex items-center gap-2 border-b h-14">
              <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
                <Stethoscope className="w-5 h-5" />
              </div>
              <span className="font-semibold text-lg tracking-tight">CarePlus HMS</span>
            </div>
            {visibleSections.map((section) => (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                      return (
                        <SidebarMenuItem key={item.name}>
                          <SidebarMenuButton asChild isActive={isActive} tooltip={item.name}>
                            <Link href={item.href} className="flex items-center gap-3">
                              <item.icon className="w-4 h-4" />
                              <span>{item.name}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
            {user && (
              <div className="mt-auto border-t p-3 space-y-2">
                <div className="px-1">
                  <div className="text-sm font-medium truncate">{user.name}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{user.username}</span>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${ROLE_BADGE_COLORS[user.role] || ""}`}>
                      {user.role}
                    </Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-xs" onClick={logout}>
                  <LogOut className="w-3.5 h-3.5" /> Sign out
                </Button>
              </div>
            )}
          </SidebarContent>
        </Sidebar>

        <SidebarInset className="flex flex-col min-w-0 overflow-hidden">
          <header className="h-14 border-b bg-card flex items-center justify-between px-4 sticky top-0 z-10 shrink-0 shadow-sm gap-3">
            <div className="flex items-center gap-3">
              {isMobile && <SidebarTrigger />}
              <h1 className="font-semibold text-foreground truncate text-sm sm:text-base">
                {allNav.find(item => location === item.href || (item.href !== "/" && location.startsWith(item.href)))?.name || "CarePlus HMS"}
              </h1>
            </div>

            {/* Global Smart Search */}
            <div className="relative w-full max-w-xs sm:max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Global smart search..."
                className="pl-8 h-9 rounded-xl text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {searchResults && (
                <div className="absolute right-0 top-full mt-1.5 w-72 sm:w-96 bg-popover text-popover-foreground border shadow-lg rounded-2xl p-3 z-50 max-h-[300px] overflow-auto space-y-3">
                  {searchResults.patients.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Patients</span>
                      <div className="space-y-1.5 mt-1">
                        {searchResults.patients.map(p => (
                          <Link key={p.id} href={`/patients/${p.id}`} onClick={() => setSearch("")} className="block text-xs hover:bg-muted p-1.5 rounded-lg font-semibold">
                            {p.name} <span className="font-mono text-[10px] text-muted-foreground">({p.uhid})</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.employees.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Staff / Doctors</span>
                      <div className="space-y-1.5 mt-1">
                        {searchResults.employees.map(e => (
                          <span key={e.id} className="block text-xs p-1.5 rounded-lg">
                            {e.name} <span className="text-[10px] text-muted-foreground capitalize">({e.role})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.medicines.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Medicines</span>
                      <div className="space-y-1.5 mt-1">
                        {searchResults.medicines.map(m => (
                          <Link key={m.id} href="/pharmacy" onClick={() => setSearch("")} className="block text-xs hover:bg-muted p-1.5 rounded-lg">
                            {m.name} <span className="font-mono text-[10px] text-muted-foreground">({m.code || "No code"})</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                  {searchResults.patients.length === 0 && searchResults.employees.length === 0 && searchResults.medicines.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-2">No matching records found.</div>
                  )}
                </div>
              )}
            </div>
          </header>
          <div className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
