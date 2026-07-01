import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  EYE_OPENING_SCORES,
  VERBAL_RESPONSE_SCORES,
  MOTOR_RESPONSE_SCORES,
  GCSScore,
  calculateGCSTotal,
  getGCSSeverity,
  getGCSSeverityColor,
  getGCSSeverityIcon,
  formatGCSScore,
} from "@/lib/gcs-assessment";

interface GlasgowComaScaleProps {
  value: GCSScore;
  onChange: (score: GCSScore) => void;
  readOnly?: boolean;
}

export default function GlasgowComaScale({ value, onChange, readOnly = false }: GlasgowComaScaleProps) {
  const total = calculateGCSTotal(value);
  const severity = getGCSSeverity(total);
  const severityColor = getGCSSeverityColor(total);
  const severityIcon = getGCSSeverityIcon(total);

  const handleEyeChange = (score: number) => {
    if (!readOnly) {
      onChange({ ...value, eyeOpening: score });
    }
  };

  const handleVerbalChange = (score: number) => {
    if (!readOnly) {
      onChange({ ...value, verbalResponse: score });
    }
  };

  const handleMotorChange = (score: number) => {
    if (!readOnly) {
      onChange({ ...value, motorResponse: score });
    }
  };

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Glasgow Coma Scale (GCS)</CardTitle>
          {total > 0 && (
            <Badge className={severityColor}>
              {severityIcon} {formatGCSScore(value)} - {severity}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Eye Opening */}
        <div>
          <label className="text-sm font-semibold mb-2 block">
            Eye Opening (E) {value.eyeOpening && `- ${value.eyeOpening}`}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EYE_OPENING_SCORES.map(option => (
              <button
                key={option.id}
                onClick={() => handleEyeChange(option.score)}
                disabled={readOnly}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  value.eyeOpening === option.score
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="font-semibold">{option.score}</div>
                <div className="text-xs">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Verbal Response */}
        <div>
          <label className="text-sm font-semibold mb-2 block">
            Verbal Response (V) {value.verbalResponse && `- ${value.verbalResponse}`}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {VERBAL_RESPONSE_SCORES.map(option => (
              <button
                key={option.id}
                onClick={() => handleVerbalChange(option.score)}
                disabled={readOnly}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  value.verbalResponse === option.score
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="font-semibold">{option.score}</div>
                <div className="text-xs">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Motor Response */}
        <div>
          <label className="text-sm font-semibold mb-2 block">
            Motor Response (M) {value.motorResponse && `- ${value.motorResponse}`}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {MOTOR_RESPONSE_SCORES.map(option => (
              <button
                key={option.id}
                onClick={() => handleMotorChange(option.score)}
                disabled={readOnly}
                className={`p-2 rounded-lg text-sm border transition-all ${
                  value.motorResponse === option.score
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="font-semibold">{option.score}</div>
                <div className="text-xs">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        {total > 0 && (
          <div className={`p-3 rounded-lg border ${severityColor}`}>
            <div className="font-semibold text-sm">
              Total GCS Score: {total}/15
            </div>
            <div className="text-xs mt-1 opacity-90">
              Severity: {severity} ({severity === "Mild" ? "Good prognosis" : severity === "Moderate" ? "Guarded prognosis" : "Poor prognosis"})
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
