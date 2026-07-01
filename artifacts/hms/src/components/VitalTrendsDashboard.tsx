import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  checkVitalStatus,
  calculateTrend,
  getTrendIcon,
  getStatusColor,
  parseVitalValue,
  parseBP,
} from "@/lib/vital-trends";

interface Vitals {
  temp?: string;
  pulse?: string;
  bp?: string;
  rr?: string;
  spo2?: string;
}

interface VitalTrendsDashboardProps {
  currentVitals: Vitals;
  previousVitals?: Vitals;
  historicalVitals?: Vitals[];
  className?: string;
}

export default function VitalTrendsDashboard({
  currentVitals,
  previousVitals,
  historicalVitals = [],
  className = "",
}: VitalTrendsDashboardProps) {
  const renderVitalCard = (
    label: string,
    currentValue: string | undefined,
    previousValue: string | undefined,
    unit: string,
    icon: string
  ) => {
    const current = parseVitalValue(currentValue);
    if (current === null) return null;

    const previous = parseVitalValue(previousValue);
    const status = checkVitalStatus(label.toLowerCase().replace(" ", "_"), current);
    const change = previous !== null ? current - previous : 0;
    const changePercent = previous !== null ? ((change / previous) * 100).toFixed(1) : "0";

    return (
      <div key={label} className={`border rounded-lg p-3 ${getStatusColor(status)}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">{icon}</span>
              {label}
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">{current}</div>
              <div className="text-xs opacity-80">{unit}</div>
            </div>

            {previous !== null && (
              <div className="mt-2 text-xs">
                <span className="opacity-80">Previous: {previous} {unit}</span>
                <div className={`mt-1 ${change > 0 ? "text-red-600" : change < 0 ? "text-blue-600" : ""}`}>
                  {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(parseFloat(changePercent))}%
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0 items-end">
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${
                status === "critical"
                  ? "bg-red-200 dark:bg-red-900"
                  : status === "warning"
                    ? "bg-yellow-200 dark:bg-yellow-900"
                    : "bg-green-200 dark:bg-green-900"
              }`}
            >
              {status}
            </Badge>
            {status !== "normal" && (
              <div className="text-xs font-semibold">
                {status === "critical" ? "🚨" : "⚠️"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderBPCard = (currentBP: string | undefined, previousBP: string | undefined) => {
    const current = parseBP(currentBP);
    if (current.systolic === null) return null;

    const previous = parseBP(previousBP);
    const status = Math.max(
      checkVitalStatus("bp_systolic", current.systolic),
      checkVitalStatus("bp_diastolic", current.diastolic || 0)
    );

    const systolicChange = previous.systolic !== null ? current.systolic - previous.systolic : 0;
    const diastolicChange = previous.diastolic !== null ? current.diastolic - previous.diastolic : 0;

    return (
      <div key="BP" className={`border rounded-lg p-3 ${getStatusColor(status)}`}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">❤️</span>
              Blood Pressure
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold">
                {current.systolic}/{current.diastolic}
              </div>
              <div className="text-xs opacity-80">mmHg</div>
            </div>

            {previous.systolic !== null && (
              <div className="mt-2 text-xs space-y-1">
                <div className="opacity-80">Previous: {previous.systolic}/{previous.diastolic}</div>
                <div className="flex gap-2">
                  <span className={systolicChange > 0 ? "text-red-600" : systolicChange < 0 ? "text-blue-600" : ""}>
                    Sys: {systolicChange > 0 ? "↑" : systolicChange < 0 ? "↓" : "→"} {Math.abs(systolicChange)}
                  </span>
                  <span className={diastolicChange > 0 ? "text-red-600" : diastolicChange < 0 ? "text-blue-600" : ""}>
                    Dia: {diastolicChange > 0 ? "↑" : diastolicChange < 0 ? "↓" : "→"} {Math.abs(diastolicChange)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 shrink-0 items-end">
            <Badge
              variant="outline"
              className={`text-[10px] capitalize ${
                status === "critical"
                  ? "bg-red-200 dark:bg-red-900"
                  : status === "warning"
                    ? "bg-yellow-200 dark:bg-yellow-900"
                    : "bg-green-200 dark:bg-green-900"
              }`}
            >
              {status}
            </Badge>
            {status !== "normal" && (
              <div className="text-xs font-semibold">
                {status === "critical" ? "🚨" : "⚠️"}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const allVitalsEmpty = !currentVitals.temp && !currentVitals.pulse && !currentVitals.bp && !currentVitals.rr && !currentVitals.spo2;

  if (allVitalsEmpty) {
    return null;
  }

  return (
    <Card className={`border-2 border-cyan-200 dark:border-cyan-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          📊 Vital Signs Trends
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Current vitals with comparison to previous reading
        </p>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Temperature */}
          {renderVitalCard("Temperature", currentVitals.temp, previousVitals?.temp, "°F", "🌡️")}

          {/* Pulse */}
          {renderVitalCard("Pulse", currentVitals.pulse, previousVitals?.pulse, "bpm", "💓")}

          {/* Blood Pressure */}
          {renderBPCard(currentVitals.bp, previousVitals?.bp)}

          {/* Respiratory Rate */}
          {renderVitalCard("Resp Rate", currentVitals.rr, previousVitals?.rr, "/min", "💨")}

          {/* SpO2 */}
          {renderVitalCard("SpO2", currentVitals.spo2, previousVitals?.spo2, "%", "🫁")}
        </div>

        {/* Summary Alert */}
        {(() => {
          const vitalsWithCritical = [
            currentVitals.temp && checkVitalStatus("temp", parseVitalValue(currentVitals.temp) || 0) === "critical",
            currentVitals.pulse && checkVitalStatus("pulse", parseVitalValue(currentVitals.pulse) || 0) === "critical",
            currentVitals.rr && checkVitalStatus("rr", parseVitalValue(currentVitals.rr) || 0) === "critical",
            currentVitals.spo2 && checkVitalStatus("spo2", parseVitalValue(currentVitals.spo2) || 0) === "critical",
          ].filter(Boolean).length;

          if (vitalsWithCritical > 0) {
            return (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg">
                <div className="text-sm font-semibold text-red-900 dark:text-red-200 flex items-center gap-2">
                  <span>🚨 ALERT</span>
                  <span>{vitalsWithCritical} critical vital(s) detected</span>
                </div>
                <p className="text-xs text-red-800 dark:text-red-300 mt-1">
                  Immediate clinical assessment recommended
                </p>
              </div>
            );
          }
          return null;
        })()}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-3 mt-3">
          💡 Green = Normal | Yellow = Warning | Red = Critical. Compare to previous day to identify trends.
        </div>
      </CardContent>
    </Card>
  );
}
