import { useState } from "react";
import { useListInventoryItems, useGetInventorySummary } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle } from "lucide-react";

const CATEGORIES = ["Consumables", "Dressing", "Equipment", "Linen", "Instruments", "Office Supplies", "Other"];

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Consumables", unit: "", currentStock: "", reorderLevel: "10", purchaseRate: "", vendor: "" });
  const qc = useQueryClient();

  const { data: items, isLoading } = useListInventoryItems({ category, search });
  const { data: summary } = useGetInventorySummary();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.unit || !form.currentStock) { toast.error("Name, unit and stock are required"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, currentStock: parseFloat(form.currentStock), reorderLevel: parseFloat(form.reorderLevel), purchaseRate: parseFloat(form.purchaseRate) || 0 }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Inventory item added");
      setOpen(false);
      setForm({ name: "", category: "Consumables", unit: "", currentStock: "", reorderLevel: "10", purchaseRate: "", vendor: "" });
      qc.invalidateQueries({ queryKey: ["/api/inventory/items"] });
    } catch (err: any) {
      toast.error("Failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Hospital Inventory</h2>
          <p className="text-muted-foreground text-sm">Non-pharmaceutical consumables and equipment</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Inventory Item</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2"><Label>Item Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Item name" /></div>
                <div className="space-y-2">
                  <Label>Category *</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-2"><Label>Unit *</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="e.g. box, unit" /></div>
                <div className="space-y-2"><Label>Current Stock *</Label><Input type="number" value={form.currentStock} onChange={e => setForm(f => ({ ...f, currentStock: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" value={form.reorderLevel} onChange={e => setForm(f => ({ ...f, reorderLevel: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Purchase Rate (₹)</Label><Input type="number" value={form.purchaseRate} onChange={e => setForm(f => ({ ...f, purchaseRate: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Vendor</Label><Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} /></div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting}>{submitting ? "Saving…" : "Add Item"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { title: "Total Items", value: summary?.totalItems },
          { title: "Low Stock", value: summary?.lowStockCount, alert: true },
          { title: "Total Value", value: summary?.totalValue ? `₹${Number(summary.totalValue).toLocaleString()}` : "—" },
        ].map(({ title, value, alert }) => (
          <Card key={title} className={alert && Number(value) > 0 ? "border-yellow-300" : ""}>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
            <CardContent><p className={`text-2xl font-bold ${alert && Number(value) > 0 ? "text-yellow-600" : ""}`}>{value ?? "—"}</p></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex gap-4">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search items..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead>Reorder Level</TableHead>
                <TableHead>Purchase Rate</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : (items || []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No inventory items found.</TableCell></TableRow>
              ) : (
                (items || []).map((item: any) => {
                  const isLow = parseFloat(item.currentStock) <= parseFloat(item.reorderLevel || "10");
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-semibold">{item.name}</TableCell>
                      <TableCell><Badge variant="outline">{item.category}</Badge></TableCell>
                      <TableCell>
                        <span className={`font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>{item.currentStock}</span>
                        {isLow && <AlertTriangle className="inline h-3 w-3 ml-1 text-yellow-500" />}
                      </TableCell>
                      <TableCell>{item.unit}</TableCell>
                      <TableCell>{item.reorderLevel}</TableCell>
                      <TableCell>₹{parseFloat(item.purchaseRate || "0").toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.vendor || "—"}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${isLow ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>
                          {isLow ? "Low Stock" : "In Stock"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
