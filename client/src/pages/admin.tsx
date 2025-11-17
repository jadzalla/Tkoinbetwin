import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { Coins, Settings, Users, TrendingUp, AlertCircle, ExternalLink, ShieldAlert, Globe, Rocket } from "lucide-react";
import type { Agent } from "@shared/schema";

interface SystemConfig {
  [key: string]: any;
}

export default function Admin() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [burnRate, setBurnRate] = useState<number>(100); // basis points

  // Fetch system configuration
  const { data: config, isLoading: configLoading } = useQuery<SystemConfig>({
    queryKey: ["/api/config"],
  });

  // Fetch pending agents
  const { data: pendingAgents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/admin/agents", { status: "pending" }],
  });

  // Sync burn rate from fetched config
  useEffect(() => {
    if (config?.burn_rate !== undefined) {
      setBurnRate(config.burn_rate);
    }
  }, [config?.burn_rate]);

  // Update burn rate mutation
  const updateBurnRateMutation = useMutation({
    mutationFn: async (newRate: number) => {
      return await apiRequest("/api/admin/config/burn_rate", {
        method: "PUT",
        body: JSON.stringify({
          value: newRate,
          description: `Burn rate applied to treasury deposits (0-200 basis points, representing 0-2%)`,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/tokenomics"] });
      toast({
        title: "Burn Rate Updated",
        description: `Successfully updated burn rate to ${burnRate} basis points (${burnRate / 100}%)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update burn rate",
        variant: "destructive",
      });
    },
  });

  // Approve agent mutation
  const approveAgentMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return await apiRequest(`/api/admin/agents/${agentId}/approve`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agents"] });
      toast({
        title: "Agent Approved",
        description: "Agent has been successfully approved",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve agent",
        variant: "destructive",
      });
    },
  });

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Please login to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/login">
              <Button className="w-full" data-testid="button-login">Login to Continue</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has admin role
  const isAdmin = user.isAdmin;
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              This page is restricted to administrators only. Your account does not have the required permissions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-md text-sm">
              <p className="font-semibold mb-2">Need admin access?</p>
              <p className="text-muted-foreground">
                Contact your system administrator to request admin privileges for your account.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-dashboard">
                  Go to Dashboard
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full" data-testid="button-home">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Settings className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Tkoin Admin Panel</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-home">
                <ExternalLink className="h-4 w-4 mr-2" />
                Public Site
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="button-dashboard">
                Dashboard
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
          <h1 className="text-3xl font-bold mb-2">System Administration</h1>
          <p className="text-muted-foreground">Manage tokenomics, agents, and platform configuration</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Currency Management Link */}
          <Link href="/admin/currencies">
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid="card-manage-currencies">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  Currency Management
                </CardTitle>
                <CardDescription>
                  Configure supported currencies and exchange rates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Active Currencies</span>
                    <span className="font-mono font-bold" data-testid="text-active-currencies-count">
                      Loading...
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Add, edit, or disable currencies available for agent transactions
                  </p>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>Manage Currencies</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Token Management Link */}
          <Link href="/admin/token">
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid="card-token-management">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5 text-primary" />
                  Token Management
                </CardTitle>
                <CardDescription>
                  Deploy and manage the TKOIN Token-2022 on Solana
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Deployment Status</span>
                    <Badge variant="outline" data-testid="badge-token-status">
                      Loading...
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Deploy Token-2022 with transfer fee extension and manage token operations
                  </p>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>Manage Token</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Agent Slashing Link */}
          <Link href="/admin/slashing">
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid="card-agent-slashing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Agent Slashing
                </CardTitle>
                <CardDescription>
                  Manage stake penalties for agent violations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Pending Reviews</span>
                    <Badge variant="outline" data-testid="badge-pending-slashes">
                      Loading...
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create, review, and execute slashing events for policy violations
                  </p>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>Manage Slashing</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Staking Analytics Link */}
          <Link href="/admin/analytics/staking">
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid="card-staking-analytics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Staking Analytics
                </CardTitle>
                <CardDescription>
                  Monitor agent staking health and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Total Staked</span>
                    <Badge variant="outline" data-testid="badge-total-staked">
                      Loading...
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View staking trends, tier distribution, and at-risk agents
                  </p>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>View Analytics</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Slashing Analytics Link */}
          <Link href="/admin/analytics/slashing">
            <Card className="hover-elevate active-elevate-2 cursor-pointer h-full" data-testid="card-slashing-analytics">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-primary" />
                  Slashing Analytics
                </CardTitle>
                <CardDescription>
                  Monitor violation patterns and penalty effectiveness
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Total Slashed</span>
                    <Badge variant="outline" data-testid="badge-total-slashed-preview">
                      Loading...
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    View violation trends, severity breakdown, and agent compliance
                  </p>
                  <div className="flex items-center gap-2 text-primary text-sm font-medium">
                    <span>View Analytics</span>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Burn Rate Configuration */}
          <Card data-testid="card-burn-rate-config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Burn Rate Configuration
              </CardTitle>
              <CardDescription>
                Adjust the burn rate applied to all treasury deposits (0-2%)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Current Rate:</Label>
                  <Badge variant="outline" className="font-mono text-lg" data-testid="badge-current-rate">
                    {burnRate} bps ({(burnRate / 100).toFixed(2)}%)
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="burn-rate-slider">Adjust Burn Rate</Label>
                  <Slider
                    id="burn-rate-slider"
                    min={0}
                    max={200}
                    step={10}
                    value={[burnRate]}
                    onValueChange={(values) => setBurnRate(values[0])}
                    className="w-full"
                    data-testid="slider-burn-rate"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0% (No burn)</span>
                    <span>1% (Recommended)</span>
                    <span>2% (Maximum)</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="burn-rate-input">Precise Value (basis points)</Label>
                  <Input
                    id="burn-rate-input"
                    type="number"
                    min={0}
                    max={200}
                    value={burnRate}
                    onChange={(e) => setBurnRate(Number(e.target.value))}
                    className="font-mono"
                    data-testid="input-burn-rate"
                  />
                </div>

                <div className="bg-muted/50 p-4 rounded-md space-y-2">
                  <h4 className="font-semibold text-sm">Impact Preview:</h4>
                  <ul className="text-sm space-y-1">
                    <li>• 1000 TKOIN deposit → {1000 - (1000 * burnRate / 10000)} TKOIN received</li>
                    <li>• Equivalent to {(1000 * burnRate / 10000).toFixed(2)} TKOIN burned</li>
                    <li>• User gets {((1000 - (1000 * burnRate / 10000)) * 100).toLocaleString()} game credits</li>
                  </ul>
                </div>

                <Button
                  onClick={() => updateBurnRateMutation.mutate(burnRate)}
                  disabled={updateBurnRateMutation.isPending || burnRate === config?.burn_rate}
                  className="w-full"
                  data-testid="button-update-burn-rate"
                >
                  {updateBurnRateMutation.isPending ? "Updating..." : "Update Burn Rate"}
                </Button>
              </div>

              {burnRate !== (config?.burn_rate || 100) && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/50 rounded-md">
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-600 dark:text-amber-400">Unsaved Changes</p>
                    <p className="text-muted-foreground">
                      Click "Update Burn Rate" to apply changes
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Agent Approvals */}
          <Card data-testid="card-pending-agents">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Pending Agent Approvals
              </CardTitle>
              <CardDescription>
                Review and approve new agent applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agentsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              ) : pendingAgents && pendingAgents.length > 0 ? (
                <div className="space-y-3">
                  {pendingAgents.map((agent) => (
                    <Card key={agent.id} className="p-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold" data-testid={`text-agent-name-${agent.id}`}>
                            {agent.displayName || agent.username}
                          </h4>
                          <Badge variant="secondary" data-testid={`badge-status-${agent.id}`}>
                            Pending
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>📧 {agent.email}</p>
                          <p>📍 {agent.city}, {agent.country}</p>
                          <p className="font-mono text-xs truncate">💰 {agent.solanaWallet}</p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => approveAgentMutation.mutate(agent.id)}
                          disabled={approveAgentMutation.isPending}
                          className="w-full"
                          data-testid={`button-approve-${agent.id}`}
                        >
                          Approve Agent
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No pending applications</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* System Stats */}
          <Card data-testid="card-system-stats">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                System Statistics
              </CardTitle>
              <CardDescription>
                Current platform metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full mx-auto" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Configured Burn Rate</span>
                    <span className="font-mono font-bold" data-testid="text-stat-burn-rate">
                      {config?.burn_rate || 100} bps ({((config?.burn_rate || 100) / 100).toFixed(2)}%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                    <span className="text-sm font-medium">Conversion Rate</span>
                    <span className="font-mono font-bold" data-testid="text-stat-conversion">
                      1 TKOIN = {config?.conversionRate || 100} Credits
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    More system statistics coming soon
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
