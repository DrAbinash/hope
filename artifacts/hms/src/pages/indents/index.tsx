import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, ClipboardList, Check, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  issued: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-700",
};

const DEPARTMENTS = ["Ward", "OT", "ICU", "Emergency", "OPD", "Lab", "Radiology", "Housekeeping", "Other"];

export default function IndentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const canApprove = user?.role === "admin" || user?.role === "pharmacist";
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState<any>({ department: "Ward", requestedBy: user?.name || "", notes: "", items: [] });
  const [newItem, setNewItem] = useState<any>({ itemType: "medicine", itemId: 0, itemName: "", unit: "", requestedQty: 1 });

  const { data: indents } = useQuery<any[]>({
    queryKey: ["indents", tab],
    queryFn: async () => {
      const data = await j(`/api/indents${tab !== "all" ? `?status=${tab}` : ""}`);
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: medicines } = useQuery<any[]>({ queryKey: ["medicines-all"], queryFn: async () => {
    const data = await j("/api/pharmacy/medicines");
    return Array.isArray(data) ? data : [];
  }});
  const { data: invItems } = useQuery<any[]>({ queryKey: ["inv-items-all"], queryFn: async () => {
    const data = await j("/api/inventory/items");
    return Array.isArray(data) ? data : [];
  }});

  const create = useMutation({
    mutationFn: () => j("/api/indents", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success("Indent created");
      qc.invalidateQueries({ queryKey: ["indents"] });
      setOpen(false);
      setForm({ department: "Ward", requestedBy: user?.name || "", notes: "", items: [] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (id: number) => j(`/api/indents/${id}/approve`, { method: "POST" }),
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: ["indents"] }); },
  });
  const issue = useMutation({
    mutationFn: (id: number) => j(`/api/indents/${id}/issue`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => {
      toast.success("Issued — stock decremented");
      qc.invalidateQueries({ queryKey: ["indents"] });
      qc.invalidateQueries({ queryKey: ["medicines-all"] });
      qc.invalidateQueries({ queryKey: ["inv-items-all"] });
    },
    onError: (e: any) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: number) => j(`/api/indents/${id}/cancel`, { method: "POST" }),
    onSuccess: () => { toast.success("Cancelled"); qc.invalidateQueries({ queryKey: ["indents"] }); },
  });

  const addItem = () => {
    if (!newItem.itemId || !newItem.itemName || newItem.requestedQty <= 0) {
      toast.error("Pick an item and quantity");
      return;
    }
    setForm({ ...form, items: [...form.items, newItem] });
    setNewItem({ itemType: "medicine", itemId: 0, itemName: "", unit: "", requestedQty: 1 });
  };

  const safeMedicines = Array.isArray(medicines) ? medicines : [];
  const safeInvItems = Array.isArray(invItems) ? invItems : [];
  const safeIndents = Array.isArray(indents) ? indents : [];

  const pickFromList = (val: string) => {
    if (newItem.itemType === "medicine") {
      const m = safeMedicines.find((x: any) => x.id === parseInt(val));
      if (m) setNewItem({ ...newItem, itemId: m.id, itemName: m.name, unit: m.unit });
    } else {
      const i = safeInvItems.find((x: any) => x.id === parseInt(val));
      if (i) setNewItem({ ...newItem, itemId: i.id, itemName: i.name, unit: i.unit });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ClipboardList className="h-6 w-6" />Hospital Indents</h2>
          <p className="text-muted-foreground text-sm">Internal stock requisitions from departments to pharmacy/store</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New Indent</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Create Indent</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Department</Label>
                  <Select value={form.department} onValueChange={v => setForm({ ...form, department: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Requested By</Label><Input value={form.requestedBy} onChange={e => setForm({ ...form, requestedBy: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="border rounded p-3 space-y-2">
                <div className="text-sm font-semibold">Items</div>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <Label className="text-xs">Type</Label>
                    <Select value={newItem.itemType} onValueChange={v => setNewItem({ ...newItem, itemType: v, itemId: 0, itemName: "" })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="medicine">Medicine</SelectItem>
                        <SelectItem value="inventory">Inventory</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-6">
                    <Label className="text-xs">Item</Label>
                    <Select value={newItem.itemId ? String(newItem.itemId) : ""} onValueChange={pickFromList}>
                      <SelectTrigger><SelectValue placeholder="Pick item" /></SelectTrigger>
                      <SelectContent>
                        {(newItem.itemType === "medicine" ? safeMedicines : safeInvItems).map((x: any) =>
                          <SelectItem key={x.id} value={String(x.id)}>{x.name} (stock: {x.stock || x.currentStock})</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">Qty</Label>
                    <Input type="number" min="0" value={newItem.requestedQty} onChange={e => setNewItem({ ...newItem, requestedQty: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div className="col-span-1"><Button size="sm" onClick={addItem}><Plus className="h-3 w-3" /></Button></div>
                </div>
                {form.items.length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Name</TableHead><TableHead>Qty</TableHead><TableHead></TableHead></TableRow></TableHeader>
                    <TableBody>
                      {form.items.map((it: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell><Badge variant="outline">{it.itemType}</Badge></TableCell>
                          <TableCell>{it.itemName}</TableCell>
                          <TableCell>{it.requestedQty} {it.unit}</TableCell>
                          <TableCell><Button size="icon" variant="ghost" onClick={() => setForm({ ...form, items: form.items.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.items.length || create.isPending}>Create Indent</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Indent No</TableHead><TableHead>Department</TableHead><TableHead>Requested By</TableHead>
                <TableHead>Items</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead>Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {safeIndents.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No indents.</TableCell></TableRow>
                ) : safeIndents.map((i: any) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.indentNo}</TableCell>
                    <TableCell>{i.department}</TableCell>
                    <TableCell>{i.requestedBy}</TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {(Array.isArray(i.items) ? i.items : []).map((it: any) => (
                          <div key={it.id}>{it.itemName} <span className="text-muted-foreground">× {it.requestedQty} {it.unit || ""}</span></div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell><Badge className={STATUS_COLOR[i.status]}>{i.status}</Badge></TableCell>
                    <TableCell className="text-xs">{new Date(i.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {canApprove && i.status === "pending" && (
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => approve.mutate(i.id)}><Check className="h-3 w-3 mr-1" />Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => cancel.mutate(i.id)}><X className="h-3 w-3" /></Button>
                        </div>
                      )}
                      {canApprove && i.status === "approved" && (
                        <Button size="sm" onClick={() => issue.mutate(i.id)}><Truck className="h-3 w-3 mr-1" />Issue</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
