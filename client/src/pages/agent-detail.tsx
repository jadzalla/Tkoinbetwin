import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, AlertCircle, Crown, ShieldCheck, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateOrderDialog } from "@/components/p2p/create-order-dialog";
import type { Agent, PaymentMethod } from "@/../../shared/schema";

interface AgentWithMethods extends Agent {
  paymentMethods?: PaymentMethod[];
}

export default function AgentDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const [createOrderOpen, setCreateOrderOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);

  const { data: agent, isLoading: agentLoading, isError: agentError } = useQuery<AgentWithMethods>({
    queryKey: [`/api/p2p/agents/${agentId}`],
    enabled: !!agentId,
  });

  const paymentMethods = agent?.paymentMethods || [];
  const isLoading = agentLoading;

  if (!agentId) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Alert variant="destructive" data-testid="alert-missing-agent-id">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Invalid agent ID</AlertDescription>
          </Alert>
          <Link href="/marketplace">
            <Button variant="outline" className="mt-4" data-testid="button-back-to-marketplace">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "premium": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "verified": return "bg-slate-400/10 text-slate-400 border-slate-400/20";
      default: return "bg-orange-600/10 text-orange-600 border-orange-600/20";
    }
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case "premium": return <Crown className="h-6 w-6" />;
      case "verified": return <ShieldCheck className="h-6 w-6" />;
      default: return <Award className="h-6 w-6" />;
    }
  };

  const handleCreateOrder = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    setCreateOrderOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <Skeleton className="h-24 w-24 rounded-full mx-auto" />
                <Skeleton className="h-6 w-32 mx-auto mt-4" />
              </CardHeader>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (agentError) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Alert variant="destructive" data-testid="error-loading-agent">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Failed to load agent information</AlertDescription>
          </Alert>
          <Link href="/marketplace">
            <Button variant="outline" className="mt-4" data-testid="button-back-to-marketplace">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto">
          <Alert variant="destructive" data-testid="alert-agent-not-found">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Agent not found</AlertDescription>
          </Alert>
          <Link href="/marketplace">
            <Button variant="outline" className="mt-4" data-testid="button-back-to-marketplace">
              Back to Marketplace
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const availableBalance = parseFloat(agent.tkoinBalance) - parseFloat(agent.lockedBalance);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/marketplace">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Marketplace
          </Button>
        </Link>

        {/* Agent Profile & Payment Methods */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Profile */}
          <Card className="lg:col-span-1">
            <CardHeader className="text-center">
              <Avatar className="h-24 w-24 mx-auto mb-4">
                <AvatarFallback className={`text-4xl ${getTierBadgeColor(agent.verificationTier)}`}>
                  {getTierIcon(agent.verificationTier)}
                </AvatarFallback>
              </Avatar>
              <CardTitle className="text-2xl" data-testid="text-agent-name">
                {agent.displayName || agent.username}
              </CardTitle>
              <CardDescription>@{agent.username}</CardDescription>
              <Badge 
                variant="outline" 
                className={`mt-2 ${getTierBadgeColor(agent.verificationTier)}`}
                data-testid="badge-agent-tier"
              >
                {agent.verificationTier.toUpperCase()} TIER
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
                <p className="text-xl font-mono font-semibold" data-testid="text-total-balance">
                  {parseFloat(agent.tkoinBalance).toLocaleString()} TKOIN
                </p>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-1">Available for Sale</p>
                <p className="text-xl font-mono font-semibold text-green-600" data-testid="text-available-balance">
                  {availableBalance.toLocaleString()} TKOIN
                </p>
              </div>
              {agent.email && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contact</p>
                    <p className="text-sm truncate">{agent.email}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>
                Choose a payment method to start an order
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!paymentMethods || paymentMethods.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    This agent has no payment methods configured yet
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {paymentMethods.map(method => (
                    <Card 
                      key={method.id} 
                      className="hover-elevate transition-all"
                      data-testid={`card-payment-method-${method.id}`}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {method.displayName}
                          </CardTitle>
                          {method.isActive ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs uppercase tracking-wide">
                          {method.methodType.replace(/_/g, " ")}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Min Amount</span>
                          <span className="font-mono font-semibold">
                            ${parseFloat(method.minAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Max Amount</span>
                          <span className="font-mono font-semibold">
                            ${parseFloat(method.maxAmount).toLocaleString()}
                          </span>
                        </div>
                        {method.instructions && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {method.instructions}
                          </p>
                        )}
                        <Button 
                          className="w-full mt-2" 
                          disabled={!method.isActive}
                          onClick={() => handleCreateOrder(method)}
                          data-testid={`button-buy-with-${method.id}`}
                        >
                          {method.isActive ? "Buy TKOIN" : "Unavailable"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create Order Dialog */}
      {agent && selectedPaymentMethod && (
        <CreateOrderDialog
          open={createOrderOpen}
          onOpenChange={setCreateOrderOpen}
          agent={agent}
          paymentMethod={selectedPaymentMethod}
          onSuccess={(orderId) => {
            setCreateOrderOpen(false);
            setLocation(`/orders/${orderId}`);
          }}
        />
      )}
    </div>
  );
}
