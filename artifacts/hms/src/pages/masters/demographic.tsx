import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, UsersRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

type Category = "initial" | "religion" | "blood_group" | "marital_status" | "country" | "state" | "city" | "village";

interface Lookup {
  id: number;
  category: Category;
  name: string;
  parentId: number | null;
  isActive: boolean;
  sortOrder: number;
}

const TABS: { key: Category; label: string; parent: Category | null }[] = [
  { key: "initial", label: "Initial Master", parent: null },
  { key: "religion", label: "Religion Master", parent: null },
  { key: "blood_group", label: "Blood Group Master", parent: null },
  { key: "marital_status", label: "Marital Status", parent: null },
  { key: "country", label: "Country Master", parent: null },
  { key: "state", label: "State Master", parent: "country" },
  { key: "city", label: "City Master", parent: "state" },
  { key: "village", label: "Village Master", parent: "city" },
];

function useLookups(category: Category, parentId?: number) {
  return useQuery<Lookup[]>({
    queryKey: ["/api/lookups", category, parentId ?? null],
    queryFn: async () => {
      const u = new URL("/api/lookups", window.location.origin);
      u.searchParams.set("category", category);
      if (parentId !== undefined) u.searchParams.set("parentId", String(parentId));
      const r = await fetch(u.pathname + u.search, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
  });
}

function CategoryPanel({ category, parent, canWrite }: { category: Category; parent: Category | null; canWrite: boolean }) {
  const qc = useQueryClient();
  const [parentId, setParentId] = useState<string>("");
  const { data: parents = [] } = useLookups((parent ?? "country") as Category);
  const { data: rows = [], isLoading } = useLookups(category, parent && parentId ? parseInt(parentId) : undefined);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lookup | null>(null);
  const [name, setName] = useState("");
  const [editParentId, setEditParentId] = useState<string>("");
  const [delId, setDelId] = useState<number | null>(null);

  const parentNameById = useMemo(() => new Map(parents.map(p => [p.id, p.name])), [parents]);

  const save = useMutation({
    mutationFn: async () => {
      const body: any = { category, name: name.trim() };
      if (parent) body.parentId = editParentId ? parseInt(editParentId) : null;
      const url = editing ? `/api/lookups/${editing.id}` : "/api/lookups";
      const method = editing ? "PUT" : "POST";
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
      return r.json();
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Added");
      qc.invalidateQueries({ queryKey: ["/api/lookups", category] });
      setOpen(false); setEditing(null); setName(""); setEditParentId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const r = await fetch(`/api/lookups/${id}`, { method: "DELETE", credentials: "include" });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || `HTTP ${r.status}`); }
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["/api/lookups", category] });
      setDelId(null);
    },
    onError: (e: Error) => { toast.error(e.message); setDelId(null); },
  });

  const toggleActive = useMutation({
    mutationFn: async (row: Lookup) => {
      const r = await fetch(`/api/lookups/${row.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/lookups", category] }),
  });

  function openAdd() {
    setEditing(null); setName(""); setEditParentId(parent ? parentId : ""); setOpen(true);
  }
  function openEdit(r: Lookup) {
    setEditing(r); setName(r.name); setEditParentId(r.parentId ? String(r.parentId) : ""); setOpen(true);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle>{TABS.find(t => t.key === category)?.label}</CardTitle>
          <div className="flex items-center gap-2">
            {parent && (
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="w-56"><SelectValue placeholder={`Filter by ${parent}…`} /></SelectTrigger>
                <SelectContent>
                  {parents.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            {canWrite && (
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} {TABS.find(t => t.key === category)?.label.replace(" Master", "")}</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    {parent && (
                      <div>
                        <Label>{parent.replace("_", " ")} *</Label>
                        <Select value={editParentId} onValueChange={setEditParentId}>
                          <SelectTrigger><SelectValue placeholder={`Select a ${parent}…`} /></SelectTrigger>
                          <SelectContent>
                            {parents.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={() => save.mutate()} disabled={!name.trim() || save.isPending || (!!parent && !editParentId)}>
                      {save.isPending ? "Saving…" : "Save"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Name</TableHead>
              {parent && <TableHead className="capitalize">{parent.replace("_", " ")}</TableHead>}
              <TableHead>Status</TableHead>
              {canWrite && <TableHead className="text-right w-32">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
            ) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">
                {parent && !parentId ? `Select a ${parent} to view entries, or add one.` : "No entries yet."}
              </TableCell></TableRow>
            ) : rows.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell className="font-medium">{r.name}</TableCell>
                {parent && <TableCell className="text-muted-foreground text-sm">{parentNameById.get(r.parentId ?? -1) || "—"}</TableCell>}
                <TableCell>
                  <Badge variant={r.isActive ? "default" : "outline"} className={canWrite ? "cursor-pointer" : ""}
                    onClick={() => canWrite && toggleActive.mutate(r)}>
                    {r.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => setDelId(r.id)}><Trash2 className="h-4 w-4" /></Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog open={delId !== null} onOpenChange={(v) => !v && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove the entry. Entries in use as a parent (e.g. a Country with States) cannot be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && remove.mutate(delId)} className="bg-rose-600 hover:bg-rose-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function PatientDemographicPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "admin";
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><UsersRound className="h-6 w-6" /> Patient Demographic Masters</h2>
        <p className="text-muted-foreground text-sm">Initial · Religion · Blood Group · Marital Status · Country → State → City → Village. {canWrite ? "Admin can add / edit / delete." : "Read-only for your role."}</p>
      </div>
      <Tabs defaultValue="initial">
        <TabsList className="flex flex-wrap h-auto">
          {TABS.map(t => <TabsTrigger key={t.key} value={t.key}>{t.label.replace(" Master", "")}</TabsTrigger>)}
        </TabsList>
        {TABS.map(t => (
          <TabsContent key={t.key} value={t.key} className="mt-4">
            <CategoryPanel category={t.key} parent={t.parent} canWrite={canWrite} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
