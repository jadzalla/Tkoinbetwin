import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Agent, PaymentMethod } from "@/../../shared/schema";

interface AgentWithMethods extends Agent {
  paymentMethods?: PaymentMethod[];
}

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPaymentType, setSelectedPaymentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("rating");

  const { data: agents, isLoading } = useQuery<AgentWithMethods[]>({
    queryKey: ["/api/agents"],
  });

  const { data: paymentMethods } = useQuery<PaymentMethod[]>({
    queryKey: ["/api/payment-methods/all"],
  });

  // Get unique payment types from all agents' payment methods
  const paymentTypes = Array.from(
    new Set(paymentMethods?.map(pm => pm.methodType) || [])
  );

  // Filter agents based on search and payment type
  const filteredAgents = agents?.filter(agent => {
    const matchesSearch = !searchQuery || 
      agent.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.username.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesPaymentType = selectedPaymentType === "all" || 
      agent.paymentMethods?.some(pm => pm.methodType === selectedPaymentType);
    
    return matchesSearch && matchesPaymentType && agent.status === "approved";
  }) || [];

  // Sort agents
  const sortedAgents = [...filteredAgents].sort((a, b) => {
    switch (sortBy) {
      case "balance":
        return parseFloat(b.tkoinBalance) - parseFloat(a.tkoinBalance);
      case "tier":
        const tierOrder: Record<string, number> = { "premium": 3, "verified": 2, "basic": 1 };
        return (tierOrder[b.verificationTier] || 0) - (tierOrder[a.verificationTier] || 0);
      default: // rating
        return 0; // Would sort by rating if we had it
    }
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "premium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "verified": return "bg-slate-400/10 text-slate-400 border-slate-400/20";
      default: return "bg-orange-600/10 text-orange-600 border-orange-600/20";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "premium": return "👑";
      case "verified": return "✓";
      default: return "🥉";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">P2P Marketplace</h1>
              <p className="text-muted-foreground">Find trusted agents to buy or sell TKOIN</p>
            </div>
            <Link href="/orders">
              <Button variant="outline" data-testid="button-my-orders">
                My Orders
              </Button>
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-agents"
              />
            </div>
            <Select value={selectedPaymentType} onValueChange={setSelectedPaymentType}>
              <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-payment-type">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                {paymentTypes.map(type => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-sort">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rating">Best Rating</SelectItem>
                <SelectItem value="balance">Most Liquidity</SelectItem>
                <SelectItem value="tier">Highest Tier</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Agent Grid */}
      <div className="container mx-auto px-4 py-8">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Card key={i} className="overflow-hidden">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : sortedAgents.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-2">No agents found</p>
            <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedAgents.map(agent => (
              <Card 
                key={agent.id} 
                className="overflow-hidden hover-elevate transition-all"
                data-testid={`card-agent-${agent.id}`}
              >
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className={getTierBadgeColor(agent.verificationTier)}>
                        {getTierIcon(agent.verificationTier)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg truncate">
                          {agent.displayName || agent.username}
                        </CardTitle>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={getTierBadgeColor(agent.verificationTier)}
                        data-testid={`badge-tier-${agent.verificationTier}`}
                      >
                        {agent.verificationTier.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                    <p className="text-2xl font-mono font-semibold" data-testid={`text-balance-${agent.id}`}>
                      {parseFloat(agent.tkoinBalance).toLocaleString()} TKOIN
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Payment Methods</p>
                    <div className="flex flex-wrap gap-2">
                      {agent.paymentMethods && agent.paymentMethods.length > 0 ? (
                        agent.paymentMethods.slice(0, 3).map(pm => (
                          <Badge key={pm.id} variant="secondary" className="text-xs">
                            {pm.displayName}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">No methods</Badge>
                      )}
                      {agent.paymentMethods && agent.paymentMethods.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agent.paymentMethods.length - 3} more
                        </Badge>
                      )}
                    </div>
                  </div>

                  <Link href={`/marketplace/agent/${agent.id}`}>
                    <Button className="w-full" data-testid={`button-view-agent-${agent.id}`}>
                      View Agent
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
