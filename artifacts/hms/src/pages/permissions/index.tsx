import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, UserCog, RotateCcw, Search } from "lucide-react";
import {
  MODULE_CATALOG, MODULE_LABELS, ROLES, ALL_MODULE_KEYS,
} from "@/lib/permissions-catalog";
import { useAuth } from "@/lib/auth";

interface Employee {
  id: number;
  empCode: string;
  name: string;
  role: string;
  department: string | null;
  isActive: boolean;
}

interface UserPermissionResponse {
  role: string;
  roleDefaults: Record<string, boolean>;
  overrides: Record<string, boolean>;
}

function ModuleGrid({
  value, onChange, baseValue, allowInherit,
}: {
  value: Record<string, boolean | null>;
  onChange: (key: string, v: boolean | null) => void;
  baseValue?: Record<string, boolean>;
  allowInherit?: boolean;
}) {
  const [filter, setFilter] = useState("");
  const q = filter.toLowerCase();
  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Filter modules..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="pl-10 max-w-sm"
        />
      </div>
      <div className="space-y-5">
        {MODULE_CATALOG.map((group) => {
          const items = group.items.filter(
            (it) => !q || it.label.toLowerCase().includes(q) || it.key.toLowerCase().includes(q),
          );
          if (items.length === 0) return null;
          return (
            <div key={group.group} className="border rounded-lg">
              <div className="px-4 py-2 border-b bg-muted/40 flex items-center justify-between">
                <h4 className="text-sm font-semibold">{group.group}</h4>
                <span className="text-xs text-muted-foreground">{items.length} modules</span>
              </div>
              <div className="divide-y">
                {items.map((item) => {
                  const v = value[item.key];
                  const hasOverride = v !== null && v !== undefined;
                  const effective = hasOverride ? (v as boolean) : (baseValue?.[item.key] ?? false);
                  return (
                    <div key={item.key} className="px-4 py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{item.label}</div>
                        <code className="text-xs text-muted-foreground">{item.key}</code>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {allowInherit && hasOverride && (
                          <Badge variant="secondary" className="text-[10px]">
                            Override
                          </Badge>
                        )}
                        {allowInherit && !hasOverride && baseValue && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            Inherits {baseValue[item.key] ? "Allow" : "Deny"}
                          </Badge>
                        )}
                        <Switch
                          checked={effective}
                          onCheckedChange={(checked) => onChange(item.key, checked)}
                        />
                        {allowInherit && hasOverride && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Reset to role default"
                            onClick={() => onChange(item.key, null)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RolePermissionsPanel() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("doctor");
  const [draft, setDraft] = useState<Record<string, boolean | null>>({});

  const { data, isLoading } = useQuery<Record<string, boolean>>({
    queryKey: ["/api/permissions/role", role],
    queryFn: async () => {
      const r = await fetch(`/api/permissions/role/${role}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch role permissions");
      return r.json();
    },
  });

  useEffect(() => {
    if (data) {
      const init: Record<string, boolean | null> = {};
      for (const k of ALL_MODULE_KEYS) init[k] = data[k] ?? false;
      setDraft(init);
    }
  }, [data, role]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, boolean> = {};
      for (const k of ALL_MODULE_KEYS) body[k] = !!draft[k];
      const r = await fetch(`/api/permissions/role/${role}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: () => {
      toast.success(`Permissions for ${role} updated`);
      qc.invalidateQueries({ queryKey: ["/api/permissions/role", role] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allowedCount = Object.values(draft).filter((v) => v === true).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" /> Role Permissions
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Choose which modules are accessible by default for each role.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.filter((r) => r.value !== "admin").map((r) => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary">{allowedCount} allowed</Badge>
            <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
              {save.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
        ) : (
          <ModuleGrid
            value={draft}
            onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
          />
        )}
      </CardContent>
    </Card>
  );
}

function UserOverridesPanel() {
  const qc = useQueryClient();
  const { refreshPermissions, user: me } = useAuth();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [draft, setDraft] = useState<Record<string, boolean | null>>({});
  const [empSearch, setEmpSearch] = useState("");

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const r = await fetch("/api/employees", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to fetch employees");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const filteredEmps = useMemo(() => {
    const list = (Array.isArray(employees) ? employees : []).filter((e) => e.isActive);
    const q = empSearch.toLowerCase();
    if (!q) return list;
    return list.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      e.empCode.toLowerCase().includes(q) ||
      e.role.toLowerCase().includes(q),
    );
  }, [employees, empSearch]);

  const { data, isLoading } = useQuery<UserPermissionResponse>({
    queryKey: ["/api/permissions/user", employeeId],
    queryFn: () => fetch(`/api/permissions/user/${employeeId}`).then((r) => r.json()),
    enabled: !!employeeId,
  });

  useEffect(() => {
    if (data) {
      const init: Record<string, boolean | null> = {};
      for (const k of ALL_MODULE_KEYS) {
        init[k] = k in data.overrides ? data.overrides[k] : null;
      }
      setDraft(init);
    }
  }, [data, employeeId]);

  const save = useMutation({
    mutationFn: async () => {
      const body: Record<string, boolean | null> = {};
      for (const k of ALL_MODULE_KEYS) body[k] = draft[k] ?? null;
      const r = await fetch(`/api/permissions/user/${employeeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Save failed");
      return r.json();
    },
    onSuccess: async () => {
      toast.success("User overrides saved");
      qc.invalidateQueries({ queryKey: ["/api/permissions/user", employeeId] });
      // If editing self, refresh sidebar permissions
      if (me && String(me.id) === employeeId) {
        await refreshPermissions();
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const overrideCount = Object.values(draft).filter((v) => v !== null && v !== undefined).length;
  const selectedEmp = employees?.find((e) => String(e.id) === employeeId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCog className="w-4 h-4" /> Per-User Overrides
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Grant or revoke specific modules for individual employees. Empty = inherit from role.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          <div className="space-y-2 border rounded-lg p-2 max-h-[600px] overflow-y-auto">
            <div className="relative px-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search employee..."
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            {filteredEmps.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => setEmployeeId(String(emp.id))}
                className={`w-full text-left p-2 rounded transition ${
                  String(emp.id) === employeeId ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/60"
                }`}
              >
                <div className="text-sm font-medium truncate">{emp.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-mono text-xs text-muted-foreground">{emp.empCode}</span>
                  <Badge variant="secondary" className="text-[10px]">{emp.role}</Badge>
                </div>
              </button>
            ))}
            {filteredEmps.length === 0 && (
              <div className="text-center text-xs text-muted-foreground py-6">No employees</div>
            )}
          </div>

          <div className="space-y-3">
            {!employeeId ? (
              <div className="text-center text-muted-foreground py-12 border rounded-lg border-dashed">
                Select an employee to manage their permissions
              </div>
            ) : isLoading ? (
              <div className="space-y-2">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
            ) : data ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b">
                  <div>
                    <div className="text-sm font-medium">{selectedEmp?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Role: <Badge variant="secondary" className="ml-1">{data.role}</Badge>
                      <span className="ml-3">Overrides: {overrideCount}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const cleared: Record<string, boolean | null> = {};
                        for (const k of ALL_MODULE_KEYS) cleared[k] = null;
                        setDraft(cleared);
                      }}
                    >
                      Clear all overrides
                    </Button>
                    <Button onClick={() => save.mutate()} disabled={save.isPending}>
                      {save.isPending ? "Saving..." : "Save Overrides"}
                    </Button>
                  </div>
                </div>
                <ModuleGrid
                  value={draft}
                  baseValue={data.roleDefaults}
                  onChange={(k, v) => setDraft((d) => ({ ...d, [k]: v }))}
                  allowInherit
                />
              </>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PermissionsPage() {
  const { user } = useAuth();
  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="w-10 h-10 mb-3 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Admin only</h2>
        <p className="text-muted-foreground text-sm mt-1">
          You need admin access to manage permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Permissions Manager</h2>
        <p className="text-muted-foreground text-sm">
          Configure module access by role and override per employee. Sub-modules under
          Reports, Accounting, etc. are listed individually so you can grant or revoke
          finely. Admins always have full access.
        </p>
      </div>
      <Tabs defaultValue="role" className="w-full">
        <TabsList>
          <TabsTrigger value="role">By Role</TabsTrigger>
          <TabsTrigger value="user">By User (Override)</TabsTrigger>
        </TabsList>
        <TabsContent value="role" className="mt-4">
          <RolePermissionsPanel />
        </TabsContent>
        <TabsContent value="user" className="mt-4">
          <UserOverridesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
