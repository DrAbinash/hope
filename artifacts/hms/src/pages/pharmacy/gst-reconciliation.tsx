import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calculator, Download } from "lucide-react";

function fmt(n: any) { return `₹${Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}` }

export default function GstReconciliation() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [dates, setDates] = useState({ from: firstOfMonth, to: today.toISOString().slice(0, 10) });
  const [applied, setApplied] = useState(dates);
  const [tab, setTab] = useState("summary");

  const { data: summary, isLoading } = useQuery<any>({
    queryKey: ["/api/pharmacy/gst-reconciliation", applied],
    queryFn: () => fetch(`/api/pharmacy/gst-reconciliation?from_date=${applied.from}&to_date=${applied.to}`).then(r => r.json()),
  });

  const { data: hsn = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/gst-reconciliation/hsn", applied],
    queryFn: () => fetch(`/api/pharmacy/gst-reconciliation/hsn-summary?from_date=${applied.from}&to_date=${applied.to}`).then(r => r.json()),
    enabled: tab === "hsn",
  });

  function exportCsv() {
    if (!hsn.length) return;
    const rows = [["HSN Code", "GST%", "Quantity", "Taxable Value", "CGST", "SGST", "Invoice Count"]];
    hsn.forEach((r: any) => rows.push([r.hsn_code, r.gst_percent, r.quantity, r.taxable_value, r.cgst, r.sgst, r.invoice_count]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `gst_hsn_${applied.from}_${applied.to}.csv`; a.click();
  }

  return (
    <div className="p-4 space-y-4 max-w-5xl">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-purple-600" />
        <div><h1 className="text-xl font-bold">GST Reconciliation</h1><p className="text-sm text-muted-foreground">Monthly GST audit dashboard — GSTR-style summary</p></div>
      </div>

      <Card>
        <CardContent className="pt-3 pb-2">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label className="text-xs">From</Label><Input type="date" className="h-8 w-36" value={dates.from} onChange={e => setDates(p => ({ ...p, from: e.target.value }))} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" className="h-8 w-36" value={dates.to} onChange={e => setDates(p => ({ ...p, to: e.target.value }))} /></div>
            <Button size="sm" onClick={() => setApplied(dates)}>Apply</Button>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="hsn">HSN-Wise</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4 pt-2">
          {isLoading ? <div className="py-10 text-center text-muted-foreground">Computing…</div> : summary && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm text-blue-800">Output GST (Sales)</CardTitle></CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-3xl font-bold text-blue-700">{fmt(summary.output_gst?.total)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Period: {summary.period?.from} → {summary.period?.to}</div>
                  </CardContent>
                </Card>
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm text-green-800">Input Credit (Purchases)</CardTitle></CardHeader>
                  <CardContent className="pb-3">
                    <div className="text-3xl font-bold text-green-700">{fmt(summary.input_gst?.net_input)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Purchase GST − Return Credit</div>
                  </CardContent>
                </Card>
                <Card className={`border-2 ${Number(summary.liability?.net_payable) > 0 ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
                  <CardHeader className="pb-1 pt-3"><CardTitle className="text-sm">Net GST Payable</CardTitle></CardHeader>
                  <CardContent className="pb-3">
                    <div className={`text-3xl font-bold ${Number(summary.liability?.net_payable) > 0 ? "text-amber-700" : "text-green-700"}`}>{fmt(summary.liability?.net_payable)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Output − Input Credit</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Output GST Breakdown by State Type</CardTitle></CardHeader>
                  <CardContent>
                    {summary.output_gst?.by_state_type?.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No sales in this period</p>
                    ) : summary.output_gst?.by_state_type?.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b last:border-0 text-sm">
                        <span className="capitalize font-medium">{r.gst_state_type} (Bills: {r.bill_count})</span>
                        <div className="text-right">
                          <div>CGST: {fmt(r.cgst)}</div>
                          <div>SGST: {fmt(r.sgst)}</div>
                          {Number(r.igst ?? 0) > 0 && <div>IGST: {fmt(r.igst)}</div>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2 pt-3"><CardTitle className="text-sm">Input GST Breakdown</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    {[
                      { label: "Purchase GST (Input Credit)", value: summary.input_gst?.purchase_gst, color: "text-green-700" },
                      { label: "Return GST (Credit Note)", value: summary.input_gst?.return_credit, color: "text-red-600" },
                      { label: "Net Input Credit", value: summary.input_gst?.net_input, color: "text-green-800 font-bold" },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between py-1.5 border-b last:border-0">
                        <span>{r.label}</span><span className={r.color}>{fmt(r.value)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="hsn" className="space-y-3 pt-2">
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={hsn.length === 0}><Download className="h-4 w-4 mr-1" />Export CSV</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>HSN Code</TableHead>
                  <TableHead>GST %</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Taxable Value</TableHead>
                  <TableHead>CGST</TableHead>
                  <TableHead>SGST</TableHead>
                  <TableHead>Total GST</TableHead>
                  <TableHead>Invoices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hsn.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No HSN data — check period filters</TableCell></TableRow>
                ) : hsn.map((r: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono font-semibold">{r.hsn_code}</TableCell>
                    <TableCell>{r.gst_percent}%</TableCell>
                    <TableCell>{Number(r.quantity ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{fmt(r.taxable_value)}</TableCell>
                    <TableCell>{fmt(r.cgst)}</TableCell>
                    <TableCell>{fmt(r.sgst)}</TableCell>
                    <TableCell className="font-semibold">{fmt(Number(r.cgst ?? 0) + Number(r.sgst ?? 0))}</TableCell>
                    <TableCell>{r.invoice_count}</TableCell>
                  </TableRow>
                ))}
                {hsn.length > 0 && (
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell>{fmt(hsn.reduce((s: number, r: any) => s + Number(r.taxable_value ?? 0), 0))}</TableCell>
                    <TableCell>{fmt(hsn.reduce((s: number, r: any) => s + Number(r.cgst ?? 0), 0))}</TableCell>
                    <TableCell>{fmt(hsn.reduce((s: number, r: any) => s + Number(r.sgst ?? 0), 0))}</TableCell>
                    <TableCell>{fmt(hsn.reduce((s: number, r: any) => s + Number(r.cgst ?? 0) + Number(r.sgst ?? 0), 0))}</TableCell>
                    <TableCell>{hsn.reduce((s: number, r: any) => s + Number(r.invoice_count ?? 0), 0)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
