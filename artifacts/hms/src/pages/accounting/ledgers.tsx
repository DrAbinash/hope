import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, BookOpen } from "lucide-react";

interface Group { id: number; name: string; nature: string }
interface Ledger { id: number; name: string; groupId: number; groupName: string; openingBalance: string; currentBalance: string }
const empty = { name: "", groupId: "", openingBalance: "0", openingType: "Dr" as "Dr" | "Cr" };

export default function LedgerDetailsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [delId, setDelId] = useState<number | null>(null);

  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/accounting/ledger-groups"],
    queryFn: async () => {
      const r = await fetch("/api/accounting/ledger-groups", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
  const { data: ledgers = [], isLoading } = useQuery<Ledger[]>({
    queryKey: ["/api/accounting/ledgers"],
    queryFn: async () => {
      const r = await fetch("/api/accounting/ledgers", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/api/accounting/ledgers/${editingId}` : `/api/accounting/ledgers`;
      const r = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: form.name,
          groupId: parseInt(form.groupId),
          openingBalance: parseFloat(form.openingBalance) || 0,
          openingType: form.openingType,
        }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      toast.success(editingId ? "Ledger updated" : "Ledger added");
      qc.invalidateQueries({ queryKey: ["/api/accounting/ledgers"] });
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/accounting/ledgers/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    },
    onSuccess: () => {
      toast.success("Ledger deleted");
      qc.invalidateQueries({ queryKey: ["/api/accounting/ledgers"] });
      setDelId(null);
    },
    onError: (e: Error) => { toast.error(e.message); setDelId(null); },
  });

  function reset() { setEditingId(null); setForm(empty); }
  function startEdit(l: Ledger) {
    const ob = parseFloat(l.openingBalance || "0");
    setEditingId(l.id);
    setForm({
      name: l.name,
      groupId: String(l.groupId),
      openingBalance: Math.abs(ob).toString(),
      openingType: ob < 0 ? "Cr" : "Dr",
    });
  }
  function submit() {
    if (!form.name.trim()) { toast.error("Account Name is required"); return; }
    if (!form.groupId) { toast.error("Group Name is required"); return; }
    save.mutate();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ledgers;
    return ledgers.filter(l => l.name.toLowerCase().includes(q) || l.groupName?.toLowerCase().includes(q));
  }, [ledgers, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-6 w-6" /> Ledger Details</h2>
        <p className="text-muted-foreground text-sm">Master → Accounts → Add Ledger Details</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader><CardTitle>{editingId ? "Edit Ledger" : "Add Ledger Details"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Account Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div>
              <Label>Group Name *</Label>
              <Select value={form.groupId} onValueChange={v => setForm({ ...form, groupId: v })}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {groups.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.name} <span className="text-muted-foreground text-xs ml-1">({g.nature})</span></SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <div>
                <Label>Opening Balance</Label>
                <Input type="number" step="0.01" value={form.openingBalance} onChange={e => setForm({ ...form, openingBalance: e.target.value })} />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={form.openingType} onValueChange={(v: "Dr" | "Cr") => setForm({ ...form, openingType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr">Dr</SelectItem>
                    <SelectItem value="Cr">Cr</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={reset} className="flex-1">{editingId ? "Cancel" : "Clear"}</Button>
              <Button onClick={submit} disabled={save.isPending} className="flex-1">{save.isPending ? "Saving…" : "Save"}</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>View Added Ledger Details</CardTitle>
              <Input placeholder="Find by name or group" value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Group Name</TableHead>
                  <TableHead className="text-right">Opening Balance</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="w-32 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No ledgers match.</TableCell></TableRow>
                ) : filtered.map((l, i) => {
                  const ob = parseFloat(l.openingBalance || "0");
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{l.name}</TableCell>
                      <TableCell><Badge variant="outline">{l.groupName}</Badge></TableCell>
                      <TableCell className="text-right">₹{Math.abs(ob).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell><Badge variant={ob < 0 ? "destructive" : "secondary"}>{ob < 0 ? "Cr" : "Dr"}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(l)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDelId(l.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={delId !== null} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this ledger?</AlertDialogTitle>
            <AlertDialogDescription>If this ledger has any vouchers posted to it, the deletion will be blocked.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && remove.mutate(delId)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
