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
import { Pill, ShoppingCart, Wallet, Printer, Package } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function PrintableHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
      <h1 className="text-xl font-bold">CarePlus HMS — Hope Pharmacy</h1>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs">{sub}</p>
    </div>
  );
}

function useVendors() {
  return useQuery<any[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const r = await fetch("/api/vendors", { credentials: "include" });
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : (j.rows || []);
    },
  });
}

function IssuedMedicines() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/pharmacy/issued", from, to, q],
    queryFn: async () => {
      const u = new URL("/api/reports/pharmacy/issued", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { total: 0, paid: 0, due: 0, qty: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Pill className="h-5 w-5" /> Issued Medicines (IP) — {data?.count ?? 0} bills</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Search</Label><Input placeholder="Patient / UHID / Bill No / IPD No" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Issued Medicines (IP)" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bills</p><p className="text-xl font-bold">{data?.count ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Qty</p><p className="text-xl font-bold">{t.qty}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-xl font-bold">{fmt(t.total)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bill No.</TableHead><TableHead>Date</TableHead><TableHead>Patient</TableHead>
            <TableHead>IPD No.</TableHead><TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.saleId}>
                <TableCell className="font-mono text-xs">{r.billNo}</TableCell>
                <TableCell>{r.billDate}</TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell className="font-mono text-xs">{r.ipdNo || "—"}</TableCell>
                <TableCell className="text-right">{(r.items || []).length}</TableCell>
                <TableCell className="text-right">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.paid)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell><Badge variant={r.billStatus === "final" ? "default" : "outline"}>{r.billStatus}</Badge></TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No IP medicine issuances in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MedicinePurchases() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [vendorId, setVendorId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const { data: vendors } = useVendors();
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/pharmacy/purchases", from, to, vendorId, status, q],
    queryFn: async () => {
      const u = new URL("/api/reports/pharmacy/purchases", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (vendorId) u.searchParams.set("vendorId", vendorId);
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
        <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5" /> Medicine Purchases — {data?.count ?? 0}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Vendor</Label>
            <Select value={vendorId || "all"} onValueChange={v => setVendorId(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All vendors</SelectItem>
                {(vendors || []).map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Status</Label>
            <Select value={status || "all"} onValueChange={v => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["paid", "partial", "unpaid", "pending"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Search</Label><Input placeholder="Vendor / Invoice" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Medicine Purchases" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Purchases</p><p className="text-xl font-bold">{fmt(t.total)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Paid to Vendors</p><p className="text-xl font-bold text-emerald-600">{fmt(t.paid)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding (AP)</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead>
            <TableHead className="text-right">Items</TableHead>
            <TableHead className="text-right">Subtotal</TableHead>
            <TableHead className="text-right">GST</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.purchaseId}>
                <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                <TableCell>{r.invoiceDate}</TableCell>
                <TableCell><div className="font-medium">{r.vendorName}</div>{r.gstin && <div className="text-xs text-muted-foreground">{r.gstin}</div>}</TableCell>
                <TableCell className="text-right">{r.itemCount}</TableCell>
                <TableCell className="text-right">{fmt(r.subtotal)}</TableCell>
                <TableCell className="text-right">{fmt(r.gst)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : r.status === "partial" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No purchases in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IpPaymentHistory() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [status, setStatus] = useState("");
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/pharmacy/ip-payments", from, to, status, mode, q],
    queryFn: async () => {
      const u = new URL("/api/reports/pharmacy/ip-payments", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (status) u.searchParams.set("status", status);
      if (mode) u.searchParams.set("mode", mode);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { billed: 0, collected: 0, due: 0 };
  const byMode = data?.byMode || {};
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> IP Payment History — {data?.count ?? 0}</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div><Label>Status</Label>
            <Select value={status || "all"} onValueChange={v => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["paid", "partial", "pending"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Mode</Label>
            <Select value={mode || "all"} onValueChange={v => setMode(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {["Cash", "Card", "UPI", "Bank Transfer", "Cheque", "Insurance"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Search</Label><Input placeholder="Patient / UHID / Bill No" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="IP Payment History" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-xl font-bold">{fmt(t.billed)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Collected</p><p className="text-xl font-bold text-emerald-600">{fmt(t.collected)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-xl font-bold text-rose-600">{fmt(t.due)}</p></CardContent></Card>
        </div>
        {Object.keys(byMode).length > 0 && (
          <div className="text-sm flex flex-wrap gap-2 print:hidden">
            <span className="text-muted-foreground">Collected by mode:</span>
            {Object.entries(byMode).map(([m, v]: any) => (
              <Badge key={m} variant="outline">{m}: {fmt(v)}</Badge>
            ))}
          </div>
        )}
        <Table>
          <TableHeader><TableRow>
            <TableHead>Bill No.</TableHead><TableHead>Date</TableHead><TableHead>Patient</TableHead>
            <TableHead>IPD No.</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Paid</TableHead>
            <TableHead className="text-right">Due</TableHead>
            <TableHead>Mode</TableHead><TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.billNo}</TableCell>
                <TableCell>{r.billDate}</TableCell>
                <TableCell><div className="font-medium">{r.patientName}</div><div className="font-mono text-xs text-muted-foreground">{r.uhid}</div></TableCell>
                <TableCell className="font-mono text-xs">{r.ipdNo || "—"}</TableCell>
                <TableCell className="text-right">{fmt(r.total)}</TableCell>
                <TableCell className="text-right text-emerald-700">{fmt(r.paid)}</TableCell>
                <TableCell className="text-right text-rose-700">{fmt(r.due)}</TableCell>
                <TableCell>{r.paymentMode || "—"}</TableCell>
                <TableCell><Badge variant={r.status === "paid" ? "default" : r.status === "partial" ? "secondary" : "outline"}>{r.status}</Badge></TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No IP payments in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function PharmacyReportsPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Package className="h-6 w-6" /> IP Pharmacy Reports</h2>
        <p className="text-muted-foreground text-sm">Issued medicines, vendor purchases and IP payment history.</p>
      </div>
      <Tabs defaultValue="issued">
        <TabsList className="print:hidden">
          <TabsTrigger value="issued"><Pill className="h-4 w-4 mr-2" />Issued Medicines</TabsTrigger>
          <TabsTrigger value="purchases"><ShoppingCart className="h-4 w-4 mr-2" />Medicine Purchase</TabsTrigger>
          <TabsTrigger value="payments"><Wallet className="h-4 w-4 mr-2" />IP Payment History</TabsTrigger>
        </TabsList>
        <TabsContent value="issued" className="mt-4"><IssuedMedicines /></TabsContent>
        <TabsContent value="purchases" className="mt-4"><MedicinePurchases /></TabsContent>
        <TabsContent value="payments" className="mt-4"><IpPaymentHistory /></TabsContent>
      </Tabs>
    </div>
  );
}
