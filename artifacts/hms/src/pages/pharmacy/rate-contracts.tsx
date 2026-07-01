import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FileText, Plus, AlertTriangle, ChevronRight } from "lucide-react";

export default function RateContracts() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("contracts");
  const [showNew, setShowNew] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any | null>(null);
  const [newForm, setNewForm] = useState({ vendor_id: "", vendor_name: "", valid_from: "", valid_to: "", notes: "" });
  const [items, setItems] = useState<{ medicine_id: string; medicine_name: string; agreed_rate: string; gst_percent: string; min_order_qty: string; unit: string }[]>([
    { medicine_id: "", medicine_name: "", agreed_rate: "", gst_percent: "12", min_order_qty: "1", unit: "strip" }
  ]);

  const { data: contracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/rate-contracts"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/rate-contracts", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch rate contracts");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: vendors = [] } = useQuery<any[]>({
    queryKey: ["/api/vendors"],
    queryFn: async () => {
      const r = await fetch("/api/vendors?limit=200", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch vendors");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: contractItems = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/rate-contracts/items", selectedContract?.id],
    queryFn: async () => {
      const r = await fetch(`/api/pharmacy/rate-contracts/${selectedContract!.id}/items`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch contract items");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedContract,
  });

  const { data: violations = [] } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/rate-contracts/violations"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/rate-contracts/violations", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch violations");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: tab === "violations",
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch("/api/pharmacy/rate-contracts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!r.ok) throw new Error((await r.json()).error || "Failed to create rate contract");
      return r.json();
    },
    onSuccess: () => { toast.success("Rate contract created"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/rate-contracts"] }); setShowNew(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const expiring = contracts.filter((c: any) => {
    const d = new Date(c.valid_to).getTime(); const now = Date.now();
    return d > now && d - now < 30 * 86400000;
  });

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-emerald-600" />
          <div><h1 className="text-xl font-bold">Vendor Rate Contracts</h1><p className="text-sm text-muted-foreground">Agreed purchase rate management and compliance tracking</p></div>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1" />New Contract</Button>
      </div>

      {expiring.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{expiring.length} contract(s) expiring within 30 days — {expiring.map((c: any) => c.contract_no).join(", ")}</span>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract No</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid To</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Violations</TableHead>
                  <TableHead>Savings</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10">Loading…</TableCell></TableRow>
                ) : contracts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">No contracts. Click "New Contract" to create one.</TableCell></TableRow>
                ) : contracts.map((c: any) => {
                  const expired = new Date(c.valid_to) < new Date();
                  const nearExpiry = !expired && (new Date(c.valid_to).getTime() - Date.now()) < 30 * 86400000;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.contract_no}</TableCell>
                      <TableCell className="font-medium">{c.vendor_name}</TableCell>
                      <TableCell className="text-xs">{c.valid_from}</TableCell>
                      <TableCell className="text-xs">
                        <span className={expired ? "text-red-600 font-semibold" : nearExpiry ? "text-amber-600 font-semibold" : ""}>{c.valid_to}</span>
                      </TableCell>
                      <TableCell>
                        {expired ? <Badge className="bg-red-100 text-red-800">Expired</Badge>
                          : nearExpiry ? <Badge className="bg-amber-100 text-amber-800">Expiring Soon</Badge>
                          : <Badge className="bg-green-100 text-green-800">Active</Badge>}
                      </TableCell>
                      <TableCell>{c.item_count}</TableCell>
                      <TableCell>{Number(c.violations ?? 0) > 0 ? <span className="text-red-600 font-semibold">{c.violations}</span> : "0"}</TableCell>
                      <TableCell>₹{Number(c.total_savings ?? 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedContract(c)}>
                          <ChevronRight className="h-4 w-4" /> Items
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="pt-2">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Contracted Rate</TableHead>
                  <TableHead>Invoiced Rate</TableHead>
                  <TableHead>Excess Rate</TableHead>
                  <TableHead>Excess Amount</TableHead>
                  <TableHead>Approved By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No violations recorded</TableCell></TableRow>
                ) : violations.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-xs">{new Date(v.created_at).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>{v.medicine_name}</TableCell>
                    <TableCell>₹{Number(v.contracted_rate).toFixed(2)}</TableCell>
                    <TableCell className="text-red-700">₹{Number(v.invoiced_rate).toFixed(2)}</TableCell>
                    <TableCell className="text-red-700 font-semibold">₹{Number(v.excess_rate ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-red-700 font-semibold">₹{Number(v.excess_amount ?? 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-xs">{v.approved_by_name ?? "—"}</TableCell>
                    <TableCell className="text-xs max-w-40 truncate">{v.approval_reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* New Contract Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>New Rate Contract</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Vendor *</Label>
                <Select value={newForm.vendor_id} onValueChange={v => { const vend = vendors.find((x: any) => String(x.id) === v); setNewForm(p => ({ ...p, vendor_id: v, vendor_name: vend?.name ?? "" })); }}>
                  <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                  <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vendor Name *</Label><Input value={newForm.vendor_name} onChange={e => setNewForm(p => ({ ...p, vendor_name: e.target.value }))} placeholder="Or type name" /></div>
              <div><Label>Valid From *</Label><Input type="date" value={newForm.valid_from} onChange={e => setNewForm(p => ({ ...p, valid_from: e.target.value }))} /></div>
              <div><Label>Valid To *</Label><Input type="date" value={newForm.valid_to} onChange={e => setNewForm(p => ({ ...p, valid_to: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={newForm.notes} onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>

            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Contract Items</Label>
                <Button size="sm" variant="outline" onClick={() => setItems(p => [...p, { medicine_id: "", medicine_name: "", agreed_rate: "", gst_percent: "12", min_order_qty: "1", unit: "strip" }])}>
                  <Plus className="h-3 w-3 mr-1" />Add Row
                </Button>
              </div>
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 mb-2">
                  <div className="col-span-2"><Input placeholder="Medicine name" value={it.medicine_name} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, medicine_name: e.target.value } : x))} /></div>
                  <div><Input placeholder="Rate ₹" type="number" value={it.agreed_rate} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, agreed_rate: e.target.value } : x))} /></div>
                  <div><Input placeholder="GST%" type="number" value={it.gst_percent} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, gst_percent: e.target.value } : x))} /></div>
                  <div><Input placeholder="Min Qty" type="number" value={it.min_order_qty} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, min_order_qty: e.target.value } : x))} /></div>
                  <div><Button size="sm" variant="ghost" className="text-red-500 px-2" onClick={() => setItems(p => p.filter((_, j) => j !== i))}>✕</Button></div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate({ ...newForm, vendor_id: Number(newForm.vendor_id), items: items.filter(x => x.medicine_name && x.agreed_rate).map(x => ({ ...x, agreed_rate: Number(x.agreed_rate), gst_percent: Number(x.gst_percent), min_order_qty: Number(x.min_order_qty) })) })}>Create Contract</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Items View Dialog */}
      <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Contract Items — {selectedContract?.contract_no}</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Agreed Rate</TableHead><TableHead>GST%</TableHead><TableHead>Min Qty</TableHead><TableHead>Current Rate</TableHead><TableHead>Margin</TableHead></TableRow></TableHeader>
              <TableBody>
                {contractItems.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No items</TableCell></TableRow>
                  : contractItems.map((it: any) => {
                    const diff = it.current_purchase_rate ? Number(it.agreed_rate) - Number(it.current_purchase_rate) : null;
                    return (
                      <TableRow key={it.id}>
                        <TableCell>{it.medicine_name}</TableCell>
                        <TableCell>₹{Number(it.agreed_rate).toFixed(2)}</TableCell>
                        <TableCell>{it.gst_percent}%</TableCell>
                        <TableCell>{it.min_order_qty}</TableCell>
                        <TableCell>{it.current_purchase_rate ? `₹${Number(it.current_purchase_rate).toFixed(2)}` : "—"}</TableCell>
                        <TableCell>{diff !== null ? <span className={diff < 0 ? "text-red-600 font-semibold" : "text-green-600"}>₹{Math.abs(diff).toFixed(2)} {diff < 0 ? "↑" : "↓"}</span> : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setSelectedContract(null)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
