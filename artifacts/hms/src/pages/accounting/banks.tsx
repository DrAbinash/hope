import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Landmark } from "lucide-react";

interface Bank {
  id: number; bankName: string; accountHolderName: string; accountNo: string;
  ifscCode: string | null; branch: string; upiId: string | null; isActive: number;
}
const empty = { bankName: "", accountHolderName: "", accountNo: "", ifscCode: "", branch: "", upiId: "" };

export default function BankDetailsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [delId, setDelId] = useState<number | null>(null);

  const { data: banks = [], isLoading } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
    queryFn: async () => {
      const r = await fetch("/api/banks", { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editingId ? `/api/banks/${editingId}` : `/api/banks`;
      const r = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      toast.success(editingId ? "Bank updated" : "Bank added");
      qc.invalidateQueries({ queryKey: ["/api/banks"] });
      setOpen(false); setEditingId(null); setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/banks/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    },
    onSuccess: () => {
      toast.success("Bank deleted");
      qc.invalidateQueries({ queryKey: ["/api/banks"] });
      setDelId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() { setEditingId(null); setForm(empty); setOpen(true); }
  function openEdit(b: Bank) {
    setEditingId(b.id);
    setForm({
      bankName: b.bankName, accountHolderName: b.accountHolderName, accountNo: b.accountNo,
      ifscCode: b.ifscCode || "", branch: b.branch, upiId: b.upiId || "",
    });
    setOpen(true);
  }
  function submit() {
    if (!form.bankName || !form.accountHolderName || !form.accountNo || !form.branch) {
      toast.error("Bank name, account holder, account no., and branch are required");
      return;
    }
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Landmark className="h-6 w-6" /> Bank Details</h2>
          <p className="text-muted-foreground text-sm">Master → Accounts → Add Bank Details (per entity)</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Bank Details</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>View Added Bank Details</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Bank Name</TableHead>
                <TableHead>Account Holder</TableHead>
                <TableHead>Account No.</TableHead>
                <TableHead>IFSC</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>UPI ID</TableHead>
                <TableHead className="w-32 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : banks.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No banks yet. Click "Add Bank Details" to start.</TableCell></TableRow>
              ) : banks.map((b, i) => (
                <TableRow key={b.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{b.bankName}{b.isActive === 0 && <Badge variant="outline" className="ml-2">Inactive</Badge>}</TableCell>
                  <TableCell>{b.accountHolderName}</TableCell>
                  <TableCell className="font-mono text-sm">{b.accountNo}</TableCell>
                  <TableCell className="font-mono text-sm">{b.ifscCode || "—"}</TableCell>
                  <TableCell>{b.branch}</TableCell>
                  <TableCell className="font-mono text-sm">{b.upiId || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDelId(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Edit Bank Details" : "Add Bank Details"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Bank Name *</Label><Input value={form.bankName} onChange={e => setForm({ ...form, bankName: e.target.value })} /></div>
            <div><Label>Account Holder Name *</Label><Input value={form.accountHolderName} onChange={e => setForm({ ...form, accountHolderName: e.target.value })} /></div>
            <div><Label>Account No. *</Label><Input value={form.accountNo} onChange={e => setForm({ ...form, accountNo: e.target.value })} /></div>
            <div><Label>IFSC Code</Label><Input value={form.ifscCode} onChange={e => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" /></div>
            <div><Label>Branch *</Label><Input value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} /></div>
            <div><Label>UPI ID</Label><Input value={form.upiId} onChange={e => setForm({ ...form, upiId: e.target.value })} placeholder="e.g. hospital@hdfc" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={delId !== null} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this bank?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the bank details. This action cannot be undone.</AlertDialogDescription>
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
