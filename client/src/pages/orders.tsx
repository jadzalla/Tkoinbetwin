import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { P2pOrder, Agent, PaymentMethod } from "@/../../shared/schema";

interface OrderWithDetails extends P2pOrder {
  agent?: Agent;
  paymentMethod?: PaymentMethod;
}

export default function Orders() {
  const [activeTab, setActiveTab] = useState<string>("all");

  const { data: orders, isLoading } = useQuery<OrderWithDetails[]>({
    queryKey: ["/api/p2p/orders"],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-4 w-4" />;
      case "cancelled": return <XCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "cancelled": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "created": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "payment_sent": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "verifying": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
    }
  };

  const filteredOrders = orders?.filter(order => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return order.status !== "completed" && order.status !== "cancelled";
    if (activeTab === "completed") return order.status === "completed";
    if (activeTab === "cancelled") return order.status === "cancelled";
    return true;
  }) || [];

  const activeCount = orders?.filter(o => o.status !== "completed" && o.status !== "cancelled").length || 0;
  const completedCount = orders?.filter(o => o.status === "completed").length || 0;
  const cancelledCount = orders?.filter(o => o.status === "cancelled").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">My Orders</h1>
              <p className="text-muted-foreground">Track your P2P marketplace orders</p>
            </div>
            <Link href="/marketplace">
              <Button data-testid="button-marketplace">
                Browse Marketplace
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-4">
            <TabsTrigger value="all" data-testid="tab-all">
              All ({orders?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              Active ({activeCount})
            </TabsTrigger>
            <TabsTrigger value="completed" data-testid="tab-completed">
              Completed ({completedCount})
            </TabsTrigger>
            <TabsTrigger value="cancelled" data-testid="tab-cancelled">
              Cancelled ({cancelledCount})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-4 w-48" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-20 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-semibold mb-2">No orders found</p>
                  <p className="text-sm text-muted-foreground mb-6">
                    {activeTab === "all" 
                      ? "You haven't created any orders yet" 
                      : `No ${activeTab} orders`}
                  </p>
                  <Link href="/marketplace">
                    <Button data-testid="button-browse-agents">
                      Browse Agents
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map(order => (
                  <Card 
                    key={order.id} 
                    className="hover-elevate transition-all"
                    data-testid={`card-order-${order.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-lg">
                          Order #{order.id.slice(0, 8)}
                        </CardTitle>
                        <Badge 
                          variant="outline" 
                          className={getStatusColor(order.status)}
                          data-testid={`badge-status-${order.id}`}
                        >
                          {getStatusIcon(order.status)}
                          <span className="ml-1 text-xs">
                            {order.status.replace(/_/g, " ").toUpperCase()}
                          </span>
                        </Badge>
                      </div>
                      <CardDescription className="text-xs">
                        {new Date(order.createdAt).toLocaleDateString()} at{" "}
                        {new Date(order.createdAt).toLocaleTimeString()}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">You Pay</p>
                          <p className="font-mono font-semibold" data-testid={`text-fiat-${order.id}`}>
                            ${parseFloat(order.fiatAmount).toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">You Receive</p>
                          <p className="font-mono font-semibold text-green-600" data-testid={`text-tkoin-${order.id}`}>
                            {parseFloat(order.tkoinAmount).toLocaleString()} TK
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Agent</p>
                        <p className="text-sm font-medium truncate">
                          {order.agent?.displayName || order.agent?.username || "Loading..."}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Payment Method</p>
                        <p className="text-sm truncate">
                          {order.paymentMethod?.displayName || "Loading..."}
                        </p>
                      </div>

                      <Link href={`/orders/${order.id}`}>
                        <Button 
                          className="w-full mt-2" 
                          size="sm"
                          data-testid={`button-view-order-${order.id}`}
                        >
                          View Details
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
