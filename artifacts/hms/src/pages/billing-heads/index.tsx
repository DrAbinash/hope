import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface BillingHead {
  id: number;
  entityId: number | null;
  code: string;
  name: string;
  category: string;
  defaultRate: string;
  gstPercent: string | null;
  hsnSac: string | null;
  ledgerName: string | null;
  isActive: boolean;
}

const CATEGORIES = [
  "Consultation", "Registration", "Room Charges", "Nursing",
  "Pathology", "Radiology", "OT Procedure", "Pharmacy", "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  Consultation: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  "Room Charges": "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  Pathology: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  Radiology: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  "OT Procedure": "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  Nursing: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  Registration: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
};

export default function BillingHeadsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "", name: "", category: "Consultation", defaultRate: "", gstPercent: "0",
    hsnSac: "", ledgerName: "", entityId: "1",
  });

  const { data: heads, isLoading } = useQuery<BillingHead[]>({
    queryKey: ["/api/billing-heads"],
    queryFn: async () => {
      const r = await fetch("/api/billing-heads", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch billing heads");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        entityId: Number(form.entityId),
        defaultRate: Number(form.defaultRate),
        gstPercent: Number(form.gstPercent),
      };
      const r = await fetch("/api/billing-heads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Billing head created");
      qc.invalidateQueries({ queryKey: ["/api/billing-heads"] });
      setOpen(false);
      setForm({ code: "", name: "", category: "Consultation", defaultRate: "", gstPercent: "0", hsnSac: "", ledgerName: "", entityId: "1" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const safeHeads = Array.isArray(heads) ? heads : [];
  const filtered = tab === "all" ? safeHeads : safeHeads.filter((h) => h.category === tab);
  const categoryGroups = safeHeads.reduce((acc, h) => {
    acc[h.category] = (acc[h.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Billing Heads & Charges</h2>
          <p className="text-muted-foreground text-sm">Master rate card for OPD, IPD, lab tests, radiology, OT and procedures.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Billing Head</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Billing Head</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Code *</Label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. LAB-CRP" />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Display Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Default Rate (₹) *</Label>
                <Input type="number" value={form.defaultRate} onChange={(e) => setForm({ ...form, defaultRate: e.target.value })} />
              </div>
              <div>
                <Label>GST %</Label>
                <Input type="number" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} />
              </div>
              <div>
                <Label>HSN/SAC</Label>
                <Input value={form.hsnSac} onChange={(e) => setForm({ ...form, hsnSac: e.target.value })} />
              </div>
              <div>
                <Label>Linked Ledger</Label>
                <Input value={form.ledgerName} onChange={(e) => setForm({ ...form, ledgerName: e.target.value })} placeholder="e.g. Laboratory Income" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.code || !form.name || !form.defaultRate || create.isPending}>
                {create.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">All ({(heads || []).length})</TabsTrigger>
          {CATEGORIES.filter((c) => categoryGroups[c]).map((c) => (
            <TabsTrigger key={c} value={c}>{c} ({categoryGroups[c]})</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>HSN/SAC</TableHead>
                      <TableHead>Linked Ledger</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">GST%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="font-mono text-xs">{h.code}</TableCell>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={CATEGORY_COLORS[h.category] || ""}>{h.category}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{h.hsnSac || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{h.ledgerName || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Number(h.defaultRate).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right text-sm">{h.gstPercent ? `${h.gstPercent}%` : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {filtered.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No billing heads in this category</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
