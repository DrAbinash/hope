import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, FileSearch, Printer, ChevronRight } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
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

function Outstanding({ onView }: { onView: (id: number, name: string) => void }) {
  const [q, setQ] = useState("");
  const [minDue, setMinDue] = useState("0.01");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/patient-ledger/outstanding", q, minDue],
    queryFn: async () => {
      const u = new URL("/api/reports/patient-ledger/outstanding", window.location.origin);
      if (q) u.searchParams.set("q", q);
      if (minDue) u.searchParams.set("minDue", minDue);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { patients: 0, billed: 0, paid: 0, due: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Outstanding Receivables — {data?.count ?? 0} patients</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end print:hidden">
          <div className="md:col-span-2"><Label>Search</Label><Input placeholder="Name / UHID / phone" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div><Label>Min Due (₹)</Label><Input type="number" min={0} step={0.01} value={minDue} onChange={e => setMinDue(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Outstanding Receivables" sub={`As of ${today()}`} />
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Patients</p><p className="text-xl font-bold">{t.patients}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Billed</p><p className="text-xl font-bold">{fmt(t.billed)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-emerald-600">{fmt(t.paid)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>UHID</TableHead><TableHead>Patient</TableHead><TableHead>Phone</TableHead>
            <TableHead className="text-right">OPD/IPD</TableHead><TableHead className="text-right">Pharmacy</TableHead>
            <TableHead className="text-right">Billed</TableHead><TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead><TableHead>Last Activity</TableHead>
            <TableHead className="text-right print:hidden"></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.patient_id}>
                <TableCell className="font-mono text-xs">{r.uhid}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.phone || "—"}</TableCell>
                <TableCell className="text-right">{r.opd_bills}</TableCell>
                <TableCell className="text-right">{r.pharmacy_bills}</TableCell>
                <TableCell className="text-right">{fmt(r.billed)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.paid)}</TableCell>
                <TableCell className="text-right font-semibold text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell>{r.last_activity?.slice(0, 10) || "—"}</TableCell>
                <TableCell className="text-right print:hidden">
                  <Button variant="ghost" size="sm" onClick={() => onView(r.patient_id, r.name)}>
                    Statement<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No outstanding receivables.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Statement({ initialId, initialName }: { initialId: number | null; initialName: string }) {
  const [pid, setPid] = useState(initialId ? String(initialId) : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const enabled = !!pid && Number.isFinite(parseInt(pid, 10));
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ["/api/reports/patient-ledger/statement", pid, from, to],
    enabled,
    queryFn: async () => {
      const u = new URL("/api/reports/patient-ledger/statement", window.location.origin);
      u.searchParams.set("patientId", pid);
      if (from) u.searchParams.set("fromDate", from);
      if (to) u.searchParams.set("toDate", to);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { billed: 0, paid: 0, due: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><FileSearch className="h-5 w-5" /> Patient Statement {initialName && `— ${initialName}`}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!data}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
          <div><Label>Patient ID</Label><Input type="number" min={1} value={pid} onChange={e => setPid(e.target.value)} placeholder="e.g. 1" /></div>
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="text-xs text-muted-foreground">Click "Statement" on the Outstanding tab to auto-fill.</div>
        </div>
        {error && <p className="text-rose-600 text-sm">{(error as Error).message}</p>}
        {data && (
          <>
            <PrintableHeader title="Patient Statement" sub={`${data.patient?.name} (UHID ${data.patient?.uhid})${from || to ? ` · ${from || "earliest"} – ${to || today()}` : ""}`} />
            <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground">Patient</p><p className="font-semibold">{data.patient?.name}</p><p className="text-xs">UHID {data.patient?.uhid}</p></div>
              <div><p className="text-xs text-muted-foreground">Billed</p><p className="text-lg font-bold">{fmt(t.billed)}</p></div>
              <div><p className="text-xs text-muted-foreground">Collected</p><p className="text-lg font-bold text-emerald-600">{fmt(t.paid)}</p></div>
              <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-lg font-bold text-rose-600">{fmt(t.due)}</p></div>
            </CardContent></Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Source</TableHead><TableHead>Doc No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Running Due</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(data.transactions || []).map((tx: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{tx.date?.slice(0, 10)}</TableCell>
                    <TableCell><Badge variant={tx.source === "Pharmacy" ? "secondary" : "default"}>{tx.source}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{tx.doc_no}</TableCell>
                    <TableCell>{tx.doc_type}</TableCell>
                    <TableCell className="text-right">{fmt(tx.billed)}</TableCell>
                    <TableCell className="text-right text-emerald-700">{fmt(tx.paid)}</TableCell>
                    <TableCell className="text-right text-rose-700">{fmt(tx.due)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(tx.runningDue)}</TableCell>
                    <TableCell>{tx.mode || "—"}</TableCell>
                    <TableCell><Badge variant={tx.status === "paid" ? "default" : "outline"}>{tx.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {!isLoading && (data.transactions || []).length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">No transactions in range.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </>
        )}
        {!enabled && <p className="text-sm text-muted-foreground">Enter a patient ID to view their statement.</p>}
      </CardContent>
    </Card>
  );
}

export default function PatientLedgerPage() {
  const [tab, setTab] = useState("outstanding");
  const [stmtId, setStmtId] = useState<number | null>(null);
  const [stmtName, setStmtName] = useState("");

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Wallet className="h-6 w-6" /> Patient Ledger</h2>
        <p className="text-muted-foreground text-sm">Outstanding receivables and per-patient transaction statements.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="print:hidden">
          <TabsTrigger value="outstanding"><Wallet className="h-4 w-4 mr-2" />Outstanding</TabsTrigger>
          <TabsTrigger value="statement"><FileSearch className="h-4 w-4 mr-2" />Patient Statement</TabsTrigger>
        </TabsList>
        <TabsContent value="outstanding" className="mt-4">
          <Outstanding onView={(id, name) => { setStmtId(id); setStmtName(name); setTab("statement"); }} />
        </TabsContent>
        <TabsContent value="statement" className="mt-4">
          <Statement initialId={stmtId} initialName={stmtName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
