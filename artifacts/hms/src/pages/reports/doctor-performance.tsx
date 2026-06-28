import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Activity, Printer, Stethoscope, BedDouble, Wallet, Users } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-04-01`;
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt1 = (n: any) => Number(n ?? 0).toFixed(1);

export default function DoctorPerformancePage() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const [docId, setDocId] = useState("");
  const params = new URLSearchParams({ fromDate: from, toDate: to });
  if (docId.trim()) params.set("doctorId", docId.trim());

  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/doctor-performance", params.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/reports/doctor-performance?${params.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });

  const t = data?.totals || { doctors: 0, opdVisits: 0, ipdAdmissions: 0, consultFees: 0, totalBilled: 0, totalCollected: 0 };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Activity className="h-6 w-6" /> Doctor Performance</h2>
        <p className="text-muted-foreground text-sm">Per-doctor productivity: OPD visits, IPD admissions, average LOS, invoice revenue billed and collected.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
          <CardTitle>Filters</CardTitle>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
            <div><Label>Doctor ID (optional)</Label><Input type="number" placeholder="Filter by doctor" value={docId} onChange={e => setDocId(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">FY default (Apr 1 → today). Range capped at 366 days.</p>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
        <h1 className="text-xl font-bold">CarePlus HMS</h1>
        <h2 className="text-base font-semibold">Doctor Performance Report</h2>
        <p className="text-xs">{from} to {to}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Doctors</p><p className="text-2xl font-bold">{t.doctors}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Stethoscope className="h-3 w-3" />OPD Visits</p><p className="text-2xl font-bold">{t.opdVisits}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><BedDouble className="h-3 w-3" />IPD Admissions</p><p className="text-2xl font-bold">{t.ipdAdmissions}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Consult Fees</p><p className="text-xl font-bold">{fmt(t.consultFees)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Total Billed</p><p className="text-xl font-bold text-emerald-600">{fmt(t.totalBilled)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Collected</p><p className="text-xl font-bold text-blue-600">{fmt(t.totalCollected)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="print:hidden"><CardTitle>Per-Doctor Productivity — {data?.count ?? 0} doctors</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="text-rose-600 text-sm mb-2">{(error as Error).message}</p>}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">OPD Visits</TableHead>
                <TableHead className="text-right">Completed</TableHead>
                <TableHead className="text-right">Converted→IPD</TableHead>
                <TableHead className="text-right">Consult Fees</TableHead>
                <TableHead className="text-right">IPD Admis.</TableHead>
                <TableHead className="text-right">Active</TableHead>
                <TableHead className="text-right">Avg LOS (d)</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Rev/Visit</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data?.rows || []).map((r: any) => (
                  <TableRow key={r.doctorId}>
                    <TableCell className="font-medium">{r.doctorName}<div className="text-xs text-muted-foreground">#{r.doctorId}{r.designation ? ` · ${r.designation}` : ""}</div></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.department || "—"}</TableCell>
                    <TableCell className="text-right">{r.opdVisits}</TableCell>
                    <TableCell className="text-right">{r.opdCompleted}</TableCell>
                    <TableCell className="text-right">{r.opdConverted}</TableCell>
                    <TableCell className="text-right">{fmt(r.consultFees)}</TableCell>
                    <TableCell className="text-right">{r.ipdAdmissions}</TableCell>
                    <TableCell className="text-right">{r.ipdActive}</TableCell>
                    <TableCell className="text-right">{fmt1(r.avgLos)}</TableCell>
                    <TableCell className="text-right text-emerald-700 font-semibold">{fmt(r.totalBilled)}</TableCell>
                    <TableCell className="text-right text-blue-700">{fmt(r.totalCollected)}</TableCell>
                    <TableCell className="text-right">{fmt(r.revenuePerVisit)}</TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data?.rows || []).length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center py-6 text-muted-foreground">No doctor activity in range.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Note: Revenue rows attribute invoices via <span className="font-mono">opd_visit_id</span> / <span className="font-mono">ipd_admission_id</span>; standalone invoices (Pathology / OT / pharmacy) are not credited to a single doctor and appear in Finance Reports instead.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
