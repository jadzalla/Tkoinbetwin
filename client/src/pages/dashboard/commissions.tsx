import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, TrendingUp, DollarSign, Award, Calendar, ArrowUpDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { Agent, Transaction } from "@shared/schema";
import { format } from "date-fns";

interface CommissionsProps {
  agent: Agent;
}

export default function Commissions({ agent }: CommissionsProps) {
  const [sortBy, setSortBy] = useState<"date" | "commission">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  
  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/agents/me/transactions"],
  });

  // Safe number formatting
  const formatAmount = (value: string | null | undefined, decimals: number = 4): string => {
    if (!value) return "0." + "0".repeat(decimals);
    try {
      const num = parseFloat(value);
      if (isNaN(num)) return "0." + "0".repeat(decimals);
      return num.toFixed(decimals);
    } catch {
      return "0." + "0".repeat(decimals);
    }
  };

  // Calculate commission totals
  const commissionStats = transactions.reduce(
    (acc, tx) => {
      const commission = parseFloat(tx.commissionAmount || "0");
      acc.total += commission;
      
      if (tx.type === "deposit") {
        acc.byType.deposit += commission;
      } else if (tx.type === "withdrawal") {
        acc.byType.withdrawal += commission;
      } else if (tx.type === "agent_transfer") {
        acc.byType.agent_transfer += commission;
      }
      
      if (tx.status === "completed") {
        acc.completed += commission;
      } else if (tx.status === "pending") {
        acc.pending += commission;
      }
      
      return acc;
    },
    {
      total: 0,
      completed: 0,
      pending: 0,
      byType: {
        deposit: 0,
        withdrawal: 0,
        agent_transfer: 0,
      },
    }
  );

  // Monthly earnings (last 6 months) - use YYYY-MM format for reliable sorting
  const monthlyEarnings = transactions.reduce<Record<string, { amount: number; sortKey: string; display: string }>>((acc, tx) => {
    if (!tx.createdAt) return acc;
    const date = new Date(tx.createdAt);
    const sortKey = format(date, "yyyy-MM"); // Sortable format
    const display = format(date, "MMM yyyy"); // Display format
    const commission = parseFloat(tx.commissionAmount || "0");
    
    if (!acc[sortKey]) {
      acc[sortKey] = { amount: 0, sortKey, display };
    }
    acc[sortKey].amount += commission;
    return acc;
  }, {});

  // Tier progression
  const tierLimits = {
    basic: { daily: 10000, monthly: 250000, nextTier: "verified" },
    verified: { daily: 50000, monthly: 1500000, nextTier: "premium" },
    premium: { daily: -1, monthly: -1, nextTier: null },
  };

  const currentTier = tierLimits[agent.verificationTier as keyof typeof tierLimits] || tierLimits.basic;
  const currentMonthVolume = transactions
    .filter((tx) => {
      if (!tx.createdAt) return false;
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      return (
        txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, tx) => sum + parseFloat(tx.tkoinAmount || "0"), 0);

  const tierProgress =
    currentTier.monthly > 0
      ? Math.min((currentMonthVolume / currentTier.monthly) * 100, 100)
      : 100;

  // CSV escaping helper
  const escapeCsvValue = (value: string): string => {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Export commission history
  const handleExport = () => {
    const csv = [
      ["Date", "Type", "Status", "Amount", "Commission", "Wallet"],
      ...transactions.map((tx) => [
        tx.createdAt ? format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm:ss") : "",
        tx.type,
        tx.status,
        formatAmount(tx.tkoinAmount, 4),
        formatAmount(tx.commissionAmount, 4),
        tx.userWallet || "",
      ]),
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Loading commissions...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">
            Commission Dashboard
          </h1>
          <p className="text-muted-foreground">Track your earnings and tier progression</p>
        </div>
        <Button onClick={handleExport} variant="outline" data-testid="button-export">
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card data-testid="card-total-commissions">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Commissions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-commissions">
              {formatAmount(commissionStats.total.toString(), 4)} TKOIN
            </div>
            <p className="text-xs text-muted-foreground mt-1">All-time earnings</p>
          </CardContent>
        </Card>

        <Card data-testid="card-completed-commissions">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-completed-commissions">
              {formatAmount(commissionStats.completed.toString(), 4)} TKOIN
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {commissionStats.pending > 0 && (
                <span data-testid="text-pending-commissions">
                  {formatAmount(commissionStats.pending.toString(), 4)} pending
                </span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-current-tier">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Tier</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize" data-testid="text-current-tier">
              {agent.verificationTier}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentTier.nextTier ? `Next: ${currentTier.nextTier}` : "Maximum tier"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Progression */}
      {currentTier.nextTier && (
        <Card data-testid="card-tier-progression">
          <CardHeader>
            <CardTitle>Tier Progression</CardTitle>
            <CardDescription>
              Progress towards {currentTier.nextTier} tier (Monthly volume requirement:{" "}
              {currentTier.monthly.toLocaleString()} TKOIN)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" data-testid="text-progress-label">
                  {currentMonthVolume.toFixed(2)} / {currentTier.monthly.toLocaleString()} TKOIN
                </span>
                <span className="text-sm text-muted-foreground" data-testid="text-progress-percentage">
                  {tierProgress.toFixed(1)}%
                </span>
              </div>
              <Progress value={tierProgress} className="h-2" data-testid="progress-tier" />
            </div>
            <p className="text-xs text-muted-foreground">
              Complete {(currentTier.monthly - currentMonthVolume).toFixed(2)} more TKOIN in
              volume this month to reach {currentTier.nextTier} tier
            </p>
          </CardContent>
        </Card>
      )}

      {/* Commission Breakdown */}
      <Card data-testid="card-commission-breakdown">
        <CardHeader>
          <CardTitle>Commission Breakdown by Type</CardTitle>
          <CardDescription>Earnings by transaction category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="badge-deposit">
                  Deposit
                </Badge>
                <span className="text-sm text-muted-foreground">Customer deposits</span>
              </div>
              <span className="font-mono font-semibold" data-testid="text-deposit-commissions">
                {formatAmount(commissionStats.byType.deposit.toString(), 4)} TKOIN
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="badge-withdrawal">
                  Withdrawal
                </Badge>
                <span className="text-sm text-muted-foreground">Customer withdrawals</span>
              </div>
              <span className="font-mono font-semibold" data-testid="text-withdrawal-commissions">
                {formatAmount(commissionStats.byType.withdrawal.toString(), 4)} TKOIN
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="badge-transfer">
                  Agent Transfer
                </Badge>
                <span className="text-sm text-muted-foreground">Inter-agent transfers</span>
              </div>
              <span className="font-mono font-semibold" data-testid="text-transfer-commissions">
                {formatAmount(commissionStats.byType.agent_transfer.toString(), 4)} TKOIN
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Earnings Chart */}
      <Card data-testid="card-monthly-earnings-chart">
        <CardHeader>
          <CardTitle>Monthly Earnings Chart</CardTitle>
          <CardDescription>Commission trends over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          {Object.keys(monthlyEarnings).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-chart-data">
              No commission history yet
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={Object.values(monthlyEarnings)
                  .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
                  .slice(-6)}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="display" 
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: "currentColor" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-background border rounded-lg p-2 shadow-lg">
                          <p className="text-sm font-medium">{payload[0].payload.display}</p>
                          <p className="text-sm text-primary font-semibold">
                            {formatAmount(payload[0].value?.toString() || "0", 4)} TKOIN
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Commission History Table */}
      <Card data-testid="card-commission-history">
        <CardHeader>
          <CardTitle>Commission History</CardTitle>
          <CardDescription>Detailed record of all your commission earnings</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.filter(tx => parseFloat(tx.commissionAmount || "0") > 0).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-history">
              No commissions earned yet
            </p>
          ) : (
            <>
              <div className="flex justify-end gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("date");
                      setSortOrder("desc");
                    }
                  }}
                  data-testid="button-sort-date"
                >
                  <ArrowUpDown className="mr-2 h-3 w-3" />
                  Date {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (sortBy === "commission") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("commission");
                      setSortOrder("desc");
                    }
                  }}
                  data-testid="button-sort-commission"
                >
                  <ArrowUpDown className="mr-2 h-3 w-3" />
                  Commission {sortBy === "commission" && (sortOrder === "asc" ? "↑" : "↓")}
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Date</th>
                        <th className="text-left p-3 text-sm font-medium">Type</th>
                        <th className="text-left p-3 text-sm font-medium">Status</th>
                        <th className="text-right p-3 text-sm font-medium">Amount</th>
                        <th className="text-right p-3 text-sm font-medium">Commission</th>
                        <th className="text-left p-3 text-sm font-medium">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions
                        .filter(tx => parseFloat(tx.commissionAmount || "0") > 0)
                        .sort((a, b) => {
                          if (sortBy === "date") {
                            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
                          } else {
                            const commA = parseFloat(a.commissionAmount || "0");
                            const commB = parseFloat(b.commissionAmount || "0");
                            return sortOrder === "asc" ? commA - commB : commB - commA;
                          }
                        })
                        .map((tx) => (
                          <tr
                            key={tx.id}
                            className="border-t hover-elevate"
                            data-testid={`row-commission-${tx.id}`}
                          >
                            <td className="p-3 text-sm">
                              {tx.createdAt ? format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm") : "N/A"}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-xs">
                                {tx.type}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  tx.status === "completed"
                                    ? "default"
                                    : tx.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="text-xs"
                              >
                                {tx.status}
                              </Badge>
                            </td>
                            <td className="p-3 text-sm text-right font-mono">
                              {formatAmount(tx.tkoinAmount, 4)} TKOIN
                            </td>
                            <td className="p-3 text-sm text-right font-mono font-semibold text-green-600 dark:text-green-400">
                              +{formatAmount(tx.commissionAmount, 4)} TKOIN
                            </td>
                            <td className="p-3 text-sm text-muted-foreground font-mono truncate max-w-[150px]">
                              {tx.userWallet || "N/A"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
