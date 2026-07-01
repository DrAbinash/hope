import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, AlertCircle, Info } from "lucide-react";
import {
  validatePrescription,
  getSeverityColor,
  getSeverityIcon,
  MedicineWithDose,
} from "@/lib/prescription-validation";

interface PrescriptionValidatorProps {
  medicines: MedicineWithDose[];
  className?: string;
}

export default function PrescriptionValidator({
  medicines,
  className = "",
}: PrescriptionValidatorProps) {
  if (medicines.length === 0) {
    return null;
  }

  const validationErrors = validatePrescription(medicines);

  if (validationErrors.length === 0) {
    return (
      <Card className={`border-2 border-green-200 dark:border-green-800 ${className}`}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-green-900 dark:text-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <span className="font-semibold">✓ Prescription validation passed</span>
          </div>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            All {medicines.length} medicine(s) passed dosage and duration validation
          </p>
        </CardContent>
      </Card>
    );
  }

  const errorCounts = {
    error: validationErrors.filter(e => e.severity === "error").length,
    warning: validationErrors.filter(e => e.severity === "warning").length,
    info: validationErrors.filter(e => e.severity === "info").length,
  };

  const hasErrors = errorCounts.error > 0;

  return (
    <Card className={`border-2 ${hasErrors ? "border-red-300 dark:border-red-800" : "border-yellow-300 dark:border-yellow-800"} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {hasErrors ? (
            <>
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Prescription Validation Issues
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              Prescription Warnings
            </>
          )}
        </CardTitle>
        <div className="flex gap-2 mt-2 flex-wrap">
          {errorCounts.error > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              ❌ {errorCounts.error} Error(s)
            </Badge>
          )}
          {errorCounts.warning > 0 && (
            <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200 text-[10px]">
              ⚠️ {errorCounts.warning} Warning(s)
            </Badge>
          )}
          {errorCounts.info > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              ℹ️ {errorCounts.info} Info
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {validationErrors.map((error, idx) => (
          <div
            key={idx}
            className={`border rounded-lg p-3 ${getSeverityColor(error.severity)}`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg shrink-0">{getSeverityIcon(error.severity)}</span>
              <div className="flex-1">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {error.medicine}
                  <Badge
                    variant="outline"
                    className="text-[10px] capitalize"
                  >
                    {error.severity}
                  </Badge>
                </div>
                <div className="text-sm mt-1">{error.issue}</div>
                <div className="text-sm mt-2 opacity-90">
                  <span className="font-semibold">💡 </span>
                  {error.recommendation}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-2 mt-2">
          {hasErrors ? (
            <span>
              🚨 Prescription cannot be safely filled until errors are resolved. Review and correct before submission.
            </span>
          ) : (
            <span>
              ⚠️ Please review warnings and apply clinical judgment before proceeding.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
