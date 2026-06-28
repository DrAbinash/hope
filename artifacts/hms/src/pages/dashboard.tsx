import { useEffect, useState } from "react";
import { useGetDashboardSummary, useGetRecentActivity } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import {
  Users,
  Stethoscope,
  BedDouble,
  IndianRupee,
  AlertTriangle,
  PackageX,
  PlusCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Shield,
  Activity,
  Heart,
  Pill,
  ClipboardCheck,
  Calendar,
  Layers,
  ListOrdered,
  BarChart3,
  TestTube
} from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useAuth();
  const [range, setRange] = useState<"today" | "yesterday" | "week" | "month" | "year">("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: isActivityLoading } = useGetRecentActivity();

  useEffect(() => {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    if (range === "today") {
      const d = fmt(today);
      setFrom(d);
      setTo(d);
    } else if (range === "yesterday") {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      const d = fmt(y);
      setFrom(d);
      setTo(d);
    } else if (range === "week") {
      const w = new Date(today);
      w.setDate(w.getDate() - 6);
      setFrom(fmt(w));
      setTo(fmt(today));
    } else if (range === "month") {
      const m = new Date(today);
      m.setMonth(m.getMonth() - 1);
      setFrom(fmt(m));
      setTo(fmt(today));
    } else if (range === "year") {
      const y = new Date(today);
      y.setFullYear(y.getFullYear() - 1);
      setFrom(fmt(y));
      setTo(fmt(today));
    }
  }, [range]);

  return (
    <div className="space-y-6">
      {/* Header welcome banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden border border-slate-700/50">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Welcome back, {user?.name || "User"}</h1>
            <p className="text-indigo-200/80 text-sm mt-1">
              Hope NeuroTrauma & MultiSpeciality Hospital HMS · Current role: <span className="capitalize font-semibold text-white">{user?.role}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/patients">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 font-medium">
                <PlusCircle className="w-4 h-4" /> New Patient
              </Button>
            </Link>
            <Link href="/billing-desk">
              <Button size="sm" variant="secondary" className="rounded-xl gap-2 font-medium">
                <IndianRupee className="w-4 h-4" /> Billing Desk
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Date selector filter */}
      <Card className="border shadow-sm bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Metrics Filtering</CardTitle>
          <CardDescription>Filter hospital metrics by date ranges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={range} onValueChange={(v) => setRange(v as typeof range)}>
            <TabsList className="grid w-full grid-cols-5 bg-muted">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
              <TabsTrigger value="week">1 Week</TabsTrigger>
              <TabsTrigger value="month">1 Month</TabsTrigger>
              <TabsTrigger value="year">1 Year</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dynamic Role-specific KPI metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          title="Total Registered"
          value={summary?.totalPatients}
          icon={Users}
          tone="from-sky-500 to-indigo-500"
          isLoading={isSummaryLoading}
        />
        <StatCard
          title="Today's OPD"
          value={summary?.todayOpdVisits}
          icon={Stethoscope}
          tone="from-cyan-500 to-teal-500"
          isLoading={isSummaryLoading}
        />
        <StatCard
          title="Active IPD"
          value={summary?.activeIpdAdmissions}
          icon={BedDouble}
          tone="from-emerald-500 to-green-500"
          isLoading={isSummaryLoading}
        />
        <StatCard
          title="Available Beds"
          value={summary?.availableBeds}
          icon={BedDouble}
          tone="from-violet-500 to-purple-500"
          isLoading={isSummaryLoading}
        />
        <StatCard
          title="Today Revenue"
          value={summary?.todayRevenue ? `₹${summary.todayRevenue}` : "₹0"}
          icon={IndianRupee}
          tone="from-amber-500 to-orange-500"
          isLoading={isSummaryLoading}
        />
        <StatCard
          title="Low Stock Warning"
          value={summary?.lowStockItems}
          icon={PackageX}
          tone="from-rose-500 to-red-500"
          isLoading={isSummaryLoading}
        />
      </div>

      {/* Role specific quick action shortcuts */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2 border shadow-sm">
          <CardHeader>
            <CardTitle>Role Quick Controls</CardTitle>
            <CardDescription>Tailored clinical & financial shortcuts for your profile</CardDescription>
          </CardHeader>
          <CardContent>
            {user?.role === "admin" && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/employees"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Users className="w-4 h-4" /> Manage Employees</Button></Link>
                <Link href="/permissions"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Shield className="w-4 h-4" /> Access Permissions</Button></Link>
                <Link href="/settings"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Activity className="w-4 h-4" /> Hospital Settings</Button></Link>
                <Link href="/billing-heads"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><FileText className="w-4 h-4" /> Billing Catalog</Button></Link>
              </div>
            )}
            {user?.role === "doctor" && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/doctor"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Heart className="w-4 h-4" /> Doctor Console</Button></Link>
                <Link href="/opd"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Stethoscope className="w-4 h-4" /> OPD Visits</Button></Link>
                <Link href="/prescription-templates"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><FileText className="w-4 h-4" /> Rx Templates</Button></Link>
                <Link href="/diagnostics"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Activity className="w-4 h-4" /> Diagnostics orders</Button></Link>
              </div>
            )}
            {user?.role === "nurse" && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/ipd"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><BedDouble className="w-4 h-4" /> Inpatient Care (IPD)</Button></Link>
                <Link href="/wards"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Layers className="w-4 h-4" /> Wards Layout Map</Button></Link>
                <Link href="/pharmacy/mar"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><ClipboardCheck className="w-4 h-4" /> Nursing MAR Logs</Button></Link>
                <Link href="/consent-forms"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><FileText className="w-4 h-4" /> Surgery Consents</Button></Link>
              </div>
            )}
            {user?.role === "cashier" && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/billing-desk"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><IndianRupee className="w-4 h-4" /> Billing checkout</Button></Link>
                <Link href="/discounts"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><DollarSign className="w-4 h-4" /> Discounts Approval</Button></Link>
                <Link href="/collection-report"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><TrendingUp className="w-4 h-4" /> Shift Cash closing</Button></Link>
                <Link href="/estimations"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Calendar className="w-4 h-4" /> Treatment Cost Estimation</Button></Link>
              </div>
            )}
            {user?.role === "pharmacist" && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/pharmacy"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Pill className="w-4 h-4" /> Retail Dispensing</Button></Link>
                <Link href="/pharmacy/prescription-queue"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><ListOrdered className="w-4 h-4" /> Prescriptions Queue</Button></Link>
                <Link href="/pharmacy/dashboard"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><BarChart3 className="w-4 h-4" /> Pharmacy Dashboard</Button></Link>
                <Link href="/pharmacy/expiry"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><AlertTriangle className="w-4 h-4" /> Expiry Tracker</Button></Link>
              </div>
            )}
            {(!user?.role || ["lab_tech", "radiology_tech", "receptionist", "house_keeping"].includes(user?.role || "")) && (
              <div className="grid grid-cols-2 gap-3">
                <Link href="/patients"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><Users className="w-4 h-4" /> Patient Demographics</Button></Link>
                <Link href="/diagnostics"><Button className="w-full justify-start rounded-xl gap-2" variant="outline"><TestTube className="w-4 h-4" /> Diagnostic Reports</Button></Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity card */}
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Live updates from OPD and IPD desks</CardDescription>
          </CardHeader>
          <CardContent>
            {isActivityLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3 max-h-[250px] overflow-auto">
                {activity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 text-xs rounded-xl bg-muted/30 p-2.5 border border-muted-foreground/10 hover:bg-muted/50 transition-colors">
                    <div className="bg-primary/10 text-primary p-1.5 rounded-full shrink-0">
                      <Activity className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{item.description}</p>
                      <p className="text-muted-foreground mt-0.5 font-mono text-[10px]">
                        {format(new Date(item.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No recent activity logged.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  isLoading,
  tone = "from-slate-500 to-slate-700"
}: {
  title: string;
  value?: string | number;
  icon: React.ElementType;
  isLoading: boolean;
  tone?: string;
}) {
  return (
    <Card className={`border-0 bg-gradient-to-br ${tone} text-white shadow-md rounded-2xl`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold text-white/95 truncate">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-white/80 shrink-0 ml-2" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-7 w-16 bg-white/20 rounded-md" />
        ) : (
          <div className="text-xl font-extrabold text-white tracking-tight">{value ?? "-"}</div>
        )}
      </CardContent>
    </Card>
  );
}
