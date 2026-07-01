import { Link } from "wouter";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Search, Handshake } from "lucide-react";

export default function ConsultantsList() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["/api/consultants"],
    queryFn: async () => {
      const r = await fetch("/api/consultants", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json() as Promise<{ consultants: any[] }>;
    },
  });
  const rows = (Array.isArray(data?.consultants) ? data.consultants : []).filter((d) =>
    !search || d.name?.toLowerCase().includes(search.toLowerCase()) || d.phone?.includes(search) || d.specialization?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2"><Handshake className="w-6 h-6"/> Consultants</h1>
          <p className="text-muted-foreground text-sm">External consultants engaged on cases.</p>
        </div>
        <Link href="/consultants/new"><Button><Plus className="w-4 h-4 mr-1"/>Add Consultant</Button></Link>
      </div>

      <Card><CardContent className="p-4">
        <div className="relative max-w-sm mb-3">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground"/>
          <Input className="pl-8" placeholder="Search by name, phone, specialization…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Specialization</TableHead><TableHead>Phone</TableHead>
            <TableHead>Payment</TableHead><TableHead>Active</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
              : rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No consultants yet.</TableCell></TableRow>
              : rows.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}{d.qualification ? <span className="text-muted-foreground text-xs ml-1">({d.qualification})</span> : null}</TableCell>
                  <TableCell>{d.specialization || "—"}</TableCell>
                  <TableCell>{d.phone || "—"}</TableCell>
                  <TableCell>{d.paymentType === "percentage" ? `${Number(d.paymentValue).toFixed(2)}%` : `₹${Number(d.paymentValue).toLocaleString("en-IN")} fixed`}</TableCell>
                  <TableCell>{d.isActive ? <span className="text-emerald-700 text-xs">Active</span> : <span className="text-muted-foreground text-xs">Inactive</span>}</TableCell>
                  <TableCell className="text-right"><Link href={`/consultants/${d.id}/edit`}><Button size="sm" variant="ghost"><Pencil className="w-4 h-4"/></Button></Link></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
