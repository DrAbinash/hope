import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Printer } from "lucide-react";

const j = async (url: string) => {
  const r = await fetch(url, { credentials: "include" });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Request failed");
  return r.json();
};
const today = () => new Date().toISOString().slice(0, 10);

const SCHEDULE_COLORS: Record<string, string> = {
  narcotic: "bg-red-100 text-red-800",
  psychotropic: "bg-purple-100 text-purple-800",
  schedule_h1: "bg-orange-100 text-orange-800",
  schedule_h: "bg-yellow-100 text-yellow-800",
};

export default function NdpsRegisterPage() {
  const firstOfMonth = today().slice(0, 7) + "-01";
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today());
  const [medicineId, setMedicineId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery<any>({
    queryKey: ["ndps-register", from, to, medicineId, search, page],
    queryFn: () => j(
      `/api/pharmacy/schedule-h-register?from=${from}&to=${to}&page=${page}&limit=50` +
      `${medicineId ? `&medicineId=${medicineId}` : ""}` +
      `${search ? `&search=${encodeURIComponent(search)}` : ""}`
    ),
  });

  const { data: medicines } = useQuery<any[]>({ queryKey: ["medicines"], queryFn: () => j("/api/pharmacy/medicines") });
  const ndpsMeds = (medicines || []).filter(m => m.scheduleType === "narcotic" || m.scheduleType === "psychotropic");

  const entries = (data?.items || []).filter((e: any) =>
    e.scheduleType === "narcotic" || e.scheduleType === "psychotropic"
  );

  const printRegister = () => {
    const w = window.open("", "_blank", "width=900,height=600");
    if (!w) return;
    const rows = entries.map((e: any) => `
      <tr>
        <td>${e.dispensedAt}</td>
        <td>${e.medicineName || "—"}</td>
        <td>${e.scheduleType?.toUpperCase() || "—"}</td>
        <td>${e.batchNo || "—"}</td>
        <td>${e.quantityDispensed}</td>
        <td>${e.patientName || "—"}</td>
        <td>${e.doctorName || "—"}</td>
        <td>${e.prescriptionRef || "—"}</td>
        <td>${e.issuedBy || "—"}</td>
        <td>${e.verifiedBy || "—"}</td>
        <td>${e.runningBalance || "—"}</td>
      </tr>`).join("");
    w.document.write(`<html><head><title>NDPS/Narcotic Register</title>
      <style>body{font-family:sans-serif;font-size:11px;padding:16px}h2{margin-bottom:4px}p{color:#666;margin:0 0 10px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
      th{background:#f3f3f3;font-weight:600}</style></head>
      <body><h2>NDPS / Narcotic & Psychotropic Register</h2>
      <p>Period: ${from} to ${to}</p>
      <table><thead><tr>
        <th>Date</th><th>Medicine</th><th>Schedule</th><th>Batch</th><th>Qty</th>
        <th>Patient</th><th>Doctor</th><th>Rx Ref</th><th>Issued By</th><th>Verified By</th><th>Balance</th>
      </tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-red-600" />NDPS / Narcotic Register
          </h2>
          <p className="text-muted-foreground text-sm">Narcotic & Psychotropic Substances Act compliance register</p>
        </div>
        <Button variant="outline" size="sm" onClick={printRegister}><Printer className="h-4 w-4 mr-2" />Print Register</Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-36 h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">NDPS Medicine</Label>
              <Select value={medicineId} onValueChange={setMedicineId}>
                <SelectTrigger className="w-48 h-8 text-sm"><SelectValue placeholder="All NDPS" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All NDPS Medicines</SelectItem>
                  {ndpsMeds.map((m: any) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label className="text-xs">Search</Label>
              <Input placeholder="Doctor / Rx Ref…" value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm" />
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
                  <TableHead>Medicine</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Rx Ref</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Verified By</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-10">No NDPS entries found for the selected period.</TableCell></TableRow>
                )}
                {entries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm">{e.dispensedAt}</TableCell>
                    <TableCell className="font-medium text-sm">{e.medicineName}</TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${SCHEDULE_COLORS[e.scheduleType] || ""}`}>
                        {e.scheduleType?.toUpperCase().replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{e.batchNo || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{e.quantityDispensed}</TableCell>
                    <TableCell className="text-sm">{e.patientName || "—"}</TableCell>
                    <TableCell className="text-sm">{e.doctorName || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{e.prescriptionRef || "—"}</TableCell>
                    <TableCell className="text-sm">{e.issuedBy || "—"}</TableCell>
                    <TableCell className="text-sm">{e.verifiedBy || "—"}</TableCell>
                    <TableCell className="text-right font-semibold">{e.runningBalance ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {(data?.total || 0) > 50 && (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
          <span className="text-sm self-center">Page {page} of {Math.ceil((data?.total || 0) / 50)}</span>
          <Button size="sm" variant="outline" disabled={page >= Math.ceil((data?.total || 0) / 50)} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
