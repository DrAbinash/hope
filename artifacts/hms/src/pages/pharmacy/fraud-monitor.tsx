import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ShieldAlert, Eye, Search, AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";

const RISK_META: Record<string, { badge: string; label: string }> = {
  high: { badge: "bg-red-100 text-red-800 border-red-200", label: "High Risk" },
  medium: { badge: "bg-amber-100 text-amber-800 border-amber-200", label: "Medium Risk" },
  low: { badge: "bg-blue-100 text-blue-800 border-blue-200", label: "Low Risk" },
};

const EVENT_TYPES: Record<string, string> = {
  high_discount: "High Discount",
  midnight_billing: "Midnight Billing",
  negative_margin: "Negative Margin",
  repeated_refund: "Repeated Refund",
  cancelled_after_payment: "Cancelled After Payment",
  stock_adj_no_approval: "Unapproved Stock Adj",
  ndps_mismatch: "NDPS Mismatch",
  excessive_rate_edit: "Excessive Rate Edit",
  sudden_stock_shrinkage: "Stock Shrinkage",
};

export default function FraudMonitor() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ risk_level: "", event_type: "", from_date: "", to_date: "", reviewed: "false" });
  const [reviewDialog, setReviewDialog] = useState<{ id: number; title: string } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [scanDays, setScanDays] = useState("1");

  const params = new URLSearchParams();
  if (filters.risk_level) params.set("risk_level", filters.risk_level);
  if (filters.event_type) params.set("event_type", filters.event_type);
  if (filters.from_date) params.set("from_date", filters.from_date);
  if (filters.to_date) params.set("to_date", filters.to_date);
  if (filters.reviewed) params.set("reviewed", filters.reviewed);

  const { data: events = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ["/api/pharmacy/fraud-events", filters],
    queryFn: async () => {
      const r = await fetch(`/api/pharmacy/fraud-events?${params}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch fraud events");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: summary } = useQuery<any>({
    queryKey: ["/api/pharmacy/fraud-events/summary"],
    queryFn: async () => {
      const r = await fetch("/api/pharmacy/fraud-events/summary", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch summary");
      return r.json();
    },
  });

  const scanMutation = useMutation({
    mutationFn: async (days: number) => {
      const r = await fetch("/api/pharmacy/fraud-events/scan", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ days }) });
      if (!r.ok) throw new Error("Failed to run scan");
      return r.json();
    },
    onSuccess: (res) => { toast.success(`Scan complete — ${res.events_inserted} new events flagged`); qc.invalidateQueries({ queryKey: ["/api/pharmacy/fraud-events"] }); qc.invalidateQueries({ queryKey: ["/api/pharmacy/fraud-events/summary"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, note }: any) => {
      const r = await fetch(`/api/pharmacy/fraud-events/${id}/review`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ review_notes: note }) });
      if (!r.ok) throw new Error("Failed to mark as reviewed");
      return r.json();
    },
    onSuccess: () => { toast.success("Marked as reviewed"); qc.invalidateQueries({ queryKey: ["/api/pharmacy/fraud-events"] }); qc.invalidateQueries({ queryKey: ["/api/pharmacy/fraud-events/summary"] }); setReviewDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-4 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-red-600" />
          <div><h1 className="text-xl font-bold">Fraud & Anomaly Monitor</h1><p className="text-sm text-muted-foreground">Admin-only — suspicious activity detection engine</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={90} className="w-20 h-8" value={scanDays} onChange={e => setScanDays(e.target.value)} />
          <span className="text-sm text-muted-foreground">days</span>
          <Button size="sm" variant="destructive" onClick={() => scanMutation.mutate(Number(scanDays))} disabled={scanMutation.isPending}>
            <RefreshCcw className="h-4 w-4 mr-1" />{scanMutation.isPending ? "Scanning…" : "Run Scan"}
          </Button>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "High Risk (Unreviewed)", value: summary.high_unreviewed, color: "text-red-700", bg: "bg-red-50 border-red-200" },
            { label: "Medium Risk", value: summary.medium_unreviewed, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
            { label: "Low Risk", value: summary.low_unreviewed, color: "text-blue-700", bg: "" },
            { label: "Reviewed", value: summary.reviewed_total, color: "text-green-700", bg: "" },
            { label: "High Risk Amount", value: `₹${Number(summary.high_risk_amount ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`, color: "text-red-800", bg: "" },
          ].map(k => (
            <Card key={k.label} className={k.bg ? `border-2 ${k.bg}` : ""}><CardContent className="pt-3 pb-2">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className={`text-2xl font-bold ${k.color}`}>{k.value ?? 0}</div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-3 pb-2">
          <div className="flex flex-wrap gap-3">
            <div>
              <Label className="text-xs">Risk Level</Label>
              <Select value={filters.risk_level} onValueChange={v => setFilters(p => ({ ...p, risk_level: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-8 w-36"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.keys(RISK_META).map(k => <SelectItem key={k} value={k}>{RISK_META[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Event Type</Label>
              <Select value={filters.event_type} onValueChange={v => setFilters(p => ({ ...p, event_type: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-8 w-44"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(EVENT_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">From</Label><Input type="date" className="h-8 w-36" value={filters.from_date} onChange={e => setFilters(p => ({ ...p, from_date: e.target.value }))} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" className="h-8 w-36" value={filters.to_date} onChange={e => setFilters(p => ({ ...p, to_date: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Show</Label>
              <Select value={filters.reviewed} onValueChange={v => setFilters(p => ({ ...p, reviewed: v }))}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">Unreviewed Only</SelectItem>
                  <SelectItem value="">All Events</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Risk</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Bill No</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date / Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10">Loading…</TableCell></TableRow>
            ) : events.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No flagged events. Run scan to detect anomalies.</TableCell></TableRow>
            ) : events.map((e: any) => (
              <TableRow key={e.id} className={e.risk_level === "high" ? "bg-red-50/30" : ""}>
                <TableCell><Badge className={(RISK_META[e.risk_level] ?? RISK_META.low).badge}>{(RISK_META[e.risk_level] ?? { label: e.risk_level }).label}</Badge></TableCell>
                <TableCell className="text-xs">{EVENT_TYPES[e.event_type] ?? e.event_type}</TableCell>
                <TableCell className="text-xs max-w-52 truncate" title={e.description}>{e.title}</TableCell>
                <TableCell className="text-xs">{e.user_name ?? "—"}<div className="text-muted-foreground">{e.user_role}</div></TableCell>
                <TableCell className="font-mono text-xs">{e.bill_no ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.patient_name ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.amount ? `₹${Number(e.amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}</TableCell>
                <TableCell className="text-xs">{new Date(e.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</TableCell>
                <TableCell>
                  {e.is_reviewed ? <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Reviewed</Badge>
                    : <Badge variant="outline" className="text-amber-700">Pending</Badge>}
                </TableCell>
                <TableCell>
                  {!e.is_reviewed && (
                    <Button size="sm" variant="ghost" onClick={() => { setReviewDialog({ id: e.id, title: e.title }); setReviewNote(""); }}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Fraud Event</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{reviewDialog?.title}</p>
          <div><Label>Review Notes</Label><Textarea rows={3} value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Describe your findings and action taken..." className="mt-1" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: reviewDialog!.id, note: reviewNote })}>Mark Reviewed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
