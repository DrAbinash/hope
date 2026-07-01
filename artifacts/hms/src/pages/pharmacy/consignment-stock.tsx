import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Package, Truck } from "lucide-react";
import { toast } from "sonner";

export default function ConsignmentStockPage() {
  const [items, setItems] = useState<any[]>([]);
  const [outstanding, setOutstanding] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("in_stock");
  const [openNew, setOpenNew] = useState(false);
  const [openConsume, setOpenConsume] = useState<any>(null);
  const [form, setForm] = useState<any>({
    vendor_id: "", medicine_id: "", batch_no: "", expiry_date: "",
    mrp: 0, rate: 0, qty_received: 0, received_date: new Date().toISOString().slice(0,10), notes: "",
  });
  const [cons, setCons] = useState<any>({ sale_id: "", patient_id: "", qty: 0, rate: 0 });

  useEffect(() => { load(); }, [statusFilter]);
  async function load() {
    const [i, o] = await Promise.all([
      (async () => { const r = await fetch(`/api/pharmacy/consignment?status=${statusFilter}`, { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
      (async () => { const r = await fetch("/api/pharmacy/consignment/outstanding", { credentials: "include" }); if (!r.ok) throw new Error("Failed"); return r.json(); })(),
    ]);
    setItems(Array.isArray(i) ? i : []);
    setOutstanding(Array.isArray(o) ? o : []);
  }

  async function receive() {
    const r = await fetch("/api/pharmacy/consignment", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) { toast.success("Consignment received"); setOpenNew(false); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  async function consume() {
    const r = await fetch(`/api/pharmacy/consignment/${openConsume.id}/consume`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...cons, rate: cons.rate || openConsume.rate }),
    });
    if (r.ok) { toast.success(`Consumed. Remaining: ${(await r.json()).remaining}`); setOpenConsume(null); setCons({ sale_id: "", patient_id: "", qty: 0, rate: 0 }); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Package className="h-6 w-6" /> Consignment Stock</h1>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild><Button data-testid="consign-receive"><Plus className="h-4 w-4 mr-1" /> Receive Consignment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Receive Consignment Stock</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vendor ID *</Label><Input type="number" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} /></div>
              <div><Label>Medicine ID *</Label><Input type="number" value={form.medicine_id} onChange={e => setForm({...form, medicine_id: e.target.value})} /></div>
              <div><Label>Batch No *</Label><Input value={form.batch_no} onChange={e => setForm({...form, batch_no: e.target.value})} /></div>
              <div><Label>Expiry Date</Label><Input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} /></div>
              <div><Label>MRP</Label><Input type="number" value={form.mrp} onChange={e => setForm({...form, mrp: e.target.value})} /></div>
              <div><Label>Rate (₹)</Label><Input type="number" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} /></div>
              <div><Label>Qty Received *</Label><Input type="number" value={form.qty_received} onChange={e => setForm({...form, qty_received: e.target.value})} /></div>
              <div><Label>Received Date</Label><Input type="date" value={form.received_date} onChange={e => setForm({...form, received_date: e.target.value})} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <Button onClick={receive} className="w-full">Receive</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="outstanding"><Truck className="h-4 w-4 mr-1" /> Vendor Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="flex gap-2 mb-3">
            {["in_stock", "exhausted", "returned", ""].map(s => (
              <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"} onClick={() => setStatusFilter(s)}>
                {s || "All"}
              </Button>
            ))}
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vendor</TableHead><TableHead>Medicine</TableHead><TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead><TableHead>Recv</TableHead><TableHead>Used</TableHead>
                <TableHead>Balance</TableHead><TableHead>Rate</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map(it => (
                  <TableRow key={it.id}>
                    <TableCell>{it.vendor_name}</TableCell>
                    <TableCell>{it.medicine_name}</TableCell>
                    <TableCell className="font-mono text-xs">{it.batch_no}</TableCell>
                    <TableCell>{it.expiry_date || "—"}</TableCell>
                    <TableCell>{Number(it.qty_received)}</TableCell>
                    <TableCell>{Number(it.qty_consumed)}</TableCell>
                    <TableCell><Badge>{Number(it.qty_balance)}</Badge></TableCell>
                    <TableCell>₹{it.rate}</TableCell>
                    <TableCell><Badge variant={it.status === "in_stock" ? "default" : "secondary"}>{it.status}</Badge></TableCell>
                    <TableCell>{it.status === "in_stock" && <Button size="sm" variant="outline" onClick={() => setOpenConsume(it)}>Consume</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="outstanding">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vendor</TableHead><TableHead>Active Items</TableHead>
                <TableHead>Balance Qty</TableHead><TableHead>Balance Value</TableHead>
                <TableHead>Uninvoiced Consumption</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {outstanding.map((o: any) => (
                  <TableRow key={o.vendor_id}>
                    <TableCell className="font-medium">{o.vendor_name}</TableCell>
                    <TableCell>{o.active_items}</TableCell>
                    <TableCell>{Number(o.balance_qty)}</TableCell>
                    <TableCell>₹{Number(o.balance_value).toLocaleString()}</TableCell>
                    <TableCell className="text-amber-700 font-semibold">₹{Number(o.uninvoiced_consumption).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!openConsume} onOpenChange={() => setOpenConsume(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Consume from {openConsume?.medicine_name} ({openConsume?.batch_no})</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">Balance: {Number(openConsume?.qty_balance || 0)}</div>
            <div><Label>Sale ID</Label><Input type="number" value={cons.sale_id} onChange={e => setCons({...cons, sale_id: e.target.value})} /></div>
            <div><Label>Patient ID</Label><Input type="number" value={cons.patient_id} onChange={e => setCons({...cons, patient_id: e.target.value})} /></div>
            <div><Label>Qty *</Label><Input type="number" value={cons.qty} onChange={e => setCons({...cons, qty: e.target.value})} /></div>
            <div><Label>Rate (₹)</Label><Input type="number" value={cons.rate || openConsume?.rate || 0} onChange={e => setCons({...cons, rate: e.target.value})} /></div>
            <Button onClick={consume} className="w-full">Record Consumption</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
