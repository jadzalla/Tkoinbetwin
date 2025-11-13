import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Coins, TrendingUp, Users, Shield, ArrowRight, Flame } from "lucide-react";

interface TokenomicsStats {
  maxSupply: string;
  circulatingSupply: string;
  totalBurned: string;
  burnRate: string;
  conversionRate: string;
  activeAgents: number;
}

export default function Home() {
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
          </nav>
          
          <div className="flex items-center gap-2">
            <Link href="/api/login">
              <Button variant="outline" size="sm" data-testid="button-login">Agent Login</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative py-24 md:py-32 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
          <div className="container relative px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center space-y-6">
              <Badge variant="outline" className="text-primary border-primary/50" data-testid="badge-status">
                Token-2022 Powered
              </Badge>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight" data-testid="heading-hero">
                Professional Tkoin Exchange
              </h1>
              <p className="text-xl text-muted-foreground" data-testid="text-hero-description">
                Trusted agent network facilitating seamless fiat-to-crypto exchanges on Solana. 
                2% burn mechanism, 100M max supply.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="#agents">
                  <Button size="lg" data-testid="button-find-agent">
                    Find an Agent <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/api/login">
                  <Button size="lg" variant="outline" data-testid="button-become-agent">
                    Become an Agent
                  </Button>
                </Link>
              </div>
            </div>

            {stats && (
              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
                <Card data-testid="card-stat-supply">
                  <CardHeader className="pb-2">
                    <CardDescription>Max Supply</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-bold" data-testid="text-max-supply">
                      {Number(stats.maxSupply).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-burned">
                  <CardHeader className="pb-2">
                    <CardDescription>Total Burned</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-bold flex items-center gap-1" data-testid="text-total-burned">
                      {Number(stats.totalBurned).toLocaleString()}
                      <Flame className="h-4 w-4 text-destructive" />
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-agents">
                  <CardHeader className="pb-2">
                    <CardDescription>Active Agents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-bold" data-testid="text-active-agents">
                      {stats.activeAgents}
                    </div>
                  </CardContent>
                </Card>
                <Card data-testid="card-stat-rate">
                  <CardHeader className="pb-2">
                    <CardDescription>Conversion Rate</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-mono font-bold" data-testid="text-conversion-rate">
                      1:{stats.conversionRate}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </section>

        <section id="how-it-works" className="py-20 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Simple, secure, and transparent cryptocurrency exchanges
              </p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>1. Find an Agent</CardTitle>
                  <CardDescription>
                    Browse verified agents in your area or online
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <TrendingUp className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>2. Exchange Funds</CardTitle>
                  <CardDescription>
                    Transfer fiat (cash/bank) or stablecoins (USDT/USDC/EURt)
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Coins className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>3. Receive Tkoin</CardTitle>
                  <CardDescription>
                    Get Tkoin in your wallet instantly, ready for gaming
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section id="agents" className="py-20 bg-muted/50 border-t">
          <div className="container px-4 md:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Trusted Agent Network</h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                All agents are verified and rated by the community
              </p>
            </div>
            
            <div className="max-w-3xl mx-auto">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <Shield className="h-12 w-12 text-primary mx-auto" />
                    <h3 className="text-xl font-semibold">Ready to become an agent?</h3>
                    <p className="text-muted-foreground">
                      Join our network of liquidity providers and earn commissions on every exchange
                    </p>
                    <Link href="/api/login">
                      <Button size="lg" data-testid="button-apply-agent">
                        Apply to Become an Agent
                      </Button>
                    </Link>
                  </div>
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
                <li><a href="/api/login" className="hover:text-primary">Become an Agent</a></li>
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
