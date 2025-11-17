import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Coins, TrendingUp, DollarSign, Award, CheckCircle2, Wallet } from "lucide-react";
import type { Agent } from "@shared/schema";

interface DashboardIndexProps {
  agent: Agent;
}

export default function DashboardIndex({ agent }: DashboardIndexProps) {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      active: { variant: "default", label: "Active" },
      pending: { variant: "secondary", label: "Pending Approval" },
      suspended: { variant: "destructive", label: "Suspended" },
      revoked: { variant: "destructive", label: "Revoked" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant} data-testid={`badge-status-${status}`}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-agent-name">{agent.displayName || agent.username}</h1>
            <p className="text-muted-foreground">Agent ID: {agent.id}</p>
          </div>
          {getStatusBadge(agent.status)}
        </div>
      </div>

      {agent.status === 'pending' && (
        <Card className="border-amber-500/50 bg-amber-500/5" data-testid="card-pending-notice">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" />
              Application Under Review
            </CardTitle>
            <CardDescription>
              Your agent application is being reviewed by our team. You'll be notified once approved.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {agent.status === 'active' && agent.registrationType === 'permissionless' && (
        <Alert className="border-green-500/50 bg-green-500/5" data-testid="alert-welcome-permissionless">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription>
            <strong>Welcome to Tkoin Protocol!</strong> You've successfully registered as a Basic tier agent via wallet verification. 
            Your account is now active with ${Number(agent.dailyLimit).toLocaleString()} daily transaction limit. 
            Stake additional TKOIN to unlock higher tiers and increased limits.
          </AlertDescription>
        </Alert>
      )}

      {agent.status === 'active' && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Card data-testid="card-inventory">
              <CardHeader className="pb-3">
                <CardDescription>TKOIN Inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-mono font-bold" data-testid="text-inventory-balance">
                    {Number(agent.tkoinBalance).toLocaleString()}
                  </div>
                  <Coins className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Limit: {Number(agent.dailyLimit).toLocaleString()} / day
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-commissions">
              <CardHeader className="pb-3">
                <CardDescription>Total Commissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-mono font-bold" data-testid="text-commissions">
                    {Number(agent.totalCommissionEarned).toLocaleString()}
                  </div>
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Tier: {agent.commissionTier}
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-volume">
              <CardHeader className="pb-3">
                <CardDescription>Total Minted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-mono font-bold" data-testid="text-volume">
                    {Number(agent.totalMinted).toLocaleString()}
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  All-time transactions
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-rating">
              <CardHeader className="pb-3">
                <CardDescription>Agent Rating</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <div className="text-3xl font-mono font-bold" data-testid="text-rating">
                    {agent.averageRating ? Number(agent.averageRating).toFixed(1) : 'N/A'}
                  </div>
                  <Award className="h-5 w-5 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {agent.totalRatings} ratings
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Agent Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Solana Wallet</dt>
                  <dd className="mt-1 text-sm font-mono" data-testid="text-wallet">{agent.solanaWallet}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Location</dt>
                  <dd className="mt-1 text-sm" data-testid="text-location">
                    {agent.city}, {agent.country}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Verification Tier</dt>
                  <dd className="mt-1">
                    <Badge variant="outline" data-testid="badge-verification">{agent.verificationTier}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Availability</dt>
                  <dd className="mt-1">
                    <Badge 
                      variant={agent.availabilityStatus === 'online' ? 'default' : 'secondary'}
                      data-testid="badge-availability"
                    >
                      {agent.availabilityStatus}
                    </Badge>
                  </dd>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Performance at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total Minted</dt>
                  <dd className="mt-1 text-2xl font-mono font-bold" data-testid="text-total-minted">
                    {Number(agent.totalMinted).toLocaleString()} TKOIN
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Total Earned</dt>
                  <dd className="mt-1 text-2xl font-mono font-bold" data-testid="text-total-earned">
                    {Number(agent.totalCommissionEarned).toLocaleString()} TKOIN
                  </dd>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Use the sidebar to access pricing, transactions, commissions, and more.
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
