import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Download, BookOpen, Check, Clock } from "lucide-react";

const EXPORT_TYPES = [
  { value: "sales", label: "Pharmacy Sales" },
  { value: "purchases", label: "Purchases" },
  { value: "returns", label: "Sales Returns" },
  { value: "vendor_payments", label: "Vendor Payments" },
  { value: "all", label: "All Transactions" },
];

const VOUCHER_MAPPING: Record<string, { debit: string; credit: string }> = {
  sales: { debit: "Cash / Patient Dues A/c", credit: "Pharmacy Sales A/c + GST Payable" },
  purchases: { debit: "Purchase A/c + GST Input", credit: "Vendor A/c" },
  returns: { debit: "Pharmacy Sales A/c + GST Payable", credit: "Cash / Credit Note" },
  vendor_payments: { debit: "Vendor A/c", credit: "Bank / Cash A/c" },
  all: { debit: "Various", credit: "Various" },
};

export default function TallyExport() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ export_type: "sales", from_date: "", to_date: "" });
  const [lastExport, setLastExport] = useState<any | null>(null);

  const { data: exports = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/tally-exports"],
    queryFn: () => fetch("/api/pharmacy/tally-exports").then(r => r.json()),
  });

  const exportMutation = useMutation({
    mutationFn: (data: any) => fetch("/api/pharmacy/tally-exports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }),
    onSuccess: (res) => {
      toast.success(`Export complete — ${res.record_count} vouchers generated`);
      setLastExport(res);
      qc.invalidateQueries({ queryKey: ["/api/pharmacy/tally-exports"] });

      // Download as JSON (Tally-compatible structure)
      const blob = new Blob([JSON.stringify(res.vouchers, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `tally_export_${form.export_type}_${form.from_date}_${form.to_date}.json`; a.click();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-teal-600" />
        <div><h1 className="text-xl font-bold">Tally / Accounting Export</h1><p className="text-sm text-muted-foreground">Generate Tally-compatible voucher exports for pharmacy accounting</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-base">Generate Export</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Export Type</Label>
              <Select value={form.export_type} onValueChange={v => setForm(p => ({ ...p, export_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EXPORT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From Date *</Label><Input type="date" value={form.from_date} onChange={e => setForm(p => ({ ...p, from_date: e.target.value }))} /></div>
              <div><Label>To Date *</Label><Input type="date" value={form.to_date} onChange={e => setForm(p => ({ ...p, to_date: e.target.value }))} /></div>
            </div>

            {form.export_type && VOUCHER_MAPPING[form.export_type] && (
              <div className="bg-muted rounded-lg p-3 text-xs space-y-1">
                <div className="font-semibold text-xs uppercase text-muted-foreground">Voucher Entry Preview</div>
                <div className="flex justify-between"><span className="text-green-700">Dr: {VOUCHER_MAPPING[form.export_type].debit}</span></div>
                <div className="flex justify-between"><span className="text-blue-700">Cr: {VOUCHER_MAPPING[form.export_type].credit}</span></div>
              </div>
            )}

            <Button className="w-full" disabled={!form.from_date || !form.to_date || exportMutation.isPending}
              onClick={() => exportMutation.mutate(form)}>
              <Download className="h-4 w-4 mr-2" />{exportMutation.isPending ? "Generating…" : "Generate & Download"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-3"><CardTitle className="text-base">Ledger Mapping</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { account: "Pharmacy Sales A/c", type: "Revenue", tally: "Sales Account" },
                { account: "GST Payable (CGST)", type: "Liability", tally: "Duties & Taxes" },
                { account: "GST Payable (SGST)", type: "Liability", tally: "Duties & Taxes" },
                { account: "Purchase A/c", type: "Expense", tally: "Purchase Account" },
                { account: "Vendor A/c", type: "Liability", tally: "Sundry Creditors" },
                { account: "Patient Dues A/c", type: "Asset", tally: "Sundry Debtors" },
                { account: "Cash A/c", type: "Asset", tally: "Cash-in-hand" },
              ].map((m) => (
                <div key={m.account} className="flex justify-between py-1 border-b last:border-0">
                  <span className="font-medium">{m.account}</span>
                  <Badge variant="outline" className="text-xs">{m.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2 pt-3"><CardTitle className="text-base">Export History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Export No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exported By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading…</TableCell></TableRow>
              ) : exports.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No exports yet</TableCell></TableRow>
              ) : exports.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.export_no}</TableCell>
                  <TableCell className="capitalize">{e.export_type}</TableCell>
                  <TableCell className="text-xs">{e.from_date} → {e.to_date}</TableCell>
                  <TableCell>{e.record_count}</TableCell>
                  <TableCell>
                    {e.status === "exported"
                      ? <Badge className="bg-green-100 text-green-800"><Check className="h-3 w-3 mr-1" />Exported</Badge>
                      : <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />{e.status}</Badge>}
                  </TableCell>
                  <TableCell className="text-xs">{e.exported_by ?? "—"}</TableCell>
                  <TableCell className="text-xs">{e.exported_at ? new Date(e.exported_at).toLocaleDateString("en-IN") : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
