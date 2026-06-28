import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Percent, Printer, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const yearStart = () => `${new Date().getFullYear()}-04-01`;
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PrintableHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
      <h1 className="text-xl font-bold">CarePlus HMS</h1>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs">{sub}</p>
    </div>
  );
}

function DateRangeBar({ from, to, setFrom, setTo }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
      <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      <p className="md:col-span-2 text-xs text-muted-foreground">Defaults to current Indian financial year (Apr 1 → today). Range capped at 366 days.</p>
    </div>
  );
}

function OutputGst() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/gst/output", from, to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/gst/output?fromDate=${from}&toDate=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { pharmacyBills: 0, serviceBills: 0, cgst: 0, sgst: 0, igst: 0, pharmacyGst: 0, serviceGst: 0, gstTotal: 0, grossTotal: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5" /> Output GST (Sales) — {data?.count ?? 0} months</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <PrintableHeader title="Output GST (Sales)" sub={`${from} to ${to}`} />
        {error && <p className="text-rose-600 text-sm">{(error as Error).message}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">CGST</p><p className="text-xl font-bold">{fmt(t.cgst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SGST</p><p className="text-xl font-bold">{fmt(t.sgst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">IGST</p><p className="text-xl font-bold">{fmt(t.igst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Output GST</p><p className="text-xl font-bold text-emerald-600">{fmt(t.gstTotal)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Pharmacy Bills</TableHead>
            <TableHead className="text-right">Service Bills</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Pharmacy GST</TableHead>
            <TableHead className="text-right">Service GST</TableHead>
            <TableHead className="text-right">Total GST</TableHead>
            <TableHead className="text-right">Gross</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.month}>
                <TableCell className="font-mono">{r.month}</TableCell>
                <TableCell className="text-right">{r.pharmacyBills}</TableCell>
                <TableCell className="text-right">{r.serviceBills}</TableCell>
                <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                <TableCell className="text-right">{fmt(r.pharmacyGst)}</TableCell>
                <TableCell className="text-right">{fmt(r.serviceGst)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.gstTotal)}</TableCell>
                <TableCell className="text-right">{fmt(r.grossTotal)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No sales in range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InputGst() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/gst/input", from, to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/gst/input?fromDate=${from}&toDate=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { purchases: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, gstTotal: 0, gross: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ArrowDownRight className="h-5 w-5" /> Input GST (Purchases) — {data?.count ?? 0} months</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <PrintableHeader title="Input GST (Purchases)" sub={`${from} to ${to}`} />
        {error && <p className="text-rose-600 text-sm">{(error as Error).message}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">CGST</p><p className="text-xl font-bold">{fmt(t.cgst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SGST</p><p className="text-xl font-bold">{fmt(t.sgst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">IGST</p><p className="text-xl font-bold">{fmt(t.igst)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total ITC Available</p><p className="text-xl font-bold text-blue-600">{fmt(t.gstTotal)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Purchases</TableHead>
            <TableHead className="text-right">Taxable</TableHead>
            <TableHead className="text-right">CGST</TableHead>
            <TableHead className="text-right">SGST</TableHead>
            <TableHead className="text-right">IGST</TableHead>
            <TableHead className="text-right">Total GST</TableHead>
            <TableHead className="text-right">Gross</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.month}>
                <TableCell className="font-mono">{r.month}</TableCell>
                <TableCell className="text-right">{r.purchases}</TableCell>
                <TableCell className="text-right">{fmt(r.taxable)}</TableCell>
                <TableCell className="text-right">{fmt(r.cgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.sgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.igst)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.gstTotal)}</TableCell>
                <TableCell className="text-right">{fmt(r.gross)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No purchases in range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function NetLiability() {
  const [from, setFrom] = useState(yearStart());
  const [to, setTo] = useState(today());
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/gst/liability", from, to],
    queryFn: async () => {
      const r = await fetch(`/api/reports/gst/liability?fromDate=${from}&toDate=${to}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { outTotal: 0, inTotal: 0, netTotal: 0, netCgst: 0, netSgst: 0, netIgst: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Scale className="h-5 w-5" /> Net GST Liability — {data?.count ?? 0} months</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangeBar from={from} to={to} setFrom={setFrom} setTo={setTo} />
        <PrintableHeader title="Net GST Liability" sub={`${from} to ${to}`} />
        {error && <p className="text-rose-600 text-sm">{(error as Error).message}</p>}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Output GST</p><p className="text-xl font-bold text-emerald-600">{fmt(t.outTotal)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Input GST (ITC)</p><p className="text-xl font-bold text-blue-600">{fmt(t.inTotal)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net Payable</p><p className={`text-xl font-bold ${t.netTotal >= 0 ? "text-rose-600" : "text-emerald-600"}`}>{fmt(t.netTotal)}</p></CardContent></Card>
        </div>
        <p className="text-xs text-muted-foreground border-l-2 border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 rounded">
          Note: <span className="font-semibold">Net CGST/SGST/IGST</span> reflect pharmacy GST only (since pharmacy sales carry the split).
          Service invoices currently store a single GST lump, which is included in <span className="font-semibold">Output</span>, <span className="font-semibold">Net Service</span> and <span className="font-semibold">Net Payable</span> but not in the per-tax-head split.
        </p>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Month</TableHead>
            <TableHead className="text-right">Output</TableHead>
            <TableHead className="text-right">Input (ITC)</TableHead>
            <TableHead className="text-right">Net CGST</TableHead>
            <TableHead className="text-right">Net SGST</TableHead>
            <TableHead className="text-right">Net IGST</TableHead>
            <TableHead className="text-right">Net Service</TableHead>
            <TableHead className="text-right">Net Payable</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => {
              const netService = Number(r.netTotal || 0) - (Number(r.netCgst || 0) + Number(r.netSgst || 0) + Number(r.netIgst || 0));
              return (
              <TableRow key={r.month}>
                <TableCell className="font-mono">{r.month}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.outTotal)}</TableCell>
                <TableCell className="text-right text-blue-700">{fmt(r.inTotal)}</TableCell>
                <TableCell className="text-right">{fmt(r.netCgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.netSgst)}</TableCell>
                <TableCell className="text-right">{fmt(r.netIgst)}</TableCell>
                <TableCell className="text-right">{fmt(netService)}</TableCell>
                <TableCell className={`text-right font-semibold ${Number(r.netTotal) >= 0 ? "text-rose-700" : "text-emerald-700"}`}>{fmt(r.netTotal)}</TableCell>
              </TableRow>
            );})}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No GST activity in range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function GstReportsPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Percent className="h-6 w-6" /> GST Summary</h2>
        <p className="text-muted-foreground text-sm">Month-wise output GST (sales), input GST (purchases), and net liability with CGST/SGST/IGST split.</p>
      </div>
      <Tabs defaultValue="output">
        <TabsList className="print:hidden">
          <TabsTrigger value="output"><ArrowUpRight className="h-4 w-4 mr-2" />Output (Sales)</TabsTrigger>
          <TabsTrigger value="input"><ArrowDownRight className="h-4 w-4 mr-2" />Input (Purchases)</TabsTrigger>
          <TabsTrigger value="liability"><Scale className="h-4 w-4 mr-2" />Net Liability</TabsTrigger>
        </TabsList>
        <TabsContent value="output" className="mt-4"><OutputGst /></TabsContent>
        <TabsContent value="input" className="mt-4"><InputGst /></TabsContent>
        <TabsContent value="liability" className="mt-4"><NetLiability /></TabsContent>
      </Tabs>
    </div>
  );
}
