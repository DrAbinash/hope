import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, TrendingUp } from "lucide-react";
import { suggestDiagnoses, getConfidenceColor, getConfidenceLabel } from "@/lib/diagnosis-suggestions";

interface SmartDiagnosisSuggestionsProps {
  symptoms: string[];
  findings: string[];
  onSelectDiagnosis?: (diagnosis: string) => void;
  className?: string;
}

export default function SmartDiagnosisSuggestions({
  symptoms,
  findings,
  onSelectDiagnosis,
  className = "",
}: SmartDiagnosisSuggestionsProps) {
  const suggestions = suggestDiagnoses(symptoms, findings, 0.55);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <Card className={`border-2 border-indigo-200 dark:border-indigo-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-indigo-600" />
          AI Diagnosis Suggestions
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Based on {symptoms.length} symptom(s) and {findings.length} finding(s)
        </p>
      </CardHeader>

      <CardContent className="space-y-2">
        {suggestions.map((suggestion, idx) => {
          const confidence = Math.round(suggestion.confidence * 100);
          const confLevel = getConfidenceLabel(suggestion.confidence);

          return (
            <div
              key={suggestion.id}
              className={`border rounded-lg p-3 ${getConfidenceColor(suggestion.confidence)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-sm">{idx + 1}. {suggestion.name}</div>
                    <Badge variant="outline" className="text-[10px]">
                      {suggestion.category}
                    </Badge>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    {/* Matching Symptoms */}
                    {symptoms.length > 0 && (
                      <div>
                        <span className="font-semibold text-xs">Matching Symptoms:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {suggestion.symptoms.map(sym => {
                            const isMatched = symptoms.some(s => s.toLowerCase().includes(sym.toLowerCase()) || sym.toLowerCase().includes(s.toLowerCase()));
                            return (
                              <span
                                key={sym}
                                className={`text-[10px] px-2 py-0.5 rounded ${
                                  isMatched ? "bg-white/50 dark:bg-black/20 font-semibold" : "opacity-60"
                                }`}
                              >
                                {isMatched ? "✓ " : ""}{sym}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Matching Findings */}
                    {findings.length > 0 && (
                      <div>
                        <span className="font-semibold text-xs">Matching Findings:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {suggestion.findings.map(finding => {
                            const isMatched = findings.some(f => f.toLowerCase().includes(finding.toLowerCase()) || finding.toLowerCase().includes(f.toLowerCase()));
                            return (
                              <span
                                key={finding}
                                className={`text-[10px] px-2 py-0.5 rounded ${
                                  isMatched ? "bg-white/50 dark:bg-black/20 font-semibold" : "opacity-60"
                                }`}
                              >
                                {isMatched ? "✓ " : ""}{finding}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Suggested Investigations */}
                  <div className="mt-2 text-[11px]">
                    <span className="font-semibold">Suggested Tests:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {suggestion.investigations.slice(0, 4).map(inv => (
                        <span key={inv} className="text-[10px] bg-white/30 dark:bg-black/30 px-2 py-0.5 rounded">
                          {inv}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Confidence Indicator */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="text-center">
                    <div className="text-lg font-bold">{confidence}%</div>
                    <div className="text-[9px] font-semibold">{confLevel}</div>
                  </div>
                  {onSelectDiagnosis && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onSelectDiagnosis(suggestion.name)}
                      className="h-6 text-xs rounded-lg mt-1 hover:bg-white/30 dark:hover:bg-black/30"
                    >
                      Select
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-2 mt-2">
          💡 AI suggestions based on symptom and finding patterns. Always use clinical judgment and confirm with patient history and investigations.
        </div>
      </CardContent>
    </Card>
  );
}
