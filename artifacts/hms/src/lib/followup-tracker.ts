export interface FollowUp {
  id: string;
  admissionId: number;
  patientId: number;
  patientName: string;
  diagnosis: string;
  followupDate: string;
  followupDays?: number;
  instructions: string;
  priority: "routine" | "urgent" | "critical";
  status: "pending" | "completed" | "rescheduled";
  createdDate: string;
  completedDate?: string;
  notes?: string;
  doctorId: number;
  doctorName: string;
}

export function getFollowupStatus(followupDate: string, status: string): "overdue" | "due-soon" | "pending" | "completed" {
  if (status === "completed") return "completed";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const followupDateObj = new Date(followupDate);
  followupDateObj.setHours(0, 0, 0, 0);
  
  const daysUntil = Math.floor((followupDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 3) return "due-soon";
  return "pending";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "overdue":
      return "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200";
    case "due-soon":
      return "bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200";
    case "pending":
      return "bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200";
    case "completed":
      return "bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200";
    default:
      return "bg-slate-100 dark:bg-slate-800";
  }
}

export function getPriorityIcon(priority: string): string {
  switch (priority) {
    case "critical":
      return "🚨";
    case "urgent":
      return "⚠️";
    case "routine":
      return "📋";
    default:
      return "•";
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-200 dark:bg-red-900 text-red-900 dark:text-red-200";
    case "urgent":
      return "bg-orange-200 dark:bg-orange-900 text-orange-900 dark:text-orange-200";
    case "routine":
      return "bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-200";
    default:
      return "bg-slate-200 dark:bg-slate-700";
  }
}

export function calculateDaysUntilFollowup(followupDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const followupDateObj = new Date(followupDate);
  followupDateObj.setHours(0, 0, 0, 0);
  
  return Math.floor((followupDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatFollowupDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { 
    weekday: "short", 
    year: "numeric", 
    month: "short", 
    day: "numeric" 
  });
}

export function sortFollowups(followups: FollowUp[]): FollowUp[] {
  return [...followups].sort((a, b) => {
    // Completed items go to the end
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    
    // Overdue first
    const statusA = getFollowupStatus(a.followupDate, a.status);
    const statusB = getFollowupStatus(b.followupDate, b.status);
    
    const statusOrder = { overdue: 0, "due-soon": 1, pending: 2, completed: 3 };
    if (statusOrder[statusA as keyof typeof statusOrder] !== statusOrder[statusB as keyof typeof statusOrder]) {
      return (statusOrder[statusA as keyof typeof statusOrder] || 999) - (statusOrder[statusB as keyof typeof statusOrder] || 999);
    }
    
    // Then by priority
    const priorityOrder = { critical: 0, urgent: 1, routine: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    
    // Then by follow-up date
    return new Date(a.followupDate).getTime() - new Date(b.followupDate).getTime();
  });
}
