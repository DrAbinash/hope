import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Download, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export default function ReorderSuggestionsPage() {
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["reorder-suggestions"],
    queryFn: () => j("/api/pharmacy/reorder-suggestions"),
    refetchInterval: 120000,
  });

  const items: any[] = (data?.items || []).filter((m: any) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.genericName || "").toLowerCase().includes(search.toLowerCase())
  );

  const criticalItems = items.filter(m => (m.daysToStockout ?? 999) <= 3);
  const urgentItems = items.filter(m => m.daysToStockout !== null && m.daysToStockout > 3 && m.daysToStockout <= 7);

  const exportCsv = () => {
    const header = "Medicine,Generic,Stock,Reorder Level,Max Stock,Suggested Qty,Avg Daily,Stockout Date,Purchase Rate\n";
    const rows = items.map(m =>
      `"${m.name}","${m.genericName || ""}",${m.stock},${m.reorderLevel},${m.maxStock},${m.suggestedQty},${m.avgDailyConsumption},"${m.stockoutDate || "N/A"}","${m.purchaseRate || "N/A"}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "reorder_suggestions.csv";
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <TrendingDown className="h-6 w-6 text-yellow-600" />Reorder Suggestions
          </h2>
          <p className="text-muted-foreground text-sm">Stock intelligence · Predicted stockout dates · Purchase suggestions</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">Total Below Reorder</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-yellow-600">{data?.total ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">Critical (≤ 3 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-red-600">{criticalItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs text-muted-foreground">Urgent (4–7 days)</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-orange-600">{urgentItems.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-4 pb-0">
          <Input placeholder="Search medicine…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm w-64" />
        </CardContent>
        <CardContent className="p-0 mt-3">
          {isLoading ? <Skeleton className="h-40 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Generic / Strength</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder Lvl</TableHead>
                  <TableHead className="text-right">Max Stock</TableHead>
                  <TableHead className="text-right">Suggested Qty</TableHead>
                  <TableHead className="text-right">Avg Daily</TableHead>
                  <TableHead>Predicted Stockout</TableHead>
                  <TableHead className="text-right">Purchase Rate</TableHead>
                  <TableHead>Schedule</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-10">
                    {data?.total === 0 ? "All medicines are above reorder level." : "No items match your search."}
                  </TableCell></TableRow>
                )}
                {items.map((m: any) => {
                  const isCritical = (m.daysToStockout ?? 999) <= 3;
                  const isUrgent = m.daysToStockout !== null && m.daysToStockout > 3 && m.daysToStockout <= 7;
                  return (
                    <TableRow key={m.id} className={isCritical ? "bg-red-50" : isUrgent ? "bg-orange-50" : ""}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1">
                          {isCritical && <AlertTriangle className="h-3 w-3 text-red-600 flex-shrink-0" />}
                          {m.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {m.genericName || "—"}{m.strength ? ` · ${m.strength}` : ""}
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${isCritical ? "text-red-600" : isUrgent ? "text-orange-600" : "text-yellow-600"}`}>
                        {m.stock}
                      </TableCell>
                      <TableCell className="text-right text-sm">{m.reorderLevel}</TableCell>
                      <TableCell className="text-right text-sm">{m.maxStock}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-700">{m.suggestedQty}</TableCell>
                      <TableCell className="text-right text-sm">{m.avgDailyConsumption > 0 ? m.avgDailyConsumption : "—"}</TableCell>
                      <TableCell>
                        {m.stockoutDate ? (
                          <div>
                            <p className={`text-sm font-medium ${isCritical ? "text-red-600" : isUrgent ? "text-orange-600" : "text-gray-700"}`}>{m.stockoutDate}</p>
                            <p className="text-xs text-muted-foreground">{m.daysToStockout} days</p>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">N/A</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{m.purchaseRate ? inr(m.purchaseRate) : "—"}</TableCell>
                      <TableCell>
                        {m.scheduleType && m.scheduleType !== "general" && (
                          <Badge variant="outline" className="text-xs">{m.scheduleType.replace("_", " ").toUpperCase()}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
