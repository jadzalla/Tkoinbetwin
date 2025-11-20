import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { ArrowLeft, Clock, Send, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { P2pOrder, OrderMessage, Agent, PaymentMethod } from "@/../../shared/schema";

interface OrderWithDetails extends P2pOrder {
  agent?: Agent;
  paymentMethod?: PaymentMethod;
}

export default function OrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const { data: order, isLoading: orderLoading } = useQuery<OrderWithDetails>({
    queryKey: ["/api/p2p/orders", orderId],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<OrderMessage[]>({
    queryKey: ["/api/p2p/orders", orderId, "messages"],
    refetchInterval: 3000, // Refetch every 3 seconds
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", `/api/p2p/orders/${orderId}/messages`, { content });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/orders", orderId, "messages"] });
      setMessage("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to send message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markPaymentSentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/p2p/orders/${orderId}/payment-sent`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/orders", orderId] });
      toast({
        title: "Payment marked as sent",
        description: "The agent will be notified",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to mark payment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/p2p/orders/${orderId}/complete`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/orders", orderId] });
      toast({
        title: "Order completed",
        description: "TKOIN has been transferred",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to complete order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PATCH", `/api/p2p/orders/${orderId}/cancel`, { reason: "User cancelled" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/orders", orderId] });
      toast({
        title: "Order cancelled",
        description: "TKOIN has been unlocked",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate time remaining
  useEffect(() => {
    if (!order || order.status === "completed" || order.status === "cancelled") {
      setTimeRemaining(0);
      return;
    }

    const updateTimer = () => {
      const created = new Date(order.createdAt).getTime();
      const now = Date.now();
      const elapsed = now - created;
      const remaining = Math.max(0, 30 * 60 * 1000 - elapsed); // 30 minutes
      setTimeRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const formatTimeRemaining = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "cancelled": return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Clock className="h-5 w-5 text-amber-500" />;
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

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Skeleton className="h-10 w-32" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Order not found</AlertDescription>
          </Alert>
          <Link href="/orders">
            <Button variant="outline" className="mt-4" data-testid="button-back-to-orders">
              Back to Orders
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isExpiringSoon = timeRemaining > 0 && timeRemaining < 5 * 60 * 1000; // Less than 5 minutes

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Button */}
        <Link href="/orders">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Orders
          </Button>
        </Link>

        {/* Order Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-2xl" data-testid="text-order-id">
                    Order #{order.id.slice(0, 8)}
                  </CardTitle>
                  <Badge variant="outline" className={getStatusColor(order.status)} data-testid="badge-order-status">
                    {getStatusIcon(order.status)}
                    <span className="ml-1">{order.status.replace(/_/g, " ").toUpperCase()}</span>
                  </Badge>
                </div>
                <CardDescription>
                  Created {new Date(order.createdAt).toLocaleString()}
                </CardDescription>
              </div>
              {timeRemaining > 0 && order.status !== "completed" && order.status !== "cancelled" && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">Time Remaining</p>
                  <p 
                    className={`text-2xl font-mono font-bold ${isExpiringSoon ? "text-red-600" : ""}`}
                    data-testid="text-timer"
                  >
                    {formatTimeRemaining(timeRemaining)}
                  </p>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Details & Chat */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details */}
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">You Pay</p>
                    <p className="text-2xl font-mono font-semibold" data-testid="text-fiat-amount">
                      ${parseFloat(order.fiatAmount).toLocaleString()} {order.fiatCurrency}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">You Receive</p>
                    <p className="text-2xl font-mono font-semibold text-green-600" data-testid="text-tkoin-amount">
                      {parseFloat(order.tkoinAmount).toLocaleString()} TKOIN
                    </p>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Agent</p>
                  <p className="text-lg font-semibold">{order.agent?.displayName || "Loading..."}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                  <p className="text-lg">{order.paymentMethod?.displayName || "Loading..."}</p>
                </div>
              </CardContent>
            </Card>

            {/* Chat */}
            <Card>
              <CardHeader>
                <CardTitle>Chat</CardTitle>
                <CardDescription>Communicate with the agent</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] pr-4 mb-4">
                  {messagesLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : !messages || messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No messages yet. Start the conversation!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className="flex flex-col gap-1"
                          data-testid={`message-${msg.id}`}
                        >
                          <p className="text-xs text-muted-foreground">
                            {new Date(msg.createdAt).toLocaleTimeString()}
                          </p>
                          <div className="bg-muted rounded-lg p-3">
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type a message..."
                    disabled={order.status === "completed" || order.status === "cancelled"}
                    data-testid="input-message"
                  />
                  <Button 
                    type="submit" 
                    size="icon"
                    disabled={!message.trim() || sendMessageMutation.isPending || order.status === "completed" || order.status === "cancelled"}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {order.status === "created" && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Send payment using the agent's payment method, then mark as sent.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    className="w-full" 
                    onClick={() => markPaymentSentMutation.mutate()}
                    disabled={markPaymentSentMutation.isPending}
                    data-testid="button-mark-payment-sent"
                  >
                    Mark Payment Sent
                  </Button>
                </>
              )}
              
              {(order.status === "payment_sent" || order.status === "verifying") && (
                <>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Waiting for agent to confirm payment receipt and release TKOIN.
                    </AlertDescription>
                  </Alert>
                  <Button 
                    className="w-full" 
                    variant="outline"
                    data-testid="button-upload-proof"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Payment Proof
                  </Button>
                </>
              )}

              {order.status !== "completed" && order.status !== "cancelled" && (
                <>
                  <Separator />
                  <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => cancelOrderMutation.mutate()}
                    disabled={cancelOrderMutation.isPending}
                    data-testid="button-cancel-order"
                  >
                    Cancel Order
                  </Button>
                </>
              )}

              {/* Debug/Test button for completing orders */}
              {(order.status === "payment_sent" || order.status === "verifying") && (
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => completeOrderMutation.mutate()}
                  disabled={completeOrderMutation.isPending}
                  data-testid="button-complete-order"
                >
                  Complete Order (Test)
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
