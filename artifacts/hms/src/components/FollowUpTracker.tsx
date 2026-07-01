import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, AlertCircle, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  getFollowupStatus,
  getStatusColor,
  getPriorityIcon,
  getPriorityColor,
  calculateDaysUntilFollowup,
  formatFollowupDate,
  sortFollowups,
  FollowUp,
} from "@/lib/followup-tracker";

interface FollowUpTrackerProps {
  followups: FollowUp[];
  onMarkComplete?: (followupId: string) => void;
  onReschedule?: (followupId: string, newDate: string) => void;
  className?: string;
}

export default function FollowUpTracker({
  followups,
  onMarkComplete,
  onReschedule,
  className = "",
}: FollowUpTrackerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "overdue" | "due-soon" | "pending" | "completed">("all");

  const sortedFollowups = sortFollowups(followups);
  
  const filtered = sortedFollowups.filter(f => {
    const matchesSearch = f.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.diagnosis.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          f.doctorName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === "all") return matchesSearch;
    return matchesSearch && getFollowupStatus(f.followupDate, f.status) === filterStatus;
  });

  const counts = {
    overdue: sortedFollowups.filter(f => getFollowupStatus(f.followupDate, f.status) === "overdue").length,
    "due-soon": sortedFollowups.filter(f => getFollowupStatus(f.followupDate, f.status) === "due-soon").length,
    pending: sortedFollowups.filter(f => getFollowupStatus(f.followupDate, f.status) === "pending").length,
    completed: sortedFollowups.filter(f => f.status === "completed").length,
  };

  return (
    <Card className={`border-2 border-orange-200 dark:border-orange-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          📅 Follow-Up Tracker
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Manage patient follow-ups and track overdue appointments
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary Badges */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className={`cursor-pointer ${filterStatus === "all" ? "bg-slate-300 dark:bg-slate-600" : ""}`}
            onClick={() => setFilterStatus("all")}
          >
            All ({sortedFollowups.length})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 ${filterStatus === "overdue" ? "ring-2 ring-red-500" : ""}`}
            onClick={() => setFilterStatus("overdue")}
          >
            🚨 Overdue ({counts.overdue})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer bg-yellow-100 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-200 ${filterStatus === "due-soon" ? "ring-2 ring-yellow-500" : ""}`}
            onClick={() => setFilterStatus("due-soon")}
          >
            ⚠️ Due Soon ({counts["due-soon"]})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 ${filterStatus === "pending" ? "ring-2 ring-blue-500" : ""}`}
            onClick={() => setFilterStatus("pending")}
          >
            📋 Pending ({counts.pending})
          </Badge>
          <Badge
            variant="outline"
            className={`cursor-pointer bg-green-100 dark:bg-green-950 text-green-900 dark:text-green-200 ${filterStatus === "completed" ? "ring-2 ring-green-500" : ""}`}
            onClick={() => setFilterStatus("completed")}
          >
            ✓ Completed ({counts.completed})
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by patient, diagnosis, or doctor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {/* Follow-ups List */}
        {filtered.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.map(followup => {
              const status = getFollowupStatus(followup.followupDate, followup.status);
              const daysUntil = calculateDaysUntilFollowup(followup.followupDate);

              return (
                <div
                  key={followup.id}
                  className={`border rounded-lg p-3 ${getStatusColor(status)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getPriorityIcon(followup.priority)}</span>
                        <div className="font-semibold text-sm">{followup.patientName}</div>
                        <Badge className={`text-[10px] ${getPriorityColor(followup.priority)}`}>
                          {followup.priority}
                        </Badge>
                      </div>

                      <div className="text-xs space-y-1">
                        <div><span className="opacity-80">Diagnosis:</span> <span className="font-semibold">{followup.diagnosis}</span></div>
                        <div><span className="opacity-80">Follow-up:</span> <span className="font-semibold">{formatFollowupDate(followup.followupDate)}</span></div>
                        {status === "overdue" && (
                          <div className="text-red-700 dark:text-red-300 font-semibold">
                            ⚠️ {Math.abs(daysUntil)} day(s) overdue
                          </div>
                        )}
                        {status === "due-soon" && (
                          <div className="text-yellow-700 dark:text-yellow-300 font-semibold">
                            📍 Due in {daysUntil} day(s)
                          </div>
                        )}
                        {status === "pending" && (
                          <div className="text-blue-700 dark:text-blue-300">
                            📅 {daysUntil} day(s) remaining
                          </div>
                        )}
                        {followup.instructions && (
                          <div><span className="opacity-80">Instructions:</span> <span className="text-[11px]">{followup.instructions}</span></div>
                        )}
                        <div><span className="opacity-80">Dr. {followup.doctorName}</span></div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 shrink-0">
                      {followup.status !== "completed" && onMarkComplete && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            onMarkComplete(followup.id);
                            toast.success("Follow-up marked as completed");
                          }}
                          className="h-7 px-2 text-xs rounded-lg hover:bg-green-200 dark:hover:bg-green-900"
                          title="Mark as completed"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Done
                        </Button>
                      )}
                      {followup.status === "completed" && (
                        <Badge variant="secondary" className="text-[10px]">
                          ✓ Completed
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm || filterStatus !== "all" ? "No follow-ups match your search" : "No follow-ups pending"}
          </div>
        )}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-2">
          💡 Red = Overdue | Yellow = Due within 3 days | Blue = Pending | Green = Completed
        </div>
      </CardContent>
    </Card>
  );
}
