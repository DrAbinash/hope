import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Boxes, AlarmClock, ShoppingBasket, ArrowLeftRight, Printer, Package } from "lucide-react";

const today = () => new Date().toISOString().slice(0, 10);
const monthAgo = () => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10); };
const fmt = (n: any) => `₹ ${Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: any) => Number(n ?? 0).toLocaleString("en-IN");

function PrintableHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="hidden print:block text-center mb-4 border-b-2 pb-2">
      <h1 className="text-xl font-bold">CarePlus HMS — Hope Pharmacy</h1>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-xs">{sub}</p>
    </div>
  );
}

function OnHand() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/stock/on-hand", q, category],
    queryFn: async () => {
      const u = new URL("/api/reports/stock/on-hand", window.location.origin);
      if (q) u.searchParams.set("q", q);
      if (category) u.searchParams.set("category", category);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { items: 0, stock: 0, mrpValue: 0, purchaseValue: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><Boxes className="h-5 w-5" /> Stock-on-Hand — {data?.count ?? 0} items</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end print:hidden">
          <div className="md:col-span-2"><Label>Search</Label><Input placeholder="Name / generic / barcode" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div><Label>Category</Label><Input placeholder="e.g. Tablet" value={category} onChange={e => setCategory(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Stock-on-Hand" sub={`As of ${today()}`} />
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SKUs</p><p className="text-xl font-bold">{t.items}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Units</p><p className="text-xl font-bold">{num(t.stock)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">MRP Value</p><p className="text-xl font-bold">{fmt(t.mrpValue)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Purchase Value</p><p className="text-xl font-bold text-emerald-600">{fmt(t.purchaseValue)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Medicine</TableHead><TableHead>Category</TableHead>
            <TableHead>Batch / Expiry</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">Reorder</TableHead>
            <TableHead className="text-right">MRP</TableHead>
            <TableHead className="text-right">Stock Value</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.name}</div>{r.genericName && <div className="text-xs text-muted-foreground">{r.genericName}</div>}</TableCell>
                <TableCell>{r.category || "—"}</TableCell>
                <TableCell><div className="font-mono text-xs">{r.batchNo || "—"}</div><div className="text-xs text-muted-foreground">{r.expiryDate || ""}</div></TableCell>
                <TableCell className="text-right">{num(r.stock)} {r.unit && <span className="text-xs text-muted-foreground">{r.unit}</span>}</TableCell>
                <TableCell className="text-right">{r.reorderLevel ?? "—"}</TableCell>
                <TableCell className="text-right">{fmt(r.mrp)}</TableCell>
                <TableCell className="text-right font-semibold">{fmt(Number(r.stock || 0) * Number(r.mrp || 0))}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No medicines match.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ExpiryTracker() {
  const [days, setDays] = useState("90");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/stock/expiry", days],
    queryFn: async () => {
      const r = await fetch(`/api/reports/stock/expiry?days=${encodeURIComponent(days)}`, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { expired: 0, near: 0, lossValue: 0 };
  const todayStr = today();
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><AlarmClock className="h-5 w-5" /> Expiry Tracker — {data?.count ?? 0} batches</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
          <div><Label>Window (days)</Label><Input type="number" min={1} max={3650} value={days} onChange={e => setDays(e.target.value)} /></div>
          <p className="text-sm text-muted-foreground md:col-span-3">Lists in-stock batches expiring on or before {data?.cutoff || "—"}.</p>
        </div>
        <PrintableHeader title="Expiry Tracker" sub={`Through ${data?.cutoff || ""} (${days} days)`} />
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Already Expired</p><p className="text-xl font-bold text-rose-600">{t.expired}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Near Expiry</p><p className="text-xl font-bold text-amber-600">{t.near}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Potential Loss (purchase value)</p><p className="text-xl font-bold">{fmt(t.lossValue)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Medicine</TableHead><TableHead>Batch</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead className="text-right">Stock</TableHead>
            <TableHead className="text-right">MRP</TableHead>
            <TableHead className="text-right">At-risk Value</TableHead>
            <TableHead>State</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => {
              const expired = r.expiryDate && r.expiryDate < todayStr;
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="font-mono text-xs">{r.batchNo || "—"}</TableCell>
                  <TableCell>{r.expiryDate}</TableCell>
                  <TableCell className="text-right">{num(r.stock)} {r.unit && <span className="text-xs text-muted-foreground">{r.unit}</span>}</TableCell>
                  <TableCell className="text-right">{fmt(r.mrp)}</TableCell>
                  <TableCell className="text-right">{fmt(Number(r.stock || 0) * Number(r.purchaseRate || 0))}</TableCell>
                  <TableCell><Badge variant={expired ? "destructive" : "secondary"}>{expired ? "Expired" : "Near"}</Badge></TableCell>
                </TableRow>
              );
            })}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No batches expiring within {days} days.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ReorderList() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/stock/reorder"],
    queryFn: async () => {
      const r = await fetch("/api/reports/stock/reorder", { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ShoppingBasket className="h-5 w-5" /> Reorder List — {data?.count ?? 0} items below threshold</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <PrintableHeader title="Reorder List" sub={`As of ${today()}`} />
        <div className="grid grid-cols-2 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SKUs to reorder</p><p className="text-xl font-bold">{data?.count ?? 0}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Suggested Spend</p><p className="text-xl font-bold">{fmt(data?.totals?.suggestedSpend)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Medicine</TableHead><TableHead>Category</TableHead>
            <TableHead>Manufacturer</TableHead>
            <TableHead className="text-right">In Stock</TableHead>
            <TableHead className="text-right">Reorder Level</TableHead>
            <TableHead className="text-right">Suggested Qty</TableHead>
            <TableHead className="text-right">Est. Spend</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>{r.category || "—"}</TableCell>
                <TableCell>{r.manufacturer || "—"}</TableCell>
                <TableCell className="text-right text-rose-700 font-semibold">{num(r.stock)}</TableCell>
                <TableCell className="text-right">{r.reorderLevel ?? "—"}</TableCell>
                <TableCell className="text-right">{num(r.suggestedQty)}</TableCell>
                <TableCell className="text-right">{fmt(r.suggestedSpend)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">All stock above reorder thresholds.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StockMovement() {
  const [from, setFrom] = useState(monthAgo());
  const [to, setTo] = useState(today());
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/stock/movement", from, to, q],
    queryFn: async () => {
      const u = new URL("/api/reports/stock/movement", window.location.origin);
      u.searchParams.set("fromDate", from); u.searchParams.set("toDate", to);
      if (q) u.searchParams.set("q", q);
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      return r.json();
    },
  });
  const t = data?.totals || { inQty: 0, outQty: 0, inAmount: 0, outAmount: 0 };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap print:hidden">
        <CardTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5" /> Stock Movement — {data?.count ?? 0} medicines</CardTitle>
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end print:hidden">
          <div><Label>From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div><Label>To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Search</Label><Input placeholder="Medicine name" value={q} onChange={e => setQ(e.target.value)} /></div>
        </div>
        <PrintableHeader title="Stock Movement" sub={`${from} to ${to}`} />
        <div className="grid grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">In Qty</p><p className="text-xl font-bold text-emerald-600">{num(t.inQty)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Out Qty</p><p className="text-xl font-bold text-rose-600">{num(t.outQty)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Purchase ₹</p><p className="text-xl font-bold">{fmt(t.inAmount)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sales ₹</p><p className="text-xl font-bold">{fmt(t.outAmount)}</p></CardContent></Card>
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Medicine</TableHead>
            <TableHead className="text-right">In Qty</TableHead>
            <TableHead className="text-right">In ₹</TableHead>
            <TableHead className="text-right">Out Qty</TableHead>
            <TableHead className="text-right">Out ₹</TableHead>
            <TableHead className="text-right">Net Qty</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data?.rows || []).map((r: any, i: number) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{r.name || "—"}</TableCell>
                <TableCell className="text-right text-emerald-700">{num(r.inQty)}</TableCell>
                <TableCell className="text-right">{fmt(r.inAmount)}</TableCell>
                <TableCell className="text-right text-rose-700">{num(r.outQty)}</TableCell>
                <TableCell className="text-right">{fmt(r.outAmount)}</TableCell>
                <TableCell className="text-right font-semibold">{num(r.netQty)}</TableCell>
              </TableRow>
            ))}
            {!isLoading && (data?.rows || []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No stock movements in this range.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function StockReportsPage() {
  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Package className="h-6 w-6" /> Stock & Inventory Reports</h2>
        <p className="text-muted-foreground text-sm">Stock-on-hand, expiry tracker, reorder list, and stock movement.</p>
      </div>
      <Tabs defaultValue="onhand">
        <TabsList className="print:hidden">
          <TabsTrigger value="onhand"><Boxes className="h-4 w-4 mr-2" />Stock-on-Hand</TabsTrigger>
          <TabsTrigger value="expiry"><AlarmClock className="h-4 w-4 mr-2" />Expiry</TabsTrigger>
          <TabsTrigger value="reorder"><ShoppingBasket className="h-4 w-4 mr-2" />Reorder</TabsTrigger>
          <TabsTrigger value="movement"><ArrowLeftRight className="h-4 w-4 mr-2" />Movement</TabsTrigger>
        </TabsList>
        <TabsContent value="onhand" className="mt-4"><OnHand /></TabsContent>
        <TabsContent value="expiry" className="mt-4"><ExpiryTracker /></TabsContent>
        <TabsContent value="reorder" className="mt-4"><ReorderList /></TabsContent>
        <TabsContent value="movement" className="mt-4"><StockMovement /></TabsContent>
      </Tabs>
    </div>
  );
}
