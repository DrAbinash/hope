import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Clipboard, Clock, AlertTriangle, CheckCircle2, RefreshCcw } from "lucide-react";

const PRIORITY_META: Record<string, { color: string; label: string }> = {
  normal: { color: "bg-gray-100 text-gray-700", label: "Normal" },
  urgent: { color: "bg-amber-100 text-amber-700", label: "Urgent" },
  icu: { color: "bg-red-100 text-red-700", label: "ICU" },
  ot: { color: "bg-purple-100 text-purple-700", label: "OT" },
};
const STATUS_META: Record<string, { color: string }> = {
  pending: { color: "bg-amber-100 text-amber-700" },
  dispensing: { color: "bg-blue-100 text-blue-700" },
  partial: { color: "bg-orange-100 text-orange-700" },
  completed: { color: "bg-green-100 text-green-700" },
  cancelled: { color: "bg-gray-100 text-gray-700" },
};

async function fetchQueue(status?: string, priority?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (priority) params.set("priority", priority);
  const r = await fetch(`/api/pharmacy/prescription-queue?${params}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed");
  const data = await r.json();
  return Array.isArray(data) ? data : [];
}

export default function PrescriptionQueuePage() {
  const qc = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterPriority, setFilterPriority] = useState("");
  const [search, setSearch] = useState("");

  const { data: queue = [], isLoading, refetch } = useQuery({
    queryKey: ["prescription-queue", filterStatus, filterPriority],
    queryFn: () => fetchQueue(filterStatus || undefined, filterPriority || undefined),
    refetchInterval: 30000,
  });
  const safeQueue = Array.isArray(queue) ? queue : [];

  const dispenseMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await fetch(`/api/pharmacy/prescription-queue/${id}/dispense`, { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    onSuccess: () => { toast.success("Queue updated"); qc.invalidateQueries({ queryKey: ["prescription-queue"] }); },
    onError: () => toast.error("Failed to update queue"),
  });

  const filtered = safeQueue.filter((q: any) =>
    !search || q.patientName?.toLowerCase().includes(search.toLowerCase()) || q.queueNo?.includes(search)
  );

  const counts = { pending: safeQueue.filter((q: any) => q.status === "pending").length, urgent: safeQueue.filter((q: any) => q.priority !== "normal").length };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">Prescription Queue</h1>
          <p className="text-sm text-muted-foreground">Doctor Rx → Pharmacy dispensing workflow</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCcw className="w-3.5 h-3.5 mr-1" />Refresh</Button>
      </div>

      {/* Summary badges */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-sm font-medium text-amber-700">{counts.pending} Pending</span>
        </div>
        {counts.urgent > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-50 border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-sm font-medium text-red-700">{counts.urgent} Urgent / Critical</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search patient / queue no…" className="max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {["pending", "dispensing", "partial", "completed", "cancelled"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            {Object.entries(PRIORITY_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Queue No</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
                : filtered.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground"><Clipboard className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No prescriptions in queue</p></TableCell></TableRow>
                : filtered.map((q: any) => (
                  <TableRow key={q.id} className={q.priority === "icu" || q.priority === "ot" ? "bg-red-50/40" : q.priority === "urgent" ? "bg-amber-50/40" : ""}>
                    <TableCell className="font-mono text-xs font-medium">{q.queueNo}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{q.patientName}</div>
                      {q.patientPhone && <div className="text-xs text-muted-foreground">{q.patientPhone}</div>}
                    </TableCell>
                    <TableCell className="text-sm">{q.doctorName || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        {(q.prescriptionItems as any[])?.slice(0, 2).map((item: any, i: number) => (
                          <div key={i} className="text-xs flex items-center gap-1">
                            {item.available === false ? <span className="text-red-500">⚠</span> : <span className="text-green-500">✓</span>}
                            <span>{item.medicineName} ×{item.quantity}</span>
                          </div>
                        ))}
                        {(q.prescriptionItems as any[])?.length > 2 && <div className="text-xs text-muted-foreground">+{q.prescriptionItems.length - 2} more</div>}
                      </div>
                    </TableCell>
                    <TableCell><Badge className={PRIORITY_META[q.priority]?.color ?? ""}>{PRIORITY_META[q.priority]?.label ?? q.priority}</Badge></TableCell>
                    <TableCell><Badge className={STATUS_META[q.status]?.color ?? ""}>{q.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</TableCell>
                    <TableCell>
                      {q.status === "pending" && (
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => dispenseMutation.mutate({ id: q.id, status: "dispensing" })}>Start</Button>
                          <Button size="sm" onClick={() => dispenseMutation.mutate({ id: q.id, status: "completed" })} className="bg-green-600 hover:bg-green-700">Done</Button>
                        </div>
                      )}
                      {q.status === "dispensing" && (
                        <Button size="sm" onClick={() => dispenseMutation.mutate({ id: q.id, status: "completed" })} className="bg-green-600 hover:bg-green-700">
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Complete
                        </Button>
                      )}
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
