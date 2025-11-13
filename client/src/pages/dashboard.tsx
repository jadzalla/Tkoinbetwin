import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, DollarSign, Award, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { Agent } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  // Always try to fetch agent data for authenticated users to reflect real-time status changes
  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent>({
    queryKey: ["/api/agents/me"],
    enabled: !!user, // Fetch for any authenticated user
    retry: false, // Don't retry if not an agent
  });

  if (authLoading || agentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Agent Access Required</CardTitle>
            <CardDescription>
              Please login to access the agent portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/api/login">
              <Button className="w-full" data-testid="button-login">Login to Continue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show apply prompt if not an agent (either no agent record or 404 error)
  if (!agent && !agentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Agent Access Required</CardTitle>
            <CardDescription>
              You need to be registered as an agent to access this portal
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Apply to become an agent to start earning commissions by facilitating Tkoin exchanges
            </p>
            <Link href="/apply">
              <Button className="w-full" data-testid="button-apply-agent">Apply to Become an Agent</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Tkoin Agent Portal</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <ExternalLink className="h-4 w-4 mr-2" />
                Public Site
              </Button>
            </Link>
            <Button variant="ghost" size="sm" data-testid="button-profile">
              {user.email}
            </Button>
            <a href="/api/logout">
              <Button variant="outline" size="sm" data-testid="button-logout">Logout</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 md:px-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold" data-testid="text-agent-name">{agent.displayName || agent.username}</h1>
              <p className="text-muted-foreground">Agent ID: {agent.id}</p>
            </div>
            {getStatusBadge(agent.status)}
          </div>
        </div>

        {agent.status === 'pending' && (
          <Card className="mb-8 border-amber-500/50 bg-amber-500/5">
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

        {agent.status === 'active' && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
              <Card data-testid="card-inventory">
                <CardHeader className="pb-3">
                  <CardDescription>TKOIN Inventory</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-mono font-bold" data-testid="text-inventory-balance">
                      {Number(agent.balanceTkoin).toLocaleString()}
                    </div>
                    <Coins className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Limit: {Number(agent.dailyLimitTkoin).toLocaleString()} / day
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
                      {Number(agent.lifetimeCommissions).toLocaleString()}
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
                  <CardDescription>Total Volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-mono font-bold" data-testid="text-volume">
                      {Number(agent.lifetimeVolume).toLocaleString()}
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
                      {agent.averageRating?.toFixed(1) || 'N/A'}
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
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Manage purchases and redemptions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Buy Side (Sell to Users)
                  </div>
                  <Button className="w-full justify-start" variant="outline" disabled data-testid="button-buy-inventory">
                    <Coins className="mr-2 h-4 w-4" />
                    Buy TKOIN Inventory
                  </Button>
                  <Button className="w-full justify-start" variant="outline" disabled data-testid="button-sell-to-user">
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Sell TKOIN to User
                  </Button>
                  
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-6 mb-2">
                    Redemption Side (Buy from Users)
                  </div>
                  <Button className="w-full justify-start" variant="outline" disabled data-testid="button-redemption-requests">
                    <DollarSign className="mr-2 h-4 w-4" />
                    View Redemption Requests
                  </Button>
                  <Button className="w-full justify-start" variant="outline" disabled data-testid="button-process-redemption">
                    <Award className="mr-2 h-4 w-4" />
                    Process User Redemption
                  </Button>
                  
                  <p className="text-xs text-muted-foreground pt-4">
                    Full agent features coming soon. This is a preview of your agent dashboard.
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
