import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BedDouble, Printer } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

function useApi<T = any>(path: string, key: any[]) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => {
      const r = await fetch(path, { credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
  });
}

function PatientCell({ r }: { r: any }) {
  return (
    <TableCell className="font-medium">{r.patientName} <span className="text-xs text-muted-foreground font-mono">({r.uhid})</span></TableCell>
  );
}

function AgeSex({ r }: { r: any }) {
  return <TableCell>{r.age}/{(r.gender || "").slice(0, 1)}</TableCell>;
}

function StatusBadge({ s }: { s: string }) {
  return <Badge variant={s === "discharged" ? "outline" : "default"}>{s || "—"}</Badge>;
}

export default function IpdReportsPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);

  const admitted = useApi<any>("/api/reports/ipd/admitted", ["ipd-admitted"]);
  const admissions = useApi<any>(`/api/reports/ipd/admissions?fromDate=${fromDate}&toDate=${toDate}`, ["ipd-admissions", fromDate, toDate]);
  const duesCurrent = useApi<any>("/api/reports/ipd/dues?status=current", ["ipd-dues-current"]);
  const duesDP = useApi<any>("/api/reports/ipd/dues?status=discharged", ["ipd-dues-dp"]);
  const dischargesAll = useApi<any>("/api/reports/ipd/discharges", ["ipd-discharges-all"]);
  const dischargesByDate = useApi<any>(`/api/reports/ipd/discharges?fromDate=${fromDate}&toDate=${toDate}`, ["ipd-discharges-bydate", fromDate, toDate]);
  const packages = useApi<any>(`/api/reports/ipd/packages?fromDate=${fromDate}&toDate=${toDate}`, ["ipd-packages", fromDate, toDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2 print:hidden">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BedDouble className="h-6 w-6" /> IPD Reports</h2>
          <p className="text-muted-foreground text-sm">Admissions · Dues · Discharges · Packages</p>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" /></div>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </div>

      <Tabs defaultValue="admitted">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="admitted">Admitted Patient List</TabsTrigger>
          <TabsTrigger value="admissions">Admission Log By Date</TabsTrigger>
          <TabsTrigger value="dues-current">In Patient Due</TabsTrigger>
          <TabsTrigger value="dues-dp">DP Dues Report</TabsTrigger>
          <TabsTrigger value="discharges-all">Discharge Log</TabsTrigger>
          <TabsTrigger value="discharges-bydate">Discharge Log by Date</TabsTrigger>
          <TabsTrigger value="packages">IPD Package Details</TabsTrigger>
        </TabsList>

        <TabsContent value="admitted" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Currently Admitted ({admitted.data?.total ?? 0})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>IPD No.</TableHead><TableHead>Admit Date</TableHead>
                  <TableHead>Patient</TableHead><TableHead>Age/Sex</TableHead><TableHead>Doctor</TableHead>
                  <TableHead>Ward / Bed</TableHead><TableHead>Diagnosis</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(admitted.data?.rows || []).map((r: any, i: number) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ipdNo}</TableCell>
                      <TableCell>{r.admissionDate}</TableCell>
                      <PatientCell r={r} /><AgeSex r={r} />
                      <TableCell className="text-sm">{r.doctorName || "—"}</TableCell>
                      <TableCell className="text-sm">{r.wardName} / {r.bedNo}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{r.diagnosis || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!admitted.isLoading && (admitted.data?.rows || []).length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No patients currently admitted.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admissions" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Admissions ({fromDate} → {toDate}) · Total {admissions.data?.total ?? 0}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>IPD No.</TableHead><TableHead>Admit Date</TableHead>
                  <TableHead>Patient</TableHead><TableHead>Doctor</TableHead><TableHead>Ward/Bed</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(admissions.data?.rows || []).map((r: any, i: number) => (
                    <TableRow key={r.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{r.ipdNo}</TableCell>
                      <TableCell>{r.admissionDate}</TableCell>
                      <PatientCell r={r} />
                      <TableCell className="text-sm">{r.doctorName || "—"}</TableCell>
                      <TableCell className="text-sm">{r.wardName} / {r.bedNo}</TableCell>
                      <TableCell><StatusBadge s={r.status} /></TableCell>
                    </TableRow>
                  ))}
                  {!admissions.isLoading && (admissions.data?.rows || []).length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No admissions in range.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {([
          ["dues-current", "In Patient Due (currently admitted)", duesCurrent],
          ["dues-dp", "DP Dues Report (discharged with outstanding)", duesDP],
        ] as const).map(([key, title, q]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>{title} · Total Outstanding ₹{Number(q.data?.totalDue || 0).toLocaleString()}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>#</TableHead><TableHead>IPD No.</TableHead><TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead><TableHead>Admit / Discharge</TableHead>
                    <TableHead className="text-right">Bill Total</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Due</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(q.data?.rows || []).map((r: any, i: number) => (
                      <TableRow key={r.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ipdNo}</TableCell>
                        <PatientCell r={r} />
                        <TableCell className="text-sm">{r.doctorName || "—"}</TableCell>
                        <TableCell className="text-sm whitespace-nowrap">{r.admissionDate}{r.dischargeDate ? ` → ${r.dischargeDate}` : ""}</TableCell>
                        <TableCell className="text-right">₹{Number(r.billTotal).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-700">₹{Number(r.billPaid).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-rose-700 font-medium">₹{Number(r.billDue).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {!q.isLoading && (q.data?.rows || []).length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No outstanding dues.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {([
          ["discharges-all", "All Discharges", dischargesAll, false],
          ["discharges-bydate", `Discharges (${fromDate} → ${toDate})`, dischargesByDate, true],
        ] as const).map(([key, title, q]) => (
          <TabsContent key={key} value={key} className="mt-4">
            <Card>
              <CardHeader><CardTitle>{title} · Total {q.data?.total ?? 0}</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>#</TableHead><TableHead>IPD No.</TableHead><TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead><TableHead>Admit Date</TableHead>
                    <TableHead>Discharge Date</TableHead><TableHead>LoS (days)</TableHead>
                    <TableHead>Diagnosis</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(q.data?.rows || []).map((r: any, i: number) => {
                      const los = r.dischargeDate ? Math.max(0, Math.ceil((+new Date(r.dischargeDate) - +new Date(r.admissionDate)) / 86400000)) : null;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-mono text-xs">{r.ipdNo}</TableCell>
                          <PatientCell r={r} />
                          <TableCell className="text-sm">{r.doctorName || "—"}</TableCell>
                          <TableCell>{r.admissionDate}</TableCell>
                          <TableCell>{r.dischargeDate}</TableCell>
                          <TableCell>{los ?? "—"}</TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{r.diagnosis || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!q.isLoading && (q.data?.rows || []).length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No discharges.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="packages" className="mt-4">
          <Card>
            <CardHeader><CardTitle>IPD Package Bills ({fromDate} → {toDate}) · {packages.data?.total ?? 0}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Invoice No.</TableHead><TableHead>Date</TableHead>
                  <TableHead>IPD No.</TableHead><TableHead>Patient</TableHead>
                  <TableHead>Package Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(packages.data?.rows || []).map((r: any, i: number) => {
                    const items = Array.isArray(r.items) ? r.items.filter((it: any) => it.packageId || it.type === "package") : [];
                    return (
                      <TableRow key={r.invoiceId}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-mono text-xs">{r.invoiceNo}</TableCell>
                        <TableCell>{r.invoiceDate}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ipdNo || "—"}</TableCell>
                        <TableCell className="font-medium">{r.patientName} <span className="text-xs font-mono text-muted-foreground">({r.uhid})</span></TableCell>
                        <TableCell className="text-sm max-w-xs">{items.length ? items.map((it: any) => it.description || it.name).join(", ") : "—"}</TableCell>
                        <TableCell className="text-right">₹{Number(r.total).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-emerald-700">₹{Number(r.paid).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-rose-700">₹{Number(r.due).toLocaleString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {!packages.isLoading && (packages.data?.rows || []).length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No package bills in range.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
