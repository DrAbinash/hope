import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ShieldAlert, Info, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  checkInteractions,
  type InteractionSeverity,
  type MedicineForCheck,
} from "@/lib/drug-interactions";

interface Props {
  medicines: MedicineForCheck[];
}

const STYLES: Record<
  InteractionSeverity,
  { wrap: string; chip: string; icon: ReactNode; label: string }
> = {
  severe: {
    wrap: "border-destructive/40 bg-destructive/5",
    chip: "bg-destructive text-destructive-foreground",
    icon: <ShieldAlert className="h-4 w-4 text-destructive" />,
    label: "Severe",
  },
  moderate: {
    wrap: "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20",
    chip: "bg-amber-500 text-white",
    icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    label: "Moderate",
  },
  minor: {
    wrap: "border-muted bg-muted/40",
    chip: "bg-muted text-muted-foreground",
    icon: <Info className="h-4 w-4 text-muted-foreground" />,
    label: "Minor",
  },
};

export function DrugInteractionAlerts({ medicines }: Props) {
  const warnings = useMemo(() => checkInteractions(medicines), [medicines]);
  const [open, setOpen] = useState(true);

  if (warnings.length === 0) return null;

  const severeCount = warnings.filter((w) => w.severity === "severe").length;
  const moderateCount = warnings.filter((w) => w.severity === "moderate").length;

  return (
    <div
      className={`rounded-md border-2 ${
        severeCount > 0
          ? "border-destructive/50 bg-destructive/5"
          : "border-amber-400/50 bg-amber-50 dark:bg-amber-950/20"
      }`}
      data-testid="drug-interaction-alerts"
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="drug-interaction-alerts-body"
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          {severeCount > 0 ? (
            <ShieldAlert className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          )}
          <span className="text-sm font-semibold">
            {warnings.length} drug interaction{warnings.length === 1 ? "" : "s"} detected
          </span>
          {severeCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {severeCount} severe
            </Badge>
          )}
          {moderateCount > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] hover:bg-amber-500/90">
              {moderateCount} moderate
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
      {open && (
        <div id="drug-interaction-alerts-body" className="border-t px-3 py-2 space-y-2">
          {warnings.map((w, i) => {
            const s = STYLES[w.severity];
            return (
              <div
                key={i}
                className={`rounded-md border p-2.5 ${s.wrap}`}
                data-testid={`drug-interaction-${i}`}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-0.5">{s.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded ${s.chip}`}>
                        {s.label}
                      </span>
                      <span className="text-sm font-medium">
                        {w.drugA} <span className="text-muted-foreground">×</span> {w.drugB}
                      </span>
                    </div>
                    <div className="text-xs mt-1">{w.effect}</div>
                    <div className="text-xs mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground">Advice: </span>
                      {w.advice}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="text-[10px] text-muted-foreground italic pt-1">
            Screening aid only. Verify with an authoritative reference and use clinical judgement.
          </div>
        </div>
      )}
    </div>
  );
}
