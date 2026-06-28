import { Link } from "wouter";
import { useListOpdVisits } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

export default function OpdToIpdPage() {
  const { data, isLoading } = useListOpdVisits({ limit: 500 } as any);
  const converted = (data?.visits || []).filter((v: any) => v.convertedToIpd);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">OPD to IPD List</h2>
        <p className="text-muted-foreground text-sm">OPD visits that were converted to IPD admission</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>OPD No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>IPD Admission</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : converted.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No OPD-to-IPD conversions yet.</TableCell></TableRow>
              ) : (
                converted.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.visitNo}</TableCell>
                    <TableCell>{v.visitDate}</TableCell>
                    <TableCell className="font-semibold">{v.patientName}</TableCell>
                    <TableCell>{v.doctorName}</TableCell>
                    <TableCell>{v.ipdAdmissionId ? `IPD #${v.ipdAdmissionId}` : "—"}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="sm" asChild><Link href={`/opd/${v.id}`}>OPD</Link></Button>
                      {v.ipdAdmissionId && (
                        <Button variant="ghost" size="sm" asChild><Link href={`/ipd/${v.ipdAdmissionId}`}>IPD</Link></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
