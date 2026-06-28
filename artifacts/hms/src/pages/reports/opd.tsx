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
import { Stethoscope, Receipt, Users, ArrowRightLeft, Printer } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function useDoctors() {
  return useQuery<any[]>({
    queryKey: ["/api/doctors"],
    queryFn: async () => {
      const r = await fetch("/api/doctors", { credentials: "include" });
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.rows || []);
    },
  });
}

function Filters({ from, to, setFrom, setTo, doctorId, setDoctorId, q, setQ, status, setStatus, statusOpts, hideQ, hideStatus }: any) {
  const { data: doctors } = useDoctors();
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
      <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
      <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
      <div><Label>Doctor</Label>
        <Select value={doctorId || "all"} onValueChange={v => setDoctorId(v === "all" ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="All doctors" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {(doctors || []).map((d: any) => (
              <SelectItem key={d.id} value={String(d.id)}>{d.name}{d.specialization ? ` — ${d.specialization}` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {!hideStatus && statusOpts && (
        <div><Label>Status</Label>
          <Select value={status || "all"} onValueChange={v => setStatus(v === "all" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {statusOpts.map((s: string) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {!hideQ && (
        <div><Label>Search</Label><Input placeholder="Name / UHID / No." value={q} onChange={e => setQ(e.target.value)} /></div>
      )}
    </div>
  );
}

function PrintableHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
      <h1 className="text-xl font-bold">CarePlus HMS — Hope Hospital</h1>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs">{sub}</p>
    </div>
  );
}

function OpdBills() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/opd/bills", from, to, doctorId, status, q],
    queryFn: async () => {
      const u = new URL("/api/reports/opd/bills", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (doctorId) u.searchParams.set("doctorId", doctorId);
      if (status) u.searchParams.set("status", status);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { total: 0, paid: 0, due: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> OPD Bill Record ({data?.count ?? 0})</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="print:hidden"><Filters from={from} to={to} setFrom={setFrom} setTo={setTo} doctorId={doctorId} setDoctorId={setDoctorId} q={q} setQ={setQ} status={status} setStatus={setStatus} statusOpts={["paid", "partial", "pending"]} /></div>
        <PrintableHeader title="OPD Bill Record" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-xl font-bold">{fmt(t.total)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-emerald-600">{fmt(t.paid)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bill No.</TableHead><TableHead>Date</TableHead><TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead><TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.invoiceId}>
                <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                <TableCell>{r.invoiceDate}</TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell>{r.doctorName || "—"}</TableCell>
                <TableCell className="text-right">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.paid)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : r.status === "partial" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No OPD bills in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OpdPatients() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/opd/patients", from, to, doctorId, status, q],
    queryFn: async () => {
      const u = new URL("/api/reports/opd/patients", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (doctorId) u.searchParams.set("doctorId", doctorId);
      if (status) u.searchParams.set("status", status);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> OPD Patients ({data?.count ?? 0}) · Total Fee {fmt(data?.totalFee)}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="print:hidden"><Filters from={from} to={to} setFrom={setFrom} setTo={setTo} doctorId={doctorId} setDoctorId={setDoctorId} q={q} setQ={setQ} status={status} setStatus={setStatus} statusOpts={["pending", "completed", "converted"]} /></div>
        <PrintableHeader title="OPD Patient Report" sub={`${from} to ${to}`} />
        <Table>
          <TableHeader><TableRow>
            <TableHead>Visit No.</TableHead><TableHead>Date</TableHead><TableHead>Patient</TableHead>
            <TableHead>Age/Sex</TableHead><TableHead>Phone</TableHead><TableHead>Doctor</TableHead>
            <TableHead>Status</TableHead><TableHead className="text-right">Fee</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.visitId}>
                <TableCell className="font-mono text-xs">{r.visitNo}</TableCell>
                <TableCell>{r.visitDate}</TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell>{r.age ?? "—"} / {r.gender ?? "—"}</TableCell>
                <TableCell>{r.phone || "—"}</TableCell>
                <TableCell>{r.doctorName}{r.specialization ? <div className="text-xs text-muted-foreground">{r.specialization}</div> : null}</TableCell>
                <TableCell>
                  <Badge variant={r.convertedToIpd ? "default" : r.status === "completed" ? "secondary" : "outline"}>
                    {r.convertedToIpd ? "→ IPD" : r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{fmt(r.fee)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No OPD visits in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function OpdConversions() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/opd/conversions", from, to, doctorId, q],
    queryFn: async () => {
      const u = new URL("/api/reports/opd/conversions", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (doctorId) u.searchParams.set("doctorId", doctorId);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="h-5 w-5" /> OPD → IPD Conversions ({data?.count ?? 0})</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="print:hidden"><Filters from={from} to={to} setFrom={setFrom} setTo={setTo} doctorId={doctorId} setDoctorId={setDoctorId} q={q} setQ={setQ} hideStatus /></div>
        <PrintableHeader title="OPD to IPD Conversions" sub={`${from} to ${to}`} />
        <Table>
          <TableHeader><TableRow>
            <TableHead>OPD Visit No.</TableHead><TableHead>Visit Date</TableHead>
            <TableHead>IPD No.</TableHead><TableHead>Admission Date</TableHead>
            <TableHead>Patient</TableHead><TableHead>Doctor</TableHead>
            <TableHead>Ward</TableHead><TableHead>IPD Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.opdVisitId}>
                <TableCell className="font-mono text-xs">{r.visitNo}</TableCell>
                <TableCell>{r.visitDate}</TableCell>
                <TableCell className="font-mono text-xs">{r.ipdNo || "—"}</TableCell>
                <TableCell>{r.admissionDate || "—"}</TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell>{r.doctorName || "—"}</TableCell>
                <TableCell>{r.wardName || "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.ipdStatus || "—"}</Badge></TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No conversions in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ConsultantSpecific() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [doctorId, setDoctorId] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/opd/consultant", from, to, doctorId],
    queryFn: async () => {
      const u = new URL("/api/reports/opd/consultant", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (doctorId) u.searchParams.set("doctorId", doctorId);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { visits: 0, patients: 0, converted: 0, fee: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" /> Consultant-Specific Summary ({data?.count ?? 0})</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="print:hidden"><Filters from={from} to={to} setFrom={setFrom} setTo={setTo} doctorId={doctorId} setDoctorId={setDoctorId} hideQ hideStatus /></div>
        <PrintableHeader title="Consultant-Specific Report" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Visits</p><p className="text-xl font-bold">{t.visits}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Unique Patients</p><p className="text-xl font-bold">{t.patients}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Converted to IPD</p><p className="text-xl font-bold text-blue-600">{t.converted}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Fee</p><p className="text-xl font-bold text-emerald-600">{fmt(t.fee)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Doctor</TableHead><TableHead>Specialization</TableHead>
            <TableHead className="text-right">Visits</TableHead>
            <TableHead className="text-right">Unique Patients</TableHead>
            <TableHead className="text-right">→ IPD</TableHead>
            <TableHead className="text-right">Total Fee</TableHead>
            <TableHead className="text-right">Conv. %</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => {
              const conv = r.totalVisits ? ((Number(r.converted) / Number(r.totalVisits)) * 100).toFixed(1) : "0.0";
              return (
                <TableRow key={r.doctorId}>
                  <TableCell className="font-medium">{r.doctorName}</TableCell>
                  <TableCell>{r.specialization || "—"}</TableCell>
                  <TableCell className="text-right">{r.totalVisits}</TableCell>
                  <TableCell className="text-right">{r.uniquePatients}</TableCell>
                  <TableCell className="text-right">{r.converted}</TableCell>
                  <TableCell className="text-right">{fmt(r.totalFee)}</TableCell>
                  <TableCell className="text-right">{conv}%</TableCell>
                </TableRow>
              );
            })}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No data in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function OpdReportsPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Stethoscope className="h-6 w-6" /> OPD Reports</h2>
        <p className="text-muted-foreground text-sm">Bill records, registered patients, OPD→IPD conversions and consultant-specific summaries.</p>
      </div>
      <Tabs defaultValue="bills">
        <TabsList className="print:hidden">
          <TabsTrigger value="bills"><Receipt className="h-4 w-4 mr-2" />Bill Record</TabsTrigger>
          <TabsTrigger value="patients"><Users className="h-4 w-4 mr-2" />OPD Patients</TabsTrigger>
          <TabsTrigger value="conversions"><ArrowRightLeft className="h-4 w-4 mr-2" />OPD → IPD</TabsTrigger>
          <TabsTrigger value="consultant"><Stethoscope className="h-4 w-4 mr-2" />Consultant</TabsTrigger>
        </TabsList>
        <TabsContent value="bills" className="mt-4"><OpdBills /></TabsContent>
        <TabsContent value="patients" className="mt-4"><OpdPatients /></TabsContent>
        <TabsContent value="conversions" className="mt-4"><OpdConversions /></TabsContent>
        <TabsContent value="consultant" className="mt-4"><ConsultantSpecific /></TabsContent>
      </Tabs>
    </div>
  );
}
