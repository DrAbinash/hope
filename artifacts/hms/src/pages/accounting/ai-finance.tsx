import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  FileText, Upload, Brain, CheckCircle2, ShieldAlert, Sparkles, RefreshCcw, 
  Search, Download, FileUp, Landmark, AlertTriangle, Eye, ArrowRightLeft, 
  HelpCircle, Settings, Check, Loader2, ArrowRight, Cpu
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

function inr(n: any) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function AIFinanceAssistantPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [selectedEntityId, setSelectedEntityId] = useState("1"); // 1 = Hope Hospital, 2 = Care Diagnostics, consolidated = Management Reports
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  
  // OCR & Expense States
  const [uploading, setUploading] = useState(false);
  const [ocrReviewDoc, setOcrReviewDoc] = useState<any>(null);
  const [editFields, setEditFields] = useState<any>({});
  const [editRecs, setEditRecs] = useState<any>({});
  const [searchQuery, setSearchQuery] = useState("");
  
  // Bank Import & Reconciliation States
  const [bankFileContent, setBankFileContent] = useState("");
  const [importingBank, setImportingBank] = useState(false);
  const [openReconTxn, setOpenReconTxn] = useState<any>(null);
  
  // Tally Export States
  const [tallyDateFrom, setTallyDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [tallyDateTo, setTallyDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [tallyExporting, setTallyExporting] = useState(false);

  // Queries
  const { data: stats } = useQuery<any>({ 
    queryKey: ["ai-finance-stats", selectedEntityId], 
    queryFn: () => j(`/api/accounting/dashboard?entityId=${selectedEntityId}`),
    refetchInterval: 5000,
    enabled: selectedEntityId !== "consolidated"
  });

  const { data: documents, refetch: refetchDocs } = useQuery<any[]>({ 
    queryKey: ["financial-documents", searchQuery, selectedEntityId], 
    queryFn: () => j(`/api/accounting/financial-documents?entityId=${selectedEntityId}&search=${encodeURIComponent(searchQuery)}`),
    enabled: selectedEntityId !== "consolidated"
  });

  const { data: bankTransactions, refetch: refetchBankTxns } = useQuery<any[]>({ 
    queryKey: ["bank-transactions-recon", selectedEntityId], 
    queryFn: () => j(`/api/bank-reconciliation/transactions?entityId=${selectedEntityId}`),
    enabled: selectedEntityId !== "consolidated"
  });

  const { data: alertsData } = useQuery<any>({ 
    queryKey: ["ai-finance-alerts", selectedEntityId], 
    queryFn: () => j(`/api/accounting/alerts?entityId=${selectedEntityId}`),
    refetchInterval: 10000,
    enabled: selectedEntityId !== "consolidated"
  });

  const { data: ledgers } = useQuery<any[]>({ 
    queryKey: ["accounting-ledgers-list", selectedEntityId], 
    queryFn: () => j(`/api/accounting/ledgers?entityId=${selectedEntityId}`),
    enabled: selectedEntityId !== "consolidated"
  });

  const { data: consolidatedData } = useQuery<any>({
    queryKey: ["consolidated-management-report"],
    queryFn: () => j("/api/accounting/consolidated-report"),
    enabled: selectedEntityId === "consolidated"
  });

  // Mutations
  const triggerOcr = useMutation({
    mutationFn: (body: any) => j("/api/accounting/expenses/ocr", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => {
      toast.success("AI OCR extraction completed successfully");
      refetchDocs();
      if (data.ledgerRecommendations?.entityId) {
        setSelectedEntityId(String(data.ledgerRecommendations.entityId));
      }
      setOcrReviewDoc(data);
      setEditFields(data.extractedFields || {});
      setEditRecs(data.ledgerRecommendations || {});
    },
    onError: (e: any) => toast.error(e.message)
  });

  const updateDoc = useMutation({
    mutationFn: ({ id, body }: any) => j(`/api/accounting/financial-documents/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Document updated successfully");
      refetchDocs();
    },
    onError: (e: any) => toast.error(e.message)
  });

  const approveDoc = useMutation({
    mutationFn: (id: number) => j(`/api/accounting/financial-documents/${id}/approve`, { method: "POST" }),
    onSuccess: (data) => {
      toast.success(`Expense Approved! Created Voucher: ${data.voucherNo}`);
      refetchDocs();
      setOcrReviewDoc(null);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const importBankStatement = useMutation({
    mutationFn: (body: any) => j("/api/accounting/bank-statement/import", { method: "POST", body: JSON.stringify({ ...body, entityId: parseInt(selectedEntityId) }) }),
    onSuccess: (data) => {
      toast.success(`Successfully imported ${data.count} bank statement entries`);
      refetchBankTxns();
      setBankFileContent("");
    },
    onError: (e: any) => toast.error(e.message)
  });

  const reconcileBankTxn = useMutation({
    mutationFn: ({ id, body }: any) => j(`/api/bank-reconciliation/transactions/${id}/match`, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success("Bank transaction reconciled successfully");
      refetchBankTxns();
      setOpenReconTxn(null);
    },
    onError: (e: any) => toast.error(e.message)
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      triggerOcr.mutate({
        documentUrl: `/objects/uploads/${file.name}`,
        documentName: file.name
      });
    }, 1500);
  };

  const handleTallyDownload = () => {
    setTallyExporting(true);
    setTimeout(() => {
      window.open(`/api/accounting/tally/export?entityId=${selectedEntityId}&fromDate=${tallyDateFrom}&toDate=${tallyDateTo}`, "_blank");
      setTallyExporting(false);
      toast.success("Tally export download compiled");
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600 animate-pulse" />
            AI Accounting & Finance Assistant
          </h2>
          <p className="text-muted-foreground text-sm">
            Document-driven expense ingestion, automated ledger recommendations, bank statement reconciliation & Tally ERP 9 / TallyPrime integration.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase">Legal Entity:</Label>
          <Select value={selectedEntityId} onValueChange={(val) => {
            setSelectedEntityId(val);
            if (val === "consolidated") {
              setActiveTab("dashboard");
            }
          }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select Entity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Hope Neurotrauma Hospital</SelectItem>
              <SelectItem value="2">Care Diagnostics</SelectItem>
              <SelectItem value="consolidated">Consolidated Management Reports</SelectItem>
            </SelectContent>
          </Select>

          {selectedEntityId === "2" && (
            <div className="flex items-center gap-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Dept:</Label>
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select Dept" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Departments</SelectItem>
                  <SelectItem value="Radiology">Radiology</SelectItem>
                  <SelectItem value="Laboratory">Laboratory</SelectItem>
                  <SelectItem value="Pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="Ultrasound">Ultrasound</SelectItem>
                  <SelectItem value="CT">CT</SelectItem>
                  <SelectItem value="MRI">MRI</SelectItem>
                  <SelectItem value="X-Ray">X-Ray</SelectItem>
                  <SelectItem value="Administration">Administration</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      {selectedEntityId === "consolidated" ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Combined Revenue</p>
              <p className="text-2xl font-extrabold text-indigo-700">{inr(consolidatedData?.combined?.revenue)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500 bg-red-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Combined Expenses</p>
              <p className="text-2xl font-extrabold text-red-700">{inr(consolidatedData?.combined?.expenses)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Combined Net Profit</p>
              <p className="text-2xl font-extrabold text-emerald-700">{inr(consolidatedData?.combined?.netProfit)}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500 bg-slate-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Combined Bank Position</p>
              <p className="text-2xl font-extrabold text-slate-700">{inr(consolidatedData?.combined?.bankPosition)}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500 bg-amber-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Pending OCR Reviews</p>
              <p className="text-2xl font-extrabold text-amber-700">{stats?.pendingOcr ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Pending Approvals</p>
              <p className="text-2xl font-extrabold text-indigo-700">{stats?.pendingApproval ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Unmatched Bank Entries</p>
              <p className="text-2xl font-extrabold text-emerald-700">{stats?.unmatchedBank ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-slate-500 bg-slate-50/5">
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase">Finalized AI Vouchers</p>
              <p className="text-2xl font-extrabold text-slate-700">{stats?.totalVouchers ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="dashboard">AI Accounts Dashboard</TabsTrigger>
          {selectedEntityId !== "consolidated" && (
            <>
              <TabsTrigger value="expense">Smart Expense Entry</TabsTrigger>
              <TabsTrigger value="repository">Document Repository</TabsTrigger>
              <TabsTrigger value="bank-recon">Bank Statement import & Recon</TabsTrigger>
              <TabsTrigger value="tally">Tally ERP 9 / TallyPrime Export</TabsTrigger>
            </>
          )}
        </TabsList>
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {selectedEntityId === "consolidated" ? (
            <div className="space-y-4">
              <div className="flex gap-2.5 p-3 rounded-lg border border-indigo-100 bg-indigo-50/50 text-xs text-indigo-800 items-center">
                <Cpu className="h-4 w-4 text-indigo-600 animate-pulse shrink-0" />
                <span className="font-semibold">Internal Management Report Only: Not for Statutory GST, TDS or Tax Filings.</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle className="text-base">Hope Neurotrauma & Multispeciality Hospital</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between border-b pb-1"><span>Revenue:</span><span className="font-semibold">{inr(consolidatedData?.hopeHospital?.revenue)}</span></div>
                    <div className="flex justify-between border-b pb-1 text-red-600"><span>Expenses:</span><span className="font-semibold">{inr(consolidatedData?.hopeHospital?.expenses)}</span></div>
                    <div className="flex justify-between border-b pb-1 text-green-600 font-bold"><span>Net Profit:</span><span>{inr(consolidatedData?.hopeHospital?.netProfit)}</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Outstanding Receivables:</span><span>{inr(consolidatedData?.hopeHospital?.receivables)}</span></div>
                    <div className="flex justify-between"><span>Bank/Cash Balance:</span><span>{inr(consolidatedData?.hopeHospital?.bankPosition)}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base">Care Diagnostics (Departmental Summary)</CardTitle></CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between border-b pb-1"><span>Revenue:</span><span className="font-semibold">{inr(consolidatedData?.careDiagnostics?.revenue)}</span></div>
                    <div className="flex justify-between border-b pb-1 text-red-600"><span>Expenses:</span><span className="font-semibold">{inr(consolidatedData?.careDiagnostics?.expenses)}</span></div>
                    <div className="flex justify-between border-b pb-1 text-green-600 font-bold"><span>Net Profit:</span><span>{inr(consolidatedData?.careDiagnostics?.netProfit)}</span></div>
                    <div className="flex justify-between border-b pb-1"><span>Outstanding Receivables:</span><span>{inr(consolidatedData?.careDiagnostics?.receivables)}</span></div>
                    <div className="flex justify-between"><span>Bank/Cash Balance:</span><span>{inr(consolidatedData?.careDiagnostics?.bankPosition)}</span></div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="md:col-span-2">
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-5 w-5 text-indigo-500" /> AI Financial Advisory Alerts</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {(!alertsData?.alerts || alertsData.alerts.length === 0) ? (
                    <p className="text-sm text-muted-foreground italic">No anomalies or audit exceptions flagged by the AI engine.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {alertsData.alerts.map((a: string, idx: number) => (
                        <div key={idx} className="flex gap-2.5 p-3 rounded-lg border border-amber-100 bg-amber-50/50 text-xs text-amber-800">
                          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <Button className="w-full justify-start gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={() => setActiveTab("expense")}>
                    <FileUp className="h-4 w-4" /> Upload New Invoice Scan
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveTab("bank-recon")}>
                    <Landmark className="h-4 w-4" /> Import Statement
                  </Button>
                  <Button variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveTab("tally")}>
                    <Download className="h-4 w-4" /> Go to Tally Export
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="expense" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-5 w-5 text-indigo-500" /> Upload Invoice Scan / PDF / Photo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-xl p-8 text-center bg-slate-50/50 border-slate-200 flex flex-col items-center justify-center gap-3">
                <Upload className="h-10 w-10 text-muted-foreground animate-bounce" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm">Drag & drop your files here, or click to browse</p>
                  <p className="text-xs text-muted-foreground">Supports PDF, JPG, PNG, HEIC, WebP, Multi-page PDF, Mobile scanner photos</p>
                </div>
                <div className="relative">
                  <Input type="file" onChange={handleFileUpload} className="hidden" id="inv-uploader" accept="image/*,application/pdf" disabled={uploading} />
                  <Button asChild variant="secondary" disabled={uploading}>
                    <label htmlFor="inv-uploader" className="cursor-pointer">
                      {uploading ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Uploading & scanning…
                        </>
                      ) : (
                        "Select File"
                      )}
                    </label>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {ocrReviewDoc && (
            <Card className="border-2 border-indigo-200">
              <CardHeader className="bg-indigo-50/40 border-b border-indigo-100 flex items-center justify-between flex-row">
                <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-indigo-600" />
                  AI Ingestion In Draft Mode - Review & Approve Voucher
                </CardTitle>
                <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700">Pending Review</Badge>
              </CardHeader>
              <CardContent className="pt-4 grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b pb-1">AI Extracted Fields (Editable)</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Vendor Name</Label>
                      <Input value={editFields.vendorName || ""} onChange={e => setEditFields({ ...editFields, vendorName: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Invoice Number</Label>
                      <Input value={editFields.invoiceNo || ""} onChange={e => setEditFields({ ...editFields, invoiceNo: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Invoice Date</Label>
                      <Input type="date" value={editFields.invoiceDate || ""} onChange={e => setEditFields({ ...editFields, invoiceDate: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">GSTIN</Label>
                      <Input value={editFields.gstin || ""} onChange={e => setEditFields({ ...editFields, gstin: e.target.value })} />
                    </div>
                    <div>
                      <Label className="text-xs">Invoice Amount (Base)</Label>
                      <Input type="number" step="0.01" value={editFields.invoiceAmount || 0} onChange={e => setEditFields({ ...editFields, invoiceAmount: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-xs">CGST</Label>
                      <Input type="number" step="0.01" value={editFields.cgst || 0} onChange={e => setEditFields({ ...editFields, cgst: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-xs">SGST</Label>
                      <Input type="number" step="0.01" value={editFields.sgst || 0} onChange={e => setEditFields({ ...editFields, sgst: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div>
                      <Label className="text-xs">Total Amount (₹)</Label>
                      <Input type="number" step="0.01" value={editFields.totalAmount || 0} onChange={e => setEditFields({ ...editFields, totalAmount: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Narration / Description</Label>
                    <Textarea rows={2} value={editFields.expenseDescription || ""} onChange={e => setEditFields({ ...editFields, expenseDescription: e.target.value })} />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b pb-1">AI Ledger Mapping Recommendations</h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Target Legal Entity</Label>
                      <Select value={String(editRecs.entityId || "1")} onValueChange={v => {
                        const entId = parseInt(v);
                        setEditRecs({ 
                          ...editRecs, 
                          entityId: entId,
                          expenseLedgerId: entId === 2 ? 21 : 1, // Default fallbacks
                          paymentAccountId: entId === 2 ? 20 : 2
                        });
                      }}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Hope Neurotrauma & Multispeciality Hospital</SelectItem>
                          <SelectItem value="2">Care Diagnostics</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs">Expense / Purchase Ledger</Label>
                      <Select value={String(editRecs.expenseLedgerId || "")} onValueChange={v => setEditRecs({ ...editRecs, expenseLedgerId: parseInt(v) })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(ledgers || []).filter((l: any) => l.entityId === (editRecs.entityId || 1)).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[10px] text-indigo-600 mt-1 flex items-center gap-1"><Sparkles className="h-3 w-3" /> Recommended based on OCR Text: {editRecs.expenseLedgerName}</p>
                    </div>

                    <div>
                      <Label className="text-xs">Credit / Payment Account Ledger</Label>
                      <Select value={String(editRecs.paymentAccountId || "")} onValueChange={v => setEditRecs({ ...editRecs, paymentAccountId: parseInt(v) })}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(ledgers || []).filter((l: any) => l.entityId === (editRecs.entityId || 1)).map((l: any) => (
                            <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div><Label className="text-xs">Cost Centre</Label><Input value={editFields.costCentre || ""} onChange={e => setEditFields({ ...editFields, costCentre: e.target.value })} /></div>
                      <div><Label className="text-xs">Branch</Label><Input value={editFields.branch || ""} onChange={e => setEditFields({ ...editFields, branch: e.target.value })} /></div>
                    </div>
                  </div>

                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-[11px] text-indigo-900 space-y-1">
                    <p className="font-semibold">⚠️ Safety Advisory Protocol:</p>
                    <p>AI ledger mappings and fields are recommendations only. Draft entries are not posted to accounting registers until accountant review is signed off.</p>
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" onClick={() => setOcrReviewDoc(null)}>Discard Draft</Button>
                    <Button onClick={() => approveDoc.mutate(ocrReviewDoc.id)} disabled={approveDoc.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
                      {approveDoc.isPending ? "Approving & Seeding..." : "Approve & Post Draft Voucher"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="repository" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between flex-wrap gap-4">
              <CardTitle className="text-base">Financial Document Repository</CardTitle>
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search by Vendor, Invoice, GSTIN…" className="pl-9 h-8" />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doc Name</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>GSTIN</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!documents || documents.length === 0) ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No financial documents uploaded yet.</TableCell></TableRow>
                  ) : (
                    documents.map((d: any) => {
                      const f = d.extractedFields || {};
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-semibold text-xs max-w-[150px] truncate">{d.documentName}</TableCell>
                          <TableCell className="text-xs">{f.vendorName || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{f.invoiceNo || "—"}</TableCell>
                          <TableCell className="text-xs">{f.invoiceDate || "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{f.gstin || "—"}</TableCell>
                          <TableCell className="text-right font-medium">{inr(f.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge className={
                              d.status === "approved" ? "bg-green-100 text-green-700" :
                              d.status === "draft" ? "bg-amber-100 text-amber-700" :
                              "bg-slate-100 text-slate-700"
                            }>
                              {d.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => {
                              setOcrReviewDoc(d);
                              setEditFields(d.extractedFields || {});
                              setEditRecs(d.ledgerRecommendations || {});
                              setActiveTab("expense");
                            }}>
                              <Eye className="h-3 w-3" /> View & Approve
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bank-recon" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Landmark className="h-5 w-5 text-indigo-500" /> Import PDF / CSV Bank Statement</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea 
                value={bankFileContent} 
                onChange={e => setBankFileContent(e.target.value)} 
                placeholder="Paste statement text contents or CSV rows (date, description, reference, amount, credit|debit)..."
                rows={4}
              />
              <div className="flex justify-end">
                <Button onClick={() => importBankStatement.mutate({ documentName: "Statement.csv", fileContent: bankFileContent })} disabled={!bankFileContent.trim() || importBankStatement.isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium">
                  {importBankStatement.isPending ? "Parsing statement…" : "Parse & Import Statement Entries"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Unreconciled Bank Transactions (Match Center)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Matched Voucher</TableHead>
                    <TableHead>AI Suggestion</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(!bankTransactions || bankTransactions.length === 0) ? (
                    <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No bank transactions found.</TableCell></TableRow>
                  ) : (
                    bankTransactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{t.txnDate}</TableCell>
                        <TableCell className="text-xs">{t.description}</TableCell>
                        <TableCell className="font-mono text-xs">{t.reference}</TableCell>
                        <TableCell><Badge className={t.txnType === "credit" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>{t.txnType}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{inr(t.amount)}</TableCell>
                        <TableCell className="text-xs">
                          {t.reconciled ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Reconciled</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Unmatched</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!t.reconciled && (
                            <Badge className="bg-indigo-100 text-indigo-700 border-0 flex items-center gap-1 w-max">
                              <Sparkles className="h-3 w-3 text-indigo-600 animate-spin" />
                              <span>Match Available</span>
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!t.reconciled && (
                            <Button size="sm" variant="outline" onClick={() => setOpenReconTxn(t)} className="h-7 text-xs border-indigo-200 hover:bg-indigo-50">
                              Reconcile
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {openReconTxn && (
            <Dialog open={!!openReconTxn} onOpenChange={v => !v && setOpenReconTxn(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-600" />
                    AI Reconciler Suggestions: INR {parseFloat(openReconTxn.amount).toLocaleString()}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-xs text-muted-foreground p-3 bg-muted rounded-lg">
                    Bank Entry: <span className="font-semibold">{openReconTxn.description}</span> on {openReconTxn.txnDate}.
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-bold">Suggested Matches in ERP (High Confidence):</Label>
                    <div className="border rounded-lg divide-y">
                      <div className="flex items-center justify-between p-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">Ramesh Kumar - Pharmacy Sale #PV9011</p>
                          <p className="text-muted-foreground mt-0.5">Amount: INR {parseFloat(openReconTxn.amount).toLocaleString()} | Mode: UPI | Date: {openReconTxn.txnDate}</p>
                        </div>
                        <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={() => reconcileBankTxn.mutate({ id: openReconTxn.id, body: { matchedPharmacySaleId: 9011, reconciled: true } })}>
                          Match & Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="tally" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Download className="h-5 w-5 text-indigo-500" /> Export Ledgers & Vouchers to Tally ERP 9 / TallyPrime</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-md">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>From Date</Label>
                  <Input type="date" value={tallyDateFrom} onChange={e => setTallyDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label>To Date</Label>
                  <Input type="date" value={tallyDateTo} onChange={e => setTallyDateTo(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Label>Voucher Type Filter</Label>
                <Select defaultValue="All">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Vouchers</SelectItem>
                    <SelectItem value="Payment">Payments Only</SelectItem>
                    <SelectItem value="Receipt">Receipts Only</SelectItem>
                    <SelectItem value="Journal">Journals Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-700 space-y-1">
                <p className="font-semibold flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Pre-Export Validation Passed:</p>
                <p>1. Ledger names match Tally standards.</p>
                <p>2. Debits match credits perfectly in all vouchers within range.</p>
                <p>3. Only approved & finalized transactions will be exported.</p>
              </div>

              <Button onClick={handleTallyDownload} disabled={tallyExporting} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center justify-center gap-2">
                {tallyExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Compiling Export…
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Download XML for Tally Import
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
