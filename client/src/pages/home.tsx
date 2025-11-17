import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Coins, TrendingUp, Users, Shield, ArrowRight, Flame, DollarSign, Trophy, Medal, Award, Wallet, Target, BarChart3, CheckCircle2, ExternalLink, FileCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { motion, useSpring, useTransform, useInView } from "framer-motion";
import { useRef } from "react";

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

interface OnChainStats {
  treasuryBalance: string;
  recentBurns: Array<{
    id: string;
    amount: string;
    timestamp: string;
    txSignature: string;
  }>;
  tierEarnings: {
    bronze: { avgMonthlyEarnings: string; agentCount: number; totalVolume: string; };
    silver: { avgMonthlyEarnings: string; agentCount: number; totalVolume: string; };
    gold: { avgMonthlyEarnings: string; agentCount: number; totalVolume: string; };
  };
  tokenVerification: {
    isVerified: boolean;
    standard: string;
    mintAddress: string;
    extensions: string[];
  };
}

// Shared glassmorphism style for consistency
const GLASS_STYLE = {
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderColor: 'rgba(255, 255, 255, 0.1)',
} as const;

// Animated counter component for smooth number transitions
function AnimatedCounter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const spring = useSpring(value, { 
    damping: 20, 
    stiffness: 50,
    mass: 0.8
  });
  
  const display = useTransform(spring, (current) => {
    const formatted = Math.floor(current).toLocaleString();
    return suffix ? `${formatted}${suffix}` : formatted;
  });

  return (
    <motion.div 
      className="mb-1"
      style={{
        fontSize: 'clamp(1.875rem, 2.25rem, 2.25rem)',
        fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
        fontWeight: 700,
        color: '#ffffff',
        textAlign: 'center',
      }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      {display}
    </motion.div>
  );
}

