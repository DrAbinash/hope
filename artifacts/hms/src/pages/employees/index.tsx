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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Search } from "lucide-react";

interface Employee {
  id: number;
  empCode: string;
  entityId: number | null;
  name: string;
  role: string;
  landingPath: string | null;
  department: string | null;
  designation: string | null;
  phone: string | null;
  email: string | null;
  joiningDate: string | null;
  monthlySalary: string | null;
  username: string | null;
  isActive: boolean;
}

interface Entity {
  id: number;
  name: string;
  type: string;
}

const LANDING_PAGES = [
  {
    group: "Core",
    items: [
      { value: "/", label: "Dashboard" },
      { value: "/patients", label: "Patients" },
      { value: "/billing", label: "Billing" },
      { value: "/pharmacy", label: "Pharmacy" },
      { value: "/doctor", label: "Doctor Dashboard" },
      { value: "/ipd", label: "IPD" },
      { value: "/opd", label: "OPD" },
      { value: "/diagnostics", label: "Diagnostics" },
    ],
  },
  {
    group: "Reports",
    items: [
      { value: "/reports", label: "Reports Home" },
      { value: "/reports/finance", label: "Finance Reports" },
      { value: "/reports/pharmacy", label: "Pharmacy Reports" },
      { value: "/reports/opd", label: "OPD Reports" },
      { value: "/reports/ipd", label: "IPD Reports" },
      { value: "/collection-report", label: "Collection Report" },
    ],
  },
  {
    group: "Admin",
    items: [
      { value: "/employees", label: "Employees" },
      { value: "/settings", label: "Hospital Settings" },
      { value: "/billing-heads", label: "Billing Heads" },
      { value: "/packages", label: "Packages" },
      { value: "/inventory", label: "Inventory" },
      { value: "/masters/demographic", label: "Masters / Demographic" },
    ],
  },
] as const;

const ROLES = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "receptionist", label: "Receptionist" },
  { value: "cashier", label: "Cashier / Billing" },
  { value: "lab_tech", label: "Lab Technician" },
  { value: "radiology_tech", label: "Radiology Tech" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "house_keeping", label: "Housekeeping" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  doctor: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  nurse: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
  receptionist: "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300",
  cashier: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  lab_tech: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  radiology_tech: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  pharmacist: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  house_keeping: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", role: "receptionist", entityId: "1", department: "", designation: "",
    phone: "", email: "", joiningDate: "", monthlySalary: "", username: "", landingPath: "",
  });

  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: () => fetch("/api/employees").then((r) => r.json()),
  });
  const { data: entities } = useQuery<Entity[]>({
    queryKey: ["/api/entities"],
    queryFn: () => fetch("/api/entities").then((r) => r.json()),
  });

  const create = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        entityId: form.entityId ? Number(form.entityId) : null,
        monthlySalary: form.monthlySalary ? Number(form.monthlySalary) : null,
      };
      const r = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success("Employee created");
      qc.invalidateQueries({ queryKey: ["/api/employees"] });
      setOpen(false);
      setForm({ name: "", role: "receptionist", entityId: "1", department: "", designation: "", phone: "", email: "", joiningDate: "", monthlySalary: "", username: "", landingPath: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (employees || []).filter((e) => {
    const q = search.toLowerCase();
    return !q || e.name.toLowerCase().includes(q) || e.empCode.toLowerCase().includes(q) || e.role.toLowerCase().includes(q) || (e.department || "").toLowerCase().includes(q);
  });

  const entityName = (id: number | null) => entities?.find((e) => e.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Employees & Roles</h2>
          <p className="text-muted-foreground text-sm">Staff master with role-based access for both entities.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4 mr-2" />Add Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>New Employee</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Entity</Label>
                <Select value={form.entityId} onValueChange={(v) => setForm({ ...form, entityId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(entities || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Department</Label>
                <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
              </div>
              <div>
                <Label>Designation</Label>
                <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Joining Date</Label>
                <Input type="date" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
              </div>
              <div>
                <Label>Monthly Salary (₹)</Label>
                <Input type="number" value={form.monthlySalary} onChange={(e) => setForm({ ...form, monthlySalary: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Login Username</Label>
                <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Landing Page Override</Label>
                <Select value={form.landingPath || "__default__"} onValueChange={(v) => setForm({ ...form, landingPath: v === "__default__" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Use role default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">Use role default</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-4">
                {LANDING_PAGES.map((group) => (
                  <div key={group.group} className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">{group.group}</div>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setForm({ ...form, landingPath: item.value })}
                          className={`rounded-md border px-3 py-2 text-sm transition ${
                            form.landingPath === item.value
                              ? "border-primary bg-primary text-primary-foreground"
                              : "hover:bg-muted/60"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  This override is optional. If not set, the employee lands on the default page for their role.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!form.name || create.isPending}>
                {create.isPending ? "Saving..." : "Save Employee"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, code, role or department..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          {isLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell className="font-mono text-xs">{emp.empCode}</TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>
                      <Badge className={ROLE_COLORS[emp.role] || "bg-muted"} variant="secondary">
                        {ROLES.find((r) => r.value === emp.role)?.label || emp.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{emp.department || "—"}</TableCell>
                    <TableCell className="text-sm">{entityName(emp.entityId)}</TableCell>
                    <TableCell className="text-sm">{emp.phone || "—"}</TableCell>
                    <TableCell className="text-right">{emp.monthlySalary ? `₹${Number(emp.monthlySalary).toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell>
                      {emp.isActive ? <Badge variant="secondary" className="text-green-700 bg-green-100 dark:bg-green-950/40 dark:text-green-300">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No employees found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
