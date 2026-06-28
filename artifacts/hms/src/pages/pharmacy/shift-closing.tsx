import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }
const today = () => new Date().toISOString().slice(0, 10);

export default function ShiftClosingPage() {
  const qc = useQueryClient();
  const [from, setFrom] = useState(today().slice(0, 7) + "-01");
  const [to, setTo] = useState(today());

  const { data, isLoading } = useQuery<any>({
    queryKey: ["pharmacy-shifts", from, to],
    queryFn: () => j(`/api/pharmacy/shifts?from=${from}&to=${to}`),
  });
  const shifts = data?.items || [];

  // Open shift dialog
  const [openShiftOpen, setOpenShiftOpen] = useState(false);
  const [openCash, setOpenCash] = useState(0);
  const [shiftDate, setShiftDate] = useState(today());

  const openShift = useMutation({
    mutationFn: () => j("/api/pharmacy/shifts", { method: "POST", body: JSON.stringify({ shiftDate, openingCash: openCash }) }),
    onSuccess: () => { toast.success("Shift opened"); qc.invalidateQueries({ queryKey: ["pharmacy-shifts"] }); setOpenShiftOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  // Close shift dialog
  const [closeOpen, setCloseOpen] = useState(false);
  const [closingShift, setClosingShift] = useState<any>(null);
  const [cashReceived, setCashReceived] = useState(0);
  const [upiReceived, setUpiReceived] = useState(0);
  const [cardReceived, setCardReceived] = useState(0);
  const [refunds, setRefunds] = useState(0);
  const [countedCash, setCountedCash] = useState(0);
  const [remarks, setRemarks] = useState("");

  const openClose = (shift: any) => {
    setClosingShift(shift);
    setCashReceived(0); setUpiReceived(0); setCardReceived(0); setRefunds(0); setCountedCash(0); setRemarks("");
    setCloseOpen(true);
  };

  const closeShift = useMutation({
    mutationFn: () => j(`/api/pharmacy/shifts/${closingShift.id}/close`, {
      method: "PUT",
      body: JSON.stringify({ cashReceived, upiReceived, cardReceived, refunds, countedCash, remarks }),
    }),
    onSuccess: (r: any) => {
      toast.success(`Shift closed · Difference: ${inr(r.difference)}`);
      qc.invalidateQueries({ queryKey: ["pharmacy-shifts"] });
      setCloseOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openingCash = parseFloat(closingShift?.openingCash || "0");
  const expected = openingCash + cashReceived - refunds;
  const difference = countedCash - expected;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6" />Shift Closing
          </h2>
          <p className="text-muted-foreground text-sm">Cash reconciliation and shift closure</p>
        </div>
        <Button onClick={() => setOpenShiftOpen(true)}><Plus className="h-4 w-4 mr-2" />Open New Shift</Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3 flex-wrap items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <Skeleton className="h-40 m-4" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Opening Cash</TableHead>
                  <TableHead className="text-right">Sales Total</TableHead>
                  <TableHead className="text-right">Cash In</TableHead>
                  <TableHead className="text-right">UPI</TableHead>
                  <TableHead className="text-right">Card</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Counted</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.length === 0 && (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-10">No shifts found.</TableCell></TableRow>
                )}
                {shifts.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.shiftDate}</TableCell>
                    <TableCell className="text-right">{inr(s.openingCash)}</TableCell>
                    <TableCell className="text-right font-medium">{inr(s.salesTotal)}</TableCell>
                    <TableCell className="text-right">{inr(s.cashReceived)}</TableCell>
                    <TableCell className="text-right">{inr(s.upiReceived)}</TableCell>
                    <TableCell className="text-right">{inr(s.cardReceived)}</TableCell>
                    <TableCell className="text-right">{inr(s.expectedCash)}</TableCell>
                    <TableCell className="text-right">{inr(s.countedCash)}</TableCell>
                    <TableCell className={`text-right font-semibold ${parseFloat(s.difference || "0") < 0 ? "text-red-600" : parseFloat(s.difference || "0") > 0 ? "text-green-600" : ""}`}>
                      {s.status === "closed" ? inr(s.difference) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={s.status === "closed" ? "bg-gray-100 text-gray-700" : "bg-green-100 text-green-700"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{s.closedByName || "—"}</TableCell>
                    <TableCell>
                      {s.status === "open" && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openClose(s)}>
                          <Lock className="h-3 w-3 mr-1" />Close
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

      {/* Open Shift Dialog */}
      <Dialog open={openShiftOpen} onOpenChange={setOpenShiftOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Open Pharmacy Shift</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Shift Date</Label>
              <Input type="date" value={shiftDate} onChange={e => setShiftDate(e.target.value)} className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-sm">Opening Cash (₹)</Label>
              <Input type="number" value={openCash} onChange={e => setOpenCash(Number(e.target.value))} className="h-8 text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenShiftOpen(false)}>Cancel</Button>
            <Button onClick={() => openShift.mutate()} disabled={openShift.isPending}>Open Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Shift Dialog */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Close Shift — {closingShift?.shiftDate}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm">Cash Received (₹)</Label>
                <Input type="number" value={cashReceived} onChange={e => setCashReceived(Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-sm">UPI Received (₹)</Label>
                <Input type="number" value={upiReceived} onChange={e => setUpiReceived(Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-sm">Card Received (₹)</Label>
                <Input type="number" value={cardReceived} onChange={e => setCardReceived(Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-sm">Refunds (₹)</Label>
                <Input type="number" value={refunds} onChange={e => setRefunds(Number(e.target.value))} className="h-8 text-sm mt-1" />
              </div>
            </div>

            <div className="border rounded p-3 bg-muted/30 text-sm space-y-1">
              <div className="flex justify-between"><span>Opening Cash</span><span>{inr(openingCash)}</span></div>
              <div className="flex justify-between"><span>+ Cash Received</span><span>{inr(cashReceived)}</span></div>
              <div className="flex justify-between"><span>− Refunds</span><span>{inr(refunds)}</span></div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Expected Cash</span><span>{inr(expected)}</span></div>
            </div>

            <div>
              <Label className="text-sm">Counted Cash (₹)</Label>
              <Input type="number" value={countedCash} onChange={e => setCountedCash(Number(e.target.value))} className="h-8 text-sm mt-1" />
            </div>

            <div className={`flex justify-between font-semibold text-sm px-1 ${difference < 0 ? "text-red-600" : difference > 0 ? "text-green-600" : "text-gray-700"}`}>
              <span>Difference (Short/Over)</span>
              <span>{difference >= 0 ? "+" : ""}{inr(difference)}</span>
            </div>

            <div>
              <Label className="text-sm">Remarks</Label>
              <Input value={remarks} onChange={e => setRemarks(e.target.value)} className="h-8 text-sm mt-1" placeholder="Optional remarks…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={() => closeShift.mutate()} disabled={closeShift.isPending}>
              {closeShift.isPending ? "Closing…" : "Close Shift"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
