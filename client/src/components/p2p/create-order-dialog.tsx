import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Agent, PaymentMethod } from "@/../../shared/schema";
import type { CreateP2pOrderInput } from "@/../../shared/p2p-schemas";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent;
  paymentMethod: PaymentMethod;
  onSuccess: (orderId: string) => void;
}

export function CreateOrderDialog({
  open,
  onOpenChange,
  agent,
  paymentMethod,
  onSuccess,
}: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [fiatAmount, setFiatAmount] = useState("");
  const [tkoinAmount, setTkoinAmount] = useState("");

  // Simple 1:1 conversion for now (in production, would use exchange rates)
  const exchangeRate = 1.0;

  const createOrderMutation = useMutation({
    mutationFn: async (data: CreateP2pOrderInput) => {
      const response = await apiRequest("POST", "/api/p2p/orders", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/p2p/orders"] });
      toast({
        title: "Order created",
        description: "Your order has been created successfully",
      });
      onSuccess(data.id);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create order",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFiatChange = (value: string) => {
    setFiatAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      const tkoin = parseFloat(value) * exchangeRate;
      setTkoinAmount(tkoin.toFixed(2));
    } else {
      setTkoinAmount("");
    }
  };

  const handleTkoinChange = (value: string) => {
    setTkoinAmount(value);
    if (value && !isNaN(parseFloat(value))) {
      const fiat = parseFloat(value) / exchangeRate;
      setFiatAmount(fiat.toFixed(2));
    } else {
      setFiatAmount("");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const fiat = parseFloat(fiatAmount);
    const tkoin = parseFloat(tkoinAmount);

    // Validation
    const minAmount = parseFloat(paymentMethod.minAmount);
    const maxAmount = parseFloat(paymentMethod.maxAmount);
    const availableBalance = parseFloat(agent.tkoinBalance) - parseFloat(agent.lockedBalance);

    if (isNaN(fiat) || isNaN(tkoin)) {
      toast({
        title: "Invalid amount",
        description: "Please enter valid amounts",
        variant: "destructive",
      });
      return;
    }

    if (fiat < minAmount || fiat > maxAmount) {
      toast({
        title: "Amount out of range",
        description: `Amount must be between $${minAmount} and $${maxAmount}`,
        variant: "destructive",
      });
      return;
    }

    if (tkoin > availableBalance) {
      toast({
        title: "Insufficient liquidity",
        description: `Agent only has ${availableBalance.toLocaleString()} TKOIN available`,
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate({
      agentId: String(agent.id),
      orderType: "sell", // User buying from agent (agent sells)
      tkoinAmount: tkoinAmount,
      fiatAmount: fiatAmount,
      fiatCurrency: "USD",
      paymentMethodId: String(paymentMethod.id),
    });
  };

  const minAmount = parseFloat(paymentMethod.minAmount);
  const maxAmount = parseFloat(paymentMethod.maxAmount);
  const availableBalance = parseFloat(agent.tkoinBalance) - parseFloat(agent.lockedBalance);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="dialog-create-order">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Buy TKOIN</DialogTitle>
            <DialogDescription>
              Create an order to buy TKOIN from {agent.displayName || agent.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6">
            {/* Payment Method Info */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="text-sm space-y-1">
                  <p className="font-semibold">{paymentMethod.displayName}</p>
                  <p className="text-muted-foreground">
                    Limits: ${minAmount.toLocaleString()} - ${maxAmount.toLocaleString()}
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Amount Input */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fiat-amount">You Pay (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="fiat-amount"
                    type="number"
                    step="0.01"
                    min={minAmount}
                    max={maxAmount}
                    value={fiatAmount}
                    onChange={(e) => handleFiatChange(e.target.value)}
                    placeholder="0.00"
                    className="pl-7 font-mono text-lg"
                    data-testid="input-fiat-amount"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Min: ${minAmount} | Max: ${maxAmount}
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  ⇄
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tkoin-amount">You Receive (TKOIN)</Label>
                <Input
                  id="tkoin-amount"
                  type="number"
                  step="0.01"
                  max={availableBalance}
                  value={tkoinAmount}
                  onChange={(e) => handleTkoinChange(e.target.value)}
                  placeholder="0.00"
                  className="font-mono text-lg"
                  data-testid="input-tkoin-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Available: {availableBalance.toLocaleString()} TKOIN
                </p>
              </div>
            </div>

            <Separator />

            {/* Order Summary */}
            <div className="space-y-2 bg-muted/50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Exchange Rate</span>
                <span className="font-mono font-semibold">1 TKOIN = $1.00 USD</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee</span>
                <span className="font-mono font-semibold">$0.00</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-semibold">Total</span>
                <span className="font-mono font-bold text-lg">
                  ${fiatAmount || "0.00"}
                </span>
              </div>
            </div>

            {/* Warning */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Once created, you have <strong>30 minutes</strong> to complete payment. 
                The TKOIN will be held in escrow until the agent confirms receipt.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createOrderMutation.isPending}
              data-testid="button-cancel-order"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!fiatAmount || !tkoinAmount || createOrderMutation.isPending}
              data-testid="button-confirm-order"
            >
              {createOrderMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Order
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
