import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Plus, Check, Search } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }
const today = () => new Date().toISOString().slice(0, 10);

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
};

export default function SalesReturnsPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["sales-returns", from, to, search, statusFilter],
    queryFn: () => j(`/api/pharmacy/sales-returns?from=${from}&to=${to}${search ? `&search=${encodeURIComponent(search)}` : ""}${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`),
  });
  const returns = data?.items || [];

  // Create return dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [billSearch, setBillSearch] = useState("");
  const [foundBill, setFoundBill] = useState<any>(null);
  const [selectedItems, setSelectedItems] = useState<{ medicineId: number; name: string; batchNo: string; qty: number; maxQty: number; rate: number; gstPercent: number; isUsable: boolean }[]>([]);
  const [reason, setReason] = useState("patient_request");
  const [refundMode, setRefundMode] = useState("cash");
  const [notes, setNotes] = useState("");

  const searchBill = async () => {
    if (!billSearch.trim()) return;
    try {
      const salesData = await j(`/api/pharmacy/sales?search=${encodeURIComponent(billSearch.trim())}`);
      const bill = salesData?.sales?.find((s: any) => s.billNo.toLowerCase() === billSearch.trim().toLowerCase());
      if (!bill) { toast.error("Bill not found"); return; }
      setFoundBill(bill);
      const items = (bill.items as any[]) || [];
      setSelectedItems(items.map((it: any) => ({
        medicineId: it.medicineId, name: it.name || it.medicineName || `Med#${it.medicineId}`,
        batchNo: it.batchNo || "", qty: 0, maxQty: it.quantity || 1,
        rate: parseFloat(it.rate || "0"), gstPercent: parseFloat(it.gstPercent || "12"),
        isUsable: true,
      })));
    } catch (e: any) { toast.error(e.message); }
  };

  const createReturn = useMutation({
    mutationFn: () => {
      const lineItems = selectedItems.filter(it => it.qty > 0).map(it => ({
        medicineId: it.medicineId, batchNo: it.batchNo, quantityReturned: it.qty,
        rate: it.rate, gstPercent: it.gstPercent, isUsable: it.isUsable,
      }));
      if (!lineItems.length) throw new Error("Select at least one item with qty > 0");
      return j("/api/pharmacy/sales-returns", {
        method: "POST",
        body: JSON.stringify({
          originalSaleId: foundBill?.id,
          originalBillNo: foundBill?.billNo,
          patientId: foundBill?.patientId,
          returnDate: today(), reason,
          items: lineItems, refundMode, notes,
        }),
      });
    },
    onSuccess: (r: any) => {
      toast.success(`Sales return ${r.returnNo} created`);
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
      setCreateOpen(false);
      setFoundBill(null); setBillSearch(""); setSelectedItems([]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeReturn = useMutation({
    mutationFn: (id: number) => j(`/api/pharmacy/sales-returns/${id}/complete`, { method: "PUT" }),
    onSuccess: () => {
      toast.success("Sales return processed — stock updated");
      qc.invalidateQueries({ queryKey: ["sales-returns"] });
      qc.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const returnTotal = selectedItems.reduce((s, it) => s + it.qty * it.rate * (1 + it.gstPercent / 100), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Sales Returns</h2>
          <p className="text-muted-foreground text-sm">Patient medicine returns · GST Credit Note</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />New Sales Return</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32 h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs">Search</Label>
              <Input placeholder="Return No / Bill No…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-40 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return No</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Original Bill</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Refund Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-10">No sales returns found.</TableCell></TableRow>
                )}
                {returns.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs font-semibold">{r.returnNo}</TableCell>
                    <TableCell className="text-sm">{r.returnDate}</TableCell>
                    <TableCell className="font-mono text-xs">{r.originalBillNo || "—"}</TableCell>
                    <TableCell className="text-sm">{r.patientName || "Walk-in"}</TableCell>
                    <TableCell className="text-sm">{r.reason?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-right font-medium">{inr(r.totalAmount)}</TableCell>
                    <TableCell className="text-sm capitalize">{r.refundMode}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_COLORS[r.status] || ""}>{r.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "draft" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700 border-green-300" onClick={() => completeReturn.mutate(r.id)}>
                          <Check className="h-3 w-3 mr-1" />Process
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Return Dialog */}
      <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) { setFoundBill(null); setBillSearch(""); setSelectedItems([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Sales Return</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Bill search */}
            <div>
              <Label className="text-sm">Search Original Bill</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="Enter bill number…" value={billSearch} onChange={e => setBillSearch(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchBill()} className="h-8 text-sm" />
                <Button size="sm" variant="outline" onClick={searchBill}><Search className="h-4 w-4" /></Button>
              </div>
            </div>

            {foundBill && (
              <div className="border rounded p-3 bg-muted/30">
                <p className="text-sm font-medium">Bill: <span className="font-mono">{foundBill.billNo}</span> · {foundBill.billDate}</p>
                <p className="text-xs text-muted-foreground">Patient: {foundBill.patientName || "Walk-in"} · Total: {inr(foundBill.totalAmount)}</p>
              </div>
            )}

            {selectedItems.length > 0 && (
              <div>
                <Label className="text-sm">Select Items to Return</Label>
                <div className="border rounded divide-y mt-1">
                  {selectedItems.map((it, idx) => (
                    <div key={it.medicineId} className="p-2 flex items-center gap-3 text-sm">
                      <div className="flex-1">
                        <p className="font-medium">{it.name}</p>
                        <p className="text-xs text-muted-foreground">Batch: {it.batchNo || "N/A"} · Rate: {inr(it.rate)} · Max: {it.maxQty}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Qty</Label>
                        <Input type="number" min={0} max={it.maxQty} value={it.qty}
                          onChange={e => setSelectedItems(items => items.map((x, i) => i === idx ? { ...x, qty: Math.min(it.maxQty, Math.max(0, parseInt(e.target.value) || 0)) } : x))}
                          className="w-16 h-7 text-sm" />
                        <Select value={it.isUsable ? "usable" : "damaged"} onValueChange={v => setSelectedItems(items => items.map((x, i) => i === idx ? { ...x, isUsable: v === "usable" } : x))}>
                          <SelectTrigger className="w-24 h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="usable">Usable</SelectItem>
                            <SelectItem value="damaged">Damaged</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Return Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patient_request">Patient Request</SelectItem>
                    <SelectItem value="wrong_medicine">Wrong Medicine Dispensed</SelectItem>
                    <SelectItem value="damaged">Damaged</SelectItem>
                    <SelectItem value="expired">Near Expiry</SelectItem>
                    <SelectItem value="adverse_reaction">Adverse Reaction</SelectItem>
                    <SelectItem value="overstocked">Overstocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Refund Mode</Label>
                <Select value={refundMode} onValueChange={setRefundMode}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="credit">Credit to Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-sm">Notes</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} className="h-8 text-sm mt-1" placeholder="Optional notes…" />
            </div>

            {returnTotal > 0 && (
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm font-medium">Return Total (incl. GST)</span>
                <span className="text-lg font-bold">{inr(returnTotal)}</span>
              </div>
            )}

            {!foundBill && (
              <div className="flex items-center gap-2 text-amber-600 text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>Search for the original bill first to select items.</span>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createReturn.mutate()} disabled={!foundBill || selectedItems.filter(it => it.qty > 0).length === 0 || createReturn.isPending}>
              {createReturn.isPending ? "Creating…" : "Create Sales Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
