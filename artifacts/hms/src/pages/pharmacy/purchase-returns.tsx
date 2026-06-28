import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Truck, Plus, Printer, Check, ArrowRightCircle, Search, X } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

function inr(n: any) { return `Rs. ${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  approved: "bg-blue-100 text-blue-800",
  completed: "bg-emerald-100 text-emerald-800",
};

export default function PurchaseReturnsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  // New return form state
  const [vendorId, setVendorId] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [returnDate, setReturnDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [returnItems, setReturnItems] = useState<{ medicineId: number; name: string; batchNo: string; quantityReturned: number; rate: number; gstPercent: number }[]>([]);
  const [itemSearch, setItemSearch] = useState("");
  const [notes, setNotes] = useState("");

  const { data: vendors } = useQuery<any[]>({ queryKey: ["vendors"], queryFn: () => j("/api/vendors") });
  const { data: medicines } = useQuery<any[]>({ queryKey: ["medicines"], queryFn: () => j("/api/pharmacy/medicines") });
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["purchase-returns"],
    queryFn: () => j("/api/pharmacy/purchase-returns"),
  });

  const items = data?.items || [];

  const create = useMutation({
    mutationFn: () => j("/api/pharmacy/purchase-returns", {
      method: "POST",
      body: JSON.stringify({
        vendorId: parseInt(vendorId),
        purchaseId: purchaseId ? parseInt(purchaseId) : undefined,
        returnDate,
        reason,
        notes,
        items: returnItems.map(it => ({
          medicineId: it.medicineId,
          batchNo: it.batchNo,
          quantityReturned: it.quantityReturned,
          rate: it.rate,
          gstPercent: it.gstPercent,
        })),
      }),
    }),
    onSuccess: () => {
      toast.success("Purchase return created");
      setOpen(false);
      resetForm();
      refetch();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: (id: number) => j(`/api/pharmacy/purchase-returns/${id}/approve`, { method: "PUT" }),
    onSuccess: () => { toast.success("Return approved"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const complete = useMutation({
    mutationFn: (id: number) => j(`/api/pharmacy/purchase-returns/${id}/complete`, { method: "PUT" }),
    onSuccess: () => { toast.success("Return completed — stock sent back to vendor"); refetch(); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setVendorId(""); setPurchaseId(""); setReason(""); setNotes("");
    setReturnItems([]); setItemSearch("");
  };

  const addItem = (m: any) => {
    setReturnItems(its => {
      if (its.find(x => x.medicineId === m.id)) return its;
      const rate = parseFloat(m.purchaseRate || m.mrp || "0");
      return [...its, { medicineId: m.id, name: m.name, batchNo: m.batchNo || "", quantityReturned: 1, rate, gstPercent: parseFloat(m.gstPercent || "12") }];
    });
    setItemSearch("");
  };

  const updateQty = (id: number, qty: number) => setReturnItems(its => its.map(x => x.medicineId === id ? { ...x, quantityReturned: Math.max(1, qty) } : x));
  const removeItem = (id: number) => setReturnItems(its => its.filter(x => x.medicineId !== id));

  const subtotal = returnItems.reduce((s, i) => s + i.quantityReturned * i.rate, 0);
  const gst = returnItems.reduce((s, i) => s + i.quantityReturned * i.rate * (i.gstPercent / 100), 0);
  const total = subtotal + gst;

  const printReturn = async (r: any) => {
    // Fetch full detail with items if not present
    let detail = r;
    if (!r.items?.length) {
      try { detail = await j(`/api/pharmacy/purchase-returns/${r.id}`); } catch {}
    }
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Purchase Return ${detail.returnNo}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;font-size:12px}h1{font-size:16px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}th{background:#f3f4f6}.right{text-align:right}</style></head>
      <body><h1>Purchase Return Challan — ${detail.returnNo}</h1>
      <p>Date: ${detail.returnDate} | Vendor: ${detail.vendorName || "#" + detail.vendorId} | Status: ${detail.status}</p>
      <table><thead><tr><th>Medicine</th><th>Batch</th><th>Qty</th><th>Rate</th><th>GST%</th><th class="right">Amount</th></tr></thead><tbody>
      ${(detail.items || []).map((it: any) => `<tr><td>${it.medicineName || "#" + it.medicineId}</td><td>${it.batchNo || "—"}</td><td>${it.quantityReturned}</td><td>${inr(it.rate)}</td><td>${it.gstPercent}%</td><td class="right">${inr(it.amount)}</td></tr>`).join("")}
      </tbody><tfoot><tr><td colspan="5" class="right"><strong>Total</strong></td><td class="right"><strong>${inr(detail.totalAmount)}</strong></td></tr></tfoot></table>
      <p style="margin-top:16px"><strong>Reason:</strong> ${detail.reason}</p>
      <p><strong>Notes:</strong> ${detail.notes || "—"}</p>
      </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Purchase Returns
          </h2>
          <p className="text-muted-foreground text-sm">Return expired / damaged stock to vendors with GST credit notes</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Return</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vendor</Label>
                  <Select value={vendorId} onValueChange={setVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                    <SelectContent>
                      {(vendors || []).map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Return Date</Label>
                  <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="expired">Expired Stock</SelectItem>
                    <SelectItem value="damaged">Damaged / Broken</SelectItem>
                    <SelectItem value="wrong_item">Wrong Item Supplied</SelectItem>
                    <SelectItem value="excess">Excess Supply</SelectItem>
                    <SelectItem value="quality_issue">Quality Issue</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Add Medicine</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search medicine..." className="pl-8" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} />
                </div>
                {itemSearch && (
                  <div className="border rounded mt-1 max-h-32 overflow-auto bg-popover">
                    {(medicines || []).filter((m: any) => m.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 6).map((m: any) => (
                      <button key={m.id} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition" onClick={() => addItem(m)}>
                        {m.name} <span className="text-muted-foreground">({m.batchNo || "no batch"})</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {returnItems.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Batch</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>GST%</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {returnItems.map(it => (
                      <TableRow key={it.medicineId}>
                        <TableCell className="font-medium">{it.name}</TableCell>
                        <TableCell className="font-mono text-xs">{it.batchNo}</TableCell>
                        <TableCell><Input type="number" min={1} className="w-20 h-8" value={it.quantityReturned} onChange={(e) => updateQty(it.medicineId, parseInt(e.target.value))} /></TableCell>
                        <TableCell>{inr(it.rate)}</TableCell>
                        <TableCell>{it.gstPercent}%</TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(it.medicineId)}><X className="h-3.5 w-3.5" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <div className="flex justify-between text-sm font-medium border-t pt-2">
                <span>Subtotal: {inr(subtotal)}</span>
                <span>GST: {inr(gst)}</span>
                <span>Total: {inr(total)}</span>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!vendorId || !reason || returnItems.length === 0 || create.isPending}>
                {create.isPending ? "Creating..." : "Create Return"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : items.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No purchase returns found.</TableCell></TableRow>
              ) : items.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs font-medium">{r.returnNo}</TableCell>
                  <TableCell>{r.returnDate}</TableCell>
                  <TableCell>{r.vendorName || `Vendor #${r.vendorId}`}</TableCell>
                  <TableCell className="capitalize">{r.reason.replace(/_/g, " ")}</TableCell>
                  <TableCell className="font-semibold">{inr(r.totalAmount)}</TableCell>
                  <TableCell><Badge variant="secondary" className={STATUS_BADGE[r.status] || ""}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => printReturn(r)}><Printer className="h-3.5 w-3.5" /></Button>
                      {r.status === "draft" && <Button size="sm" variant="outline" className="h-7" onClick={() => approve.mutate(r.id)}><Check className="h-3.5 w-3.5 mr-1" />Approve</Button>}
                      {r.status === "approved" && <Button size="sm" variant="outline" className="h-7" onClick={() => complete.mutate(r.id)}><ArrowRightCircle className="h-3.5 w-3.5 mr-1" />Complete</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
