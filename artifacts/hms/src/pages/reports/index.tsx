import { useState } from "react";
import { useGetOpdToIpdReport, useGetDoctorWiseReport, useGetFinancialReport, useGetDiagnosisWiseReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { PieChart } from "lucide-react";

const today = new Date().toISOString().slice(0, 10);
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(monthStart);
  const [toDate, setToDate] = useState(today);

  const { data: opdToIpd, isLoading: opdIpdLoading } = useGetOpdToIpdReport({ fromDate, toDate });
  const { data: doctorWise, isLoading: doctorLoading } = useGetDoctorWiseReport({ fromDate, toDate });
  const { data: financial, isLoading: finLoading } = useGetFinancialReport({ fromDate, toDate });
  const { data: diagnosisWise, isLoading: diagLoading } = useGetDiagnosisWiseReport({ fromDate, toDate });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports & Analytics</h2>
          <p className="text-muted-foreground text-sm">Clinical and financial insights</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="space-y-1">
            <Label className="text-xs">From Date</Label>
            <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 h-8" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To Date</Label>
            <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 h-8" />
          </div>
        </div>
      </div>

      <Tabs defaultValue="financial">
        <TabsList>
          <TabsTrigger value="financial">Financial</TabsTrigger>
          <TabsTrigger value="doctor">Doctor-wise</TabsTrigger>
          <TabsTrigger value="opdipd">OPD→IPD Conversions</TabsTrigger>
          <TabsTrigger value="diagnosis">Diagnosis-wise</TabsTrigger>
        </TabsList>

        <TabsContent value="financial" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { title: "Total Revenue", value: financial?.totalRevenue, color: "text-blue-600" },
              { title: "Total Collection", value: financial?.totalCollection, color: "text-green-600" },
              { title: "Outstanding", value: financial?.totalOutstanding, color: "text-red-600" },
              { title: "Hospital Revenue", value: financial?.hospitalRevenue, color: "text-foreground" },
              { title: "Pharmacy Revenue", value: financial?.pharmacyRevenue, color: "text-foreground" },
            ].map(({ title, value, color }) => (
              <Card key={title}>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">{title}</CardTitle></CardHeader>
                <CardContent><p className={`text-2xl font-bold ${color}`}>{finLoading ? "—" : `₹${Number(value || 0).toLocaleString()}`}</p></CardContent>
              </Card>
            ))}
          </div>
          {(financial?.breakdowns || []).length > 0 && (
            <Card>
              <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={financial?.breakdowns || []}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Revenue" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="collection" fill="hsl(var(--primary) / 0.5)" name="Collection" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="doctor" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Doctor Name</TableHead>
                    <TableHead>Specialization</TableHead>
                    <TableHead className="text-right">OPD Count</TableHead>
                    <TableHead className="text-right">IPD Count</TableHead>
                    <TableHead className="text-right">Conversions</TableHead>
                    <TableHead className="text-right">Revenue (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {doctorLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : (doctorWise || []).map((d: any) => (
                    <TableRow key={d.doctorId}>
                      <TableCell className="font-semibold">{d.doctorName}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{d.specialization}</TableCell>
                      <TableCell className="text-right">{d.opdCount}</TableCell>
                      <TableCell className="text-right">{d.ipdCount}</TableCell>
                      <TableCell className="text-right font-medium">{d.conversionCount}</TableCell>
                      <TableCell className="text-right font-medium">₹{Number(d.revenue).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="opdipd" className="mt-4">
          <Card>
            <CardHeader><CardTitle>OPD to IPD Conversions</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>UHID</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>OPD Date</TableHead>
                    <TableHead>Admission Date</TableHead>
                    <TableHead>Diagnosis</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opdIpdLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : (opdToIpd || []).length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No conversions in selected period.</TableCell></TableRow>
                  ) : (
                    (opdToIpd || []).map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-semibold">{r.patientName}</TableCell>
                        <TableCell className="font-mono text-xs">{r.uhid}</TableCell>
                        <TableCell>{r.doctorName}</TableCell>
                        <TableCell>{r.opdDate}</TableCell>
                        <TableCell>{r.admissionDate}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.diagnosis || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnosis" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Diagnosis</TableHead>
                      <TableHead className="text-right">OPD</TableHead>
                      <TableHead className="text-right">IPD</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>{Array.from({ length: 4 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                      ))
                    ) : (diagnosisWise || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center h-24 text-muted-foreground">No data for selected period.</TableCell></TableRow>
                    ) : (
                      (diagnosisWise || []).map((d: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.diagnosis}</TableCell>
                          <TableCell className="text-right">{d.opdCount}</TableCell>
                          <TableCell className="text-right">{d.ipdCount}</TableCell>
                          <TableCell className="text-right font-bold">{d.totalCount}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
            {(diagnosisWise || []).length > 0 && (
              <Card>
                <CardHeader><CardTitle>Diagnosis Distribution</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={(diagnosisWise || []).slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="diagnosis" type="category" tick={{ fontSize: 11 }} width={120} />
                      <Tooltip />
                      <Bar dataKey="totalCount" fill="hsl(var(--primary))" name="Cases" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
