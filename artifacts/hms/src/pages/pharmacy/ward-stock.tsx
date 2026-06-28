import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, ArrowRightLeft, MapPin, Package } from "lucide-react";

const fetchLocations = async () => { const r = await fetch("/api/pharmacy/locations"); if (!r.ok) throw new Error("Failed"); return r.json(); };
const fetchLocationStock = async (locationId: string) => { const r = await fetch(`/api/pharmacy/location-stock?locationId=${locationId}`); if (!r.ok) throw new Error("Failed"); return r.json(); };
const fetchTransfers = async () => { const r = await fetch("/api/pharmacy/location-transfers"); if (!r.ok) throw new Error("Failed"); return r.json(); };
const fetchMedicines = async () => { const r = await fetch("/api/pharmacy/medicines?limit=500"); if (!r.ok) throw new Error("Failed"); return r.json(); };

const LOCATION_TYPE_LABELS: Record<string, string> = { ward: "Ward", icu: "ICU", ot: "OT", emergency: "Emergency", store: "Store" };
const LOCATION_TYPE_COLORS: Record<string, string> = { ward: "bg-blue-100 text-blue-700", icu: "bg-red-100 text-red-700", ot: "bg-purple-100 text-purple-700", emergency: "bg-orange-100 text-orange-700", store: "bg-gray-100 text-gray-700" };

export default function WardStockPage() {
  const qc = useQueryClient();
  const [selectedLoc, setSelectedLoc] = useState<string>("");
  const [showAddLoc, setShowAddLoc] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [locForm, setLocForm] = useState({ name: "", locationType: "ward", description: "" });
  const [txForm, setTxForm] = useState({ fromLocationId: "", toLocationId: "", medicineId: "", quantity: "", reason: "" });

  const { data: locations = [] } = useQuery({ queryKey: ["locations"], queryFn: fetchLocations });
  const { data: stock = [], isLoading: stockLoading } = useQuery({
    queryKey: ["location-stock", selectedLoc], queryFn: () => fetchLocationStock(selectedLoc), enabled: !!selectedLoc,
  });
  const { data: transfers = [] } = useQuery({ queryKey: ["location-transfers"], queryFn: fetchTransfers });
  const { data: medicines = [] } = useQuery({ queryKey: ["medicines-list"], queryFn: fetchMedicines });

  const addLoc = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
    onSuccess: () => { toast.success("Location added"); qc.invalidateQueries({ queryKey: ["locations"] }); setShowAddLoc(false); setLocForm({ name: "", locationType: "ward", description: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  const doTransfer = useMutation({
    mutationFn: async (d: any) => { const r = await fetch("/api/pharmacy/location-transfers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) }); if (!r.ok) { const j = await r.json(); throw new Error(j.error); } return r.json(); },
    onSuccess: () => { toast.success("Transfer completed"); qc.invalidateQueries({ queryKey: ["location-stock", selectedLoc] }); qc.invalidateQueries({ queryKey: ["location-transfers"] }); setShowTransfer(false); setTxForm({ fromLocationId: "", toLocationId: "", medicineId: "", quantity: "", reason: "" }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div><h1 className="text-xl font-bold">Ward / ICU Stock Management</h1><p className="text-sm text-muted-foreground">Monitor and transfer stock across hospital locations</p></div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}><ArrowRightLeft className="w-4 h-4 mr-1.5" />Transfer Stock</Button>
          <Button size="sm" onClick={() => setShowAddLoc(true)}><Plus className="w-4 h-4 mr-1.5" />Add Location</Button>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList><TabsTrigger value="stock">Stock by Location</TabsTrigger><TabsTrigger value="transfers">Transfer Log</TabsTrigger></TabsList>

        <TabsContent value="stock" className="space-y-4 mt-4">
          {/* Location selector */}
          <div className="flex flex-wrap gap-2">
            {(locations as any[]).map((loc: any) => (
              <button key={loc.id} onClick={() => setSelectedLoc(String(loc.id))}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${selectedLoc === String(loc.id) ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"}`}>
                <MapPin className="w-3.5 h-3.5" />
                <span>{loc.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${LOCATION_TYPE_COLORS[loc.locationType] ?? ""}`}>{LOCATION_TYPE_LABELS[loc.locationType] ?? loc.locationType}</span>
              </button>
            ))}
            {locations.length === 0 && <p className="text-sm text-muted-foreground">No locations yet. Add one to get started.</p>}
          </div>

          {selectedLoc && (
            <Card>
              <CardContent className="p-0">
                {stockLoading ? <div className="p-8 text-center text-muted-foreground">Loading…</div> : stock.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No stock at this location yet.<br />Transfer medicines here using the Transfer Stock button.</p></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Generic</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead className="text-right">Qty</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(stock as any[]).map((row: any) => (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium">{row.medicineName}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{row.genericName || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{row.batchNo || "—"}</TableCell>
                          <TableCell>{row.expiryDate || "—"}</TableCell>
                          <TableCell className="text-right font-semibold">{row.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transfers" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Transfer No</TableHead><TableHead>Medicine</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Batch</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>By</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(transfers as any[]).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No transfers yet</TableCell></TableRow>
                  ) : (transfers as any[]).map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono text-xs">{t.transferNo}</TableCell>
                      <TableCell>{t.medicineName}</TableCell>
                      <TableCell><Badge variant="outline">{t.fromLocation}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{t.toLocation}</Badge></TableCell>
                      <TableCell>{t.batchNo || "—"}</TableCell>
                      <TableCell className="text-right font-semibold">{t.quantity}</TableCell>
                      <TableCell>{t.transferredByName || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleDateString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Location Dialog */}
      <Dialog open={showAddLoc} onOpenChange={setShowAddLoc}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Location</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Location Name *</Label><Input value={locForm.name} onChange={e => setLocForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. ICU Ward A" /></div>
            <div><Label>Type *</Label>
              <Select value={locForm.locationType} onValueChange={v => setLocForm(f => ({ ...f, locationType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Description</Label><Input value={locForm.description} onChange={e => setLocForm(f => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddLoc(false)}>Cancel</Button>
            <Button onClick={() => addLoc.mutate(locForm)} disabled={!locForm.name || addLoc.isPending}>Add Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={showTransfer} onOpenChange={setShowTransfer}>
        <DialogContent>
          <DialogHeader><DialogTitle>Transfer Stock</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>From Location *</Label>
              <Select value={txForm.fromLocationId} onValueChange={v => setTxForm(f => ({ ...f, fromLocationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>{(locations as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>To Location *</Label>
              <Select value={txForm.toLocationId} onValueChange={v => setTxForm(f => ({ ...f, toLocationId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                <SelectContent>{(locations as any[]).map((l: any) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Medicine *</Label>
              <Select value={txForm.medicineId} onValueChange={v => setTxForm(f => ({ ...f, medicineId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select medicine" /></SelectTrigger>
                <SelectContent className="max-h-52">{(medicines as any[]).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantity *</Label><Input type="number" min={1} value={txForm.quantity} onChange={e => setTxForm(f => ({ ...f, quantity: e.target.value }))} /></div>
            <div><Label>Reason</Label><Input value={txForm.reason} onChange={e => setTxForm(f => ({ ...f, reason: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransfer(false)}>Cancel</Button>
            <Button onClick={() => doTransfer.mutate({ ...txForm, fromLocationId: Number(txForm.fromLocationId), toLocationId: Number(txForm.toLocationId), medicineId: Number(txForm.medicineId) })} disabled={!txForm.fromLocationId || !txForm.toLocationId || !txForm.medicineId || !txForm.quantity || doTransfer.isPending}>Transfer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
