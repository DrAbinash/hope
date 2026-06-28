import { useState } from "react";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import {
  Scissors, BedDouble, FlaskConical, FileText, Plus, Eye, Search, Calculator,
} from "lucide-react";

const TYPES = [
  { key: "surgery", label: "Surgery Estimation", icon: Scissors, color: "bg-rose-50 text-rose-700" },
  { key: "ipd", label: "IPD Estimation", icon: BedDouble, color: "bg-indigo-50 text-indigo-700" },
  { key: "investigation", label: "Investigation Estimation", icon: FlaskConical, color: "bg-amber-50 text-amber-700" },
  { key: "general", label: "General Estimation", icon: FileText, color: "bg-emerald-50 text-emerald-700" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  expired: "bg-amber-100 text-amber-800",
  cancelled: "bg-rose-100 text-rose-800",
};

export default function EstimationsHub() {
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["/api/estimations", typeFilter],
    queryFn: async () => {
      const url = typeFilter ? `/api/estimations?type=${typeFilter}` : `/api/estimations`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ estimations: any[] }>;
    },
  });

  const rows = (data?.estimations || []).filter((e) =>
    !search ||
    e.patientName?.toLowerCase().includes(search.toLowerCase()) ||
    e.estimationNo?.toLowerCase().includes(search.toLowerCase()) ||
    e.uhid?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Estimations</h2>
        <p className="text-muted-foreground text-sm">Cost estimates for surgery, IPD admission, investigations or general services</p>
      </div>

      {/* Estimation type tiles (matches photo) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {TYPES.map((t) => (
          <Card key={t.key} className="hover:shadow-md transition">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${t.color}`}><t.icon className="h-6 w-6" /></div>
              </div>
              <div className="font-semibold text-lg mb-1">{t.label}</div>
              <p className="text-xs text-muted-foreground mb-4">Build a printable cost estimate</p>
              <div className="flex gap-2">
                <Button asChild size="sm" data-testid={`new-${t.key}`}>
                  <Link href={`/estimations/new?type=${t.key}`}><Plus className="h-3.5 w-3.5 mr-1" />New</Link>
                </Button>
                <Button asChild size="sm" variant="outline" data-testid={`view-${t.key}`}
                  onClick={() => setTypeFilter(t.key)}>
                  <Link href={`/estimations?type=${t.key}`} onClick={() => setTypeFilter(t.key)}><Eye className="h-3.5 w-3.5 mr-1" />View</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter + List */}
      <Card>
        <div className="px-4 py-3 border-b flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Saved Estimations</span>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border px-2 text-sm"
              data-testid="filter-type"
            >
              <option value="">All types</option>
              {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search patient, UHID or estimation no…"
                className="pl-8 w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estimation No</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Surgeon / Procedure</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No estimations yet.</TableCell></TableRow>
              ) : (
                rows.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.estimationNo}</TableCell>
                    <TableCell className="capitalize">{e.type}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{e.patientName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{e.uhid}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.procedureName || e.surgeonName || "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">₹{Number(e.totalAmount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{e.validUntil}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[e.status] || "bg-gray-100"}`}>
                        {e.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/estimations/${e.id}`}><Eye className="h-4 w-4 mr-1" />Open</Link>
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
