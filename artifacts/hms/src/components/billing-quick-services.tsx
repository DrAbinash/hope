import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Pencil, Plus, Save, X, Star } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface BillingHead {
  id: number; code: string; name: string; category: string;
  defaultRate: string; gstPercent: string | null;
}

interface HospitalSettings {
  entityId: number;
  quickServices?: number[] | null;
  hospitalName?: string;
}

const SLOT_COUNT = 6;
const EMPTY_SLOT = "__empty_slot__";
export function BillingQuickServices({
  entityId,
  heads,
  onPick,
}: {
  entityId: number;
  heads: BillingHead[];
  onPick: (head: BillingHead) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<(number | null)[]>(Array(SLOT_COUNT).fill(null));

  const { data: settings } = useQuery<HospitalSettings>({
    queryKey: ["/api/hospital-settings", entityId],
    queryFn: () => fetch(`/api/hospital-settings/${entityId}`, { credentials: "include" }).then((r) =>
      r.ok ? r.json() : { entityId, quickServices: [] }
    ),
  });

  useEffect(() => {
    if (editing) return;
    const list = Array.isArray(settings?.quickServices) ? settings!.quickServices! : [];
    const next: (number | null)[] = Array(SLOT_COUNT).fill(null);
    for (let i = 0; i < SLOT_COUNT; i++) next[i] = list[i] ?? null;
    setDraft(next);
  }, [settings, editing]);

  const headById = useMemo(() => {
    const map = new Map<number, BillingHead>();
    for (const h of heads) map.set(h.id, h);
    return map;
  }, [heads]);

  const saveMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(`/api/hospital-settings/${entityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...(settings || { hospitalName: "Hospital" }), quickServices: ids }),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/hospital-settings", entityId] });
      toast.success("Quick services saved");
      setEditing(false);
    },
    onError: () => toast.error("Could not save quick services"),
  });

  const handleSlotClick = (i: number) => {
    const id = draft[i];
    if (id == null) return;
    const head = headById.get(id);
    if (head) onPick(head);
  };

  const handleSetSlot = (i: number, v: string) => {
    const next = [...draft];
    next[i] = v === EMPTY_SLOT ? null : Number(v);
    setDraft(next);
  };

  const handleSave = () => {
    const ids = draft.filter((x): x is number => typeof x === "number");
    saveMut.mutate(ids);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  return (
    <div className="mb-3 rounded-lg border bg-amber-50/40 dark:bg-amber-950/10 p-2" data-testid="billing-quick-services">
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-amber-500" />
          Quick services — most-used (one click to add)
        </div>
        {editing ? (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleCancel} data-testid="quick-svc-cancel">
              <X className="w-3.5 h-3.5 mr-1" />Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMut.isPending} data-testid="quick-svc-save">
              <Save className="w-3.5 h-3.5 mr-1" />Save
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)} data-testid="quick-svc-edit">
            <Pencil className="w-3.5 h-3.5 mr-1" />Configure
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {Array.from({ length: SLOT_COUNT }).map((_, i) => {
          const id = draft[i];
          const head = id != null ? headById.get(id) : undefined;
          if (editing) {
            return (
              <Select
                key={i}
                value={id != null ? String(id) : EMPTY_SLOT}
                onValueChange={(v) => handleSetSlot(i, v)}
              >
                <SelectTrigger
                  className="h-auto py-2 text-xs"
                  data-testid={`quick-svc-edit-slot-${i}`}
                >
                  <SelectValue placeholder={`Slot ${i + 1}`} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__empty_slot__"><span className="text-muted-foreground">— Empty —</span></SelectItem>
                  {heads.map((h) => (
                    <SelectItem key={h.id} value={String(h.id)}>
                      <span className="font-mono text-[10px] text-muted-foreground mr-1">{h.code}</span>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            );
          }
          if (!head) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => setEditing(true)}
                data-testid={`quick-svc-slot-${i}-empty`}
                className="border border-dashed rounded px-2 py-3 text-xs text-muted-foreground hover:bg-muted hover:border-primary transition flex flex-col items-center justify-center gap-1 min-h-[60px]"
              >
                <Plus className="w-3.5 h-3.5" />
                Slot {i + 1}
              </button>
            );
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => handleSlotClick(i)}
              data-testid={`quick-svc-slot-${i}`}
              title={`${head.code} · ${head.category}`}
              className="border rounded px-2 py-2 text-left bg-white dark:bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition min-h-[60px] flex flex-col justify-between"
            >
              <div className="text-xs font-medium leading-tight line-clamp-2">{head.name}</div>
              <div className="text-[10px] opacity-70 flex justify-between mt-1">
                <span>{head.category}</span>
                <span className="font-semibold">₹{Number(head.defaultRate).toLocaleString("en-IN")}</span>
              </div>
            </button>
          );
        })}
      </div>
      {editing && (
        <p className="text-[11px] text-muted-foreground mt-2 px-1">
          Pick up to 6 most-used services. They'll appear as one-click buttons here for everyone using this hospital.
        </p>
      )}
    </div>
  );
}