// On-Chain Credibility Section with glassmorphism cards
function OnChainCredibilitySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  const { data: onChainStats, isLoading, isError } = useQuery<OnChainStats>({
    queryKey: ['/api/stats/on-chain'],
  });

  if (isLoading || isError || !onChainStats) {
    return null; // Don't show section while loading or if error
  }

  return (
    <section ref={ref} className="py-20 bg-gradient-to-b from-purple-950 to-background">
      <div className="container px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">On-Chain Credibility</h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Verifiable, transparent, blockchain-powered economics
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Treasury Balance Card */}
          <motion.div
            className="rounded-2xl p-6 border"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            data-testid="card-treasury"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wallet className="h-5 w-5 text-purple-400" />
                Treasury Balance
              </h3>
              <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                Live
              </Badge>
            </div>
            <div className="space-y-2">
              <p className="text-4xl font-mono font-bold text-white">
                {parseFloat(onChainStats.treasuryBalance || "0").toLocaleString()} TKOIN
              </p>
              <p className="text-sm text-muted-foreground">
                Reserved for burns and platform operations
              </p>
            </div>
          </motion.div>

          {/* Token-2022 Verification Badge */}
          <motion.div
            className="rounded-2xl p-6 border"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.2 }}
            data-testid="card-verification"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                Token Verification
              </h3>
              <Badge variant="outline" className="bg-green-500/10 border-green-500/30 text-green-400">
                Verified
              </Badge>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {onChainStats.tokenVerification?.standard || "SPL Token-2022"}
              </p>
              <div className="flex flex-wrap gap-2">
                {(onChainStats.tokenVerification?.extensions ?? []).map((ext) => (
                  <Badge key={ext} variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-300 text-xs">
                    {ext}
                  </Badge>
                ))}
              </div>
              <a
                href={`https://solscan.io/token/${onChainStats.tokenVerification?.mintAddress || 'mock'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-2"
              >
                View on Solscan <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </motion.div>

          {/* Recent Burns Feed */}
          <motion.div
            className="rounded-2xl p-6 border"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.3 }}
            data-testid="card-burns"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-400" />
                Recent Burns
              </h3>
            </div>
            <div className="space-y-2">
              {(onChainStats.recentBurns ?? []).slice(0, 3).map((burn) => (
                <div key={burn.id} className="flex justify-between items-center text-sm py-2 border-b border-white/5 last:border-0">
                  <span className="text-muted-foreground">
                    {new Date(burn.timestamp).toLocaleDateString()}
                  </span>
                  <span className="font-mono text-orange-400 font-semibold">
                    -{parseFloat(burn.amount).toLocaleString()} TKOIN
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Agent Tier Earnings */}
          <motion.div
            className="rounded-2xl p-6 border"
            style={GLASS_STYLE}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.4 }}
            data-testid="card-tier-earnings"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                Agent Earnings by Tier
              </h3>
            </div>
            <div className="space-y-3">
              {/* Gold Tier */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">Gold</span>
                </div>
                <span className="font-mono text-green-400 font-semibold">
                  ${parseFloat(onChainStats.tierEarnings?.gold?.avgMonthlyEarnings || "0").toLocaleString()}/mo
                </span>
              </div>
              {/* Silver Tier */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gray-300" />
                  <span className="text-sm font-medium text-white">Silver</span>
                </div>
                <span className="font-mono text-green-400 font-semibold">
                  ${parseFloat(onChainStats.tierEarnings?.silver?.avgMonthlyEarnings || "0").toLocaleString()}/mo
                </span>
              </div>
              {/* Bronze Tier */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Medal className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-medium text-white">Bronze</span>
                </div>
                <span className="font-mono text-green-400 font-semibold">
                  ${parseFloat(onChainStats.tierEarnings?.bronze?.avgMonthlyEarnings || "0").toLocaleString()}/mo
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
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
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          {/* Full-bleed gradient nebula background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-indigo-800 to-purple-950" />
          
          {/* Dark wash overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/40" />
          
          {/* Subtle particle animation effect */}
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/30 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
          
          <div className="container relative px-4 md:px-6 py-24">
            <div className="mx-auto max-w-5xl text-center space-y-8">
              <Badge variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white" data-testid="badge-status">
                Solana Token-2022 Powered
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white" data-testid="heading-hero">
                The Sovereignty Stack
              </h1>
              
              <p className="text-2xl md:text-4xl font-semibold text-purple-200" data-testid="text-hero-tagline">
                Foundational liquidity for sovereign digital economies
              </p>
              
              <div className="max-w-3xl mx-auto space-y-4">
                <p className="text-lg md:text-xl text-white/90" data-testid="text-hero-description">
                  A protocol-layer infrastructure enabling any platform—casinos, metaverses, DAOs—to offer instant fiat-to-token conversion through a shared agent network. 
                  <span className="font-semibold text-purple-200"> BetWin casino</span> is our flagship integration.
                  <span className="font-semibold text-purple-200"> Your platform</span> could be next.
                </p>
                
                <div className="flex flex-wrap gap-3 justify-center items-center text-sm text-white/80">
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                    <Coins className="h-4 w-4 text-purple-300" />
                    <span>1B Max Supply</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                    <Flame className="h-4 w-4 text-orange-300" />
                    <span>1% Burn Rate</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full">
                    <Shield className="h-4 w-4 text-green-300" />
                    <span>Deflationary Tokenomics</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Link href="#agents">
                  <Button size="lg" className="bg-white hover:bg-white/90 text-purple-900 font-semibold" data-testid="button-find-agent">
                    Find an Agent <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/register-agent">
                  <Button size="lg" variant="outline" className="bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20" data-testid="button-register-wallet">
                    <Wallet className="mr-2 h-4 w-4" />
                    Register Instantly
                  </Button>
                </Link>
              </div>
              
              <div className="mt-4 text-center">
                <p className="text-sm text-white/70">
                  Or{" "}
                  <Link href="/apply" className="text-purple-200 hover:text-purple-100 underline font-medium" data-testid="link-apply-kyc-hero">
                    apply via traditional KYC
                  </Link>{" "}
                  for higher tier access
                </p>
              </div>
            </div>

            {/* Live Marketplace Metrics Ticker */}
            <motion.div 
              className="mt-20 rounded-2xl p-8 border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              data-testid="stats-ticker"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center" data-testid="stat-liquidity">
                  <AnimatedCounter 
                    value={(() => {
                      const value = stats?.totalLiquidity ? Number(stats.totalLiquidity) : 0;
                      return isNaN(value) ? 0 : value;
                    })()}
                  />
                  <p className="text-sm text-white/70">TKOIN Liquidity</p>
                </div>

                <div className="text-center" data-testid="stat-agents">
                  <AnimatedCounter value={stats?.activeAgents ?? 0} />
                  <p className="text-sm text-white/70 mb-2">Active Agents</p>
                  <div className="flex gap-2 justify-center">
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs flex items-center gap-1" data-testid="badge-bronze">
                      <Medal className="h-3 w-3 text-orange-400" />
                      <span>{stats?.agentsByTier?.bronze ?? 0}</span>
                    </Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs flex items-center gap-1" data-testid="badge-silver">
                      <Award className="h-3 w-3 text-gray-300" />
                      <span>{stats?.agentsByTier?.silver ?? 0}</span>
                    </Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs flex items-center gap-1" data-testid="badge-gold">
                      <Trophy className="h-3 w-3 text-yellow-300" />
                      <span>{stats?.agentsByTier?.gold ?? 0}</span>
                    </Badge>
                  </div>
                </div>

                <div className="text-center" data-testid="stat-volume">
                  <AnimatedCounter 
                    value={(() => {
                      const value = stats?.volume24h ? Number(stats.volume24h) : 0;
                      return isNaN(value) ? 0 : value;
                    })()}
                  />
                  <p className="text-sm text-white/70">24h Volume (TKOIN)</p>
                </div>

                <div className="text-center" data-testid="stat-currencies">
                  <AnimatedCounter value={stats?.supportedCurrencies ?? 6} />
                  <p className="text-sm text-white/70 mb-2">Currencies</p>
                  <div className="flex flex-wrap gap-1 justify-center">
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">PHP</Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">EUR</Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">USD</Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">JPY</Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">GBP</Badge>
                    <Badge variant="outline" className="bg-white/10 border-white/30 text-white text-xs">AUD</Badge>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* On-Chain Credibility Section */}
        <OnChainCredibilitySection />

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

              {/* For Sovereign Platforms */}
              <Card className="hover-elevate">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>For Sovereign Platforms</CardTitle>
                  <CardDescription>Plug into shared liquidity</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-medium">Register Platform</p>
                      <p className="text-sm text-muted-foreground">Get webhook credentials & API access</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-medium">Integrate Webhooks</p>
                      <p className="text-sm text-muted-foreground">Bidirectional credit sync (HMAC-secured)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-xs font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-medium">Launch & Scale</p>
                      <p className="text-sm text-muted-foreground">Instant access to agent network</p>
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

            <div className="mt-12 space-y-6">
              <Card className="hover-elevate border-2 border-primary/20">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <Wallet className="h-6 w-6 text-primary mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">Instant Registration (Recommended)</h3>
                        <p className="text-muted-foreground mb-4">
                          Hold 10,000+ TKOIN in your Solana wallet? Get instant Basic tier access with no KYC required. 
                          Connect your wallet, prove ownership, and start earning immediately.
                        </p>
                        <Link href="/register-agent">
                          <Button size="lg" data-testid="button-register-instant">
                            <Wallet className="mr-2 h-4 w-4" />
                            Register with Wallet <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="hover-elevate">
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start gap-4">
                      <FileCheck className="h-6 w-6 text-muted-foreground mt-1" />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold mb-2">Traditional KYC Application</h3>
                        <p className="text-muted-foreground mb-4">
                          Apply for Verified or Premium tier access through our KYC process. Higher transaction limits, 
                          better commission rates, and enhanced platform features.
                        </p>
                        <Link href="/apply">
                          <Button size="lg" variant="outline" data-testid="button-apply-kyc">
                            Apply via KYC <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
                    Max supply of 1 Billion TKOIN. Soft-peg conversion rate of 1 TKOIN = 100 gaming credits. 
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
                <li><a href="/api/login" className="hover:text-primary" data-testid="link-agent-portal-footer">Agent Portal</a></li>
                <li><a href="/register-agent" className="hover:text-primary" data-testid="link-register-wallet-footer">Register with Wallet</a></li>
                <li><a href="/apply" className="hover:text-primary" data-testid="link-apply-kyc-footer">Apply via KYC</a></li>
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
