import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import {
  PupilsAssessment,
  PUPIL_SIZES,
  REACTIVITY_OPTIONS,
  SHAPE_OPTIONS,
  isPupilAbnormal,
  getPupilAbnormalityColor,
  getPupilAbnormalityIcon,
  getPupilAbnormalityDetails,
  formatPupilsAssessment,
} from "@/lib/pupils-assessment";

interface PupilsExaminationProps {
  value: PupilsAssessment;
  onChange: (assessment: PupilsAssessment) => void;
  readOnly?: boolean;
}

export default function PupilsExamination({ value, onChange, readOnly = false }: PupilsExaminationProps) {
  const isAbnormal = isPupilAbnormal(value);
  const abnormalityColor = getPupilAbnormalityColor(isAbnormal);
  const abnormalityIcon = getPupilAbnormalityIcon(isAbnormal);
  const abnormalityDetails = getPupilAbnormalityDetails(value);

  return (
    <Card className="border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Pupils Examination</CardTitle>
          {(value.size.left || value.size.right) && (
            <Badge className={abnormalityColor}>
              {abnormalityIcon} {formatPupilsAssessment(value)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pupil Size */}
        <div>
          <label className="text-sm font-semibold mb-2 block">Pupil Size (mm)</label>
          <div className="grid grid-cols-2 gap-4">
            {/* Left Pupil */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Left Pupil</label>
              <div className="flex flex-wrap gap-1">
                {PUPIL_SIZES.map(size => (
                  <button
                    key={`left-${size}`}
                    onClick={() => !readOnly && onChange({ ...value, size: { ...value.size, left: size } })}
                    disabled={readOnly}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                      value.size.left === size
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Pupil */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Right Pupil</label>
              <div className="flex flex-wrap gap-1">
                {PUPIL_SIZES.map(size => (
                  <button
                    key={`right-${size}`}
                    onClick={() => !readOnly && onChange({ ...value, size: { ...value.size, right: size } })}
                    disabled={readOnly}
                    className={`px-2 py-1 rounded text-xs font-medium border transition-all ${
                      value.size.right === size
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reactivity */}
        <div>
          <label className="text-sm font-semibold mb-2 block">Light Reactivity</label>
          <div className="grid grid-cols-2 gap-4">
            {/* Left Reactivity */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Left</label>
              <div className="grid grid-cols-2 gap-2">
                {REACTIVITY_OPTIONS.map(option => (
                  <button
                    key={`left-react-${option}`}
                    onClick={() => !readOnly && onChange({ ...value, reactivity: { ...value.reactivity, left: option } })}
                    disabled={readOnly}
                    className={`p-2 rounded text-xs font-medium border transition-all ${
                      value.reactivity.left === option
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Reactivity */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Right</label>
              <div className="grid grid-cols-2 gap-2">
                {REACTIVITY_OPTIONS.map(option => (
                  <button
                    key={`right-react-${option}`}
                    onClick={() => !readOnly && onChange({ ...value, reactivity: { ...value.reactivity, right: option } })}
                    disabled={readOnly}
                    className={`p-2 rounded text-xs font-medium border transition-all ${
                      value.reactivity.right === option
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Shape */}
        <div>
          <label className="text-sm font-semibold mb-2 block">Pupil Shape</label>
          <div className="grid grid-cols-2 gap-4">
            {/* Left Shape */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Left</label>
              <div className="grid grid-cols-2 gap-2">
                {SHAPE_OPTIONS.map(option => (
                  <button
                    key={`left-shape-${option}`}
                    onClick={() => !readOnly && onChange({ ...value, shape: { ...value.shape, left: option } })}
                    disabled={readOnly}
                    className={`p-2 rounded text-xs font-medium border transition-all ${
                      value.shape.left === option
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Shape */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Right</label>
              <div className="grid grid-cols-2 gap-2">
                {SHAPE_OPTIONS.map(option => (
                  <button
                    key={`right-shape-${option}`}
                    onClick={() => !readOnly && onChange({ ...value, shape: { ...value.shape, right: option } })}
                    disabled={readOnly}
                    className={`p-2 rounded text-xs font-medium border transition-all ${
                      value.shape.right === option
                        ? "bg-blue-500 text-white border-blue-600"
                        : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                    } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Equality */}
        <div>
          <label className="text-sm font-semibold mb-2 block">Pupil Equality</label>
          <div className="flex gap-2">
            {["Equal", "Unequal"].map(option => (
              <button
                key={option}
                onClick={() => !readOnly && onChange({ ...value, equality: option as "Equal" | "Unequal" })}
                disabled={readOnly}
                className={`px-4 py-2 rounded text-sm font-medium border transition-all ${
                  value.equality === option
                    ? "bg-blue-500 text-white border-blue-600"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                } ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Abnormality Alert */}
        {isAbnormal && abnormalityDetails.length > 0 && (
          <div className={`p-3 rounded-lg border ${abnormalityColor} flex gap-3`}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <div className="font-semibold">Abnormal Findings:</div>
              {abnormalityDetails.map((detail, idx) => (
                <div key={idx} className="text-xs">• {detail}</div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
