import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Tag, Trash2 } from "lucide-react";

interface BillingHead {
  id: number; code: string; name: string; category: string; defaultRate: string;
}
interface PackageItem {
  id: number; quantity: number; billingHeadId: number;
  headName: string; headCode: string; headRate: string; headCategory: string;
}
interface Pkg {
  id: number; entityId: number | null; code: string; name: string;
  description: string | null; category: string | null;
  mrpTotal: string; packageRate: string; validityDays: number | null;
  isActive: boolean; items: PackageItem[];
}

export default function PackagesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", description: "", category: "Health Package",
    packageRate: "", validityDays: "30", entityId: "1",
  });
  const [items, setItems] = useState<{ billingHeadId: number; quantity: number }[]>([]);
  const [pickHead, setPickHead] = useState<string>("");

  const { data: packages, isLoading } = useQuery<Pkg[]>({
    queryKey: ["/api/packages"],
    queryFn: () => fetch("/api/packages").then((r) => r.json()),
  });
  const { data: heads } = useQuery<BillingHead[]>({
    queryKey: ["/api/billing-heads"],
    queryFn: () => fetch("/api/billing-heads").then((r) => r.json()),
  });

  const headMap = new Map((heads || []).map((h) => [h.id, h]));
  const computedMrp = items.reduce((s, it) => {
    const h = headMap.get(it.billingHeadId);
    return s + (h ? Number(h.defaultRate) * it.quantity : 0);
  }, 0);

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        entityId: Number(form.entityId),
        packageRate: Number(form.packageRate),
        validityDays: form.validityDays ? Number(form.validityDays) : null,
        items,
      };
      const r = await fetch("/api/packages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Package created");
      qc.invalidateQueries({ queryKey: ["/api/packages"] });
      setOpen(false);
      setForm({ code: "", name: "", description: "", category: "Health Package", packageRate: "", validityDays: "30", entityId: "1" });
      setItems([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = () => {
    if (!pickHead) return;
    const id = Number(pickHead);
    if (items.some((i) => i.billingHeadId === id)) return;
    setItems([...items, { billingHeadId: id, quantity: 1 }]);
    setPickHead("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Health Packages</h2>
          <p className="text-muted-foreground text-sm">Bundle billing heads at a discounted rate (e.g. Master Health Checkup, Cardiac Workup).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />New Package</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Health Package</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. PKG-EXEC" />
              </div>
              <div>
                <Label>Category</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Package Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="col-span-2 mt-2">
                <Label>Package Components</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={pickHead} onValueChange={setPickHead}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Select billing head to add..." /></SelectTrigger>
                    <SelectContent>
                      {(heads || []).map((h) => (
                        <SelectItem key={h.id} value={String(h.id)}>
                          {h.name} — ₹{Number(h.defaultRate).toLocaleString("en-IN")} ({h.category})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={addItem}>Add</Button>
                </div>
                <div className="mt-2 border rounded-lg overflow-hidden">
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4 text-center">No components added yet.</p>
                  ) : (
                    <div className="divide-y">
                      {items.map((it) => {
                        const h = headMap.get(it.billingHeadId);
                        if (!h) return null;
                        return (
                          <div key={it.billingHeadId} className="flex items-center gap-3 p-2 px-3">
                            <div className="flex-1 text-sm">
                              <span className="font-medium">{h.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs font-mono">{h.code}</span>
                            </div>
                            <Input type="number" className="w-20" min={1} value={it.quantity}
                              onChange={(e) => setItems(items.map((x) => x.billingHeadId === it.billingHeadId ? { ...x, quantity: Math.max(1, Number(e.target.value)) } : x))}
                            />
                            <span className="w-24 text-right text-sm">₹{(Number(h.defaultRate) * it.quantity).toLocaleString("en-IN")}</span>
                            <Button size="icon" variant="ghost" type="button"
                              onClick={() => setItems(items.filter((x) => x.billingHeadId !== it.billingHeadId))}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        );
                      })}
                      <div className="flex justify-between p-2 px-3 bg-muted text-sm font-medium">
                        <span>MRP Total</span>
                        <span>₹{computedMrp.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label>Package Rate (₹) *</Label>
                <Input type="number" value={form.packageRate} onChange={(e) => setForm({ ...form, packageRate: e.target.value })} />
                {Number(form.packageRate) > 0 && computedMrp > 0 && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Save ₹{(computedMrp - Number(form.packageRate)).toLocaleString("en-IN")} ({Math.round((1 - Number(form.packageRate) / computedMrp) * 100)}% off)
                  </p>
                )}
              </div>
              <div>
                <Label>Validity (days)</Label>
                <Input type="number" value={form.validityDays} onChange={(e) => setForm({ ...form, validityDays: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.code || !form.name || !form.packageRate || items.length === 0 || create.isPending}>
                {create.isPending ? "Creating..." : "Create Package"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-48" />)}</div>
      ) : (packages || []).length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No packages yet. Click "New Package" to create your first one.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(packages || []).map((p) => {
            const mrp = Number(p.mrpTotal);
            const rate = Number(p.packageRate);
            const savings = mrp - rate;
            const pct = mrp > 0 ? Math.round((savings / mrp) * 100) : 0;
            return (
              <Card key={p.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Tag className="w-4 h-4" />{p.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                    {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                  </div>
                  {p.category && <Badge variant="secondary">{p.category}</Badge>}
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                    {p.items.map((it) => (
                      <div key={it.id} className="flex justify-between items-center text-xs py-1 border-b last:border-0">
                        <span>{it.headName} {it.quantity > 1 && <span className="text-muted-foreground">×{it.quantity}</span>}</span>
                        <span className="text-muted-foreground">₹{(Number(it.headRate) * it.quantity).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end justify-between pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground line-through">₹{mrp.toLocaleString("en-IN")}</p>
                      <p className="text-2xl font-bold">₹{rate.toLocaleString("en-IN")}</p>
                    </div>
                    {savings > 0 && (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" variant="secondary">
                        Save ₹{savings.toLocaleString("en-IN")} ({pct}% off)
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
