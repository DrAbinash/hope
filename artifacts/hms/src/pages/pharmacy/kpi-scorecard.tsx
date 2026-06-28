import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Award, TrendingUp, TrendingDown, IndianRupee, Package, AlertTriangle, RotateCcw, Calendar } from "lucide-react";

export default function KpiScorecardPage() {
  const [data, setData] = useState<any>(null);
  const [trend, setTrend] = useState<any[]>([]);
  const [days, setDays] = useState(30);

  useEffect(() => { load(); }, [days]);
  async function load() {
    const [d, t] = await Promise.all([
      fetch(`/api/pharmacy/kpi-scorecard?days=${days}`, { credentials: "include" }).then(r => r.json()),
      fetch(`/api/pharmacy/kpi-scorecard/trend?days=${days}`, { credentials: "include" }).then(r => r.json()),
    ]);
    setData(d);
    setTrend(Array.isArray(t) ? t.map(x => ({ ...x, day: x.day?.slice(5), sales_value: Number(x.sales_value) })) : []);
  }

  if (!data) return <div className="p-6">Loading...</div>;
  const k = data.kpis || {};

  const kpiCards = [
    { label: "Avg Daily Sales", value: `₹${Number(k.avg_daily_sales || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}`, icon: IndianRupee, color: "text-green-600", trend: "up" },
    { label: "Inventory Turnover (annual)", value: `${k.inventory_turnover_annual || 0}x`, icon: TrendingUp, color: "text-blue-600", hint: k.inventory_turnover_annual > 6 ? "Healthy" : "Low" },
    { label: "Days of Inventory", value: `${k.days_of_inventory || 0} days`, icon: Calendar, color: "text-purple-600", hint: k.days_of_inventory < 45 ? "Good" : "Heavy stock" },
    { label: "Stock-out %", value: `${k.stockout_pct || 0}%`, icon: AlertTriangle, color: k.stockout_pct > 5 ? "text-red-600" : "text-green-600", hint: k.stockout_pct > 5 ? "High" : "OK" },
    { label: "Expiry Loss %", value: `${k.expiry_loss_pct || 0}%`, icon: TrendingDown, color: k.expiry_loss_pct > 2 ? "text-red-600" : "text-green-600", hint: k.expiry_loss_pct > 2 ? "Action needed" : "Good" },
    { label: "Return Rate %", value: `${k.return_rate_pct || 0}%`, icon: RotateCcw, color: k.return_rate_pct > 3 ? "text-amber-600" : "text-green-600" },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6" /> Pharmacy KPI Scorecard</h1>
        <div className="flex gap-2">
          {[7, 30, 90, 180].map(d => (
            <Button key={d} size="sm" variant={days === d ? "default" : "outline"} onClick={() => setDays(d)} data-testid={`kpi-period-${d}`}>{d}d</Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpiCards.map(k => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{k.label}</span>
                  <Icon className={`h-4 w-4 ${k.color}`} />
                </div>
                <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                {k.hint && <Badge variant="outline" className="mt-1 text-xs">{k.hint}</Badge>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Sales Mix</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total Sales</span><span className="font-bold">₹{Number(data.sales?.total_sales || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Cash Sales</span><span>₹{Number(data.sales?.cash_sales || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Credit Sales</span><span>₹{Number(data.sales?.credit_sales || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Bills</span><span>{Number(data.sales?.sale_count || 0)}</span></div>
            <div className="flex justify-between"><span>Avg Ticket</span><span>₹{Number(data.sales?.avg_ticket_value || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Package className="h-4 w-4" /> Stock Health</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total SKUs</span><span className="font-bold">{Number(data.stock?.total_skus || 0)}</span></div>
            <div className="flex justify-between"><span>Stock Value</span><span>₹{Number(data.stock?.stock_value || 0).toLocaleString()}</span></div>
            <div className="flex justify-between text-red-600"><span>Stock-out SKUs</span><span>{Number(data.stock?.stockout_skus || 0)}</span></div>
            <div className="flex justify-between text-amber-600"><span>Near-expiry (90d)</span><span>{Number(data.stock?.near_expiry_skus || 0)}</span></div>
            <div className="flex justify-between text-red-700"><span>Expired SKUs</span><span>{Number(data.stock?.expired_skus || 0)}</span></div>
            <div className="flex justify-between"><span>Expiry Loss ₹</span><span className="font-bold text-red-700">₹{Number(data.expiry_loss_value || 0).toLocaleString()}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Purchases & Returns</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span>GRN Count</span><span>{Number(data.grn?.grn_count || 0)}</span></div>
            <div className="flex justify-between"><span>Purchase Value</span><span>₹{Number(data.grn?.purchase_value || 0).toLocaleString()}</span></div>
            <div className="flex justify-between"><span>Returns Count</span><span>{Number(data.returns?.return_count || 0)}</span></div>
            <div className="flex justify-between"><span>Returns Value</span><span>₹{Math.abs(Number(data.returns?.return_value || 0)).toLocaleString()}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Daily Sales Trend ({days} days)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
              <Line type="monotone" dataKey="sales_value" stroke="#0e7490" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
