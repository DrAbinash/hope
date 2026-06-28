import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Coins, ListChecks, Stethoscope, Receipt, Printer } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const INV_TYPES = ["OPD", "IPD", "Pharmacy", "Pathology", "Radiology", "Other"];
const MODES = ["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Insurance"];

function PrintableHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
      <h1 className="text-xl font-bold">CarePlus HMS</h1>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs">{sub}</p>
    </div>
  );
}

function DailyService() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/finance/daily-service", from, to, type, q],
    queryFn: async () => {
      const u = new URL("/api/reports/finance/daily-service", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (type) u.searchParams.set("type", type);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { qty: 0, amount: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ListChecks className="h-5 w-5" /> Daily Service Report — {data?.count ?? 0} rows</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Invoice Type</Label>
            <Select value={type || "all"} onValueChange={v => setType(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All types</SelectItem>{INV_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Search</Label><Input placeholder="Service / code" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Daily Service Report" sub={`${from} to ${to}${type ? ` · ${type}` : ""}`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Rows</p><p className="text-xl font-bold">{data?.count ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Quantity</p><p className="text-xl font-bold">{Number(t.qty || 0)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Revenue</p><p className="text-xl font-bold">{fmt(t.amount)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Service</TableHead><TableHead>Code</TableHead>
            <TableHead className="text-right">Bills</TableHead><TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell>{r.date}</TableCell>
                <TableCell className="font-medium">{r.service}</TableCell>
                <TableCell className="font-mono text-xs">{r.code || "—"}</TableCell>
                <TableCell className="text-right">{r.bill_count}</TableCell>
                <TableCell className="text-right">{Number(r.qty || 0)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.amount)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No services billed in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DoctorWise() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const { data: doctors } = useQuery<any[]>({
    queryKey: ["/api/reports/finance/doctors"],
    queryFn: async () => {
      const r = await fetch("/api/reports/finance/doctors", { credentials: "include" });
      return r.ok ? r.json() : [];
    },
  });
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/finance/doctor-wise", from, to, doctorId],
    queryFn: async () => {
      const u = new URL("/api/reports/finance/doctor-wise", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (doctorId) u.searchParams.set("doctorId", doctorId);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { bills: 0, patients: 0, billed: 0, paid: 0, due: 0 };
  const services = data?.services || [];
  const servicesByDoctor: Record<string, any[]> = {};
  for (const s of services) {
    const k = String(s.doctor_id);
    (servicesByDoctor[k] ??= []).push(s);
  }
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" /> Doctor-Wise Service Taken — {data?.count ?? 0} doctors</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Doctor</Label>
            <Select value={doctorId || "all"} onValueChange={v => setDoctorId(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All doctors</SelectItem>
                {(doctors || []).map((d: any) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <PrintableHeader title="Doctor-Wise Service Taken" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-5 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Doctors</p><p className="text-xl font-bold">{data?.count ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bills</p><p className="text-xl font-bold">{t.bills}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Patients</p><p className="text-xl font-bold">{t.patients}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Billed</p><p className="text-xl font-bold">{fmt(t.billed)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-emerald-600">{fmt(t.paid)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Doctor</TableHead><TableHead className="text-right">Bills</TableHead>
            <TableHead className="text-right">Patients</TableHead>
            <TableHead className="text-right">Billed</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead>Top services</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.doctors || []).map((d: any) => (
              <TableRow key={d.doctor_id}>
                <TableCell className="font-medium">{d.doctor_name || `#${d.doctor_id}`}</TableCell>
                <TableCell className="text-right">{d.bills}</TableCell>
                <TableCell className="text-right">{d.patients}</TableCell>
                <TableCell className="text-right">{fmt(d.billed)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(d.paid)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(d.due)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(servicesByDoctor[String(d.doctor_id)] || []).slice(0, 3).map((s: any, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs">{s.service} · {fmt(s.amount)}</Badge>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.doctors || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No doctor-attributed bills in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReceiptDetails() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [mode, setMode] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/finance/receipts", from, to, mode, type, q],
    queryFn: async () => {
      const u = new URL("/api/reports/finance/receipts", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (mode) u.searchParams.set("mode", mode);
      if (type) u.searchParams.set("type", type);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { billed: 0, collected: 0, due: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> Receipt Details — {data?.count ?? 0}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Mode</Label>
            <Select value={mode || "all"} onValueChange={v => setMode(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Type</Label>
            <Select value={type || "all"} onValueChange={v => setType(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem>{INV_TYPES.map(x => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Search</Label><Input placeholder="Patient / UHID / Bill" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Receipt Details" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Receipts</p><p className="text-xl font-bold">{data?.count ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Collected</p><p className="text-xl font-bold text-emerald-600">{fmt(t.collected)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        {Object.keys(data?.byMode || {}).length > 0 && (
          <div className="text-sm flex flex-wrap gap-2 print:hidden">
            <span className="text-muted-foreground">By mode:</span>
            {Object.entries(data.byMode).map(([m, v]: any) => <Badge key={m} variant="outline">{m}: {fmt(v)}</Badge>)}
            <span className="text-muted-foreground ml-2">By type:</span>
            {Object.entries(data.byType || {}).map(([m, v]: any) => <Badge key={m} variant="secondary">{m}: {fmt(v)}</Badge>)}
          </div>
        )}
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bill No.</TableHead><TableHead>Date</TableHead><TableHead>Type</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead>Mode</TableHead><TableHead>Collected By</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                <TableCell>{r.invoiceDate}</TableCell>
                <TableCell><Badge variant="outline">{r.type}</Badge></TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell className="text-right">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.paid)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell>{r.mode || "—"}</TableCell>
                <TableCell>{r.collectedBy || "—"}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No receipts in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function FinanceReportsPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Coins className="h-6 w-6" /> Finance Reports</h2>
        <p className="text-muted-foreground text-sm">Daily service mix, doctor-wise service revenue, and receipt details.</p>
      </div>
      <Tabs defaultValue="daily">
        <TabsList className="print:hidden">
          <TabsTrigger value="daily"><ListChecks className="h-4 w-4 mr-2" />Daily Service</TabsTrigger>
          <TabsTrigger value="doctor"><Stethoscope className="h-4 w-4 mr-2" />Doctor-Wise</TabsTrigger>
          <TabsTrigger value="receipts"><Receipt className="h-4 w-4 mr-2" />Receipts</TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4"><DailyService /></TabsContent>
        <TabsContent value="doctor" className="mt-4"><DoctorWise /></TabsContent>
        <TabsContent value="receipts" className="mt-4"><ReceiptDetails /></TabsContent>
      </Tabs>
    </div>
  );
}
