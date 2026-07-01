import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import CentralTemplateManager from "@/components/CentralTemplateManager";
import { Settings } from "lucide-react";

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            <h1 className="text-3xl font-bold tracking-tight">Template Management</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Centralized management of all quick-select templates across the hospital system. Edit, add, remove, import, and export templates.
          </p>
        </div>

        {/* Main Template Manager */}
        <CentralTemplateManager />

        {/* Quick Tips */}
        <Card className="border bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-base">💡 Quick Tips</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <p>• <strong>Edit Templates:</strong> Add or remove items from any category to customize for your needs</p>
            <p>• <strong>Export:</strong> Back up all templates to a JSON file for safekeeping</p>
            <p>• <strong>Import:</strong> Restore templates from a previous backup or share settings with colleagues</p>
            <p>• <strong>Reset:</strong> Revert any category to its default state</p>
            <p>• <strong>Categories:</strong> Medications, Investigations, Symptoms, Findings, Follow-ups, Prescriptions</p>
          </CardContent>
        </Card>

        {/* Usage Statistics */}
        <Card className="border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardHeader>
            <CardTitle className="text-base">📊 How to Use</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <p><strong>IPD Progress Notes:</strong> Templates are used in the chocolate box grids for quick symptom, finding, and investigation selection</p>
            <p><strong>Prescriptions:</strong> Use the Prescription Template Builder to select medications and tests, then merge multiple templates</p>
            <p><strong>Consistency:</strong> Keep your templates organized and up-to-date for faster clinical workflows</p>
            <p><strong>Collaboration:</strong> Export and share templates with your team for standardized prescriptions</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
