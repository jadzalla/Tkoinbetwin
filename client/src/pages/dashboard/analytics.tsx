import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer 
} from "recharts";
import { TrendingUp, Users, DollarSign, Repeat, Calendar } from "lucide-react";
import type { Agent, Transaction } from "@shared/schema";
import { format, subDays, startOfDay, endOfDay } from "date-fns";

interface AnalyticsProps {
  agent: Agent;
}

type EnrichedTransaction = Transaction & { fiatCurrency?: string | null; fiatAmount?: string | null };

export default function Analytics({ agent }: AnalyticsProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  
  const { data: transactions = [], isLoading } = useQuery<EnrichedTransaction[]>({
    queryKey: ["/api/agents/me/analytics"],
  });

  // Safe number formatting
  const formatAmount = (value: string | number | null | undefined, decimals: number = 4): string => {
    if (!value) return "0." + "0".repeat(decimals);
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return "0." + "0".repeat(decimals);
    return num.toFixed(decimals);
  };

  // Filter by time range
  const getFilteredTransactions = () => {
    if (timeRange === "all") return transactions;
    
    const now = new Date();
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const startDate = startOfDay(subDays(now, days));
    
    return transactions.filter(tx => {
      if (!tx.createdAt) return false;
      return new Date(tx.createdAt) >= startDate;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // Transaction Volume Trends (daily aggregation)
  const volumeTrends = filteredTransactions.reduce<Record<string, { sortKey: string; displayDate: string; volume: number; count: number }>>((acc, tx) => {
    if (!tx.createdAt) return acc;
    const date = new Date(tx.createdAt);
    const sortKey = format(date, "yyyy-MM-dd"); // Sortable key
    const displayDate = format(date, "MMM dd"); // Display label
    const amount = parseFloat(tx.tkoinAmount || "0");
    
    if (!acc[sortKey]) {
      acc[sortKey] = { sortKey, displayDate, volume: 0, count: 0 };
    }
    acc[sortKey].volume += amount;
    acc[sortKey].count += 1;
    return acc;
  }, {});

  const volumeChartData = Object.values(volumeTrends)
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey)); // Sort by YYYY-MM-DD

  // Currency Distribution (from payment requests)
  const currencyDistribution = filteredTransactions.reduce<Record<string, number>>((acc, tx) => {
    // Use fiat currency if available, otherwise count as TKOIN
    const currency = tx.fiatCurrency || "TKOIN";
    const amount = tx.fiatAmount 
      ? parseFloat(tx.fiatAmount) 
      : parseFloat(tx.tkoinAmount || "0");
    acc[currency] = (acc[currency] || 0) + amount;
    return acc;
  }, {});

  const currencyChartData = Object.entries(currencyDistribution).map(([currency, amount]) => ({
    name: currency,
    value: parseFloat(amount.toFixed(2)),
  }));

  const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#82ca9d", "#ffc658", "#ff8042", "#8884d8"];

  // Customer Retention Metrics
  const customerActivity = filteredTransactions.reduce<Record<string, { count: number; firstSeen: Date }>>((acc, tx) => {
    if (!tx.userWallet) return acc;
    
    const txDate = tx.createdAt ? new Date(tx.createdAt) : new Date();
    if (!acc[tx.userWallet]) {
      acc[tx.userWallet] = { count: 0, firstSeen: txDate };
    }
    
    acc[tx.userWallet].count += 1;
    if (txDate < acc[tx.userWallet].firstSeen) {
      acc[tx.userWallet].firstSeen = txDate;
    }
    
    return acc;
  }, {});

  const totalCustomers = Object.keys(customerActivity).length;
  const repeatCustomers = Object.values(customerActivity).filter(c => c.count > 1).length;
  const repeatRate = totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0;

  // New vs Returning customers (for the time range)
  const rangeStartDate = timeRange === "all" 
    ? new Date(0) 
    : startOfDay(subDays(new Date(), timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90));
  
  const newCustomers = Object.entries(customerActivity).filter(([_, data]) => 
    data.firstSeen >= rangeStartDate
  ).length;

  const returningCustomers = totalCustomers - newCustomers;

  // Profitability Analysis
  const profitData = filteredTransactions.reduce((acc, tx) => {
    const revenue = parseFloat(tx.commissionAmount || "0");
    const volume = parseFloat(tx.tkoinAmount || "0");
    
    acc.totalRevenue += revenue;
    acc.totalVolume += volume;
    
    if (tx.type === "purchase") acc.purchases += volume;
    if (tx.type === "redemption") acc.redemptions += volume;
    
    return acc;
  }, { totalRevenue: 0, totalVolume: 0, purchases: 0, redemptions: 0 });

  const avgCommissionRate = profitData.totalVolume > 0 
    ? (profitData.totalRevenue / profitData.totalVolume) * 100 
    : 0;

  // Transaction type breakdown for profitability
  const typeBreakdown = filteredTransactions.reduce<Record<string, { count: number; volume: number; commission: number }>>((acc, tx) => {
    const type = tx.type;
    if (!acc[type]) {
      acc[type] = { count: 0, volume: 0, commission: 0 };
    }
    
    acc[type].count += 1;
    acc[type].volume += parseFloat(tx.tkoinAmount || "0");
    acc[type].commission += parseFloat(tx.commissionAmount || "0");
    
    return acc;
  }, {});

  const profitByTypeData = Object.entries(typeBreakdown).map(([type, data]) => ({
    type,
    volume: parseFloat(data.volume.toFixed(4)),
    commission: parseFloat(data.commission.toFixed(4)),
    count: data.count,
  }));

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="page-analytics">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="title-analytics">Analytics Dashboard</h1>
          <p className="text-muted-foreground">Insights into your agent performance</p>
        </div>
        
        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
          <SelectTrigger className="w-32" data-testid="select-time-range">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
            <SelectItem value="90d">Last 90 Days</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-customers">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-total-customers">{totalCustomers}</div>
            <p className="text-xs text-muted-foreground">
              {newCustomers} new in period
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-repeat-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Repeat Rate</CardTitle>
            <Repeat className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-repeat-rate">{repeatRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {repeatCustomers} of {totalCustomers} customers
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-total-commissions">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono" data-testid="value-total-commissions">
              {formatAmount(profitData.totalRevenue, 4)} TKOIN
            </div>
            <p className="text-xs text-muted-foreground">
              Commission earnings
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-commission-rate">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Commission Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="value-commission-rate">
              {avgCommissionRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Effective rate on volume
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Volume Trends */}
      <Card data-testid="card-volume-trends">
        <CardHeader>
          <CardTitle>Transaction Volume Trends</CardTitle>
          <CardDescription>Daily transaction volume and count</CardDescription>
        </CardHeader>
        <CardContent>
          {volumeChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-volume-data">
              No transaction data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={volumeChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="displayDate" 
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                />
                <YAxis 
                  yAxisId="left"
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                  label={{ value: "Volume (TKOIN)", angle: -90, position: "insideLeft" }}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                  label={{ value: "Count", angle: 90, position: "insideRight" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{payload[0].payload.displayDate}</p>
                          <p className="text-sm text-primary">
                            Volume: {formatAmount(payload[0].value?.toString() || "0", 4)} TKOIN
                          </p>
                          <p className="text-sm text-secondary">
                            Count: {payload[1]?.value || 0} transactions
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="volume"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
                  name="Volume"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--secondary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--secondary))", r: 3 }}
                  name="Count"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Currency Distribution */}
        <Card data-testid="card-currency-distribution">
          <CardHeader>
            <CardTitle>Currency Distribution</CardTitle>
            <CardDescription>Transaction volume by currency</CardDescription>
          </CardHeader>
          <CardContent>
            {currencyChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-currency-data">
                No currency data available
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={currencyChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {currencyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const currency = payload[0].name as string;
                        const value = payload[0].value as number;
                        return (
                          <div className="bg-background border rounded-lg p-2 shadow-lg">
                            <p className="text-sm font-medium">{currency}</p>
                            <p className="text-sm text-primary">
                              {currency === "TKOIN" 
                                ? `${formatAmount(value.toString(), 4)} TKOIN`
                                : `${value.toFixed(2)} ${currency}`
                              }
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Customer Retention */}
        <Card data-testid="card-customer-retention">
          <CardHeader>
            <CardTitle>Customer Retention</CardTitle>
            <CardDescription>New vs returning customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="font-medium">New Customers</span>
                </div>
                <Badge variant="outline" data-testid="badge-new-customers">
                  {newCustomers}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Returning Customers</span>
                </div>
                <Badge variant="outline" data-testid="badge-returning-customers">
                  {returningCustomers}
                </Badge>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">Retention Rate</span>
                  <span className="font-semibold">{repeatRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${repeatRate}%` }}
                    data-testid="bar-retention-rate"
                  ></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Analysis */}
      <Card data-testid="card-commission-analysis">
        <CardHeader>
          <CardTitle>Commission Analysis by Transaction Type</CardTitle>
          <CardDescription>Volume and commission earnings breakdown (cost data not included)</CardDescription>
        </CardHeader>
        <CardContent>
          {profitByTypeData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-commission-data">
              No commission data available
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitByTypeData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="type" 
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                  label={{ value: "TKOIN", angle: -90, position: "insideLeft" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-3 shadow-lg">
                          <p className="text-sm font-medium mb-2">{payload[0].payload.type}</p>
                          <p className="text-sm text-primary">
                            Volume: {formatAmount(payload[0].value?.toString() || "0", 4)} TKOIN
                          </p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            Commission: {formatAmount(payload[1].value?.toString() || "0", 4)} TKOIN
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Count: {payload[0].payload.count} transactions
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="volume" fill="hsl(var(--primary))" name="Volume" radius={[4, 4, 0, 0]} />
                <Bar dataKey="commission" fill="hsl(var(--chart-2))" name="Commission" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
