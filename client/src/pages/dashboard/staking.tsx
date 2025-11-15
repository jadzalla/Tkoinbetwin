import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Lock, Unlock, TrendingUp, Award, Clock, AlertTriangle } from "lucide-react";
import type { Agent } from "@shared/schema";

interface StakeInfo {
  stakedTokens: number;
  tier: string;
  isLocked: boolean;
  daysRemaining: number;
  nextTier: string | null;
  tokensNeeded: number;
  limits?: {
    dailyLimit: number;
    monthlyLimit: number;
    commissionRate: number;
  };
}

interface StakeHistoryItem {
  id: string;
  operationType: string;
  amount: string;
  previousBalance: string;
  newBalance: string;
  previousTier: string;
  newTier: string;
  notes: string;
  createdAt: string;
}

const stakeFormSchema = z.object({
  amount: z.coerce.number().min(10000, "Minimum stake is 10,000 TKOIN").positive("Amount must be positive"),
});

const unstakeFormSchema = z.object({
  amount: z.coerce.number().min(1, "Amount must be at least 1 TKOIN").positive("Amount must be positive"),
  forceUnstake: z.boolean().default(false),
});

export default function Staking({ agent }: { agent: Agent }) {
  const { toast } = useToast();

  const { data: stakeInfo, isLoading: stakeLoading, error: stakeError } = useQuery<StakeInfo>({
    queryKey: ["/api/agents/me/staking"],
  });

  const { data: stakeHistory, isLoading: historyLoading, error: historyError } = useQuery<StakeHistoryItem[]>({
    queryKey: ["/api/agents/me/stake-history"],
  });

  const stakeForm = useForm<z.infer<typeof stakeFormSchema>>({
    resolver: zodResolver(stakeFormSchema),
    defaultValues: {
      amount: 10000,
    },
  });

  const unstakeForm = useForm<z.infer<typeof unstakeFormSchema>>({
    resolver: zodResolver(unstakeFormSchema),
    defaultValues: {
      amount: 0,
      forceUnstake: false,
    },
  });

  const stakeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stakeFormSchema>) => {
      return await apiRequest("POST", "/api/agents/stake", { amount: data.amount });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Stake successful",
        description: data.message || "Tokens staked successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me/staking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me/stake-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me"] });
      stakeForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Stake failed",
        description: error.message || "Failed to stake tokens",
        variant: "destructive",
      });
    },
  });

  const unstakeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof unstakeFormSchema>) => {
      return await apiRequest("POST", "/api/agents/unstake", { amount: data.amount, force: data.forceUnstake });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Unstake successful",
        description: data.message || "Tokens unstaked successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me/staking"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me/stake-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me"] });
      unstakeForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Unstake failed",
        description: error.message || "Failed to unstake tokens",
        variant: "destructive",
      });
    },
  });

  const onStakeSubmit = (data: z.infer<typeof stakeFormSchema>) => {
    stakeMutation.mutate(data);
  };

  const onUnstakeSubmit = (data: z.infer<typeof unstakeFormSchema>) => {
    if (stakeInfo?.isLocked && !data.forceUnstake) {
      toast({
        title: "Tokens are locked",
        description: "You must accept the 10% penalty to unstake early",
        variant: "destructive",
      });
      return;
    }
    unstakeMutation.mutate(data);
  };

  const getTierBadge = (tier: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline"; color: string }> = {
      basic: { variant: "outline", color: "text-gray-500" },
      verified: { variant: "secondary", color: "text-blue-500" },
      premium: { variant: "default", color: "text-purple-500" },
    };
    const config = variants[tier.toLowerCase()] || variants.basic;
    return (
      <Badge variant={config.variant} className={config.color} data-testid={`badge-tier-${tier}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </Badge>
    );
  };

  const getTierProgress = () => {
    if (!stakeInfo) return 0;
    if (!stakeInfo.nextTier) return 100;
    
    const tierThresholds: Record<string, number> = {
      basic: 0,
      verified: 10000,
      premium: 50000,
    };
    
    const currentThreshold = tierThresholds[stakeInfo.tier.toLowerCase()] || 0;
    const nextThreshold = tierThresholds[stakeInfo.nextTier.toLowerCase()] || 50000;
    const progress = ((stakeInfo.stakedTokens - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    
    return Math.min(Math.max(progress, 0), 100);
  };

  // Error state
  if (stakeError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="error-state-stake">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Staking Info</CardTitle>
            <CardDescription>
              {(stakeError as any).message || "Failed to load staking information"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/agents/me/staking"] })} data-testid="button-retry-stake">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state
  if (stakeLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="loading-state-stake">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading staking information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-staking">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="heading-staking">
          <Award className="h-8 w-8" />
          Agent Staking
        </h1>
        <p className="text-muted-foreground mt-1" data-testid="description-staking">
          Stake TKOIN to unlock higher tiers and increase your transaction limits
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card data-testid="card-staked-balance">
          <CardHeader>
            <CardDescription>Staked Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-mono font-bold" data-testid="text-staked-balance">
                {stakeInfo?.stakedTokens.toLocaleString() || "0"}
              </div>
              <span className="text-sm text-muted-foreground" data-testid="text-currency-symbol">TKOIN</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-current-tier">
          <CardHeader>
            <CardDescription>Current Tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {getTierBadge(stakeInfo?.tier || "basic")}
              {stakeInfo?.limits && (
                <span className="text-xs text-muted-foreground" data-testid="text-commission-rate">
                  {stakeInfo.limits.commissionRate}% commission
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-lock-status">
          <CardHeader>
            <CardDescription>Lock-up Status</CardDescription>
          </CardHeader>
          <CardContent>
            {stakeInfo?.isLocked ? (
              <div className="flex items-center gap-2" data-testid="status-locked">
                <Lock className="h-5 w-5 text-amber-500" data-testid="icon-locked" />
                <div>
                  <div className="text-sm font-medium" data-testid="text-lock-status">Locked</div>
                  <div className="text-xs text-muted-foreground" data-testid="text-days-remaining">
                    {stakeInfo.daysRemaining} days remaining
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2" data-testid="status-unlocked">
                <Unlock className="h-5 w-5 text-green-500" data-testid="icon-unlocked" />
                <div className="text-sm font-medium" data-testid="text-lock-status">Unlocked</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Progression */}
      {stakeInfo?.nextTier && (
        <Card data-testid="card-tier-progression">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-tier-progression">
              <TrendingUp className="h-5 w-5" />
              Tier Progression
            </CardTitle>
            <CardDescription data-testid="description-tier-progression">
              Stake more tokens to unlock the next tier
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm" data-testid="tier-progression-info">
              <span>{getTierBadge(stakeInfo.tier)}</span>
              <span className="text-muted-foreground" data-testid="text-tokens-needed">
                {stakeInfo.tokensNeeded.toLocaleString()} TKOIN needed
              </span>
              <span>{getTierBadge(stakeInfo.nextTier)}</span>
            </div>
            <Progress value={getTierProgress()} className="h-2" data-testid="progress-tier" />
            <p className="text-xs text-muted-foreground" data-testid="text-current-stake">
              Current: {stakeInfo.stakedTokens.toLocaleString()} TKOIN staked
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stake/Unstake Forms */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stake Form */}
        <Card data-testid="card-stake-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-stake-form">
              <Lock className="h-5 w-5" />
              Stake TKOIN
            </CardTitle>
            <CardDescription data-testid="description-stake-form">
              Lock tokens for 30 days to increase your tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...stakeForm}>
              <form onSubmit={stakeForm.handleSubmit(onStakeSubmit)} className="space-y-4">
                <FormField
                  control={stakeForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-stake-amount">Amount to Stake</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="10000"
                          data-testid="input-stake-amount"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription data-testid="description-min-stake">
                        Minimum stake: 10,000 TKOIN
                      </FormDescription>
                      <FormMessage data-testid="error-stake-amount" />
                    </FormItem>
                  )}
                />

                <div className="bg-amber-500/10 border border-amber-500/50 rounded-lg p-3 text-sm" data-testid="warning-lockup">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" data-testid="icon-warning-lockup" />
                    <div>
                      <p className="font-medium text-amber-500" data-testid="text-warning-title">30-Day Lock-up Period</p>
                      <p className="text-xs text-muted-foreground mt-1" data-testid="text-warning-description">
                        Staked tokens will be locked for 30 days. Early withdrawal incurs a 10% penalty.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={stakeMutation.isPending}
                  className="w-full"
                  data-testid="button-stake"
                >
                  {stakeMutation.isPending ? "Staking..." : "Stake Tokens"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Unstake Form */}
        <Card data-testid="card-unstake-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2" data-testid="title-unstake-form">
              <Unlock className="h-5 w-5" />
              Unstake TKOIN
            </CardTitle>
            <CardDescription data-testid="description-unstake-form">
              Withdraw your staked tokens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...unstakeForm}>
              <form onSubmit={unstakeForm.handleSubmit(onUnstakeSubmit)} className="space-y-4">
                <FormField
                  control={unstakeForm.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel data-testid="label-unstake-amount">Amount to Unstake</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="5000"
                          data-testid="input-unstake-amount"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription data-testid="description-available-unstake">
                        Available to unstake: {stakeInfo?.stakedTokens.toLocaleString() || "0"} TKOIN
                      </FormDescription>
                      <FormMessage data-testid="error-unstake-amount" />
                    </FormItem>
                  )}
                />

                {stakeInfo?.isLocked && (
                  <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm" data-testid="warning-early-withdrawal">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" data-testid="icon-warning-penalty" />
                      <div>
                        <p className="font-medium text-destructive" data-testid="text-penalty-title">Tokens are Locked</p>
                        <p className="text-xs text-muted-foreground mt-1" data-testid="text-penalty-description">
                          {stakeInfo.daysRemaining} days remaining. Early withdrawal will incur a 10% penalty.
                        </p>
                        <FormField
                          control={unstakeForm.control}
                          name="forceUnstake"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-2 space-y-0 mt-2">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="checkbox-force-unstake"
                                />
                              </FormControl>
                              <FormLabel className="text-xs font-normal cursor-pointer" data-testid="label-accept-penalty">
                                I accept the 10% penalty
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={unstakeMutation.isPending}
                  variant="outline"
                  className="w-full"
                  data-testid="button-unstake"
                >
                  {unstakeMutation.isPending ? "Unstaking..." : "Unstake Tokens"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Stake History */}
      <Card data-testid="card-stake-history">
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="title-stake-history">
            <Clock className="h-5 w-5" />
            Stake History
          </CardTitle>
          <CardDescription data-testid="description-stake-history">
            View your staking and unstaking transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="loading-state-history">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto mb-2" />
              Loading history...
            </div>
          ) : historyError ? (
            <div className="text-center py-8" data-testid="error-state-history">
              <p className="text-destructive mb-2">Failed to load history</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/agents/me/stake-history"] })}
                data-testid="button-retry-history"
              >
                Retry
              </Button>
            </div>
          ) : stakeHistory && stakeHistory.length > 0 ? (
            <div className="space-y-3">
              {stakeHistory.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover-elevate"
                  data-testid={`history-item-${item.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {item.operationType === "stake" ? (
                        <Lock className="h-4 w-4 text-green-500" data-testid={`icon-stake-${item.id}`} />
                      ) : (
                        <Unlock className="h-4 w-4 text-amber-500" data-testid={`icon-unstake-${item.id}`} />
                      )}
                      <span className="font-medium capitalize" data-testid={`text-operation-${item.id}`}>{item.operationType}</span>
                      {item.previousTier !== item.newTier && (
                        <div className="flex items-center gap-1" data-testid={`tier-change-${item.id}`}>
                          <span className="text-xs text-muted-foreground">Tier:</span>
                          {getTierBadge(item.previousTier)}
                          <span className="text-xs text-muted-foreground">→</span>
                          {getTierBadge(item.newTier)}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground" data-testid={`text-notes-${item.id}`}>{item.notes}</p>
                    <p className="text-xs text-muted-foreground mt-1" data-testid={`text-date-${item.id}`}>
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-medium" data-testid={`text-amount-${item.id}`}>
                      {(parseFloat(item.amount) / 1e9).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">TKOIN</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-history">
              No staking history yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
