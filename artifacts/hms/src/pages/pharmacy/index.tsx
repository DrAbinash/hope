import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, ScanLine, Calendar, FileText, Wallet, BadgeIndianRupee, Download, FileJson, FileSpreadsheet, Receipt, Plus, Check, Trash2, Shield, Undo2, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { checkInteractions, type InteractionWarning } from "@/lib/drug-interactions";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

function inr(n: any) { return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`; }

export default function PharmacyPage() {
  const [search, setSearch] = useState("");
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [collFrom, setCollFrom] = useState(today);
  const [collTo, setCollTo] = useState(today);
  const [gstFrom, setGstFrom] = useState(today.slice(0, 7) + "-01");
  const [gstTo, setGstTo] = useState(today);
  const [scannedCode, setScannedCode] = useState("");
  const [lastScanned, setLastScanned] = useState<any>(null);
  const scannerRef = useRef<HTMLInputElement>(null);

  const { data: medicines, isLoading: medsLoading } = useQuery<any[]>({
    queryKey: ["medicines", search],
    queryFn: () => j(`/api/pharmacy/medicines${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });
  const { data: stockSummary } = useQuery<any>({ queryKey: ["pharmacy-stock"], queryFn: () => j("/api/pharmacy/stock-summary") });
  const { data: salesData, isLoading: salesLoading } = useQuery<any>({ queryKey: ["pharmacy-sales"], queryFn: () => j("/api/pharmacy/sales") });
  const sales = salesData?.sales || [];
  const { data: collection } = useQuery<any>({ queryKey: ["coll", collFrom, collTo], queryFn: () => j(`/api/pharmacy/daily-collection?from=${collFrom}&to=${collTo}`) });
  const { data: expiry } = useQuery<any>({ queryKey: ["expiry-alerts"], queryFn: () => j("/api/pharmacy/expiry-alerts") });
  const { data: gstr1 } = useQuery<any>({ queryKey: ["gstr1", gstFrom, gstTo], queryFn: () => j(`/api/pharmacy/gstr1?from=${gstFrom}&to=${gstTo}`) });
  const { data: gstr3b } = useQuery<any>({ queryKey: ["gstr3b", gstFrom, gstTo], queryFn: () => j(`/api/pharmacy/gstr3b/summary?from=${gstFrom}&to=${gstTo}`) });
  // Pharmacy entity settings — drives the default bill type for new sales
  const { data: pharmaSettings } = useQuery<any>({
    queryKey: ["pharmacy-settings"],
    queryFn: () => fetch("/api/hospital-settings/2", { credentials: "include" }).then(r => r.ok ? r.json() : null),
  });
  const defaultBillType: "provisional" | "final" = (pharmaSettings?.defaultBillType === "provisional") ? "provisional" : "final";

  // ---- New Sale dialog state ----
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleBillType, setSaleBillType] = useState<"provisional" | "final">("final");
  const [saleItems, setSaleItems] = useState<{ medicineId: number; name: string; genericName?: string; quantity: number; rate: number; amount: number; gstPercent: number; hsnCode: string; batchNo?: string }[]>([]);
  const [saleDiscount, setSaleDiscount] = useState(0);
  const [salePaid, setSalePaid] = useState(0);
  const [salePaymentMode, setSalePaymentMode] = useState("Cash");
  const [salePatientId, setSalePatientId] = useState<string>("");
  const [saleMedSearch, setSaleMedSearch] = useState("");
  // Drug interaction warnings (recomputed on each item add/remove)
  const [interactionWarnings, setInteractionWarnings] = useState<InteractionWarning[]>([]);
  // Generic substitution: medicineId -> list of alternatives
  const [genericSuggestions, setGenericSuggestions] = useState<Record<number, any[]>>({});
  // FEFO batch per medicine: medicineId -> batch info
  const [fefoBatches, setFefoBatches] = useState<Record<number, { batchNo: string; expiryDate: string; quantity: number }>>({});

  // Sync default from settings when dialog opens
  useEffect(() => { if (saleOpen) setSaleBillType(defaultBillType); }, [saleOpen, defaultBillType]);
  const saleSubtotal = saleItems.reduce((s, i) => s + i.amount, 0);
  const saleGst = saleItems.reduce((s, i) => s + (i.amount * (i.gstPercent || 0) / 100), 0);
  const saleTotal = saleSubtotal - saleDiscount + saleGst;

  const recomputeInteractions = (items: typeof saleItems) => {
    const medList = items.map(it => ({ medicineName: it.name, genericName: it.genericName || "" }));
    setInteractionWarnings(checkInteractions(medList));
  };

  const addSaleItem = async (m: any) => {
    setSaleItems(its => {
      const existing = its.find(x => x.medicineId === m.id);
      const next = existing
        ? its.map(x => x.medicineId === m.id ? { ...x, quantity: x.quantity + 1, amount: (x.quantity + 1) * x.rate } : x)
        : (() => {
            const rate = parseFloat(m.saleRate || m.mrp || "0");
            return [...its, { medicineId: m.id, name: m.name, genericName: m.genericName || "", quantity: 1, rate, amount: rate, gstPercent: parseFloat(m.gstPercent || "12"), hsnCode: m.hsnCode || "30049099" }];
          })();
      recomputeInteractions(next);
      return next;
    });
    setSaleMedSearch("");
    // Fetch FEFO batch suggestion for this medicine
    if (!fefoBatches[m.id]) {
      try {
        const data = await j(`/api/pharmacy/batches/fefo-suggest?medicineId=${m.id}`);
        if (data?.batch) {
          setFefoBatches(prev => ({ ...prev, [m.id]: data.batch }));
          setSaleItems(its => its.map(x => x.medicineId === m.id ? { ...x, batchNo: data.batch.batchNo } : x));
        }
      } catch {
        // silently ignore — FEFO is informational, not blocking
      }
    }
    // Fetch generic substitutes (only once per medicine)
    if (!genericSuggestions[m.id] && m.genericName) {
      try {
        const data = await j(`/api/pharmacy/generic-substitutes?medicineId=${m.id}`);
        if (data?.alternatives?.length) {
          setGenericSuggestions(prev => ({ ...prev, [m.id]: data.alternatives }));
        }
      } catch {
        // silently ignore
      }
    }
  };

  const updateSaleQty = (id: number, qty: number) => setSaleItems(its => {
    const next = its.map(x => x.medicineId === id ? { ...x, quantity: qty, amount: qty * x.rate } : x);
    recomputeInteractions(next);
    return next;
  });
  const removeSaleItem = (id: number) => setSaleItems(its => {
    const next = its.filter(x => x.medicineId !== id);
    recomputeInteractions(next);
    setFefoBatches(prev => { const n = { ...prev }; delete n[id]; return n; });
    setGenericSuggestions(prev => { const n = { ...prev }; delete n[id]; return n; });
    return next;
  });
  const resetSale = () => {
    setSaleItems([]); setSaleDiscount(0); setSalePaid(0); setSalePaymentMode("Cash");
    setSalePatientId(""); setSaleMedSearch(""); setInteractionWarnings([]);
    setGenericSuggestions({}); setFefoBatches({});
  };

  const createSale = useMutation({
    mutationFn: () => j("/api/pharmacy/sales", {
      method: "POST",
      body: JSON.stringify({
        patientId: salePatientId ? parseInt(salePatientId) : undefined,
        items: saleItems,
        discount: saleDiscount,
        paidAmount: saleBillType === "final" ? salePaid : undefined,
        paymentMode: saleBillType === "final" ? salePaymentMode : undefined,
        billStatus: saleBillType,
      }),
    }),
    onSuccess: (s: any) => {
      toast.success(`${saleBillType === "provisional" ? "Provisional" : "Final"} bill ${s.billNo} created`);
      qc.invalidateQueries({ queryKey: ["pharmacy-sales"] });
      qc.invalidateQueries({ queryKey: ["medicines"] });
      qc.invalidateQueries({ queryKey: ["pharmacy-stock"] });
      setSaleOpen(false);
      // Provisional bills: open the print-slip dialog so the patient can take it to the cashier counter.
      if (s.billStatus === "provisional") setSlip({ ...s, _patientName: salePatientId ? `Patient #${salePatientId}` : "Walk-in" });
      resetSale();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Provisional slip (printable) ----
  const [slip, setSlip] = useState<any>(null);
  const printSlip = () => {
    const el = document.getElementById("provisional-slip-print");
    if (!el) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    w.document.write(`<html><head><title>Provisional Slip ${slip?.billNo}</title>
      <style>
        body{font-family:ui-monospace,monospace;padding:16px;font-size:12px;}
        h1{font-size:14px;margin:0 0 4px}
        .billno{font-size:20px;font-weight:700;letter-spacing:2px;text-align:center;border:2px dashed #000;padding:8px;margin:8px 0}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        td,th{border-bottom:1px dashed #999;padding:3px 4px;text-align:left;font-size:11px}
        .right{text-align:right}
        .total{font-weight:700;font-size:14px}
        .footer{margin-top:12px;text-align:center;border-top:1px dashed #000;padding-top:8px;font-size:11px}
      </style></head><body>${el.innerHTML}</body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  // ---- Sales filter / search ----
  const [statusFilter, setStatusFilter] = useState<"all" | "provisional" | "final">("all");
  const [billSearch, setBillSearch] = useState("");
  const filteredSales = sales.filter((s: any) => {
    if (statusFilter !== "all" && s.billStatus !== statusFilter) return false;
    if (billSearch && !s.billNo.toLowerCase().includes(billSearch.toLowerCase())) return false;
    return true;
  });
  const provisionalCount = sales.filter((s: any) => s.billStatus === "provisional").length;

  // ---- Finalize dialog state ----
  const [finOpen, setFinOpen] = useState(false);
  const [finSale, setFinSale] = useState<any>(null);
  const [finPaid, setFinPaid] = useState(0);
  const [finMode, setFinMode] = useState("Cash");
  const openFinalize = (s: any) => { setFinSale(s); setFinPaid(parseFloat(s.totalAmount)); setFinMode("Cash"); setFinOpen(true); };
  const finalize = useMutation({
    mutationFn: () => j(`/api/pharmacy/sales/${finSale.id}/finalize`, {
      method: "POST",
      body: JSON.stringify({ paidAmount: finPaid, paymentMode: finMode }),
    }),
    onSuccess: () => {
      toast.success(`Bill ${finSale.billNo} finalized`);
      qc.invalidateQueries({ queryKey: ["pharmacy-sales"] });
      setFinOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadGst = (path: string, filename: string) => {
    fetch(path, { credentials: "include" })
      .then(async r => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Download failed");
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
        toast.success(`Downloaded ${filename}`);
      })
      .catch((e: any) => toast.error(e.message || "Download failed"));
  };

  const post = useMutation({
    mutationFn: () => j("/api/pharmacy/post-to-accounting", { method: "POST", body: JSON.stringify({ from: collFrom, to: collTo }) }),
    onSuccess: (r: any) => {
      toast.success(`Posted ${r.posted} bills · Revenue ${inr(r.totalRevenue)} · GST ${inr(r.totalGst)}`);
      qc.invalidateQueries({ queryKey: ["pharmacy-sales"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Barcode scanner: keyboard wedge typically appends Enter at end of payload
  useEffect(() => { scannerRef.current?.focus(); }, []);
  const handleScan = async () => {
    const code = scannedCode.trim();
    if (!code) return;
    try {
      const med = await j(`/api/pharmacy/medicines/by-barcode/${encodeURIComponent(code)}`);
      setLastScanned(med);
      toast.success(`Scanned: ${med.name}`);
    } catch (e: any) {
      toast.error(e.message || "Barcode not found");
      setLastScanned(null);
    }
    setScannedCode("");
    scannerRef.current?.focus();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pharmacy</h2>
        <p className="text-muted-foreground text-sm">Stock · Sales · Daily Collection · Expiry · GST · Barcode</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="grid gap-4 md:grid-cols-5 flex-1">
          {[
            { title: "Total Medicines", value: stockSummary?.totalItems, color: "text-foreground" },
            { title: "Low Stock", value: stockSummary?.lowStockItems, color: "text-yellow-600" },
            { title: "Short Expiry (30d)", value: expiry?.shortExpiry?.count, color: "text-orange-600" },
            { title: "Expired", value: expiry?.expired?.count, color: "text-red-600" },
            { title: "Stock Value", value: stockSummary?.totalStockValue ? inr(stockSummary.totalStockValue) : "—", color: "text-green-600" },
          ].map(({ title, value, color }) => (
            <Card key={title}>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${color}`}>{value ?? "—"}</p></CardContent>
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-2 min-w-[160px]">
          <a href="/pharmacy/schedule-h-register">
            <Button size="sm" variant="outline" className="w-full justify-start"><Shield className="h-3.5 w-3.5 mr-1" />Schedule H Register</Button>
          </a>
          <a href="/pharmacy/purchase-returns">
            <Button size="sm" variant="outline" className="w-full justify-start"><Undo2 className="h-3.5 w-3.5 mr-1" />Purchase Returns</Button>
          </a>
        </div>
      </div>

      <Tabs defaultValue="stock">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="stock">Medicine Stock</TabsTrigger>
          <TabsTrigger value="sales">Sales History</TabsTrigger>
          <TabsTrigger value="collection"><Wallet className="h-3.5 w-3.5 mr-1" />Daily Collection</TabsTrigger>
          <TabsTrigger value="expiry"><Calendar className="h-3.5 w-3.5 mr-1" />Expiry Alerts</TabsTrigger>
          <TabsTrigger value="gst"><BadgeIndianRupee className="h-3.5 w-3.5 mr-1" />GSTR-1</TabsTrigger>
          <TabsTrigger value="gst3b"><Receipt className="h-3.5 w-3.5 mr-1" />GSTR-3B</TabsTrigger>
          <TabsTrigger value="scanner"><ScanLine className="h-3.5 w-3.5 mr-1" />Barcode</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-4">
          <Card>
            <CardHeader className="py-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search medicines or barcode..." className="pl-8" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead><TableHead>HSN</TableHead><TableHead>Barcode</TableHead>
                    <TableHead>Stock</TableHead><TableHead>Expiry</TableHead><TableHead>Schedule</TableHead>
                    <TableHead>MRP</TableHead><TableHead>Sale Rate</TableHead><TableHead>GST%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medsLoading ? Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  )) : (medicines || []).length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">No medicines found.</TableCell></TableRow>
                  ) : (medicines || []).map((m: any) => {
                    const isLow = m.stock <= (m.reorderLevel || 10);
                    const isExpired = m.expiryDate && m.expiryDate < today;
                    return (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="font-semibold">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.genericName || ""}</div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{m.hsnCode || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{m.barcode || "—"}</TableCell>
                        <TableCell>
                          <span className={`font-medium ${isLow ? "text-red-600" : "text-green-600"}`}>{m.stock} {m.unit}</span>
                          {isLow && <AlertTriangle className="inline h-3 w-3 ml-1 text-yellow-500" />}
                        </TableCell>
                        <TableCell><span className={`text-sm ${isExpired ? "text-red-600 font-medium" : ""}`}>{m.expiryDate || "—"}</span></TableCell>
                        <TableCell>
                          {m.scheduleType && m.scheduleType !== "general" ? (
                            <Badge className={m.scheduleType === "schedule_h1" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}>
                              {m.scheduleType.replace("schedule_h", "H").replace("narcotic", "NARC").replace("psychotropic", "PSYCH")}
                            </Badge>
                          ) : "—"}
                        </TableCell>
                        <TableCell>{inr(m.mrp)}</TableCell>
                        <TableCell>{inr(m.saleRate)}</TableCell>
                        <TableCell>{m.gstPercent}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="mt-4">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant={statusFilter === "all" ? "default" : "outline"} onClick={() => setStatusFilter("all")}>All</Button>
              <Button size="sm" variant={statusFilter === "provisional" ? "default" : "outline"} onClick={() => setStatusFilter("provisional")} className="gap-1">
                Pending Payment {provisionalCount > 0 && <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 ml-1">{provisionalCount}</Badge>}
              </Button>
              <Button size="sm" variant={statusFilter === "final" ? "default" : "outline"} onClick={() => setStatusFilter("final")}>Paid</Button>
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={billSearch} onChange={e => setBillSearch(e.target.value)} placeholder="Find bill no..." className="pl-7 h-8 w-[180px] text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Default: <Badge variant="outline">{defaultBillType}</Badge></span>
              <Button size="sm" onClick={() => setSaleOpen(true)}><Plus className="h-4 w-4 mr-1" />New Sale</Button>
            </div>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bill</TableHead><TableHead>Status</TableHead><TableHead>Patient</TableHead><TableHead>Date</TableHead>
                <TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Due</TableHead><TableHead>Mode</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {salesLoading ? Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 9 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                )) : filteredSales.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center h-24 text-muted-foreground">{sales.length === 0 ? "No sales records found." : "No bills match the current filter."}</TableCell></TableRow>
                ) : filteredSales.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs font-medium">{s.billNo}</TableCell>
                    <TableCell>
                      {s.billStatus === "provisional"
                        ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Provisional</Badge>
                        : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Final</Badge>}
                    </TableCell>
                    <TableCell>{s.patientName || "Walk-in"}</TableCell>
                    <TableCell>{s.billDate}</TableCell>
                    <TableCell className="font-semibold">{inr(s.totalAmount)}</TableCell>
                    <TableCell className="text-green-600">{inr(s.paidAmount)}</TableCell>
                    <TableCell className={parseFloat(s.dueAmount || "0") > 0 ? "text-red-600 font-semibold" : ""}>{inr(s.dueAmount)}</TableCell>
                    <TableCell><Badge variant="outline">{s.paymentMode}</Badge></TableCell>
                    <TableCell>
                      {s.billStatus === "provisional"
                        ? <div className="flex gap-1">
                            <Button size="sm" variant="default" onClick={() => openFinalize(s)}><Check className="h-3.5 w-3.5 mr-1" />Collect Payment</Button>
                            <Button size="sm" variant="outline" onClick={() => setSlip({ ...s, _patientName: s.patientName || "Walk-in" })} title="Reprint slip">Slip</Button>
                          </div>
                        : (s.postedToAccounting
                          ? <Badge variant="secondary" className="bg-green-100 text-green-700">Posted</Badge>
                          : <Badge variant="outline">Unposted</Badge>)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          {/* New Sale dialog */}
          <Dialog open={saleOpen} onOpenChange={(o) => { setSaleOpen(o); if (!o) resetSale(); }}>
            <DialogContent className="max-w-3xl">
              <DialogHeader><DialogTitle>New Pharmacy Sale</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="flex gap-2 items-center">
                  <Label className="text-sm">Bill Type:</Label>
                  <Button size="sm" variant={saleBillType === "final" ? "default" : "outline"} onClick={() => setSaleBillType("final")}>Final (with payment)</Button>
                  <Button size="sm" variant={saleBillType === "provisional" ? "default" : "outline"} onClick={() => setSaleBillType("provisional")}>Provisional (pay later)</Button>
                  <span className="text-xs text-muted-foreground ml-auto">Default: <Badge variant="outline">{defaultBillType}</Badge></span>
                </div>

                <div>
                  <Label className="text-xs">Patient ID (optional)</Label>
                  <Input value={salePatientId} onChange={e => setSalePatientId(e.target.value.replace(/[^0-9]/g, ""))} placeholder="Walk-in if blank" className="w-[200px]" />
                </div>

                <div>
                  <Label className="text-xs">Add Medicine</Label>
                  <Input
                    placeholder="Search medicine by name..."
                    value={saleMedSearch}
                    onChange={e => setSaleMedSearch(e.target.value)}
                  />
                  {saleMedSearch && (medicines || []).length > 0 && (
                    <div className="border rounded mt-1 max-h-40 overflow-y-auto">
                      {(medicines || []).filter(m => m.name.toLowerCase().includes(saleMedSearch.toLowerCase())).slice(0, 8).map(m => (
                        <div key={m.id} className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex justify-between" onClick={() => addSaleItem(m)}>
                          <span>{m.name} <span className="text-muted-foreground text-xs">({m.stock} in stock)</span></span>
                          <span className="font-mono">{inr(m.saleRate || m.mrp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {saleItems.length > 0 && (
                  <>
                    <Table>
                      <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Batch / FEFO</TableHead><TableHead>Qty</TableHead><TableHead>Rate</TableHead><TableHead>GST%</TableHead><TableHead>Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {saleItems.map(it => {
                          const fefo = fefoBatches[it.medicineId];
                          const subs = genericSuggestions[it.medicineId] || [];
                          return (
                            <TableRow key={it.medicineId}>
                              <TableCell className="text-sm">
                                <div>{it.name}</div>
                                {it.genericName && <div className="text-xs text-muted-foreground">{it.genericName}</div>}
                                {subs.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    <span className="text-xs text-blue-600 font-medium flex items-center gap-0.5"><RefreshCcw className="h-2.5 w-2.5" />Alt:</span>
                                    {subs.slice(0, 2).map((s: any) => (
                                      <button key={s.id} title={`Switch to ${s.name} (${inr(s.saleRate || s.mrp)})`}
                                        className="text-xs text-blue-600 underline hover:no-underline"
                                        onClick={() => { removeSaleItem(it.medicineId); addSaleItem(s); }}>
                                        {s.name}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {fefo ? (
                                  <div>
                                    <span className="font-mono font-semibold">{fefo.batchNo}</span>
                                    <div className="text-muted-foreground">Exp: {fefo.expiryDate}</div>
                                    <div className="text-muted-foreground">Avail: {fefo.quantity}</div>
                                  </div>
                                ) : (
                                  it.batchNo ? <span className="font-mono">{it.batchNo}</span> : <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell><Input type="number" min={1} value={it.quantity} onChange={e => updateSaleQty(it.medicineId, parseInt(e.target.value) || 1)} className="w-[70px]" /></TableCell>
                              <TableCell>{inr(it.rate)}</TableCell>
                              <TableCell>{it.gstPercent}%</TableCell>
                              <TableCell>{inr(it.amount)}</TableCell>
                              <TableCell><Button size="icon" variant="ghost" onClick={() => removeSaleItem(it.medicineId)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>

                    {/* Drug interaction alerts */}
                    {interactionWarnings.length > 0 && (
                      <div className="space-y-1.5">
                        {interactionWarnings.map((w, i) => (
                          <div key={i} className={`flex items-start gap-2 rounded p-2.5 text-sm border ${w.severity === "severe" ? "bg-red-50 border-red-200 text-red-800" : w.severity === "moderate" ? "bg-orange-50 border-orange-200 text-orange-800" : "bg-yellow-50 border-yellow-200 text-yellow-800"}`}>
                            <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
                            <div>
                              <div className="font-semibold text-xs uppercase tracking-wide mb-0.5">
                                {w.severity} interaction · {w.drugA} + {w.drugB}
                              </div>
                              <div>{w.effect}</div>
                              <div className="text-xs mt-0.5 opacity-80">{w.advice}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Discount</Label><Input type="number" min={0} value={saleDiscount} onChange={e => setSaleDiscount(Math.max(0, parseFloat(e.target.value) || 0))} /></div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Subtotal {inr(saleSubtotal)} · GST {inr(saleGst)} · Disc {inr(saleDiscount)}</div>
                    <div className="text-2xl font-bold">{inr(saleTotal)}</div>
                  </div>
                </div>

                {saleBillType === "final" ? (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded">
                    <div>
                      <Label className="text-xs">Payment Mode</Label>
                      <Select value={salePaymentMode} onValueChange={setSalePaymentMode}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["Cash", "Card", "UPI", "Bank Transfer", "Credit"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Paid Amount</Label><Input type="number" min={0} value={salePaid} onChange={e => setSalePaid(Math.max(0, parseFloat(e.target.value) || 0))} /></div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
                    <strong>Provisional bill:</strong> stock will be deducted, but no payment is captured. The bill must be finalized later before it is posted to accounting.
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaleOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => createSale.mutate()}
                  disabled={createSale.isPending || saleItems.length === 0 || (saleBillType === "final" && salePaid > saleTotal + 0.01)}
                >
                  {createSale.isPending ? "Saving..." : `Save ${saleBillType === "provisional" ? "Provisional" : "Final"} Bill`}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Provisional slip — patient carries this to the cashier counter */}
          <Dialog open={!!slip} onOpenChange={(o) => { if (!o) setSlip(null); }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Provisional Slip — present at cashier counter</DialogTitle></DialogHeader>
              {slip && (
                <div id="provisional-slip-print" className="font-mono text-sm">
                  <h1>{pharmaSettings?.hospitalName || "Hope Pharmacy"}</h1>
                  {pharmaSettings?.address && <div className="text-xs">{pharmaSettings.address}</div>}
                  <div className="text-xs mt-1">Date: {slip.billDate}</div>
                  <div className="billno">{slip.billNo}</div>
                  <div className="text-xs">Patient: {slip._patientName}</div>
                  <table>
                    <thead><tr><th>Item</th><th className="right">Qty</th><th className="right">Amt</th></tr></thead>
                    <tbody>
                      {(slip.items || []).map((it: any, i: number) => (
                        <tr key={i}><td>{it.name || `Item ${it.medicineId}`}</td><td className="right">{it.quantity}</td><td className="right">{Number(it.amount).toFixed(2)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                  <table className="mt-2">
                    <tbody>
                      <tr><td>Subtotal</td><td className="right">{Number(slip.subtotal).toFixed(2)}</td></tr>
                      {parseFloat(slip.discount || "0") > 0 && <tr><td>Discount</td><td className="right">-{Number(slip.discount).toFixed(2)}</td></tr>}
                      <tr><td>GST</td><td className="right">{Number(slip.gstAmount).toFixed(2)}</td></tr>
                      <tr className="total"><td>TOTAL DUE</td><td className="right">₹ {Number(slip.totalAmount).toFixed(2)}</td></tr>
                    </tbody>
                  </table>
                  <div className="footer">
                    <strong>** PROVISIONAL — NOT PAID **</strong><br />
                    Please pay at the cashier counter and<br />
                    quote bill no <strong>{slip.billNo}</strong>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSlip(null)}>Close</Button>
                <Button onClick={printSlip}><FileText className="h-4 w-4 mr-1" />Print Slip</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Finalize dialog */}
          <Dialog open={finOpen} onOpenChange={setFinOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Finalize Bill {finSale?.billNo}</DialogTitle></DialogHeader>
              {finSale && (
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground">Total payable: <span className="font-bold text-foreground">{inr(finSale.totalAmount)}</span></div>
                  <div>
                    <Label className="text-xs">Payment Mode</Label>
                    <Select value={finMode} onValueChange={setFinMode}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["Cash", "Card", "UPI", "Bank Transfer", "Credit"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Paid Amount</Label>
                    <Input type="number" min={0} value={finPaid} onChange={e => setFinPaid(Math.max(0, parseFloat(e.target.value) || 0))} />
                    {finPaid < parseFloat(finSale.totalAmount || "0") && <p className="text-xs text-amber-700 mt-1">Partial payment — due of {inr(parseFloat(finSale.totalAmount) - finPaid)} will remain.</p>}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setFinOpen(false)}>Cancel</Button>
                <Button onClick={() => finalize.mutate()} disabled={finalize.isPending}>{finalize.isPending ? "Finalizing..." : "Finalize"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="collection" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div><Label className="text-xs">From</Label><Input type="date" value={collFrom} onChange={e => setCollFrom(e.target.value)} className="w-[160px]" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={collTo} onChange={e => setCollTo(e.target.value)} className="w-[160px]" /></div>
                <Button onClick={() => post.mutate()} disabled={post.isPending}>
                  <FileText className="h-4 w-4 mr-1" />{post.isPending ? "Posting…" : "Post to Accounting"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 mb-4">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Bills</div><div className="text-2xl font-bold">{collection?.totals?.bills || 0}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net Sales</div><div className="text-2xl font-bold text-blue-600">{inr(collection?.totals?.net)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Collected</div><div className="text-2xl font-bold text-green-600">{inr(collection?.totals?.collected)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Outstanding</div><div className="text-2xl font-bold text-red-600">{inr(collection?.totals?.due)}</div></CardContent></Card>
              </div>
              {collection?.totals?.modeTotals && Object.keys(collection.totals.modeTotals).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-2">
                  {Object.entries(collection.totals.modeTotals).map(([m, v]: any) => (
                    <Badge key={m} variant="outline" className="text-sm">{m}: {inr(v)}</Badge>
                  ))}
                </div>
              )}
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Bills</TableHead><TableHead>Gross</TableHead>
                  <TableHead>Discount</TableHead><TableHead>GST</TableHead><TableHead>Net</TableHead>
                  <TableHead>Collected</TableHead><TableHead>Due</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(collection?.byDate || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No sales in this range.</TableCell></TableRow>
                  ) : collection.byDate.map((d: any) => (
                    <TableRow key={d.date}>
                      <TableCell className="font-medium">{d.date}</TableCell>
                      <TableCell>{d.bills}</TableCell>
                      <TableCell>{inr(d.gross)}</TableCell>
                      <TableCell className="text-orange-600">{inr(d.discount)}</TableCell>
                      <TableCell>{inr(d.gst)}</TableCell>
                      <TableCell className="font-semibold">{inr(d.net)}</TableCell>
                      <TableCell className="text-green-600">{inr(d.collected)}</TableCell>
                      <TableCell className={d.due > 0 ? "text-red-600" : ""}>{inr(d.due)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expiry" className="mt-4 space-y-4">
          {[
            { key: "expired", title: "Expired", color: "border-red-200 bg-red-50", textColor: "text-red-700" },
            { key: "shortExpiry", title: "Short Expiry (within 30 days)", color: "border-orange-200 bg-orange-50", textColor: "text-orange-700" },
            { key: "expiringSoon", title: "Expiring Soon (30-90 days)", color: "border-yellow-200 bg-yellow-50", textColor: "text-yellow-700" },
          ].map(({ key, title, color, textColor }) => {
            const bucket = expiry?.[key];
            if (!bucket) return null;
            return (
              <Card key={key} className={color}>
                <CardHeader className="pb-2">
                  <CardTitle className={`text-sm ${textColor} flex items-center justify-between`}>
                    <span><AlertTriangle className="inline h-4 w-4 mr-1" />{title}</span>
                    <span className="text-xs">{bucket.count} items · stock value {inr(bucket.value)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {bucket.items?.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Medicine</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead>
                        <TableHead>Stock</TableHead><TableHead>MRP</TableHead><TableHead>Stock Value</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {bucket.items.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="font-mono text-xs">{m.batchNo || "—"}</TableCell>
                            <TableCell className={textColor}>{m.expiryDate}</TableCell>
                            <TableCell>{m.stock} {m.unit}</TableCell>
                            <TableCell>{inr(m.mrp)}</TableCell>
                            <TableCell>{inr(m.stock * parseFloat(m.mrp || "0"))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="gst" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div><Label className="text-xs">From</Label><Input type="date" value={gstFrom} onChange={e => setGstFrom(e.target.value)} className="w-[160px]" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={gstTo} onChange={e => setGstTo(e.target.value)} className="w-[160px]" /></div>
                <Button variant="outline" onClick={() => window.print()}><FileText className="h-4 w-4 mr-1" />Print</Button>
                <div className="ml-auto flex flex-wrap gap-2 items-end">
                  <Button size="sm" onClick={() => downloadGst(`/api/pharmacy/gstr1/export?from=${gstFrom}&to=${gstTo}&format=json`, `GSTR1_${gstFrom}_to_${gstTo}.json`)}>
                    <FileJson className="h-4 w-4 mr-1" />Portal JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadGst(`/api/pharmacy/gstr1/export?from=${gstFrom}&to=${gstTo}&format=csv&section=b2cs`, `GSTR1_B2CS_${gstFrom}.csv`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />B2CS CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadGst(`/api/pharmacy/gstr1/export?from=${gstFrom}&to=${gstTo}&format=csv&section=hsn`, `GSTR1_HSN_${gstFrom}.csv`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />HSN CSV
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadGst(`/api/pharmacy/gstr1/export?from=${gstFrom}&to=${gstTo}&format=csv&section=docs`, `GSTR1_DocIssued_${gstFrom}.csv`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />Docs CSV
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">Portal JSON matches the GSTR-1 Offline Tool schema (B2CS · B2CL · HSN · Doc Issued). Upload via Returns → GSTR-1 → Prepare Offline.</div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5 mb-4">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Bills</div><div className="text-2xl font-bold">{gstr1?.totals?.bills || 0}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Taxable Value</div><div className="text-xl font-bold">{inr(gstr1?.totals?.taxable)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">CGST</div><div className="text-xl font-bold text-blue-600">{inr(gstr1?.totals?.cgst)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">SGST</div><div className="text-xl font-bold text-blue-600">{inr(gstr1?.totals?.sgst)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">IGST</div><div className="text-xl font-bold text-purple-600">{inr(gstr1?.totals?.igst)}</div></CardContent></Card>
              </div>
              <div className="text-sm font-semibold mb-2">HSN-wise Summary (GSTR-1 Table 12)</div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>HSN Code</TableHead><TableHead>GST Rate</TableHead><TableHead>Taxable</TableHead>
                  <TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>IGST</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(gstr1?.hsnSummary || []).length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center h-24 text-muted-foreground">No GST data in this range.</TableCell></TableRow>
                  ) : gstr1.hsnSummary.map((h: any) => (
                    <TableRow key={`${h.hsn}-${h.gstRate}`}>
                      <TableCell className="font-mono">{h.hsn}</TableCell>
                      <TableCell>{h.gstRate}%</TableCell>
                      <TableCell>{inr(h.taxable)}</TableCell>
                      <TableCell>{inr(h.cgst)}</TableCell>
                      <TableCell>{inr(h.sgst)}</TableCell>
                      <TableCell>{inr(h.igst)}</TableCell>
                      <TableCell className="font-semibold">{inr(h.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gst3b" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="py-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div><Label className="text-xs">From</Label><Input type="date" value={gstFrom} onChange={e => setGstFrom(e.target.value)} className="w-[160px]" /></div>
                <div><Label className="text-xs">To</Label><Input type="date" value={gstTo} onChange={e => setGstTo(e.target.value)} className="w-[160px]" /></div>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={() => downloadGst(`/api/pharmacy/gstr3b/export?from=${gstFrom}&to=${gstTo}&format=json`, `GSTR3B_${gstFrom}_to_${gstTo}.json`)}>
                    <FileJson className="h-4 w-4 mr-1" />Portal JSON
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => downloadGst(`/api/pharmacy/gstr3b/export?from=${gstFrom}&to=${gstTo}&format=csv`, `GSTR3B_${gstFrom}_to_${gstTo}.csv`)}>
                    <FileSpreadsheet className="h-4 w-4 mr-1" />CSV
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Filing entity: <span className="font-mono">{gstr3b?.gstin || "—"}</span> · {gstr3b?.entityName || "—"} · Period <span className="font-mono">{gstr3b?.period || "—"}</span>. Portal JSON matches GSTR-3B Offline Utility format.
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-semibold mb-2">3.1 Outward Supplies</div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Section</TableHead><TableHead>Taxable</TableHead><TableHead>IGST</TableHead>
                    <TableHead>CGST</TableHead><TableHead>SGST</TableHead><TableHead>Cess</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">3.1(a) Outward taxable (other than zero/nil/exempted)</TableCell>
                      <TableCell>{inr(gstr3b?.outward?.taxable)}</TableCell>
                      <TableCell className="text-purple-600">{inr(gstr3b?.outward?.igst)}</TableCell>
                      <TableCell className="text-blue-600">{inr(gstr3b?.outward?.cgst)}</TableCell>
                      <TableCell className="text-blue-600">{inr(gstr3b?.outward?.sgst)}</TableCell>
                      <TableCell>{inr(0)}</TableCell>
                    </TableRow>
                    <TableRow><TableCell className="text-muted-foreground">3.1(b) Outward zero-rated</TableCell><TableCell colSpan={5} className="text-muted-foreground">—</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground">3.1(c) Other (nil/exempted)</TableCell><TableCell colSpan={5} className="text-muted-foreground">—</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground">3.1(d) Inward — reverse charge</TableCell><TableCell colSpan={5} className="text-muted-foreground">—</TableCell></TableRow>
                    <TableRow><TableCell className="text-muted-foreground">3.1(e) Non-GST outward</TableCell><TableCell colSpan={5} className="text-muted-foreground">—</TableCell></TableRow>
                  </TableBody>
                </Table>
              </div>
              <div>
                <div className="text-sm font-semibold mb-2">4. Eligible ITC (from vendor purchases)</div>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Section</TableHead><TableHead>IGST</TableHead><TableHead>CGST</TableHead>
                    <TableHead>SGST</TableHead><TableHead>Cess</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>4.A.5 All other ITC ({gstr3b?.itc?.bills || 0} bills · taxable {inr(gstr3b?.itc?.taxable)})</TableCell>
                      <TableCell className="text-green-600">{inr(gstr3b?.itc?.igst)}</TableCell>
                      <TableCell className="text-green-600">{inr(gstr3b?.itc?.cgst)}</TableCell>
                      <TableCell className="text-green-600">{inr(gstr3b?.itc?.sgst)}</TableCell>
                      <TableCell>{inr(0)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-4 md:grid-cols-4 pt-2 border-t">
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net IGST Payable</div><div className="text-xl font-bold text-red-600">{inr(gstr3b?.netPayable?.igst)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net CGST Payable</div><div className="text-xl font-bold text-red-600">{inr(gstr3b?.netPayable?.cgst)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net SGST Payable</div><div className="text-xl font-bold text-red-600">{inr(gstr3b?.netPayable?.sgst)}</div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Cash to Pay</div><div className="text-xl font-bold text-red-700">{inr(gstr3b?.netPayable?.total)}</div></CardContent></Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scanner" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" />Barcode Scanner</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">Point your USB/Bluetooth scanner at this field. Most scanners send Enter at the end — the barcode will auto-lookup.</div>
              <div className="flex gap-2 max-w-md">
                <Input
                  ref={scannerRef}
                  autoFocus
                  placeholder="Scan or type barcode then press Enter"
                  value={scannedCode}
                  onChange={e => setScannedCode(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleScan(); }}
                  className="font-mono"
                />
                <Button onClick={handleScan}>Lookup</Button>
              </div>
              {lastScanned && (
                <Card className="border-green-200 bg-green-50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-lg">{lastScanned.name}</div>
                        <div className="text-sm text-muted-foreground">{lastScanned.genericName} · {lastScanned.manufacturer || "—"}</div>
                        <div className="text-xs font-mono mt-1">HSN {lastScanned.hsnCode || "—"} · Batch {lastScanned.batchNo || "—"} · Exp {lastScanned.expiryDate || "—"}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-700">{inr(lastScanned.saleRate)}</div>
                        <div className="text-xs text-muted-foreground">Stock: {lastScanned.stock} {lastScanned.unit}</div>
                        <div className="text-xs">GST {lastScanned.gstPercent}%</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
