import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, TrendingDown, AlertTriangle, Users } from "lucide-react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

// Type definitions
interface SlashingOverview {
  totalSlashingEvents: number;
  totalSlashedAmount: string;
  averageSlashAmount: string;
  pendingEvents: number;
  executedEvents: number;
  reversedEvents: number;
}

interface ViolationBreakdown {
  violationType: string;
  count: number;
  totalSlashed: string;
  averageSlashed: string;
}

interface SeverityBreakdown {
  severity: string;
  count: number;
  totalSlashed: string;
  percentage: number;
}

interface SlashingTrend {
  date: string;
  count: number;
  slashedAmount: string;
}

interface AgentViolationHistory {
  agentId: string;
  agentName: string;
  totalViolations: number;
  totalSlashed: string;
  lastViolationDate: string | null;
  mostCommonViolation: string;
}

interface RecentSlashingEvent {
  id: string;
  agentId: string;
  agentName: string | null;
  violationType: string;
  severity: string;
  slashedAmount: string;
  status: string;
  createdAt: Date;
}

export default function SlashingAnalytics() {
  const { user, isLoading: authLoading } = useAuth();

  // Format numbers (handle string or number input)
  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // Fetch slashing overview
  const { data: overview, isLoading: overviewLoading } = useQuery<SlashingOverview>({
    queryKey: ["/api/admin/analytics/slashing/overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/overview", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch slashing overview");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch violation breakdown
  const { data: violations, isLoading: violationsLoading } = useQuery<ViolationBreakdown[]>({
    queryKey: ["/api/admin/analytics/slashing/violations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/violations", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch violation breakdown");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch severity breakdown
  const { data: severity, isLoading: severityLoading } = useQuery<SeverityBreakdown[]>({
    queryKey: ["/api/admin/analytics/slashing/severity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/severity", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch severity breakdown");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch slashing trends
  const { data: trends, isLoading: trendsLoading } = useQuery<SlashingTrend[]>({
    queryKey: ["/api/admin/analytics/slashing/trends"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/trends", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch slashing trends");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch agent violation history
  const { data: agents, isLoading: agentsLoading } = useQuery<AgentViolationHistory[]>({
    queryKey: ["/api/admin/analytics/slashing/agents"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/agents", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch agent violation history");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch recent slashing events
  const { data: recent, isLoading: recentLoading } = useQuery<RecentSlashingEvent[]>({
    queryKey: ["/api/admin/analytics/slashing/recent"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/slashing/recent", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch recent slashing events");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Access control
  if (!authLoading && !user?.isAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You do not have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const SEVERITY_COLORS = {
    minor: "#3b82f6",    // blue
    major: "#f59e0b",    // amber
    critical: "#ef4444", // red
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <ShieldAlert className="h-8 w-8 text-primary" />
          Slashing Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          Monitor violation patterns, penalty effectiveness, and agent compliance metrics
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-total-events">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-events">
                {overview?.totalSlashingEvents || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">All slashing events</p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-slashed">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Slashed</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-total-slashed">
                {formatNumber(overview?.totalSlashedAmount || "0")} TK
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Penalties collected</p>
          </CardContent>
        </Card>

        <Card data-testid="card-average-slash">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Penalty</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-average-slash">
                {formatNumber(overview?.averageSlashAmount || "0")} TK
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Per violation</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-events">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold" data-testid="text-pending-events">
                {overview?.pendingEvents || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.executedEvents || 0} executed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Severity Distribution Pie Chart */}
        <Card data-testid="card-severity-chart">
          <CardHeader>
            <CardTitle>Severity Distribution</CardTitle>
            <CardDescription>Breakdown of penalties by severity level</CardDescription>
          </CardHeader>
          <CardContent>
            {severityLoading ? (
              <Skeleton className="h-[300px]" />
            ) : severity && severity.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={severity}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ severity, percentage }) => 
                      `${severity.charAt(0).toUpperCase() + severity.slice(1)}: ${percentage.toFixed(1)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {severity.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={SEVERITY_COLORS[entry.severity as keyof typeof SEVERITY_COLORS] || "#999"}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No severity data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Slashing Trends Line Chart */}
        <Card data-testid="card-trends-chart">
          <CardHeader>
            <CardTitle>Slashing Trends</CardTitle>
            <CardDescription>30-day violation and penalty history</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-[300px]" />
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => format(new Date(value), "MMM dd")}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => format(new Date(value as string), "MMM dd, yyyy")}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#8b5cf6" 
                    name="Violations"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="slashedAmount" 
                    stroke="#ef4444" 
                    name="Slashed TK"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Violation Types Table */}
      <Card data-testid="card-violations-table">
        <CardHeader>
          <CardTitle>Violation Types</CardTitle>
          <CardDescription>Breakdown of executed penalties by violation category</CardDescription>
        </CardHeader>
        <CardContent>
          {violationsLoading ? (
            <Skeleton className="h-48" />
          ) : violations && violations.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="header-violation-type">Violation Type</TableHead>
                  <TableHead data-testid="header-count">Count</TableHead>
                  <TableHead data-testid="header-total-slashed">Total Slashed</TableHead>
                  <TableHead data-testid="header-avg-slashed">Avg Penalty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {violations.map((v, idx) => (
                  <TableRow key={idx} data-testid={`row-violation-${idx}`}>
                    <TableCell className="font-medium" data-testid={`text-violation-type-${idx}`}>
                      {v.violationType}
                    </TableCell>
                    <TableCell data-testid={`text-violation-count-${idx}`}>{v.count}</TableCell>
                    <TableCell data-testid={`text-violation-total-${idx}`}>
                      {formatNumber(v.totalSlashed)} TK
                    </TableCell>
                    <TableCell data-testid={`text-violation-avg-${idx}`}>
                      {formatNumber(v.averageSlashed)} TK
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No violations recorded
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Violation History Table */}
      <Card data-testid="card-agents-table">
        <CardHeader>
          <CardTitle>Agent Violation History</CardTitle>
          <CardDescription>Top agents with compliance violations</CardDescription>
        </CardHeader>
        <CardContent>
          {agentsLoading ? (
            <Skeleton className="h-64" />
          ) : agents && agents.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="header-agent-name">Agent</TableHead>
                  <TableHead data-testid="header-total-violations">Violations</TableHead>
                  <TableHead data-testid="header-total-penalties">Total Penalties</TableHead>
                  <TableHead data-testid="header-common-violation">Most Common</TableHead>
                  <TableHead data-testid="header-last-violation">Last Violation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent, idx) => (
                  <TableRow key={agent.agentId} data-testid={`row-agent-${idx}`}>
                    <TableCell className="font-medium" data-testid={`text-agent-name-${idx}`}>
                      {agent.agentName}
                    </TableCell>
                    <TableCell data-testid={`text-agent-violations-${idx}`}>
                      <Badge variant="secondary">{agent.totalViolations}</Badge>
                    </TableCell>
                    <TableCell data-testid={`text-agent-penalties-${idx}`}>
                      {formatNumber(agent.totalSlashed)} TK
                    </TableCell>
                    <TableCell data-testid={`text-agent-common-${idx}`}>
                      {agent.mostCommonViolation}
                    </TableCell>
                    <TableCell data-testid={`text-agent-last-${idx}`}>
                      {agent.lastViolationDate 
                        ? format(new Date(agent.lastViolationDate), "MMM dd, yyyy")
                        : "N/A"
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No agent violations recorded
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Events Table */}
      <Card data-testid="card-recent-table">
        <CardHeader>
          <CardTitle>Recent Slashing Events</CardTitle>
          <CardDescription>Latest penalty actions and status updates</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLoading ? (
            <Skeleton className="h-64" />
          ) : recent && recent.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="header-recent-date">Date</TableHead>
                  <TableHead data-testid="header-recent-agent">Agent</TableHead>
                  <TableHead data-testid="header-recent-violation">Violation</TableHead>
                  <TableHead data-testid="header-recent-severity">Severity</TableHead>
                  <TableHead data-testid="header-recent-amount">Amount</TableHead>
                  <TableHead data-testid="header-recent-status">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((event, idx) => (
                  <TableRow key={event.id} data-testid={`row-recent-${idx}`}>
                    <TableCell data-testid={`text-recent-date-${idx}`}>
                      {format(new Date(event.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell data-testid={`text-recent-agent-${idx}`}>
                      {event.agentName || event.agentId}
                    </TableCell>
                    <TableCell data-testid={`text-recent-violation-${idx}`}>
                      {event.violationType}
                    </TableCell>
                    <TableCell data-testid={`text-recent-severity-${idx}`}>
                      <Badge 
                        variant={
                          event.severity === "critical" ? "destructive" : 
                          event.severity === "major" ? "default" : "secondary"
                        }
                      >
                        {event.severity}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-recent-amount-${idx}`}>
                      {formatNumber(event.slashedAmount)} TK
                    </TableCell>
                    <TableCell data-testid={`text-recent-status-${idx}`}>
                      <Badge variant={event.status === "executed" ? "default" : "outline"}>
                        {event.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              No recent slashing events
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
