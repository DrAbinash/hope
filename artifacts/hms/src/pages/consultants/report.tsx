import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Printer } from "lucide-react";

export default function ConsultantReport() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["/api/consultant-engagements/report", dateFrom, dateTo],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const r = await fetch(`/api/consultant-engagements/report/by-consultant?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ rows: any[] }>;
    },
  });

  const rows = data?.rows || [];
  const totals = rows.reduce((acc, r: any) => {
    acc.cases += Number(r.cases) || 0;
    acc.totalServices += Number(r.totalServices) || 0;
    acc.totalPayout += Number(r.totalPayout) || 0;
    acc.pendingPayout += Number(r.pendingPayout) || 0;
    acc.paidPayout += Number(r.paidPayout) || 0;
    return acc;
  }, { cases: 0, totalServices: 0, totalPayout: 0, pendingPayout: 0, paidPayout: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6"/> Consultant Payout Report</h1>
          <p className="text-muted-foreground text-sm">Consultant-wise summary of services and payouts.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/consultants"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button></Link>
          <Button variant="outline" onClick={() => window.print()}><Printer className="w-4 h-4 mr-1"/>Print</Button>
        </div>
      </div>

      <Card className="print:hidden"><CardContent className="p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><Label>From</Label><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}/></div>
          <div><Label>To</Label><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}/></div>
          {(dateFrom || dateTo) ? <Button variant="ghost" onClick={() => { setDateFrom(""); setDateTo(""); }}>Clear</Button> : null}
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-4">
        <div className="hidden print:block mb-3">
          <h2 className="text-lg font-semibold">Consultant Payout Report</h2>
          <div className="text-xs text-muted-foreground">{dateFrom || dateTo ? `Period: ${dateFrom || "—"} to ${dateTo || "—"}` : "All time"}</div>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Consultant</TableHead>
            <TableHead>Specialization</TableHead>
            <TableHead>Basis</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Services Total</TableHead>
            <TableHead className="text-right">Total Payout</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Paid</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No data for the selected range.</TableCell></TableRow>
              : rows.map((r: any) => (
                <TableRow key={r.consultantId}>
                  <TableCell className="font-medium">{r.consultantName}</TableCell>
                  <TableCell>{r.specialization || "—"}</TableCell>
                  <TableCell>{r.paymentType === "percentage" ? `${Number(r.paymentValue).toFixed(2)}%` : `₹${Number(r.paymentValue).toLocaleString("en-IN")} fixed`}</TableCell>
                  <TableCell className="text-right">{r.cases}</TableCell>
                  <TableCell className="text-right">₹{Number(r.totalServices).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(r.totalPayout).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-amber-700">₹{Number(r.pendingPayout).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-emerald-700">₹{Number(r.paidPayout).toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
          </TableBody>
          {rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{totals.cases}</TableCell>
                <TableCell className="text-right font-semibold">₹{totals.totalServices.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold">₹{totals.totalPayout.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold text-amber-700">₹{totals.pendingPayout.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">₹{totals.paidPayout.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </CardContent></Card>
    </div>
  );
}
