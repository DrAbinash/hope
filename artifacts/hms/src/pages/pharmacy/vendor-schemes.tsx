import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Gift, IndianRupee } from "lucide-react";
import { toast } from "sonner";

export default function VendorSchemesPage() {
  const [list, setList] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    vendor_id: "", medicine_id: "", scheme_name: "", scheme_type: "bonus_qty",
    buy_qty: 0, free_qty: 0, discount_pct: 0, discount_amt: 0,
    valid_from: new Date().toISOString().slice(0,10),
    valid_to: new Date(Date.now() + 90*86400000).toISOString().slice(0,10),
    min_order_value: 0, notes: "",
  });
  const from = new Date(Date.now() - 90*86400000).toISOString().slice(0,10);
  const to = new Date().toISOString().slice(0,10);

  useEffect(() => { load(); }, []);
  async function load() {
    const [l, b] = await Promise.all([
      fetch("/api/pharmacy/vendor-schemes", { credentials: "include" }).then(r => r.json()),
      fetch(`/api/pharmacy/vendor-schemes/benefits?from=${from}&to=${to}`, { credentials: "include" }).then(r => r.json()),
    ]);
    setList(Array.isArray(l) ? l : []);
    setBenefits(Array.isArray(b) ? b : []);
  }

  async function save() {
    const r = await fetch("/api/pharmacy/vendor-schemes", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, medicine_id: form.medicine_id || null }),
    });
    if (r.ok) { toast.success("Scheme created"); setOpen(false); load(); }
    else toast.error((await r.json()).error || "Failed");
  }

  async function toggleActive(id: number, active: boolean) {
    await fetch(`/api/pharmacy/vendor-schemes/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: active }),
    });
    load();
  }

  function describeScheme(s: any): string {
    if (s.scheme_type === "bonus_qty") return `Buy ${s.buy_qty} + ${s.free_qty} free`;
    if (s.scheme_type === "discount_pct") return `${s.discount_pct}% off`;
    if (s.scheme_type === "discount_amt") return `₹${s.discount_amt} off`;
    return s.scheme_type;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Gift className="h-6 w-6" /> Vendor Schemes & Bonus</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="scheme-add"><Plus className="h-4 w-4 mr-1" /> New Scheme</Button></DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader><DialogTitle>Add Vendor Scheme</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vendor ID *</Label><Input type="number" value={form.vendor_id} onChange={e => setForm({...form, vendor_id: e.target.value})} /></div>
              <div><Label>Medicine ID (blank = all)</Label><Input type="number" value={form.medicine_id} onChange={e => setForm({...form, medicine_id: e.target.value})} /></div>
              <div className="col-span-2"><Label>Scheme Name *</Label><Input value={form.scheme_name} onChange={e => setForm({...form, scheme_name: e.target.value})} placeholder="e.g. Diwali Bonus 10+1" /></div>
              <div><Label>Type *</Label>
                <Select value={form.scheme_type} onValueChange={v => setForm({...form, scheme_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonus_qty">Bonus Qty (Buy X + Y Free)</SelectItem>
                    <SelectItem value="discount_pct">% Discount</SelectItem>
                    <SelectItem value="discount_amt">Flat ₹ Discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Min Order Value (₹)</Label><Input type="number" value={form.min_order_value} onChange={e => setForm({...form, min_order_value: e.target.value})} /></div>
              {form.scheme_type === "bonus_qty" && (<>
                <div><Label>Buy Qty</Label><Input type="number" value={form.buy_qty} onChange={e => setForm({...form, buy_qty: e.target.value})} /></div>
                <div><Label>Free Qty</Label><Input type="number" value={form.free_qty} onChange={e => setForm({...form, free_qty: e.target.value})} /></div>
              </>)}
              {form.scheme_type === "discount_pct" && (<div><Label>Discount %</Label><Input type="number" value={form.discount_pct} onChange={e => setForm({...form, discount_pct: e.target.value})} /></div>)}
              {form.scheme_type === "discount_amt" && (<div><Label>Discount ₹</Label><Input type="number" value={form.discount_amt} onChange={e => setForm({...form, discount_amt: e.target.value})} /></div>)}
              <div><Label>Valid From *</Label><Input type="date" value={form.valid_from} onChange={e => setForm({...form, valid_from: e.target.value})} /></div>
              <div><Label>Valid To *</Label><Input type="date" value={form.valid_to} onChange={e => setForm({...form, valid_to: e.target.value})} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
            </div>
            <Button onClick={save} className="w-full">Save</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Active Schemes ({list.filter(s => s.is_active && !s.is_expired).length})</TabsTrigger>
          <TabsTrigger value="all">All ({list.length})</TabsTrigger>
          <TabsTrigger value="benefits">Benefits Realised (90d)</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <SchemeTable schemes={list.filter(s => s.is_active && !s.is_expired)} describe={describeScheme} onToggle={toggleActive} />
        </TabsContent>
        <TabsContent value="all">
          <SchemeTable schemes={list} describe={describeScheme} onToggle={toggleActive} />
        </TabsContent>

        <TabsContent value="benefits">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Vendor</TableHead><TableHead>Scheme</TableHead><TableHead>Type</TableHead>
                <TableHead>Times Used</TableHead><TableHead>Free Qty</TableHead>
                <TableHead>Discount ₹</TableHead><TableHead>Total Benefit</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {benefits.map((b, i) => (
                  <TableRow key={i}>
                    <TableCell>{b.vendor_name}</TableCell>
                    <TableCell>{b.scheme_name}</TableCell>
                    <TableCell><Badge variant="outline">{b.scheme_type}</Badge></TableCell>
                    <TableCell>{b.times_applied}</TableCell>
                    <TableCell>{Number(b.total_free_qty)}</TableCell>
                    <TableCell>₹{Number(b.total_discount).toLocaleString()}</TableCell>
                    <TableCell className="font-bold text-green-700 flex items-center"><IndianRupee className="h-3 w-3" />{Number(b.total_benefit).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {benefits.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No benefits recorded in this period</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SchemeTable({ schemes, describe, onToggle }: { schemes: any[]; describe: (s: any) => string; onToggle: (id: number, a: boolean) => void }) {
  return (
    <Card><CardContent className="p-0">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Vendor</TableHead><TableHead>Medicine</TableHead><TableHead>Scheme</TableHead>
          <TableHead>Benefit</TableHead><TableHead>Validity</TableHead>
          <TableHead>Min Order</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {schemes.map(s => (
            <TableRow key={s.id}>
              <TableCell>{s.vendor_name}</TableCell>
              <TableCell className="text-xs">{s.medicine_name || <span className="text-muted-foreground italic">All</span>}</TableCell>
              <TableCell>{s.scheme_name}</TableCell>
              <TableCell><Badge>{describe(s)}</Badge></TableCell>
              <TableCell className="text-xs">{s.valid_from} → {s.valid_to}</TableCell>
              <TableCell>₹{Number(s.min_order_value).toLocaleString()}</TableCell>
              <TableCell>
                {s.is_expired ? <Badge variant="destructive">Expired</Badge>
                  : s.is_active ? <Badge>Active</Badge>
                  : <Badge variant="secondary">Inactive</Badge>}
              </TableCell>
              <TableCell>
                {!s.is_expired && <Button size="sm" variant="outline" onClick={() => onToggle(s.id, !s.is_active)}>{s.is_active ? "Deactivate" : "Activate"}</Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}
