import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { RefreshCcw, Thermometer } from "lucide-react";

const HEAT_META: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  green:  { label: "Adequate Stock",    bg: "bg-green-100",  text: "text-green-900",  border: "border-green-300",  dot: "bg-green-500" },
  yellow: { label: "Low Stock",         bg: "bg-yellow-100", text: "text-yellow-900", border: "border-yellow-400", dot: "bg-yellow-500" },
  orange: { label: "Near Expiry",       bg: "bg-orange-100", text: "text-orange-900", border: "border-orange-400", dot: "bg-orange-500" },
  red:    { label: "Critical Shortage", bg: "bg-red-100",    text: "text-red-900",    border: "border-red-400",    dot: "bg-red-600" },
  blue:   { label: "Overstock",         bg: "bg-blue-100",   text: "text-blue-900",   border: "border-blue-400",   dot: "bg-blue-500" },
  black:  { label: "Expired",           bg: "bg-gray-900",   text: "text-gray-100",   border: "border-gray-700",   dot: "bg-gray-700" },
};

export default function StockHeatmap() {
  const [filter, setFilter] = useState({ category: "", heat_status: "" });
  const [view, setView] = useState<"grid" | "list">("grid");

  const params = new URLSearchParams();
  if (filter.category) params.set("category", filter.category);

  const { data, isLoading, refetch } = useQuery<{ summary: any; items: any[] }>({
    queryKey: ["/api/pharmacy/stock-heatmap", filter.category],
    queryFn: () => fetch(`/api/pharmacy/stock-heatmap?${params}`).then(r => r.json()),
    refetchInterval: 60000,
  });

  const items = (data?.items ?? []).filter(x => !filter.heat_status || x.heat_status === filter.heat_status);
  const summary = data?.summary;

  const categories = [...new Set((data?.items ?? []).map((x: any) => x.category).filter(Boolean))].sort();

  return (
    <TooltipProvider>
      <div className="p-4 space-y-4 max-w-7xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Thermometer className="h-6 w-6 text-orange-600" />
            <div><h1 className="text-xl font-bold">Stock Heatmap</h1><p className="text-sm text-muted-foreground">Visual stock risk overview — live, refreshes every 60s</p></div>
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}><RefreshCcw className="h-4 w-4 mr-1" />Refresh</Button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(HEAT_META).map(([k, v]) => (
            <button key={k}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${filter.heat_status === k ? `${v.bg} ${v.border} ${v.text} ring-2 ring-offset-1` : "bg-white border-gray-200 hover:border-gray-400"}`}
              onClick={() => setFilter(p => ({ ...p, heat_status: p.heat_status === k ? "" : k }))}>
              <span className={`h-2 w-2 rounded-full ${v.dot}`} />
              {v.label}
              {summary && <span className="ml-1 font-bold">{summary[k] ?? 0}</span>}
            </button>
          ))}
          {filter.heat_status && <button onClick={() => setFilter(p => ({ ...p, heat_status: "" }))} className="text-xs text-muted-foreground hover:text-foreground px-2">Clear ✕</button>}
        </div>

        {summary && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Object.entries(HEAT_META).map(([k, v]) => (
              <Card key={k} className={`${v.bg} border-2 ${v.border} cursor-pointer`} onClick={() => setFilter(p => ({ ...p, heat_status: p.heat_status === k ? "" : k }))}>
                <CardContent className="pt-2 pb-2 text-center">
                  <div className={`text-2xl font-bold ${v.text}`}>{summary[k] ?? 0}</div>
                  <div className={`text-xs ${v.text} opacity-80`}>{v.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">Category</Label>
            <Select value={filter.category} onValueChange={v => setFilter(p => ({ ...p, category: v === "all" ? "" : v }))}>
              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="All Categories" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant={view === "grid" ? "default" : "outline"} onClick={() => setView("grid")}>Grid</Button>
            <Button size="sm" variant={view === "list" ? "default" : "outline"} onClick={() => setView("list")}>List</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-muted-foreground">Loading stock data…</div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">No medicines match your filter</div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
            {items.map((m: any) => {
              const meta = HEAT_META[m.heat_status] ?? HEAT_META.green;
              return (
                <Tooltip key={m.id}>
                  <TooltipTrigger>
                    <div className={`p-2 rounded-lg border-2 ${meta.bg} ${meta.border} text-left cursor-default hover:shadow-md transition-shadow`}>
                      <div className={`text-xs font-semibold leading-tight ${meta.text} line-clamp-2`}>{m.name}</div>
                      <div className={`text-lg font-bold mt-1 ${meta.text}`}>{m.stock}</div>
                      {m.rack_location && <div className={`text-xs opacity-60 ${meta.text}`}>{m.rack_location}</div>}
                      {m.lasa_flag && <Badge className="bg-purple-100 text-purple-800 text-xs mt-0.5 px-1">LASA</Badge>}
                      {m.high_alert_flag && <Badge variant="destructive" className="text-xs mt-0.5 px-1">HIGH</Badge>}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64 text-xs space-y-1">
                    <div className="font-semibold">{m.name}</div>
                    <div>Category: {m.category ?? "—"} | Formulation: {m.formulation ?? "—"}</div>
                    <div>Stock: {m.stock} | Reorder: {m.reorder_level} | Min: {m.min_stock} | Max: {m.max_stock}</div>
                    <div>MRP: ₹{m.mrp} | Purchase: ₹{m.purchase_rate}</div>
                    <div>Stock Value: ₹{Number(m.stock_value ?? 0).toLocaleString("en-IN")}</div>
                    {m.nearest_expiry && <div>Nearest Expiry: {m.nearest_expiry}</div>}
                    {m.rack_location && <div>Location: {m.rack_location} / {m.shelf_location}</div>}
                    <div className={`font-bold ${meta.text}`}>{meta.label}</div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  {["Status", "Medicine", "Category", "Stock", "Reorder", "MRP", "Expiry", "Value", "Location"].map(h => (
                    <th key={h} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {items.map((m: any) => {
                    const meta = HEAT_META[m.heat_status] ?? HEAT_META.green;
                    return (
                      <tr key={m.id} className="border-b hover:bg-muted/20">
                        <td className="px-3 py-1.5"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${meta.bg} ${meta.text}`}>{meta.label}</span></td>
                        <td className="px-3 py-1.5 font-medium max-w-48 truncate">{m.name}{m.lasa_flag && <Badge className="ml-1 bg-purple-100 text-purple-800 text-xs px-1">LASA</Badge>}{m.high_alert_flag && <Badge className="ml-1 bg-red-100 text-red-800 text-xs px-1">HIGH</Badge>}</td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.category ?? "—"}</td>
                        <td className="px-3 py-1.5 font-bold">{m.stock}</td>
                        <td className="px-3 py-1.5 text-xs">{m.reorder_level}</td>
                        <td className="px-3 py-1.5 text-xs">₹{m.mrp}</td>
                        <td className="px-3 py-1.5 text-xs">{m.nearest_expiry ?? "—"}</td>
                        <td className="px-3 py-1.5 text-xs">₹{Number(m.stock_value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</td>
                        <td className="px-3 py-1.5 text-xs">{m.rack_location ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {summary?.total_value !== undefined && (
          <div className="flex justify-end text-sm text-muted-foreground">
            Total Stock Value: <span className="font-bold text-foreground ml-1">₹{Number(summary.total_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
