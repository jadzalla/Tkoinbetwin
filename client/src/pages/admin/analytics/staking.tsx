import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { ArrowLeft, TrendingUp, Users, Shield, AlertTriangle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Type definitions
interface StakingOverview {
  totalStaked: number;
  activeAgents: number;
  averageStake: number;
  tierDistribution: {
    tier: string;
    count: number;
    totalStaked: number;
  }[];
}

interface StakingTrend {
  date: string;
  totalStaked: number;
  activeAgents: number;
}

interface AgentHealthMetrics {
  totalAtRisk: number;
  highRisk: number;
  mediumRisk: number;
  agents: {
    agentId: string;
    agentEmail: string;
    agentName: string;
    currentTier: string;
    stakedTokens: number;
    riskLevel: string;
    distanceFromDowngrade: number;
  }[];
}

interface StakingActivity {
  id: string;
  agentId: string;
  agentEmail: string;
  agentName: string;
  operationType: string;
  amount: string;
  amountTokens: number;
  previousTier: string | null;
  newTier: string | null;
  timestamp: string;
}

const TIER_COLORS = {
  basic: '#8B5CF6', // Purple
  verified: '#3B82F6', // Blue
  premium: '#F59E0B', // Amber
};

export default function StakingAnalytics() {
  const { user, isLoading: authLoading } = useAuth();

  // Fetch staking overview
  const { data: overview, isLoading: overviewLoading } = useQuery<StakingOverview>({
    queryKey: ["/api/admin/analytics/staking/overview"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/staking/overview", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch staking overview");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch staking trends
  const { data: trends, isLoading: trendsLoading } = useQuery<StakingTrend[]>({
    queryKey: ["/api/admin/analytics/staking/trends"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/staking/trends", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch staking trends");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch agent health metrics
  const { data: health, isLoading: healthLoading } = useQuery<AgentHealthMetrics>({
    queryKey: ["/api/admin/analytics/staking/health"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/staking/health", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch agent health metrics");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch recent activity
  const { data: activity, isLoading: activityLoading } = useQuery<StakingActivity[]>({
    queryKey: ["/api/admin/analytics/staking/activity"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics/staking/activity", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch staking activity");
      return res.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Access control
  if (!authLoading && !user?.isAdmin) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  // Format datetime
  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, HH:mm');
    } catch {
      return dateString;
    }
  };

  // Prepare pie chart data
  const pieData = overview?.tierDistribution.map(t => ({
    name: t.tier.charAt(0).toUpperCase() + t.tier.slice(1),
    value: t.count,
    tokens: t.totalStaked,
  })) || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin" data-testid="link-back-admin">
            <button className="hover-elevate active-elevate-2 p-2 rounded-md" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold" data-testid="heading-staking-analytics">Staking Analytics</h1>
            <p className="text-muted-foreground">Monitor agent staking health and trends</p>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Staked */}
        <Card data-testid="card-total-staked">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staked</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-total-staked">
                  {formatNumber(overview?.totalStaked || 0)} TKOIN
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Locked in agent stakes
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Active Agents */}
        <Card data-testid="card-active-agents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agents</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-active-agents">
                  {overview?.activeAgents || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Agents with active stakes
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Stake */}
        <Card data-testid="card-average-stake">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Stake</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-average-stake">
                  {formatNumber(overview?.averageStake || 0)} TKOIN
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Per active agent
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* At-Risk Agents */}
        <Card data-testid="card-at-risk-agents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At-Risk Agents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive" data-testid="text-at-risk-agents">
                  {health?.totalAtRisk || 0}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {health?.highRisk || 0} high, {health?.mediumRisk || 0} medium
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staking Trends Chart */}
        <Card data-testid="card-trends-chart">
          <CardHeader>
            <CardTitle>Staking Trends (30 Days)</CardTitle>
            <CardDescription>Total staked TKOIN over time</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trends || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(date) => format(new Date(date), 'MMM dd')}
                  />
                  <YAxis tickFormatter={(value) => formatNumber(value)} />
                  <Tooltip 
                    formatter={(value: number) => formatNumber(value) + ' TKOIN'}
                    labelFormatter={(label) => formatDate(label)}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalStaked" 
                    stroke="#8B5CF6" 
                    name="Total Staked"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tier Distribution Pie Chart */}
        <Card data-testid="card-tier-distribution">
          <CardHeader>
            <CardTitle>Tier Distribution</CardTitle>
            <CardDescription>Agents by verification tier</CardDescription>
          </CardHeader>
          <CardContent>
            {overviewLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={TIER_COLORS[entry.name.toLowerCase() as keyof typeof TIER_COLORS]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name, props: any) => [
                    `${value} agents (${formatNumber(props.payload.tokens)} TKOIN)`,
                    props.payload.name
                  ]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Agents Table */}
      {health && health.totalAtRisk > 0 && (
        <Card data-testid="card-at-risk-table">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              At-Risk Agents
            </CardTitle>
            <CardDescription>
              Agents close to tier downgrade thresholds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Current Tier</TableHead>
                  <TableHead>Staked Amount</TableHead>
                  <TableHead>Distance from Downgrade</TableHead>
                  <TableHead>Risk Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {health.agents.map((agent) => (
                  <TableRow key={agent.agentId} data-testid={`row-at-risk-${agent.agentId}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{agent.agentName}</div>
                        <div className="text-sm text-muted-foreground">{agent.agentEmail}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-tier-${agent.agentId}`}>
                        {agent.currentTier}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatNumber(agent.stakedTokens)} TKOIN</TableCell>
                    <TableCell>{formatNumber(agent.distanceFromDowngrade)} TKOIN</TableCell>
                    <TableCell>
                      <Badge 
                        variant={agent.riskLevel === 'high' ? 'destructive' : 'secondary'}
                        data-testid={`badge-risk-${agent.agentId}`}
                      >
                        {agent.riskLevel}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card data-testid="card-recent-activity">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Staking Activity
          </CardTitle>
          <CardDescription>Latest stake changes across all agents</CardDescription>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Operation</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Tier Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity && activity.length > 0 ? (
                  activity.map((item) => (
                    <TableRow key={item.id} data-testid={`row-activity-${item.id}`}>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(item.timestamp)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{item.agentName}</div>
                          <div className="text-sm text-muted-foreground">{item.agentEmail}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" data-testid={`badge-operation-${item.id}`}>
                          {item.operationType}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatNumber(item.amountTokens)} TKOIN</TableCell>
                      <TableCell>
                        {item.previousTier && item.newTier && item.previousTier !== item.newTier ? (
                          <span className="text-sm">
                            {item.previousTier} → {item.newTier}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">No change</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No recent activity
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
