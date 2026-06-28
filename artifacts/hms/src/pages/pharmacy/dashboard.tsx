import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Package, AlertTriangle, ShieldAlert, Percent, Activity } from "lucide-react";

const j = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export default function PharmacyDashboardPage() {
  const { data: dash, isLoading } = useQuery<any>({
    queryKey: ["pharmacy-dashboard"],
    queryFn: () => j("/api/pharmacy/dashboard"),
    refetchInterval: 60000,
  });

  if (isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    </div>
  );

  const s = dash?.sales || {};
  const st = dash?.stock || {};
  const c = dash?.compliance || {};

  const kpis = [
    { label: "Today Bills", value: s.count ?? 0, icon: Activity, color: "text-blue-600" },
    { label: "Gross Sale", value: inr(s.gross), icon: TrendingUp, color: "text-green-600" },
    { label: "Total Discount", value: inr(s.discount), icon: Percent, color: "text-yellow-600" },
    { label: "Returns", value: inr(s.returns), icon: TrendingDown, color: "text-red-500" },
    { label: "Net Sale", value: inr(s.net), icon: TrendingUp, color: "text-emerald-600" },
    { label: "Cash", value: inr(s.cash), icon: Activity, color: "text-indigo-600" },
    { label: "UPI", value: inr(s.upi), icon: Activity, color: "text-purple-600" },
    { label: "Card", value: inr(s.card), icon: Activity, color: "text-pink-600" },
  ];

  const stockKpis = [
    { label: "Total Medicines", value: st.total ?? 0, icon: Package, color: "text-foreground" },
    { label: "Low Stock Items", value: st.lowStock ?? 0, icon: AlertTriangle, color: "text-yellow-600" },
    { label: "Expired Batches", value: st.expiredBatches ?? 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Near Expiry (30d)", value: st.nearExpiryBatches ?? 0, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Expired Value", value: inr(st.expiredValue), icon: TrendingDown, color: "text-red-600" },
    { label: "Near Expiry Value", value: inr(st.nearExpiryValue), icon: AlertTriangle, color: "text-orange-600" },
    { label: "Slow Moving", value: st.slowMoving ?? 0, icon: Package, color: "text-muted-foreground" },
    { label: "NDPS Sales Today", value: c.ndpsSalesCount ?? 0, icon: ShieldAlert, color: "text-red-700" },
    { label: "High Discount Bills", value: c.highDiscountBills ?? 0, icon: Percent, color: "text-yellow-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pharmacy Dashboard</h2>
        <p className="text-muted-foreground text-sm">Today: {dash?.today} · Live metrics updated every minute</p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Today's Sales</h3>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Stock & Compliance</h3>
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {stockKpis.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="pb-1 pt-3 px-4 flex flex-row items-center justify-between">
                <CardTitle className="text-xs text-muted-foreground font-medium">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {(dash?.top10?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Medicines by Quantity (Today)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">Qty Sold</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.top10.map((m: any, i: number) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-muted-foreground w-8">{i + 1}</TableCell>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.qty}</TableCell>
                    <TableCell className="text-right font-medium">{inr(m.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dash?.top10?.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No sales recorded today yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
