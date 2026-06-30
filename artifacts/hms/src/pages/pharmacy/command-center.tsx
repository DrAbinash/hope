import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  AlertTriangle, Package, Clock, RefreshCcw, Pill, CheckCircle2,
  TrendingUp, Bell, BellOff, Layers, Clipboard, ArrowRight, ShieldAlert,
  Activity, FlaskConical, Truck, Shield
} from "lucide-react";

async function fetchCommandCenter() {
  const r = await fetch("/api/pharmacy/command-center", { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function markAllRead() {
  const r = await fetch("/api/pharmacy/notifications/read-all", { method: "PUT", credentials: "include" });
  if (!r.ok) throw new Error("Failed");
}

const ALERT_COLORS: Record<string, string> = {
  red: "bg-red-50 border-red-200 text-red-800",
  yellow: "bg-amber-50 border-amber-200 text-amber-800",
  green: "bg-emerald-50 border-emerald-200 text-emerald-800",
};
const ALERT_ICONS: Record<string, React.ReactNode> = {
  red: <AlertTriangle className="w-4 h-4 text-red-500" />,
  yellow: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  green: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
};

const ALERT_LINKS: Record<string, string> = {
  expired: "/pharmacy/expiry",
  mar: "/pharmacy/mar",
  low_stock: "/pharmacy",
  expiring: "/pharmacy/expiry",
  shift: "/pharmacy/shift-closing",
  returns: "/pharmacy/sales-returns",
  expiry_loss: "/pharmacy/expiry-loss",
  indent: "/pharmacy/purchase-indent",
  queue: "/pharmacy/prescription-queue",
};

const KPI_ITEMS = [
  { key: "todaySales", label: "Today's Sales", icon: TrendingUp, format: "currency", href: "/pharmacy" },
  { key: "lowStockCount", label: "Low Stock", icon: Package, href: "/pharmacy" },
  { key: "expiredBatches", label: "Expired Batches", icon: AlertTriangle, href: "/pharmacy/expiry", urgent: true },
  { key: "expiringBatches", label: "Expiring (30d)", icon: Clock, href: "/pharmacy/expiry" },
  { key: "prescriptionQueue", label: "Rx Queue", icon: Clipboard, href: "/pharmacy/prescription-queue" },
  { key: "pendingMAR", label: "Pending Doses", icon: Pill, href: "/pharmacy/mar" },
  { key: "pendingIndents", label: "Pending Indents", icon: Truck, href: "/pharmacy/purchase-indent" },
  { key: "unreadNotifications", label: "Notifications", icon: Bell, href: "/pharmacy" },
  { key: "ndpsMedicines", label: "NDPS Medicines", icon: ShieldAlert, href: "/pharmacy/ndps-register" },
  { key: "activeAudit", label: "Active Audit", icon: FlaskConical, href: "/pharmacy/stock-verification" },
  { key: "openShifts", label: "Open Shifts", icon: Activity, href: "/pharmacy/shift-closing" },
  { key: "pendingReturns", label: "Pending Returns", icon: RefreshCcw, href: "/pharmacy/sales-returns" },
];

export default function PharmacyCommandCenter() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["pharmacy-command-center"], queryFn: fetchCommandCenter, refetchInterval: 60000 });
  const markReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => { toast.success("All notifications marked read"); qc.invalidateQueries({ queryKey: ["pharmacy-command-center"] }); },
  });

  const kpis = data?.kpis ?? {};
  const alerts: any[] = Array.isArray(data?.alerts) ? data.alerts : [];

  function formatVal(key: string, v: number): string {
    if (key === "todaySales") return `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
    return String(v ?? 0);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Pharmacy Command Center</h1>
          <p className="text-sm text-muted-foreground">Real-time overview — refreshes every 60 seconds</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["pharmacy-command-center"] })}>
            <RefreshCcw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          {kpis.unreadNotifications > 0 && (
            <Button variant="secondary" size="sm" onClick={() => markReadMutation.mutate()}>
              <BellOff className="w-3.5 h-3.5 mr-1" /> Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Active Alerts</p>
          <div className="grid gap-2">
            {alerts.map((a: any) => (
              <Link key={a.id} href={ALERT_LINKS[a.id] ?? "/pharmacy"}>
                <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity ${ALERT_COLORS[a.level]}`}>
                  {ALERT_ICONS[a.level]}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-sm">{a.message}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{a.category}</Badge>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {KPI_ITEMS.map(({ key, label, icon: Icon, format, href, urgent }: any) => {
          const val = kpis[key] ?? 0;
          const isAlert = urgent && val > 0;
          return (
            <Link key={key} href={href}>
              <Card className={`cursor-pointer hover:shadow-md transition-shadow ${isAlert ? "border-red-300 bg-red-50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <Icon className={`w-4 h-4 ${isAlert ? "text-red-500" : "text-muted-foreground"}`} />
                  </div>
                  <div className={`text-2xl font-bold mt-2 ${isAlert ? "text-red-700" : ""}`}>
                    {isLoading ? "—" : formatVal(key, Number(val))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Separator />

      {/* Quick Links */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Quick Access</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {[
            { label: "Prescription Queue", href: "/pharmacy/prescription-queue", icon: Clipboard },
            { label: "Ward Stock", href: "/pharmacy/ward-stock", icon: Layers },
            { label: "IPD Ledger", href: "/pharmacy/ipd-ledger", icon: Pill },
            { label: "MAR", href: "/pharmacy/mar", icon: CheckCircle2 },
            { label: "OT Kits", href: "/pharmacy/kits", icon: Package },
            { label: "Implants", href: "/pharmacy/implants", icon: Shield },
            { label: "Stock Verification", href: "/pharmacy/stock-verification", icon: FlaskConical },
            { label: "Purchase Indents", href: "/pharmacy/purchase-indent", icon: Truck },
            { label: "Expiry Loss", href: "/pharmacy/expiry-loss", icon: AlertTriangle },
            { label: "Staff Issue", href: "/pharmacy/staff-issue", icon: Activity },
            { label: "Analytics", href: "/pharmacy/analytics", icon: TrendingUp },
            { label: "Rate History", href: "/pharmacy/rate-history", icon: RefreshCcw },
          ].map(({ label, href, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3" asChild>
                <div>
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
              </Button>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
