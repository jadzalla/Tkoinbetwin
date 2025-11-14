import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Wallet, QrCode, Clock, CheckCircle2, XCircle, Plus, TrendingDown } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { Agent, Currency } from "@shared/schema";

interface PaymentRequest {
  id: string;
  tkoinAmount: string;
  fiatAmount: string;
  fiatCurrency: string;
  qrCodeData: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export default function Inventory({ agent }: { agent: Agent }) {
  const { toast } = useToast();
  const [fiatAmount, setFiatAmount] = useState("");
  const [currency, setCurrency] = useState("USD");

  const { data: currencies, isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const { data: paymentRequests, isLoading } = useQuery<PaymentRequest[]>({
    queryKey: ["/api/payment-requests/me"],
  });

  // Initialize currency from first available if current selection is invalid
  useEffect(() => {
    if (currencies && currencies.length > 0) {
      const currentExists = currencies.some(c => c.code === currency);
      if (!currentExists) {
        setCurrency(currencies[0].code);
      }
    }
  }, [currencies, currency]);

  const createPaymentMutation = useMutation({
    mutationFn: async (data: { fiatAmount: string; currency: string }) => {
      return await apiRequest("POST", "/api/payment-requests", {
        fiatAmount: parseFloat(data.fiatAmount),
        currency: data.currency,
      });
    },
    onSuccess: () => {
      toast({
        title: "Payment request created",
        description: "QR code generated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests/me"] });
      setFiatAmount("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create payment request",
        description: error.message || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleCreatePayment = () => {
    const amount = parseFloat(fiatAmount);
    if (!fiatAmount || isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }
    createPaymentMutation.mutate({ fiatAmount, currency });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "expired":
      case "cancelled":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "default",
      completed: "secondary",
      expired: "destructive",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6" data-testid="page-inventory">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Wallet className="h-8 w-8" />
          Inventory & Funding
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your Tkoin balance and create payment requests
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current Balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="text-balance">
              {Number(agent.tkoinBalance || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">TKOIN</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Total Minted</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="text-minted">
              {Number(agent.totalMinted || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">TKOIN</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Daily Limit</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-mono font-bold" data-testid="text-limit">
              {Number(agent.dailyLimit || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">USD</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Create Payment Request
          </CardTitle>
          <CardDescription>
            Generate a QR code for users to pay you in fiat currency
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="fiat-amount">Fiat Amount</Label>
              <Input
                id="fiat-amount"
                type="number"
                placeholder="100"
                value={fiatAmount}
                onChange={(e) => setFiatAmount(e.target.value)}
                data-testid="input-fiat-amount"
              />
            </div>

            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select value={currency} onValueChange={setCurrency} disabled={currenciesLoading}>
                <SelectTrigger id="currency" data-testid="select-currency">
                  <SelectValue placeholder={currenciesLoading ? "Loading..." : "Select currency"} />
                </SelectTrigger>
                <SelectContent>
                  {currencies?.map((curr) => (
                    <SelectItem key={curr.code} value={curr.code} data-testid={`currency-option-${curr.code}`}>
                      {curr.symbol} {curr.code} – {curr.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleCreatePayment}
            disabled={createPaymentMutation.isPending}
            className="w-full"
            data-testid="button-create-payment"
          >
            {createPaymentMutation.isPending ? (
              "Creating..."
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Create Payment Request
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment Requests</CardTitle>
          <CardDescription>Your recent payment requests and their status</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : !paymentRequests || paymentRequests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No payment requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {paymentRequests.map((request) => (
                <Card key={request.id} className="p-4" data-testid={`card-payment-${request.id}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(request.status)}
                        <span className="font-mono font-semibold">
                          {request.fiatCurrency} {Number(request.fiatAmount || 0).toFixed(2)}
                        </span>
                        <TrendingDown className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono text-muted-foreground">
                          {Number(request.tkoinAmount || 0).toFixed(2)} TKOIN
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(request.createdAt).toLocaleString()}
                        {request.status === "pending" && request.expiresAt && (
                          <> • Expires: {new Date(request.expiresAt).toLocaleString()}</>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(request.status)}
                  </div>

                  {request.status === "pending" && request.qrCodeData && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                          <QRCodeSVG value={request.qrCodeData} size={200} level="H" data-testid={`qr-code-${request.id}`} />
                        </div>
                        <p className="text-sm font-medium text-center">
                          Scan this QR code to complete payment
                        </p>
                        <details className="text-xs text-muted-foreground w-full">
                          <summary className="cursor-pointer hover:text-foreground">Show payment details</summary>
                          <div className="mt-2 p-2 bg-muted rounded font-mono text-xs break-all" data-testid={`qr-data-${request.id}`}>
                            {request.qrCodeData}
                          </div>
                        </details>
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
