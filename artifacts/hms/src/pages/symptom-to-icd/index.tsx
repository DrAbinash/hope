import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import SymptomToICD from "@/components/SymptomToICD";
import { Search, Info } from "lucide-react";

export default function SymptomToICDPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-6 h-6 text-purple-600" />
            <h1 className="text-3xl font-bold tracking-tight">Symptom to ICD-10 Classifier</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Search symptoms to find matching ICD-10-CM diagnosis codes. Supports voice dictation for quick symptom entry.
          </p>
        </div>

        {/* Main Tool */}
        <SymptomToICD />

        {/* How to Use */}
        <Card className="border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              How to Use
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3 text-slate-700 dark:text-slate-300">
            <div>
              <strong>1. Enter Symptoms:</strong> Type symptom names or use the microphone button to dictate symptoms
            </div>
            <div>
              <strong>2. Add Multiple:</strong> Add multiple symptoms by pressing Enter or clicking Add button
            </div>
            <div>
              <strong>3. View Results:</strong> The tool automatically shows matching ICD-10 codes sorted by severity
            </div>
            <div>
              <strong>4. Copy or Select:</strong> Click Copy to copy code to clipboard, or Select to use in forms
            </div>
            <div>
              <strong>5. Remove Symptoms:</strong> Click the × button on any symptom badge to remove it
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card className="border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-base">✨ Features</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <p>🎤 <strong>Voice Dictation:</strong> Dictate symptoms hands-free using your microphone</p>
            <p>🔍 <strong>Flexible Matching:</strong> Finds ICD codes even with partial symptom names</p>
            <p>📊 <strong>Severity Levels:</strong> Color-coded results showing mild, moderate, and severe conditions</p>
            <p>📋 <strong>Multiple Symptoms:</strong> Combine multiple symptoms to narrow down diagnoses</p>
            <p>📋 <strong>Category Information:</strong> See what category each ICD code belongs to</p>
            <p>⚡ <strong>Privacy First:</strong> All searches happen locally, no data sent to servers</p>
          </CardContent>
        </Card>

        {/* Information */}
        <Card className="border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base">ℹ️ About ICD-10-CM Codes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <p>
              ICD-10-CM (International Classification of Diseases, 10th Revision, Clinical Modification) codes are standardized diagnosis codes used for:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Medical billing and insurance claims</li>
              <li>Patient medical records and documentation</li>
              <li>Statistical analysis and public health tracking</li>
              <li>Clinical research and epidemiology</li>
            </ul>
            <p className="mt-3 italic">
              This tool provides reference data. Always verify with official ICD-10 resources and clinical guidelines for accuracy.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
