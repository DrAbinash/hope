import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, Printer } from "lucide-react";

export default function ReferralReport() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const { data, isLoading } = useQuery({
    queryKey: ["/api/referral-payouts/report", dateFrom, dateTo],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const r = await fetch(`/api/referral-payouts/report/by-doctor?${qs}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ rows: any[] }>;
    },
  });

  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const totals = rows.reduce((acc, r: any) => {
    acc.cases += Number(r.cases) || 0;
    acc.totalServices += Number(r.totalServices) || 0;
    acc.totalShare += Number(r.totalShare) || 0;
    acc.pendingShare += Number(r.pendingShare) || 0;
    acc.paidShare += Number(r.paidShare) || 0;
    return acc;
  }, { cases: 0, totalServices: 0, totalShare: 0, pendingShare: 0, paidShare: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><BarChart3 className="w-6 h-6"/> Referral Doctor Share Report</h1>
          <p className="text-muted-foreground text-sm">Doctor-wise summary of services billed and shares earned.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/referrals"><Button variant="outline"><ArrowLeft className="w-4 h-4 mr-1"/>Back</Button></Link>
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
          <h2 className="text-lg font-semibold">Referral Doctor Share Report</h2>
          <div className="text-xs text-muted-foreground">
            {dateFrom || dateTo ? `Period: ${dateFrom || "—"} to ${dateTo || "—"}` : "All time"}
          </div>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Doctor</TableHead>
            <TableHead>Specialization</TableHead>
            <TableHead>Basis</TableHead>
            <TableHead className="text-right">Cases</TableHead>
            <TableHead className="text-right">Services Total</TableHead>
            <TableHead className="text-right">Total Share</TableHead>
            <TableHead className="text-right">Pending</TableHead>
            <TableHead className="text-right">Paid</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No data for the selected range.</TableCell></TableRow>
              : rows.map((r: any) => (
                <TableRow key={r.referralDoctorId}>
                  <TableCell className="font-medium">{r.doctorName}</TableCell>
                  <TableCell>{r.specialization || "—"}</TableCell>
                  <TableCell>{r.paymentType === "percentage" ? `${Number(r.paymentValue).toFixed(2)}%` : `₹${Number(r.paymentValue).toLocaleString("en-IN")} fixed`}</TableCell>
                  <TableCell className="text-right">{r.cases}</TableCell>
                  <TableCell className="text-right">₹{Number(r.totalServices).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right font-medium">₹{Number(r.totalShare).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-amber-700">₹{Number(r.pendingShare).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right text-emerald-700">₹{Number(r.paidShare).toLocaleString("en-IN")}</TableCell>
                </TableRow>
              ))}
          </TableBody>
          {rows.length > 0 ? (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={3} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{totals.cases}</TableCell>
                <TableCell className="text-right font-semibold">₹{totals.totalServices.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold">₹{totals.totalShare.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold text-amber-700">₹{totals.pendingShare.toLocaleString("en-IN")}</TableCell>
                <TableCell className="text-right font-semibold text-emerald-700">₹{totals.paidShare.toLocaleString("en-IN")}</TableCell>
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </CardContent></Card>
    </div>
  );
}
