import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3, BedDouble, ClipboardList, Printer } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function HospitalStatsPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);
  const [caseType, setCaseType] = useState<"all" | "opd" | "ipd">("all");

  const { data: occ } = useQuery<any>({
    queryKey: ["/api/stats/bed-occupancy", fromDate, toDate],
    queryFn: async () => {
      const r = await fetch(`/api/stats/bed-occupancy?fromDate=${fromDate}&toDate=${toDate}`, { credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
  });
  const { data: register } = useQuery<any>({
    queryKey: ["/api/stats/daily-case-register", fromDate, toDate, caseType],
    queryFn: async () => {
      const r = await fetch(`/api/stats/daily-case-register?fromDate=${fromDate}&toDate=${toDate}&type=${caseType}`, { credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center print:hidden flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Hospital Statistics</h2>
          <p className="text-muted-foreground text-sm">Bed occupancy and daily case register</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Label>From</Label>
          <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
          <Label>To</Label>
          <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-2" />Print</Button>
        </div>
      </div>

      <Tabs defaultValue="average">
        <TabsList>
          <TabsTrigger value="average">Average Occupancy</TabsTrigger>
          <TabsTrigger value="daily">Daily Bed Occupancy</TabsTrigger>
          <TabsTrigger value="register">Daily Case Register</TabsTrigger>
        </TabsList>

        <TabsContent value="average" className="mt-4">
          <div className="grid gap-4 md:grid-cols-4 mb-4">
            {[
              { title: "Total Beds", value: occ?.totalBeds ?? 0, suffix: "" },
              { title: "Avg Occupancy", value: occ?.averageOccupancyPct ?? 0, suffix: "%", color: "text-emerald-600" },
              { title: "Bed Days (period)", value: occ?.totalBedDays ?? 0, suffix: "" },
              { title: "Occupied Bed Days", value: occ?.occupiedBedDays ?? 0, suffix: "" },
            ].map(c => (
              <Card key={c.title}>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{c.title}</CardTitle></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${c.color || ""}`}>{Number(c.value).toLocaleString()}{c.suffix}</div></CardContent>
              </Card>
            ))}
          </div>
          {occ?.peakDay && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><BedDouble className="h-5 w-5" /> Peak Day</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <span className="font-medium">{occ.peakDay.date}</span> — <span>{occ.peakDay.occupied} beds occupied</span> · <span className="font-medium">{occ.peakDay.occupancyPct}%</span>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="daily" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Daily Bed Occupancy ({fromDate} to {toDate})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total Beds</TableHead>
                  <TableHead className="text-right">Occupied</TableHead>
                  <TableHead className="text-right">Vacant</TableHead>
                  <TableHead className="text-right">Occupancy %</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(occ?.daily || []).length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No data.</TableCell></TableRow>
                  ) : (occ?.daily || []).map((r: any) => (
                    <TableRow key={r.date}>
                      <TableCell className="whitespace-nowrap">{r.date}</TableCell>
                      <TableCell className="text-right">{r.totalBeds}</TableCell>
                      <TableCell className="text-right text-emerald-700">{r.occupied}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.vacant}</TableCell>
                      <TableCell className="text-right font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 rounded bg-muted overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, r.occupancyPct)}%` }} />
                          </div>
                          <span className="w-14 text-right">{r.occupancyPct}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Daily Case Register ({fromDate} to {toDate})</CardTitle>
                <Select value={caseType} onValueChange={(v) => setCaseType(v as any)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="opd">OPD only</SelectItem>
                    <SelectItem value="ipd">IPD only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-3 gap-3 p-3 border-b text-sm">
                <div><div className="text-muted-foreground text-xs">Total Cases</div><div className="text-xl font-bold">{register?.total ?? 0}</div></div>
                <div><div className="text-muted-foreground text-xs">OPD</div><div className="text-xl font-bold text-blue-600">{register?.opdTotal ?? 0}</div></div>
                <div><div className="text-muted-foreground text-xs">IPD</div><div className="text-xl font-bold text-rose-600">{register?.ipdTotal ?? 0}</div></div>
              </div>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Case No.</TableHead>
                  <TableHead>UHID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Age/Sex</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Complaint / Diagnosis</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {(register?.cases || []).length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-6 text-muted-foreground">No cases in selected period.</TableCell></TableRow>
                  ) : (register?.cases || []).map((c: any, i: number) => (
                    <TableRow key={`${c.caseType}-${c.id}`}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="whitespace-nowrap">{c.date}</TableCell>
                      <TableCell><Badge variant={c.caseType === "OPD" ? "default" : "destructive"}>{c.caseType}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{c.visitNo}</TableCell>
                      <TableCell className="font-mono text-xs">{c.uhid}</TableCell>
                      <TableCell className="font-medium">{c.patientName}</TableCell>
                      <TableCell className="text-sm">{c.age}/{(c.gender || "").slice(0, 1)}</TableCell>
                      <TableCell className="text-sm">{c.doctorName || "—"}</TableCell>
                      <TableCell className="text-sm max-w-xs truncate">{c.chiefComplaint || "—"}</TableCell>
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
