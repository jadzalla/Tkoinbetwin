import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Coins, TrendingUp, TrendingDown, Clock, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import type { Agent, Transaction } from "@shared/schema";
import { format, subDays, startOfDay, endOfDay, isWithinInterval } from "date-fns";

interface TransactionsProps {
  agent: Agent;
}

const ITEMS_PER_PAGE = 10;

export default function Transactions({ agent }: TransactionsProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Safe number formatting helper
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

  const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/agents/me/transactions"],
  });

  const filteredTransactions = transactions.filter((tx) => {
    // Type filter
    if (typeFilter !== "all" && tx.type !== typeFilter) return false;
    
    // Status filter
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    
    // Search filter
    if (searchQuery && !tx.id.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !tx.userWallet?.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Date range filter
    if (dateRange !== "all" && tx.createdAt) {
      const txDate = new Date(tx.createdAt);
      const now = new Date();
      let rangeStart: Date;
      let rangeEnd = endOfDay(now);
      
      switch (dateRange) {
        case "today":
          rangeStart = startOfDay(now);
          break;
        case "7days":
          rangeStart = startOfDay(subDays(now, 7));
          break;
        case "30days":
          rangeStart = startOfDay(subDays(now, 30));
          break;
        case "90days":
          rangeStart = startOfDay(subDays(now, 90));
          break;
        default:
          return true;
      }
      
      if (!isWithinInterval(txDate, { start: rangeStart, end: rangeEnd })) {
        return false;
      }
    }
    
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const resetPagination = () => {
    setCurrentPage(1);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "deposit":
        return <TrendingDown className="h-4 w-4" />;
      case "withdrawal":
        return <TrendingUp className="h-4 w-4" />;
      case "mint":
      case "burn":
        return <Coins className="h-4 w-4" />;
      default:
        return <Coins className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      completed: { variant: "default", icon: CheckCircle2 },
      pending: { variant: "secondary", icon: Clock },
      processing: { variant: "secondary", icon: AlertCircle },
      failed: { variant: "destructive", icon: XCircle },
    };
    const config = configs[status] || { variant: "outline" as const, icon: AlertCircle };
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} data-testid={`badge-status-${status}`} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      agent_transfer: "Agent Transfer",
      deposit: "Customer Deposit",
      withdrawal: "Withdrawal",
      mint: "Mint Tokens",
      burn: "Burn Tokens",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Transaction History</h1>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loading transactions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">Transaction History</h1>
        <p className="text-muted-foreground">View and filter your transaction history</p>
      </div>

      <Card data-testid="card-filters">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="type-filter">Transaction Type</Label>
              <Select value={typeFilter} onValueChange={(val) => { setTypeFilter(val); resetPagination(); }}>
                <SelectTrigger id="type-filter" data-testid="select-type-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="agent_transfer">Agent Transfer</SelectItem>
                  <SelectItem value="deposit">Customer Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="mint">Mint</SelectItem>
                  <SelectItem value="burn">Burn</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status-filter">Status</Label>
              <Select value={statusFilter} onValueChange={(val) => { setStatusFilter(val); resetPagination(); }}>
                <SelectTrigger id="status-filter" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="date-range">Date Range</Label>
              <Select value={dateRange} onValueChange={(val) => { setDateRange(val); resetPagination(); }}>
                <SelectTrigger id="date-range" data-testid="select-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7days">Last 7 Days</SelectItem>
                  <SelectItem value="30days">Last 30 Days</SelectItem>
                  <SelectItem value="90days">Last 90 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search by ID or wallet..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); resetPagination(); }}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filteredTransactions.length === 0 ? (
          <Card data-testid="card-no-transactions">
            <CardContent className="py-12 text-center">
              <Coins className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {transactions.length === 0
                  ? "No transactions yet"
                  : "No transactions match your filters"}
              </p>
            </CardContent>
          </Card>
        ) : (
          paginatedTransactions.map((tx) => (
            <Card key={tx.id} data-testid={`card-transaction-${tx.id}`} className="hover-elevate">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {getTypeIcon(tx.type)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold" data-testid={`text-type-${tx.id}`}>
                            {getTypeLabel(tx.type)}
                          </p>
                          {getStatusBadge(tx.status)}
                        </div>
                        <p className="text-sm text-muted-foreground" data-testid={`text-date-${tx.id}`}>
                          {tx.createdAt ? format(new Date(tx.createdAt), "PPp") : "N/A"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">TKOIN Amount</p>
                        <p className="font-mono text-sm font-semibold" data-testid={`text-tkoin-${tx.id}`}>
                          {formatAmount(tx.tkoinAmount, 4)} TKOIN
                        </p>
                      </div>

                      {tx.commissionAmount && parseFloat(tx.commissionAmount || "0") > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Commission Earned</p>
                          <p className="font-mono text-sm font-semibold text-green-600 dark:text-green-400" data-testid={`text-commission-${tx.id}`}>
                            +{formatAmount(tx.commissionAmount, 4)} TKOIN
                          </p>
                        </div>
                      )}

                      {tx.burnAmount && parseFloat(tx.burnAmount || "0") > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground">Burn Amount</p>
                          <p className="font-mono text-sm font-semibold text-amber-600 dark:text-amber-400" data-testid={`text-burn-${tx.id}`}>
                            {formatAmount(tx.burnAmount, 4)} TKOIN
                          </p>
                        </div>
                      )}

                      {tx.creditsAmount && (
                        <div>
                          <p className="text-xs text-muted-foreground">Credits</p>
                          <p className="font-mono text-sm font-semibold" data-testid={`text-credits-${tx.id}`}>
                            {formatAmount(tx.creditsAmount, 2)}
                          </p>
                        </div>
                      )}
                    </div>

                    {tx.userWallet && (
                      <div>
                        <p className="text-xs text-muted-foreground">Customer Wallet</p>
                        <p className="font-mono text-xs" data-testid={`text-wallet-${tx.id}`}>
                          {tx.userWallet.slice(0, 8)}...{tx.userWallet.slice(-8)}
                        </p>
                      </div>
                    )}

                    {tx.solanaSignature && (
                      <div>
                        <p className="text-xs text-muted-foreground">Solana Signature</p>
                        <p className="font-mono text-xs truncate" data-testid={`text-signature-${tx.id}`}>
                          {tx.solanaSignature}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Transaction ID</p>
                    <p className="font-mono text-xs" data-testid={`text-id-${tx.id}`}>
                      {tx.id.slice(0, 8)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredTransactions.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground" data-testid="text-count">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredTransactions.length)} of {filteredTransactions.length} transaction(s)
              </p>
              
              {totalPages > 1 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  
                  <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
