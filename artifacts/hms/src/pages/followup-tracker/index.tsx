import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Calendar, AlertCircle, Info } from "lucide-react";
import FollowUpTracker from "@/components/FollowUpTracker";
import { toast } from "sonner";
import {
  getFollowupStatus,
  formatFollowupDate,
  FollowUp,
} from "@/lib/followup-tracker";

// Mock data - in real app, this would come from API
const MOCK_FOLLOWUPS: FollowUp[] = [
  {
    id: "fu-001",
    admissionId: 1,
    patientId: 101,
    patientName: "Rajesh Kumar",
    diagnosis: "Pneumonia",
    followupDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    followupDays: 5,
    instructions: "Chest X-ray, check oxygen levels",
    priority: "urgent",
    status: "pending",
    createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    doctorId: 1,
    doctorName: "Dr. Sharma",
  },
  {
    id: "fu-002",
    admissionId: 2,
    patientId: 102,
    patientName: "Priya Singh",
    diagnosis: "Heart Failure",
    followupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    followupDays: 3,
    instructions: "BNP levels, ECG, Echocardiography",
    priority: "critical",
    status: "pending",
    createdDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    doctorId: 2,
    doctorName: "Dr. Patel",
  },
  {
    id: "fu-003",
    admissionId: 3,
    patientId: 103,
    patientName: "Arjun Verma",
    diagnosis: "Gastroenteritis",
    followupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    followupDays: 7,
    instructions: "Check hydration status, repeat stool culture if symptoms persist",
    priority: "routine",
    status: "pending",
    createdDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    doctorId: 1,
    doctorName: "Dr. Sharma",
  },
  {
    id: "fu-004",
    admissionId: 4,
    patientId: 104,
    patientName: "Meera Desai",
    diagnosis: "Diabetes Mellitus",
    followupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    followupDays: 30,
    instructions: "HbA1c test, review medication compliance",
    priority: "urgent",
    status: "pending",
    createdDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    doctorId: 3,
    doctorName: "Dr. Iyer",
  },
  {
    id: "fu-005",
    admissionId: 5,
    patientId: 105,
    patientName: "Vikram Nair",
    diagnosis: "Pneumonia",
    followupDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    followupDays: 5,
    instructions: "Post-treatment assessment",
    priority: "urgent",
    status: "completed",
    createdDate: new Date(Date.now() - 13 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    completedDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    doctorId: 2,
    doctorName: "Dr. Patel",
  },
];

export default function FollowUpTrackerPage() {
  const [followups, setFollowups] = useState<FollowUp[]>(MOCK_FOLLOWUPS);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const handleMarkComplete = (followupId: string) => {
    setFollowups(
      followups.map(f =>
        f.id === followupId
          ? { ...f, status: "completed", completedDate: new Date().toISOString().split('T')[0] }
          : f
      )
    );
    toast.success("Follow-up marked as completed");
  };

  const overdueCount = followups.filter(
    f => getFollowupStatus(f.followupDate, f.status) === "overdue"
  ).length;

  const dueSoonCount = followups.filter(
    f => getFollowupStatus(f.followupDate, f.status) === "due-soon"
  ).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-6 h-6 text-orange-600" />
            <h1 className="text-3xl font-bold tracking-tight">Follow-Up Tracker</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Manage patient follow-up appointments and track overdue visits
          </p>
        </div>

        {/* Alert Banners */}
        {overdueCount > 0 && (
          <Card className="border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-red-900 dark:text-red-200">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-semibold">{overdueCount} overdue follow-up(s)</span> - Immediate action required
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {dueSoonCount > 0 && (
          <Card className="border-2 border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-yellow-900 dark:text-yellow-200">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <div>
                  <span className="font-semibold">{dueSoonCount} due soon</span> - Schedule within 3 days
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tracker */}
        <FollowUpTracker
          followups={followups}
          onMarkComplete={handleMarkComplete}
        />

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
              <strong>📋 View Follow-ups:</strong> All pending patient follow-ups are listed with dates, priorities, and instructions
            </div>
            <div>
              <strong>🔴 Overdue Alerts:</strong> Red badges show follow-ups that are overdue - prioritize these first
            </div>
            <div>
              <strong>🟡 Due Soon:</strong> Yellow badges show appointments due within 3 days
            </div>
            <div>
              <strong>✓ Mark Complete:</strong> Click "Done" button after completing a follow-up
            </div>
            <div>
              <strong>🔍 Search & Filter:</strong> Use search box to find specific patients or diagnoses
            </div>
            <div>
              <strong>📊 Priority Levels:</strong> Critical 🚨, Urgent ⚠️, Routine 📋
            </div>
          </CardContent>
        </Card>

        {/* Benefits */}
        <Card className="border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-base">✨ Key Features</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
            <p>✓ <strong>Overdue Tracking:</strong> Automatic alerts for missed appointments</p>
            <p>✓ <strong>Priority Management:</strong> Filter by critical, urgent, or routine</p>
            <p>✓ <strong>Quick Actions:</strong> Mark follow-ups complete with one click</p>
            <p>✓ <strong>Patient Search:</strong> Find patients by name, diagnosis, or doctor</p>
            <p>✓ <strong>Smart Sorting:</strong> Most urgent items appear first</p>
            <p>✓ <strong>Audit Trail:</strong> Track completion dates for compliance</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
