import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, FlaskConical, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700", counting: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700", approved: "bg-purple-100 text-purple-700",
};

async function fetchSessions() { const r = await fetch("/api/pharmacy/stock-verification"); if (!r.ok) throw new Error("Failed"); return r.json(); }
async function fetchItems(sessionId: number) { const r = await fetch(`/api/pharmacy/stock-verification/${sessionId}/items`); if (!r.ok) throw new Error("Failed"); return r.json(); }

export default function StockVerificationPage() {
  const qc = useQueryClient();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [editingItem, setEditingItem] = useState<any>(null);
  const [physicalQty, setPhysicalQty] = useState("");
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");

  const { data: sessions = [] } = useQuery({ queryKey: ["stock-verifications"], queryFn: fetchSessions });
  const { data: items = [] } = useQuery({
    queryKey: ["sv-items", activeSession?.id],
    queryFn: () => fetchItems(activeSession.id),
    enabled: !!activeSession,
  });

  const createSession = useMutation({
    mutationFn: async () => { const r = await fetch("/api/pharmacy/stock-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ verificationDate: newDate }) }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: (s) => { toast.success("Verification session created"); qc.invalidateQueries({ queryKey: ["stock-verifications"] }); setActiveSession(s); setShowNew(false); },
    onError: () => toast.error("Failed to create session"),
  });

  const updateItem = useMutation({
    mutationFn: async ({ itemId, physicalQty, reason }: any) => {
      const r = await fetch(`/api/pharmacy/stock-verification/${activeSession.id}/items/${itemId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ physicalQty: parseInt(physicalQty), reason }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sv-items", activeSession?.id] }); setEditingItem(null); setPhysicalQty(""); setReason(""); },
    onError: () => toast.error("Failed to update"),
  });

  const completeSession = useMutation({
    mutationFn: async () => { const r = await fetch(`/api/pharmacy/stock-verification/${activeSession.id}/complete`, { method: "PUT" }); if (!r.ok) throw new Error("Failed"); return r.json(); },
    onSuccess: (s) => { toast.success("Verification completed"); qc.invalidateQueries({ queryKey: ["stock-verifications"] }); setActiveSession(s); },
    onError: () => toast.error("Failed"),
  });

  const counted = (items as any[]).filter((i: any) => i.physicalQty !== null && i.physicalQty !== undefined).length;
  const totalVariance = (items as any[]).reduce((s, i) => s + parseFloat(i.varianceValue ?? "0"), 0);
  const surplusItems = (items as any[]).filter((i: any) => (i.variance ?? 0) > 0);
  const shortageItems = (items as any[]).filter((i: any) => (i.variance ?? 0) < 0);

  const filteredItems = (items as any[]).filter((i: any) => !search || i.medicineName.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div><h1 className="text-xl font-bold">Physical Stock Verification</h1><p className="text-sm text-muted-foreground">Audit physical stock vs system counts</p></div>
        <Button size="sm" onClick={() => setShowNew(true)}><Plus className="w-4 h-4 mr-1.5" />New Session</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Sessions list */}
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Sessions</p>
          {(sessions as any[]).length === 0 ? <p className="text-sm text-muted-foreground">No sessions yet</p> : (sessions as any[]).map((s: any) => (
            <button key={s.id} onClick={() => setActiveSession(s)} className={`w-full text-left p-3 rounded-lg border transition-colors ${activeSession?.id === s.id ? "border-primary bg-primary/5" : "hover:bg-muted"}`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono">{s.sessionNo}</span>
                <Badge className={STATUS_COLORS[s.status] ?? ""}>{s.status}</Badge>
              </div>
              <div className="text-sm mt-0.5">{s.verificationDate}</div>
            </button>
          ))}
        </div>

        {/* Items count sheet */}
        <div className="lg:col-span-3 space-y-4">
          {activeSession ? (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-sm"><span className="font-semibold text-blue-700">{counted}</span><span className="text-blue-600"> / {items.length} counted</span></div>
                  {shortageItems.length > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"><TrendingDown className="w-3.5 h-3.5" /><span>{shortageItems.length} short</span></div>}
                  {surplusItems.length > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700"><TrendingUp className="w-3.5 h-3.5" /><span>{surplusItems.length} surplus</span></div>}
                  {counted > 0 && <div className={`px-3 py-1.5 rounded-lg text-sm ${totalVariance < 0 ? "bg-red-50 border border-red-200 text-red-700" : "bg-green-50 border border-green-200 text-green-700"}`}>₹{Math.abs(totalVariance).toLocaleString("en-IN", { maximumFractionDigits: 0 })} variance</div>}
                </div>
                {activeSession.status !== "completed" && counted > 0 && (
                  <Button size="sm" onClick={() => completeSession.mutate()} disabled={completeSession.isPending} className="ml-auto">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />Complete
                  </Button>
                )}
              </div>
              <Input placeholder="Search medicine…" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-[55vh] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-card z-10">
                        <TableRow>
                          <TableHead>Medicine</TableHead>
                          <TableHead className="text-right">System Qty</TableHead>
                          <TableHead className="text-right">Physical Qty</TableHead>
                          <TableHead className="text-right">Variance</TableHead>
                          <TableHead className="text-right">Value (₹)</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredItems.map((item: any) => {
                          const hasVariance = item.variance !== null && item.variance !== 0;
                          return (
                            <TableRow key={item.id} className={hasVariance ? (item.variance < 0 ? "bg-red-50/50" : "bg-green-50/50") : ""}>
                              <TableCell className="font-medium text-sm">{item.medicineName}<br /><span className="text-xs text-muted-foreground font-mono">{item.batchNo || ""}</span></TableCell>
                              <TableCell className="text-right">{item.systemQty}</TableCell>
                              <TableCell className="text-right font-semibold">{item.physicalQty ?? <span className="text-muted-foreground">—</span>}</TableCell>
                              <TableCell className={`text-right font-semibold ${item.variance < 0 ? "text-red-600" : item.variance > 0 ? "text-green-600" : ""}`}>{item.variance !== null ? (item.variance > 0 ? `+${item.variance}` : item.variance) : "—"}</TableCell>
                              <TableCell className={`text-right ${item.varianceValue < 0 ? "text-red-600" : item.varianceValue > 0 ? "text-green-600" : ""}`}>{item.varianceValue !== null ? `₹${Math.abs(parseFloat(item.varianceValue)).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}</TableCell>
                              <TableCell>
                                {activeSession.status !== "completed" && (
                                  <Button variant="outline" size="sm" onClick={() => { setEditingItem(item); setPhysicalQty(item.physicalQty !== null ? String(item.physicalQty) : ""); setReason(item.reason ?? ""); }}>Count</Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
              <FlaskConical className="w-10 h-10 mb-2 opacity-30" />
              <p>Select a verification session or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {/* New Session Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Verification Session</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">A snapshot of current system stock will be taken for all medicines.</p>
          <div><Label>Verification Date</Label><Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => createSession.mutate()} disabled={createSession.isPending}>Create Session</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Count Dialog */}
      <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enter Count — {editingItem?.medicineName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">System Qty</span><span className="font-semibold">{editingItem?.systemQty}</span></div>
            <div><Label>Physical Count *</Label><Input type="number" min={0} value={physicalQty} onChange={e => setPhysicalQty(e.target.value)} autoFocus /></div>
            {physicalQty !== "" && editingItem && parseInt(physicalQty) !== editingItem.systemQty && (
              <div className={`text-sm font-medium ${parseInt(physicalQty) < editingItem.systemQty ? "text-red-600" : "text-green-600"}`}>
                Variance: {parseInt(physicalQty) - editingItem.systemQty > 0 ? "+" : ""}{parseInt(physicalQty) - editingItem.systemQty}
              </div>
            )}
            <div><Label>Reason (for variance)</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. counted broken packs" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>Cancel</Button>
            <Button onClick={() => updateItem.mutate({ itemId: editingItem.id, physicalQty, reason })} disabled={physicalQty === "" || updateItem.isPending}>Save Count</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
