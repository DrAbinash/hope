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
import { Plus, Truck, Trash2, Wallet, IndianRupee, Pencil } from "lucide-react";
import { toast } from "sonner";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "NEFT", "RTGS", "IMPS", "Cheque", "Card"];
const PAYMENT_TERMS = ["Net 7", "Net 15", "Net 30", "Net 45", "Net 60", "Net 90", "Advance", "On Delivery"];

const blankVendor = {
  name: "", contactPerson: "", phone: "", email: "", address: "",
  gstin: "", pan: "", drugLicenseNo: "", paymentTerms: "Net 30",
  openingBalance: 0, isActive: true, notes: "",
};

export default function VendorsPage() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [tab, setTab] = useState("vendors");
  const [openVendor, setOpenVendor] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [vform, setVform] = useState<any>(blankVendor);

  const [openPurchase, setOpenPurchase] = useState(false);
  const [pform, setPform] = useState<any>({ vendorId: 0, invoiceNo: "", invoiceDate: today, gstStateType: "intra", discount: 0, paidAmount: 0, items: [], notes: "" });
  const [pItem, setPItem] = useState<any>({ medicineId: 0, medicineName: "", quantity: 1, purchaseRate: 0, gstPercent: 12, batchNo: "", expiryDate: "" });

  const [openPayment, setOpenPayment] = useState(false);
  const [payform, setPayform] = useState<any>({ vendorId: 0, purchaseId: "", paymentDate: today, amount: 0, mode: "Bank Transfer", reference: "", notes: "" });

  const { data: vendors } = useQuery<any[]>({ queryKey: ["vendors"], queryFn: async () => { const d = await j("/api/vendors"); return Array.isArray(d) ? d : []; } });
  const { data: purchases } = useQuery<any[]>({ queryKey: ["vendor-purchases"], queryFn: async () => { const d = await j("/api/vendor-purchases"); return Array.isArray(d) ? d : []; } });
  const { data: payments } = useQuery<any[]>({ queryKey: ["vendor-payments"], queryFn: async () => { const d = await j("/api/vendor-payments"); return Array.isArray(d) ? d : []; } });
  const { data: outstanding } = useQuery<any>({ queryKey: ["vendor-outstanding"], queryFn: () => j("/api/vendor-outstanding") });
  const { data: medicines } = useQuery<any[]>({ queryKey: ["medicines-all"], queryFn: async () => { const d = await j("/api/pharmacy/medicines"); return Array.isArray(d) ? d : []; } });

  const saveVendor = useMutation({
    mutationFn: () => editingVendor
      ? j(`/api/vendors/${editingVendor.id}`, { method: "PUT", body: JSON.stringify(vform) })
      : j("/api/vendors", { method: "POST", body: JSON.stringify(vform) }),
    onSuccess: () => {
      toast.success(editingVendor ? "Vendor updated" : "Vendor created");
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["vendor-outstanding"] });
      setOpenVendor(false); setEditingVendor(null); setVform(blankVendor);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createPurchase = useMutation({
    mutationFn: () => j("/api/vendor-purchases", { method: "POST", body: JSON.stringify(pform) }),
    onSuccess: () => {
      toast.success("Purchase recorded — stock updated");
      qc.invalidateQueries({ queryKey: ["vendor-purchases"] });
      qc.invalidateQueries({ queryKey: ["vendor-outstanding"] });
      qc.invalidateQueries({ queryKey: ["medicines-all"] });
      setOpenPurchase(false);
      setPform({ vendorId: 0, invoiceNo: "", invoiceDate: today, gstStateType: "intra", discount: 0, paidAmount: 0, items: [], notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createPayment = useMutation({
    mutationFn: () => j("/api/vendor-payments", { method: "POST", body: JSON.stringify({ ...payform, purchaseId: payform.purchaseId ? parseInt(payform.purchaseId) : null }) }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["vendor-payments"] });
      qc.invalidateQueries({ queryKey: ["vendor-purchases"] });
      qc.invalidateQueries({ queryKey: ["vendor-outstanding"] });
      setOpenPayment(false);
      setPayform({ vendorId: 0, purchaseId: "", paymentDate: today, amount: 0, mode: "Bank Transfer", reference: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPItem = () => {
    if (!pItem.medicineId || pItem.quantity <= 0 || pItem.purchaseRate <= 0) {
      toast.error("Pick medicine, quantity, rate"); return;
    }
    setPform({ ...pform, items: [...pform.items, pItem] });
    setPItem({ medicineId: 0, medicineName: "", quantity: 1, purchaseRate: 0, gstPercent: 12, batchNo: "", expiryDate: "" });
  };

  const pickMedicine = (val: string) => {
    const m = (medicines || []).find((x: any) => x.id === parseInt(val));
    if (m) setPItem({
      ...pItem, medicineId: m.id, medicineName: m.name,
      purchaseRate: parseFloat(m.purchaseRate || "0") || 0,
      gstPercent: parseFloat(m.gstPercent || "12"),
      batchNo: m.batchNo || "", expiryDate: m.expiryDate || "",
    });
  };

  const subtotal = pform.items.reduce((s: number, i: any) => s + i.quantity * i.purchaseRate, 0);
  const gst = pform.items.reduce((s: number, i: any) => s + (i.quantity * i.purchaseRate) * (i.gstPercent || 0) / 100, 0);
  const total = subtotal - parseFloat(pform.discount || 0) + gst;

  const filteredPurchasesForVendor = payform.vendorId
    ? (purchases || []).filter((p: any) => p.vendorId === parseInt(String(payform.vendorId)) && parseFloat(p.dueAmount || "0") > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Truck className="h-6 w-6" />Vendor Management</h2>
          <p className="text-muted-foreground text-sm">Suppliers · Purchase invoices · Payments · Outstanding</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Active Vendors</div><div className="text-2xl font-bold">{(vendors || []).filter((v: any) => v.isActive).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Purchases</div><div className="text-2xl font-bold">{(purchases || []).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Payments Recorded</div><div className="text-2xl font-bold text-green-600">{(payments || []).length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Outstanding</div><div className="text-2xl font-bold text-red-600">{inr(outstanding?.totalOutstanding)}</div></CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">Vendor Master</CardTitle>
              <Dialog open={openVendor} onOpenChange={(v) => { setOpenVendor(v); if (!v) { setEditingVendor(null); setVform(blankVendor); } }}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />New Vendor</Button></DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader><DialogTitle>{editingVendor ? "Edit Vendor" : "New Vendor"}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label>Name *</Label><Input value={vform.name} onChange={e => setVform({ ...vform, name: e.target.value })} /></div>
                    <div><Label>Contact Person</Label><Input value={vform.contactPerson} onChange={e => setVform({ ...vform, contactPerson: e.target.value })} /></div>
                    <div><Label>Phone</Label><Input value={vform.phone} onChange={e => setVform({ ...vform, phone: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Email</Label><Input value={vform.email} onChange={e => setVform({ ...vform, email: e.target.value })} /></div>
                    <div className="col-span-2"><Label>Address</Label><Textarea rows={2} value={vform.address} onChange={e => setVform({ ...vform, address: e.target.value })} /></div>
                    <div><Label>GSTIN</Label><Input value={vform.gstin} onChange={e => setVform({ ...vform, gstin: e.target.value })} placeholder="27AABCS1234F1Z5" /></div>
                    <div><Label>PAN</Label><Input value={vform.pan} onChange={e => setVform({ ...vform, pan: e.target.value })} /></div>
                    <div><Label>Drug License No</Label><Input value={vform.drugLicenseNo} onChange={e => setVform({ ...vform, drugLicenseNo: e.target.value })} /></div>
                    <div>
                      <Label>Payment Terms</Label>
                      <Select value={vform.paymentTerms} onValueChange={v => setVform({ ...vform, paymentTerms: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_TERMS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Opening Balance (₹)</Label><Input type="number" value={vform.openingBalance} onChange={e => setVform({ ...vform, openingBalance: parseFloat(e.target.value) || 0 })} /></div>
                    <div className="flex items-end gap-2"><input type="checkbox" checked={vform.isActive} onChange={e => setVform({ ...vform, isActive: e.target.checked })} /><Label>Active</Label></div>
                    <div className="col-span-2"><Label>Notes</Label><Textarea rows={2} value={vform.notes} onChange={e => setVform({ ...vform, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenVendor(false)}>Cancel</Button>
                    <Button onClick={() => saveVendor.mutate()} disabled={!vform.name || saveVendor.isPending}>{editingVendor ? "Save" : "Create"}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>GSTIN</TableHead>
                  <TableHead>Drug License</TableHead><TableHead>Terms</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(vendors || []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No vendors yet.</TableCell></TableRow>
                  ) : (vendors || []).map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div className="font-semibold">{v.name}</div>
                        <div className="text-xs text-muted-foreground">{v.email || "—"}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{v.contactPerson || "—"}</div>
                        <div className="text-xs text-muted-foreground">{v.phone || ""}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{v.gstin || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{v.drugLicenseNo || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{v.paymentTerms}</Badge></TableCell>
                      <TableCell>{v.isActive ? <Badge className="bg-green-100 text-green-700">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => { setEditingVendor(v); setVform({
                          name: v.name, contactPerson: v.contactPerson || "", phone: v.phone || "", email: v.email || "",
                          address: v.address || "", gstin: v.gstin || "", pan: v.pan || "", drugLicenseNo: v.drugLicenseNo || "",
                          paymentTerms: v.paymentTerms || "Net 30", openingBalance: parseFloat(v.openingBalance || "0"),
                          isActive: v.isActive, notes: v.notes || "",
                        }); setOpenVendor(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">Purchase Invoices</CardTitle>
              <Dialog open={openPurchase} onOpenChange={setOpenPurchase}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Record Purchase</Button></DialogTrigger>
                <DialogContent className="max-w-3xl">
                  <DialogHeader><DialogTitle>Record Vendor Purchase (Goods Receipt)</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Vendor *</Label>
                        <Select value={pform.vendorId ? String(pform.vendorId) : ""} onValueChange={v => setPform({ ...pform, vendorId: parseInt(v) })}>
                          <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                          <SelectContent>{(vendors || []).filter((v: any) => v.isActive).map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Invoice No *</Label><Input value={pform.invoiceNo} onChange={e => setPform({ ...pform, invoiceNo: e.target.value })} /></div>
                      <div><Label>Invoice Date *</Label><Input type="date" value={pform.invoiceDate} onChange={e => setPform({ ...pform, invoiceDate: e.target.value })} /></div>
                      <div>
                        <Label>GST Type</Label>
                        <Select value={pform.gstStateType} onValueChange={v => setPform({ ...pform, gstStateType: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="intra">Intra-state (CGST+SGST)</SelectItem>
                            <SelectItem value="inter">Inter-state (IGST)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label>Discount (₹)</Label><Input type="number" value={pform.discount} onChange={e => setPform({ ...pform, discount: parseFloat(e.target.value) || 0 })} /></div>
                      <div><Label>Paid On Invoice (₹)</Label><Input type="number" value={pform.paidAmount} onChange={e => setPform({ ...pform, paidAmount: parseFloat(e.target.value) || 0 })} /></div>
                    </div>
                    <div className="border rounded p-3 space-y-2">
                      <div className="text-sm font-semibold">Items</div>
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-4">
                          <Label className="text-xs">Medicine</Label>
                          <Select value={pItem.medicineId ? String(pItem.medicineId) : ""} onValueChange={pickMedicine}>
                            <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                            <SelectContent>{(medicines || []).map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1"><Label className="text-xs">Qty</Label><Input type="number" min="1" value={pItem.quantity} onChange={e => setPItem({ ...pItem, quantity: parseInt(e.target.value) || 0 })} /></div>
                        <div className="col-span-2"><Label className="text-xs">Rate</Label><Input type="number" step="0.01" value={pItem.purchaseRate} onChange={e => setPItem({ ...pItem, purchaseRate: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="col-span-1"><Label className="text-xs">GST%</Label><Input type="number" value={pItem.gstPercent} onChange={e => setPItem({ ...pItem, gstPercent: parseFloat(e.target.value) || 0 })} /></div>
                        <div className="col-span-2"><Label className="text-xs">Batch</Label><Input value={pItem.batchNo} onChange={e => setPItem({ ...pItem, batchNo: e.target.value })} /></div>
                        <div className="col-span-1"><Label className="text-xs">Expiry</Label><Input type="date" value={pItem.expiryDate} onChange={e => setPItem({ ...pItem, expiryDate: e.target.value })} /></div>
                        <div className="col-span-1"><Button size="sm" onClick={addPItem}><Plus className="h-3 w-3" /></Button></div>
                      </div>
                      {pform.items.length > 0 && (
                        <Table>
                          <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>GST%</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                          <TableBody>
                            {pform.items.map((it: any, i: number) => (
                              <TableRow key={i}>
                                <TableCell>{it.medicineName}</TableCell>
                                <TableCell>{it.quantity}</TableCell>
                                <TableCell>{inr(it.purchaseRate)}</TableCell>
                                <TableCell>{it.gstPercent}%</TableCell>
                                <TableCell className="font-mono text-xs">{it.batchNo || "—"}</TableCell>
                                <TableCell className="text-xs">{it.expiryDate || "—"}</TableCell>
                                <TableCell>{inr(it.quantity * it.purchaseRate)}</TableCell>
                                <TableCell><Button size="icon" variant="ghost" onClick={() => setPform({ ...pform, items: pform.items.filter((_: any, j: number) => j !== i) })}><Trash2 className="h-3 w-3" /></Button></TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                      <div className="flex justify-end gap-6 text-sm pt-2">
                        <div>Subtotal: <span className="font-semibold">{inr(subtotal)}</span></div>
                        <div>GST: <span className="font-semibold">{inr(gst)}</span></div>
                        <div>Total: <span className="font-bold text-lg">{inr(total)}</span></div>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenPurchase(false)}>Cancel</Button>
                    <Button onClick={() => createPurchase.mutate()} disabled={!pform.vendorId || !pform.invoiceNo || !pform.items.length || createPurchase.isPending}>Save & Update Stock</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Invoice No</TableHead><TableHead>Vendor</TableHead>
                  <TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead>
                  <TableHead>Due</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(purchases || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No purchases yet.</TableCell></TableRow>
                  ) : (purchases || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.invoiceDate}</TableCell>
                      <TableCell className="font-mono text-xs">{p.invoiceNo}</TableCell>
                      <TableCell>{p.vendorName}</TableCell>
                      <TableCell>{(p.items || []).length}</TableCell>
                      <TableCell className="font-semibold">{inr(p.totalAmount)}</TableCell>
                      <TableCell className="text-green-600">{inr(p.paidAmount)}</TableCell>
                      <TableCell className={parseFloat(p.dueAmount || "0") > 0 ? "text-red-600 font-medium" : ""}>{inr(p.dueAmount)}</TableCell>
                      <TableCell><Badge variant="outline">{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-4">
              <CardTitle className="text-base">Payments to Vendors</CardTitle>
              <Dialog open={openPayment} onOpenChange={setOpenPayment}>
                <DialogTrigger asChild><Button size="sm"><Wallet className="h-4 w-4 mr-1" />Record Payment</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Record Payment to Vendor</DialogTitle></DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label>Vendor *</Label>
                      <Select value={payform.vendorId ? String(payform.vendorId) : ""} onValueChange={v => setPayform({ ...payform, vendorId: parseInt(v), purchaseId: "" })}>
                        <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                        <SelectContent>{(vendors || []).filter((v: any) => v.isActive).map((v: any) => <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Apply to Invoice (optional)</Label>
                      <Select value={payform.purchaseId} onValueChange={v => setPayform({ ...payform, purchaseId: v })} disabled={!payform.vendorId}>
                        <SelectTrigger><SelectValue placeholder="On account / pick invoice" /></SelectTrigger>
                        <SelectContent>
                          {filteredPurchasesForVendor.map((p: any) =>
                            <SelectItem key={p.id} value={String(p.id)}>{p.invoiceNo} ({p.invoiceDate}) — due {inr(p.dueAmount)}</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Date *</Label><Input type="date" value={payform.paymentDate} onChange={e => setPayform({ ...payform, paymentDate: e.target.value })} /></div>
                      <div><Label>Amount (₹) *</Label><Input type="number" step="0.01" value={payform.amount} onChange={e => setPayform({ ...payform, amount: parseFloat(e.target.value) || 0 })} /></div>
                      <div>
                        <Label>Mode *</Label>
                        <Select value={payform.mode} onValueChange={v => setPayform({ ...payform, mode: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label>Reference</Label><Input value={payform.reference} onChange={e => setPayform({ ...payform, reference: e.target.value })} /></div>
                    </div>
                    <div><Label>Notes</Label><Textarea rows={2} value={payform.notes} onChange={e => setPayform({ ...payform, notes: e.target.value })} /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpenPayment(false)}>Cancel</Button>
                    <Button onClick={() => createPayment.mutate()} disabled={!payform.vendorId || !payform.amount || createPayment.isPending}>Record</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead>Invoice</TableHead>
                  <TableHead>Mode</TableHead><TableHead>Reference</TableHead><TableHead>Amount</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(payments || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No payments yet.</TableCell></TableRow>
                  ) : (payments || []).map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.paymentDate}</TableCell>
                      <TableCell>{p.vendorName}</TableCell>
                      <TableCell>{p.purchaseId ? `#${p.purchaseId}` : <span className="text-muted-foreground">On account</span>}</TableCell>
                      <TableCell><Badge variant="outline">{p.mode}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{p.reference || "—"}</TableCell>
                      <TableCell className="font-semibold text-green-600">{inr(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="outstanding" className="mt-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base flex items-center justify-between">
                <span><IndianRupee className="inline h-4 w-4 mr-1" />Vendor Outstanding (Accounts Payable)</span>
                <span className="text-2xl font-bold text-red-600">{inr(outstanding?.totalOutstanding)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Vendor</TableHead><TableHead>GSTIN</TableHead><TableHead>Terms</TableHead>
                  <TableHead>Opening</TableHead><TableHead>Total Purchases</TableHead>
                  <TableHead>Total Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Open Bills</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(outstanding?.vendors || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No outstanding balances.</TableCell></TableRow>
                  ) : (outstanding?.vendors || []).map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-semibold">{v.name}</TableCell>
                      <TableCell className="font-mono text-xs">{v.gstin || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{v.paymentTerms}</Badge></TableCell>
                      <TableCell>{inr(v.openingBalance)}</TableCell>
                      <TableCell>{inr(v.totalPurchases)}</TableCell>
                      <TableCell className="text-green-600">{inr(v.totalPaid)}</TableCell>
                      <TableCell className="font-bold text-red-600">{inr(v.outstanding)}</TableCell>
                      <TableCell>{v.overdueBills}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
