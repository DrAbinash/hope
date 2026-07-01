import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Eye, Download, Trash2, Clock, User, FileText, AlertCircle } from "lucide-react";

export interface AuditLog {
  id: string;
  timestamp: string;
  user: string;
  action: "view" | "download" | "upload" | "delete" | "edit" | "share";
  documentName: string;
  result: "success" | "failed";
  ipAddress?: string;
  userAgent?: string;
  details?: string;
}

interface AuditDashboardProps {
  logs: AuditLog[];
  isLoading?: boolean;
  onExport?: () => void;
}

export function AuditDashboard({ logs, isLoading = false, onExport }: AuditDashboardProps) {
  const [filterAction, setFilterAction] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = logs.filter((log) => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterUser && !log.user.toLowerCase().includes(filterUser.toLowerCase())) return false;
    if (dateFrom && new Date(log.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(log.timestamp) > new Date(dateTo)) return false;
    return true;
  });

  const actionStats = logs.reduce(
    (acc, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const userStats = logs.reduce(
    (acc, log) => {
      acc[log.user] = (acc[log.user] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const getActionIcon = (action: string) => {
    const icons: Record<string, JSX.Element> = {
      view: <Eye className="w-3 h-3" />,
      download: <Download className="w-3 h-3" />,
      delete: <Trash2 className="w-3 h-3" />,
      upload: <FileText className="w-3 h-3" />,
    };
    return icons[action] || <Clock className="w-3 h-3" />;
  };

  return (
    <div className="space-y-4">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Total Events</p>
            <p className="text-lg font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Unique Users</p>
            <p className="text-lg font-bold">{Object.keys(userStats).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Downloads</p>
            <p className="text-lg font-bold text-blue-600">{actionStats["download"] || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">Deletions</p>
            <p className="text-lg font-bold text-red-600">{actionStats["delete"] || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div>
              <Label className="text-xs">Action</Label>
              <Select value={filterAction || ""} onValueChange={(v) => setFilterAction(v || null)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Actions</SelectItem>
                  <SelectItem value="view">View</SelectItem>
                  <SelectItem value="download">Download</SelectItem>
                  <SelectItem value="upload">Upload</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="edit">Edit</SelectItem>
                  <SelectItem value="share">Share</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">User</Label>
              <Input
                placeholder="Filter by user"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="h-7 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-7 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => {
                setFilterAction(null);
                setFilterUser("");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Reset
            </Button>
            {onExport && (
              <Button size="sm" className="h-7 text-xs ml-auto" onClick={onExport}>
                Export Report
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Audit Logs ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No audit logs found</p>
            ) : (
              filtered.map((log) => (
                <div key={log.id} className="border rounded-lg p-2 text-xs hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getActionIcon(log.action)}
                        <span className="font-semibold capitalize">{log.action}</span>
                        <Badge
                          variant={log.result === "success" ? "secondary" : "destructive"}
                          className="text-xs"
                        >
                          {log.result}
                        </Badge>
                      </div>

                      <p className="text-muted-foreground mb-1">{log.documentName}</p>

                      <div className="flex flex-wrap gap-3 text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {log.user}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        {log.details && (
                          <span className="flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {log.details}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Users</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-2">
            {Object.entries(userStats)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([user, count]) => (
                <div key={user} className="flex items-center justify-between text-xs">
                  <span>{user}</span>
                  <Badge variant="secondary">{count} actions</Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
