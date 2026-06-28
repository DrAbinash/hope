import { useState } from "react";
import { useListOpdVisits } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Printer } from "lucide-react";

export default function ReprintPrescriptionPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListOpdVisits({ limit: 500 } as any);
  const visits = data?.visits || [];
  const filtered = search
    ? visits.filter((v: any) =>
        v.patientName?.toLowerCase().includes(search.toLowerCase()) ||
        v.visitNo?.toLowerCase().includes(search.toLowerCase()) ||
        v.doctorName?.toLowerCase().includes(search.toLowerCase()))
    : visits.slice(0, 50);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Re-Print Prescription</h2>
        <p className="text-muted-foreground text-sm">Search any past visit and reprint its prescription.</p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient, visit no or doctor…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              data-testid="reprint-search"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visit No</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Diagnosis</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 6 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No visits found.</TableCell></TableRow>
              ) : (
                filtered.map((v: any) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.visitNo}</TableCell>
                    <TableCell>{v.visitDate}</TableCell>
                    <TableCell className="font-semibold">{v.patientName}</TableCell>
                    <TableCell>{v.doctorName}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">{v.diagnosis || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild data-testid={`reprint-${v.id}`}>
                        <a href={`${import.meta.env.BASE_URL}opd/${v.id}/print`} target="_blank" rel="noreferrer">
                          <Printer className="h-4 w-4 mr-1" />Print
                        </a>
                      </Button>
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
