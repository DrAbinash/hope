import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, Printer, Wallet, Receipt, AlertCircle } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-04-01`;
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DepartmentRevenuePage() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/department-revenue", from, to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/department-revenue?fromDate=${from}&toDate=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { bills: 0, billed: 0, collected: 0, due: 0 };

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Building2 className="h-6 w-6" /> Department-wise Revenue</h2>
        <p className="text-muted-foreground text-sm">Revenue and collections grouped by clinical department, attributed via consulting doctor (OPD/IPD), invoice type (standalone), or pharmacy.</p>
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
            <p className="md:col-span-2 text-xs text-muted-foreground">FY default (Apr 1 → today). Range capped at 366 days.</p>
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
        <h1 className="text-xl font-bold">CarePlus HMS</h1>
        <h2 className="text-base font-semibold">Department-wise Revenue</h2>
        <p className="text-xs">{from} to {to}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Receipt className="h-3 w-3" />Bills</p><p className="text-2xl font-bold">{t.bills}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" />Total Billed</p><p className="text-xl font-bold text-emerald-600">{fmt(t.billed)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-blue-600">{fmt(t.collected)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground flex items-center gap-1"><AlertCircle className="h-3 w-3" />Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="print:hidden"><CardTitle>By Department — {data?.count ?? 0} groups</CardTitle></CardHeader>
        <CardContent>
          {error && <p className="text-rose-600 text-sm mb-2">{(error as Error).message}</p>}
          <Table>
            <TableHeader><TableRow>
              <TableHead>Department</TableHead>
              <TableHead className="text-right">Bills</TableHead>
              <TableHead className="text-right">Billed</TableHead>
              <TableHead className="text-right">Collected</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data?.rows || []).map((r: any) => (
                <TableRow key={r.department}>
                  <TableCell className="font-medium">{r.department}</TableCell>
                  <TableCell className="text-right">{r.bills}</TableCell>
                  <TableCell className="text-right text-emerald-700 font-semibold">{fmt(r.billed)}</TableCell>
                  <TableCell className="text-right text-blue-700">{fmt(r.collected)}</TableCell>
                  <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                  <TableCell className="text-right font-mono">{Number(r.sharePct ?? 0).toFixed(1)}%</TableCell>
                </TableRow>
              ))}
              {!isLoading && (data?.rows || []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No revenue in range.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground mt-3">
            Attribution rules: OPD/IPD invoices use the consulting doctor&apos;s <span className="font-mono">department</span>; standalone Pathology / Radiology / OT invoices map to their service department; pharmacy_sales aggregate to <span className="font-mono">Pharmacy</span>. OPD/IPD bills with an unknown doctor fall into <span className="font-mono">OPD/IPD (Unknown)</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
