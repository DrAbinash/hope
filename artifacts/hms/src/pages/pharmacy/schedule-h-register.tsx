import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, ShieldAlert, Printer } from "lucide-react";

const j = async (url: string, opts: RequestInit = {}) => {
  const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};

const SCHEDULE_LABELS: Record<string, string> = {
  schedule_h: "Schedule H",
  schedule_h1: "Schedule H1",
  narcotic: "Narcotic",
  psychotropic: "Psychotropic",
  general: "General",
};

const SCHEDULE_COLORS: Record<string, string> = {
  schedule_h: "bg-amber-100 text-amber-800",
  schedule_h1: "bg-red-100 text-red-800",
  narcotic: "bg-purple-100 text-purple-800",
  psychotropic: "bg-blue-100 text-blue-800",
  general: "bg-gray-100 text-gray-800",
};

export default function ScheduleHRegisterPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule-h-register", from, to, search, page],
    queryFn: () => j(`/api/pharmacy/schedule-h-register?from=${from}&to=${to}&search=${encodeURIComponent(search)}&page=${page}&limit=50`),
  });

  const items = data?.items || [];
  const total = data?.total || 0;

  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Schedule H Register</title>
      <style>body{font-family:system-ui,sans-serif;padding:16px;font-size:12px}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccc;padding:6px;text-align:left;font-size:11px}th{background:#f3f4f6}</style></head>
      <body><h2>Schedule H / H1 / Narcotic / Psychotropic Register</h2>
      <p>Period: ${from || "All"} to ${to || "All"}</p>
      <table><thead><tr><th>Date</th><th>Medicine</th><th>Patient</th><th>Doctor</th><th>Prescription</th><th>Qty</th><th>Batch</th><th>Notes</th></tr></thead><tbody>
      ${items.map((r: any) => `<tr><td>${r.dispensedAt}</td><td>${r.medicineName || "#" + r.medicineId}</td><td>${r.patientId ? "#" + r.patientId : "Walk-in"}</td><td>${r.doctorName || "—"}</td><td>${r.prescriptionRef || "—"}</td><td>${r.quantityDispensed}</td><td>${r.batchNo || "—"}</td><td>${r.notes || ""}</td></tr>`).join("")}
      </tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-600" />
            Schedule H / H1 Register
          </h2>
          <p className="text-muted-foreground text-sm">Controlled drug dispensing log (Indian D&C Act compliance)</p>
        </div>
        <Button size="sm" variant="outline" onClick={print}><Printer className="h-4 w-4 mr-1" />Print</Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" className="w-36" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="From" />
          <Input type="date" className="w-36" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
        </div>
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctor or prescription..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Prescription Ref</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              )) : items.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No register entries found.</TableCell></TableRow>
              ) : items.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.dispensedAt}</TableCell>
                  <TableCell className="font-medium">{r.medicineName || `Med #${r.medicineId}`}</TableCell>
                  <TableCell>{r.patientName || (r.patientId ? `Patient #${r.patientId}` : "Walk-in")}</TableCell>
                  <TableCell>{r.doctorName || "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.prescriptionRef || "—"}</TableCell>
                  <TableCell>{r.quantityDispensed}</TableCell>
                  <TableCell className="font-mono text-xs">{r.batchNo || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={SCHEDULE_COLORS[r.scheduleType || "general"] || ""}>
                      {SCHEDULE_LABELS[r.scheduleType || "general"] || "General"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">Total entries: {total}</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={items.length < 50} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
