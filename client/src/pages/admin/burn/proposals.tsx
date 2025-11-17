import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  Flame,
  Calculator,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  TrendingDown,
} from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";
import { baseUnitsToTokens } from "@shared/token-utils";
import type { BurnProposal } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BurnCalculation = {
  proposedAmount: string;
  treasuryBalance: string;
  burnPercentage: string;
  withinLimits: boolean;
  reasons: string[];
};

export default function BurnProposalsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // State
  const [treasuryWallet, setTreasuryWallet] = useState(
    import.meta.env.VITE_SOLANA_TREASURY_WALLET || ""
  );
  const [reason, setReason] = useState("");
  const [calculation, setCalculation] = useState<BurnCalculation | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProposal, setSelectedProposal] = useState<BurnProposal | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch proposals
  const proposalsUrl = statusFilter !== "all" 
    ? `/api/admin/burn/proposals?status=${statusFilter}`
    : "/api/admin/burn/proposals";
  
  const { data: proposals, isLoading: proposalsLoading } = useQuery<BurnProposal[]>({
    queryKey: ["/api/admin/burn/proposals", { status: statusFilter }],
    queryFn: async () => {
      const response = await fetch(proposalsUrl);
      if (!response.ok) throw new Error("Failed to fetch proposals");
      return response.json();
    },
    enabled: !!user?.isAdmin,
  });

  // Fetch stats
  const { data: stats } = useQuery<{
    totalBurned: string;
    totalProposals: number;
    pendingProposals: number;
    approvedProposals: number;
  }>({
    queryKey: ["/api/admin/burn/stats"],
    enabled: !!user?.isAdmin,
  });

  // Calculate mutation
  const calculateMutation = useMutation({
    mutationFn: async (wallet: string): Promise<BurnCalculation> => {
      return await apiRequest("POST", "/api/admin/burn/calculate", {
        treasuryWallet: wallet,
      });
    },
    onSuccess: (data: BurnCalculation) => {
      setCalculation(data);
      if (!data.withinLimits) {
        toast({
          title: "Safety Limits Violated",
          description: data.reasons.join(", "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Calculation Complete",
          description: "Burn proposal is within safety limits",
        });
      }
    },
    onError: (error: Error) => {
      setCalculation(null); // Clear invalid calculation
      toast({
        title: "Calculation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Create proposal mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/admin/burn/proposals", {
        treasuryWallet,
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/stats"] });
      toast({
        title: "Proposal Created",
        description: "Burn proposal has been created and is pending approval",
      });
      setReason("");
      setCalculation(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("POST", `/api/admin/burn/proposals/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/stats"] });
      toast({
        title: "Proposal Approved",
        description: "Burn proposal has been approved for execution",
      });
      setIsApproveDialogOpen(false);
      setSelectedProposal(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/burn/proposals/${id}/reject`, {
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/stats"] });
      toast({
        title: "Proposal Rejected",
        description: "Burn proposal has been rejected",
      });
      setIsRejectDialogOpen(false);
      setSelectedProposal(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleCalculate = () => {
    if (!treasuryWallet) {
      toast({
        title: "Wallet Required",
        description: "Please enter a treasury wallet address",
        variant: "destructive",
      });
      return;
    }
    calculateMutation.mutate(treasuryWallet);
  };

  const handleCreate = () => {
    if (!reason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for this burn proposal",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" data-testid={`badge-status-pending`}>
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" data-testid={`badge-status-approved`}>
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" data-testid={`badge-status-rejected`}>
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      case "executed":
        return (
          <Badge variant="outline" className="border-green-500 text-green-600" data-testid={`badge-status-executed`}>
            <Flame className="h-3 w-3 mr-1" />
            Executed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (authLoading || proposalsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading proposals...</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pendingProposals = proposals?.filter((p) => p.status === "pending") || [];

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-burn-proposals">
          Burn Proposals
        </h1>
        <p className="text-muted-foreground">
          Create and manage token burn proposals with safety controls
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Burned
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-burned">
                {parseFloat(baseUnitsToTokens(stats.totalBurned)).toLocaleString()} TKOIN
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Proposals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-proposals">
                {stats.totalProposals}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600" data-testid="stat-pending">
                {stats.pendingProposals}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="stat-approved">
                {stats.approvedProposals}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Calculator & Create Form */}
        <div className="space-y-6">
          {/* Calculator */}
          <Card data-testid="card-calculator">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Burn Calculator
              </CardTitle>
              <CardDescription>
                Calculate proposed burn amount based on treasury balance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="treasuryWallet" data-testid="label-treasury-wallet">
                  Treasury Wallet Address
                </Label>
                <Input
                  id="treasuryWallet"
                  value={treasuryWallet}
                  onChange={(e) => setTreasuryWallet(e.target.value)}
                  placeholder="Enter Solana wallet address"
                  data-testid="input-treasury-wallet"
                />
              </div>

              <Button
                onClick={handleCalculate}
                disabled={calculateMutation.isPending}
                className="w-full"
                data-testid="button-calculate"
              >
                {calculateMutation.isPending ? "Calculating..." : "Calculate Burn"}
              </Button>

              {/* Calculation Results */}
              {calculation && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Treasury Balance:</span>
                    <span className="text-sm font-medium" data-testid="text-treasury-balance">
                      {parseFloat(baseUnitsToTokens(calculation.treasuryBalance)).toLocaleString()} TKOIN
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Burn Percentage:</span>
                    <span className="text-sm font-medium" data-testid="text-burn-percentage">
                      {calculation.burnPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Proposed Amount:</span>
                    <span className="text-sm font-bold text-primary" data-testid="text-proposed-amount">
                      {parseFloat(baseUnitsToTokens(calculation.proposedAmount)).toLocaleString()} TKOIN
                    </span>
                  </div>
                  <div className="pt-2">
                    {calculation.withinLimits ? (
                      <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
                        <CheckCircle className="h-4 w-4 text-green-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-green-600">Within Safety Limits</p>
                          {calculation.reasons?.[0] && (
                            <p className="text-muted-foreground mt-1">{calculation.reasons[0]}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                        <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-red-600">Safety Violations</p>
                          {calculation.reasons && calculation.reasons.length > 0 && (
                            <ul className="list-disc list-inside text-muted-foreground mt-1">
                              {calculation.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Proposal */}
          <Card data-testid="card-create-proposal">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5" />
                Create Burn Proposal
              </CardTitle>
              <CardDescription>
                Submit a new burn proposal for approval
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason" data-testid="label-reason">
                  Reason for Burn
                </Label>
                <Textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this burn is necessary..."
                  rows={4}
                  data-testid="textarea-reason"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum 10 characters required
                </p>
              </div>

              <Button
                onClick={handleCreate}
                disabled={
                  createMutation.isPending ||
                  !calculation ||
                  !calculation.withinLimits ||
                  reason.length < 10
                }
                className="w-full"
                data-testid="button-create-proposal"
              >
                {createMutation.isPending ? "Creating..." : "Create Proposal"}
              </Button>

              {!calculation && (
                <p className="text-sm text-muted-foreground text-center">
                  Calculate burn amount first
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Proposals List */}
        <Card data-testid="card-proposals-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Proposals
                {pendingProposals.length > 0 && (
                  <Badge variant="secondary" className="ml-2" data-testid="badge-pending-count">
                    {pendingProposals.length} Pending
                  </Badge>
                )}
              </CardTitle>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all">All</SelectItem>
                  <SelectItem value="pending" data-testid="option-pending">Pending</SelectItem>
                  <SelectItem value="approved" data-testid="option-approved">Approved</SelectItem>
                  <SelectItem value="rejected" data-testid="option-rejected">Rejected</SelectItem>
                  <SelectItem value="executed" data-testid="option-executed">Executed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!proposals || proposals.length === 0 ? (
              <div className="text-center py-12">
                <Flame className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No burn proposals found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((proposal) => (
                  <Card key={proposal.id} data-testid={`card-proposal-${proposal.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getStatusBadge(proposal.status)}
                            <span className="text-sm text-muted-foreground">
                              {new Date(proposal.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm font-medium">
                            {parseFloat(baseUnitsToTokens(proposal.proposedAmount)).toLocaleString()} TKOIN
                          </p>
                        </div>
                        {proposal.status === "pending" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedProposal(proposal);
                                setIsApproveDialogOpen(true);
                              }}
                              data-testid={`button-approve-${proposal.id}`}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                setSelectedProposal(proposal);
                                setIsRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-${proposal.id}`}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{proposal.reason}</p>
                      {proposal.rejectionReason && (
                        <p className="text-sm text-red-600 mt-2">
                          Rejected: {proposal.rejectionReason}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent data-testid="dialog-approve">
          <DialogHeader>
            <DialogTitle>Approve Burn Proposal</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve this burn proposal?
            </DialogDescription>
          </DialogHeader>
          {selectedProposal && (
            <div className="space-y-2 py-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Amount:</span>
                <span className="text-sm font-medium">
                  {parseFloat(baseUnitsToTokens(selectedProposal.proposedAmount)).toLocaleString()} TKOIN
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Reason:</span>
                <span className="text-sm font-medium">{selectedProposal.reason}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApproveDialogOpen(false)}
              data-testid="button-cancel-approve"
            >
              Cancel
            </Button>
            <Button
              onClick={() => selectedProposal && approveMutation.mutate(selectedProposal.id)}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent data-testid="dialog-reject">
          <DialogHeader>
            <DialogTitle>Reject Burn Proposal</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this proposal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Rejection Reason</Label>
              <Textarea
                id="rejectionReason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Explain why this proposal is being rejected..."
                rows={3}
                data-testid="textarea-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRejectDialogOpen(false);
                setRejectionReason("");
              }}
              data-testid="button-cancel-reject"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                selectedProposal &&
                rejectMutation.mutate({ id: selectedProposal.id, reason: rejectionReason })
              }
              disabled={rejectMutation.isPending || !rejectionReason}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? "Rejecting..." : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
