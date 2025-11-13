import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, ExternalLink } from "lucide-react";
import { Link, Switch, Route, useLocation } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebarAgent } from "@/components/app-sidebar-agent";
import DashboardIndex from "@/pages/dashboard/index";
import Pricing from "@/pages/dashboard/pricing";
import type { Agent } from "@shared/schema";

export default function Dashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [location] = useLocation();
  
  // Always try to fetch agent data for authenticated users to reflect real-time status changes
  const { data: agent, isLoading: agentLoading, error: agentError } = useQuery<Agent>({
    queryKey: ["/api/agents/me"],
    enabled: !!user,
    retry: false,
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
            <a href="/api/login" className="block">
              <Button className="w-full" data-testid="button-login">Login to Continue</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show apply prompt if not an agent
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

  // Agent portal with sidebar navigation
  const sidebarStyle = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebarAgent agent={agent!} />
        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                <span className="font-semibold">Tkoin Agent Portal</span>
              </div>
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
          </header>

          <main className="flex-1 overflow-auto p-6">
            <Switch>
              <Route path="/dashboard" component={() => <DashboardIndex agent={agent!} />} />
              <Route path="/dashboard/pricing" component={() => <Pricing agent={agent!} />} />
              <Route path="/dashboard/transactions" component={() => (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-2">Transactions</h2>
                  <p className="text-muted-foreground">Coming soon</p>
                </div>
              )} />
              <Route path="/dashboard/commissions" component={() => (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-2">Commissions & Earnings</h2>
                  <p className="text-muted-foreground">Coming soon</p>
                </div>
              )} />
              <Route path="/dashboard/analytics" component={() => (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-2">Analytics</h2>
                  <p className="text-muted-foreground">Coming soon</p>
                </div>
              )} />
              <Route path="/dashboard/inventory" component={() => (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-2">Inventory & Funding</h2>
                  <p className="text-muted-foreground">Coming soon</p>
                </div>
              )} />
              <Route path="/dashboard/settings" component={() => (
                <div className="text-center py-12">
                  <h2 className="text-2xl font-bold mb-2">Settings</h2>
                  <p className="text-muted-foreground">Coming soon</p>
                </div>
              )} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
