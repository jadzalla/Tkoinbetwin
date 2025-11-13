import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Coins, TrendingUp, Users, Shield, ArrowRight, Flame, DollarSign, Trophy, Medal, Award, Wallet, Target, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TokenomicsStats {
  maxSupply: string;
  circulatingSupply: string;
  totalBurned: string;
  burnRate: string;
  conversionRate: string;
  activeAgents: number;
  // New marketplace metrics
  totalLiquidity: string;
  volume24h: string;
  agentsByTier: {
    bronze: number;
    silver: number;
    gold: number;
  };
  supportedCurrencies: number;
}

export default function Home() {
  const { user } = useAuth();
  
  const { data: stats } = useQuery<TokenomicsStats>({
    queryKey: ["/api/stats/tokenomics"],
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-2">
            <Coins className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Tkoin</span>
          </div>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#tokenomics" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-tokenomics">Tokenomics</a>
            <a href="#agents" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-agents">Agents</a>
            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-how-it-works">How It Works</a>
            <a href="#live-rates" className="text-sm font-medium hover:text-primary transition-colors" data-testid="link-live-rates">Live Rates</a>
          </nav>
          
          <div className="flex items-center gap-2">
            {user?.isAgent && (
              <Link href="/dashboard">
                <Button variant="ghost" size="sm" data-testid="button-dashboard">Dashboard</Button>
              </Link>
            )}
            <a href="/api/login">
              <Button variant="outline" size="sm" data-testid="button-login">Agent Login</Button>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative py-24 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          <div className="container relative px-4 md:px-6">
            <div className="mx-auto max-w-4xl text-center space-y-6">
              <Badge variant="outline" className="text-primary border-primary/50" data-testid="badge-status">
                Token-2022 Powered
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight" data-testid="heading-hero">
                Tkoin Liquidity Network
              </h1>
              <p className="text-2xl md:text-3xl font-semibold text-primary" data-testid="text-hero-tagline">
                Earn as an Agent, Play with Ease
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-hero-description">
                A trusted agent marketplace connecting players with local liquidity providers. 
                Agents earn commissions by buying and selling Tkoin. Players get instant access to gaming credits. 
                1% burn mechanism (configurable), 100M max supply.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="#agents">
                  <Button size="lg" data-testid="button-find-agent">
                    Find an Agent <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/apply">
                  <Button size="lg" variant="outline" data-testid="button-become-liquidity-provider">
                    Become a Liquidity Provider
                  </Button>
                </Link>
              </div>
            </div>

            {/* Live Marketplace Metrics */}
            <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
              <Card className="hover-elevate" data-testid="card-stat-liquidity">
                <CardHeader className="pb-2">
                  <CardDescription>Total Agent Liquidity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold" data-testid="text-total-liquidity">
                    {(() => {
                      const value = stats?.totalLiquidity ? Number(stats.totalLiquidity) : 0;
                      return isNaN(value) ? '0' : value.toLocaleString();
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">TKOIN</p>
                </CardContent>
              </Card>
              <Card className="hover-elevate" data-testid="card-stat-agents-by-tier">
                <CardHeader className="pb-2">
                  <CardDescription>Active Agents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold mb-2" data-testid="text-active-agents">
                    {stats?.activeAgents ?? 0}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-bronze">
                      <Medal className="h-3 w-3 text-orange-500" />
                      <span>{stats?.agentsByTier?.bronze ?? 0}</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-silver">
                      <Award className="h-3 w-3 text-gray-400" />
                      <span>{stats?.agentsByTier?.silver ?? 0}</span>
                    </Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1" data-testid="badge-gold">
                      <Trophy className="h-3 w-3 text-yellow-500" />
                      <span>{stats?.agentsByTier?.gold ?? 0}</span>
                    </Badge>
                  </div>
                </CardContent>
              </Card>
              <Card className="hover-elevate" data-testid="card-stat-volume">
                <CardHeader className="pb-2">
                  <CardDescription>24h Volume</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold" data-testid="text-24h-volume">
                    {(() => {
                      const value = stats?.volume24h ? Number(stats.volume24h) : 0;
                      return isNaN(value) ? '0' : value.toLocaleString();
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">TKOIN</p>
                </CardContent>
              </Card>
              <Card className="hover-elevate" data-testid="card-stat-currencies">
                <CardHeader className="pb-2">
                  <CardDescription>Supported Currencies</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-mono font-bold mb-2" data-testid="text-currency-count">
                    {stats?.supportedCurrencies ?? 6}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">PHP</Badge>
                    <Badge variant="outline" className="text-xs">EUR</Badge>
                    <Badge variant="outline" className="text-xs">USD</Badge>
                    <Badge variant="outline" className="text-xs">JPY</Badge>
                    <Badge variant="outline" className="text-xs">GBP</Badge>
                    <Badge variant="outline" className="text-xs">AUD</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works - Three-Column */}
        <section id="how-it-works" className="py-20 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Three sides of the Tkoin ecosystem working together
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {/* For Users */}
              <Card className="hover-elevate">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>For Users</CardTitle>
                  <CardDescription>Buy Tkoin to play, redeem winnings to fiat</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Find an Agent</p>
                      <p className="text-sm text-muted-foreground">Browse verified agents in your area</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Buy or Sell</p>
                      <p className="text-sm text-muted-foreground">Pay with cash/crypto, get Tkoin instantly</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Play & Redeem</p>
                      <p className="text-sm text-muted-foreground">1 TKOIN = 100 Credits, redeem winnings anytime</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* For Agents */}
              <Card className="hover-elevate border-primary/50">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                    <Wallet className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>For Agents</CardTitle>
                  <CardDescription>Earn commissions as a liquidity provider</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Buy Inventory</p>
                      <p className="text-sm text-muted-foreground">Deposit stablecoins to get Tkoin inventory</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Set Your Prices</p>
                      <p className="text-sm text-muted-foreground">Configure spreads within your tier limits</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Earn Commissions</p>
                      <p className="text-sm text-muted-foreground">Spread + tier bonus + house edge share</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* For Platform */}
              <Card className="hover-elevate">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>For Platform</CardTitle>
                  <CardDescription>Secure, compliant, transparent</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Shield className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Blockchain Verified</p>
                      <p className="text-sm text-muted-foreground">Solana Token-2022, full transparency</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Target className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">1% Burn Mechanism</p>
                      <p className="text-sm text-muted-foreground">Deflationary tokenomics (configurable 0-2%)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Users className="h-3 w-3 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Agent Verification</p>
                      <p className="text-sm text-muted-foreground">KYC-approved agents, community ratings</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Agent Benefits Section */}
        <section className="py-20 bg-muted/50 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Provide Liquidity?</h2>
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
                Join our network of agents earning commissions on every transaction
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              <Card className="hover-elevate">
                <CardHeader>
                  <DollarSign className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Earn Commissions</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Earn on every transaction from your spread margins, plus tier bonuses and house edge share
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Up to 1% base commission per transaction</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Bronze/Silver/Gold tier bonuses</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>10% share of house edge (pro-rata)</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <Trophy className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Tier Progression</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Progress through Bronze, Silver, and Gold tiers to unlock higher limits and better rates
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Medal className="h-4 w-4 text-orange-500" />
                      <span>Bronze: &lt; 25K monthly volume</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-gray-400" />
                      <span>Silver: 25K - 100K monthly volume</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      <span>Gold: &gt; 100K monthly volume</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardHeader>
                  <BarChart3 className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Monthly Settlements</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Automatic monthly payouts in USDC with full transparency and reporting
                  </p>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Automatic USDC payouts</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Detailed commission breakdown</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span>Full settlement history</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="mt-12 text-center">
              <Link href="/apply">
                <Button size="lg" data-testid="button-apply-agent">
                  Apply to Become an Agent <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Trusted Agent Network */}
        <section id="agents" className="py-20 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted Agent Network</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                All agents are verified and rated by the community. Find local liquidity providers.
              </p>
            </div>
            
            <div className="max-w-3xl mx-auto">
              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Users className="h-12 w-12 text-primary mx-auto" />
                    <h3 className="text-xl font-semibold">Agent Directory Coming Soon</h3>
                    <p className="text-muted-foreground">
                      Browse verified agents by location, currency, and rating. See live buy/sell rates and contact information.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      <Badge variant="outline">Philippines (PHP)</Badge>
                      <Badge variant="outline">Europe (EUR)</Badge>
                      <Badge variant="outline">United States (USD)</Badge>
                      <Badge variant="outline">Japan (JPY)</Badge>
                      <Badge variant="outline">United Kingdom (GBP)</Badge>
                      <Badge variant="outline">Australia (AUD)</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Tokenomics Section */}
        <section id="tokenomics" className="py-20 bg-muted/50 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Tokenomics</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Deflationary token economics designed for sustainable growth
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card>
                <CardHeader>
                  <Flame className="h-10 w-10 text-destructive mb-4" />
                  <CardTitle>Burn Mechanism</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    1% of all Tkoin deposited to the treasury wallet is automatically burned, reducing supply over time. 
                    Burn rate is configurable between 0-2% by admins.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Coins className="h-10 w-10 text-primary mb-4" />
                  <CardTitle>Supply & Conversion</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Max supply of 100M TKOIN. Soft-peg conversion rate of 1 TKOIN = 100 gaming credits. 
                    Token-2022 standard with transfer fee extension.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-12">
        <div className="container px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-semibold mb-3">Platform</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#tokenomics" className="hover:text-primary">Tokenomics</a></li>
                <li><a href="#agents" className="hover:text-primary">Find Agents</a></li>
                <li><a href="#how-it-works" className="hover:text-primary">How It Works</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Agents</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/api/login" className="hover:text-primary">Agent Portal</a></li>
                <li><a href="/apply" className="hover:text-primary">Become an Agent</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Documentation</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Whitepaper</a></li>
                <li><a href="#" className="hover:text-primary">API Docs</a></li>
                <li><a href="#" className="hover:text-primary">Audit Report</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
            <p>© {new Date().getFullYear()} Tkoin. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
