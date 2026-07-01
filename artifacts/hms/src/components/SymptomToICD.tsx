import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { searchICDBySymptoms, getSeverityColor } from "@/lib/symptom-icd-mapping";
import VoiceDictationButton from "./VoiceDictationButton";

interface SymptomToICDProps {
  onSelectICD?: (code: string, description: string) => void;
  className?: string;
}

export default function SymptomToICD({ onSelectICD, className = "" }: SymptomToICDProps) {
  const [symptomInput, setSymptomInput] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);

  const results = searchICDBySymptoms(symptoms);

  const handleAddSymptom = (symptom: string) => {
    const trimmed = symptom.trim();
    if (trimmed && !symptoms.includes(trimmed)) {
      setSymptoms([...symptoms, trimmed]);
      setSymptomInput("");
    }
  };

  const handleRemoveSymptom = (symptom: string) => {
    setSymptoms(symptoms.filter(s => s !== symptom));
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  };

  return (
    <Card className={`border-2 border-purple-200 dark:border-purple-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          🔍 Symptom to ICD-10 Classifier
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Type or dictate symptoms to find matching ICD-10 codes
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Symptom Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold">Enter Symptoms</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Fever, Cough, Shortness of breath"
              value={symptomInput}
              onChange={e => setSymptomInput(e.target.value)}
              onKeyPress={e => {
                if (e.key === "Enter") {
                  handleAddSymptom(symptomInput);
                }
              }}
              className="h-9 text-xs"
            />
            <Button
              type="button"
              onClick={() => handleAddSymptom(symptomInput)}
              size="sm"
              className="h-9 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Add
            </Button>
            <VoiceDictationButton
              onText={(text) => handleAddSymptom(text)}
              tooltip="Dictate symptom"
              className="h-9"
            />
          </div>
        </div>

        {/* Selected Symptoms */}
        {symptoms.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {symptoms.map(symptom => (
              <Badge key={symptom} variant="secondary" className="flex items-center gap-1 text-xs">
                {symptom}
                <button
                  type="button"
                  onClick={() => handleRemoveSymptom(symptom)}
                  className="text-red-500 hover:text-red-700 font-bold ml-1"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Results */}
        {results.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Found {results.length} matching ICD code(s)
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {results.map((icd, idx) => (
                <div
                  key={`${icd.code}-${idx}`}
                  className={`border rounded-lg p-3 ${getSeverityColor(icd.severity)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm font-mono">{icd.code}</div>
                      <div className="text-sm mt-1">{icd.description}</div>
                      <div className="text-[11px] mt-1 opacity-80">
                        Category: <span className="font-semibold">{icd.category}</span>
                      </div>
                      {icd.symptoms.length > 0 && (
                        <div className="text-[11px] mt-2">
                          <span className="font-semibold">Associated: </span>
                          <span>{icd.symptoms.join(", ")}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px] capitalize">
                        {icd.severity}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyCode(icd.code)}
                        className="h-7 px-2 text-xs rounded-lg hover:bg-white/30 dark:hover:bg-black/30"
                        title="Copy code"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      {onSelectICD && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectICD(icd.code, icd.description)}
                          className="h-7 px-2 text-xs rounded-lg hover:bg-white/30 dark:hover:bg-black/30"
                          title="Select this code"
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : symptoms.length > 0 ? (
          <div className="text-sm text-muted-foreground text-center py-4">
            No ICD codes found for these symptoms. Try different terms.
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-4">
            Enter symptoms to search for ICD-10 codes
          </div>
        )}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-2">
          💡 This tool matches symptoms to ICD-10-CM codes. Always verify with official ICD resources.
        </div>
      </CardContent>
    </Card>
  );
}
