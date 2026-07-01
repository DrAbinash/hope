import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, AlertOctagon } from "lucide-react";
import { checkDrugInteractions, getSeverityColor, getSeverityIcon } from "@/lib/drug-interactions";

interface DrugInteractionCheckerProps {
  medicines: string[];
  className?: string;
}

export default function DrugInteractionChecker({ medicines, className = "" }: DrugInteractionCheckerProps) {
  const interactions = checkDrugInteractions(medicines);

  if (interactions.length === 0) {
    return null;
  }

  const severeCounts = {
    severe: interactions.filter(i => i.severity === "severe").length,
    moderate: interactions.filter(i => i.severity === "moderate").length,
    mild: interactions.filter(i => i.severity === "mild").length,
  };

  return (
    <Card className={`border-2 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-600" />
          Drug Interaction Alert
        </CardTitle>
        <div className="flex gap-2 mt-2">
          {severeCounts.severe > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              🚨 {severeCounts.severe} Severe
            </Badge>
          )}
          {severeCounts.moderate > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200 text-[10px]">
              ⚠️ {severeCounts.moderate} Moderate
            </Badge>
          )}
          {severeCounts.mild > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              ℹ️ {severeCounts.mild} Mild
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {interactions.map((interaction, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-3 ${getSeverityColor(interaction.severity)}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg shrink-0">{getSeverityIcon(interaction.severity)}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm">
                  {interaction.drug1} + {interaction.drug2}
                </div>
                <div className="text-sm mt-1">{interaction.interaction}</div>
                <div className="text-sm mt-2 border-t border-current border-opacity-20 pt-2">
                  <span className="font-semibold">Recommendation: </span>
                  {interaction.recommendation}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-3">
          ℹ️ This is a basic interaction checker for common drug combinations. Always verify interactions with official resources and clinical judgment.
        </div>
      </CardContent>
    </Card>
  );
}
