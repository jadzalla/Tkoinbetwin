import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import type { Agent, Currency } from "@shared/schema";

interface AgentPricing {
  currency: string;
  isActive: boolean;
  bidPricePer1kTkoin: number;
  askPricePer1kTkoin: number;
  margin: number;
  fxRate: number;
  fxRateAge: number;
  bidSpreadBps: number;
  askSpreadBps: number;
  fxBufferBps: number;
  minOrderUsd: number;
  maxOrderUsd: number;
  dailyLimitUsd: number;
}

interface PricingProps {
  agent: Agent;
}

export default function Pricing({ agent }: PricingProps) {
  const { toast } = useToast();
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [bidSpreadBps, setBidSpreadBps] = useState(150);
  const [askSpreadBps, setAskSpreadBps] = useState(250);
  const [fxBufferBps, setFxBufferBps] = useState(75);

  // Fetch supported currencies
  const { data: currencies, isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/currencies"],
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  // Fetch current pricing for selected currency
  const { data: pricing, isLoading } = useQuery<AgentPricing>({
    queryKey: ["/api/agents/me/pricing", selectedCurrency],
    enabled: !!selectedCurrency,
  });

  // Update local state when pricing data loads
  useEffect(() => {
    if (pricing) {
      setBidSpreadBps(pricing.bidSpreadBps);
      setAskSpreadBps(pricing.askSpreadBps);
      setFxBufferBps(pricing.fxBufferBps);
    }
  }, [pricing]);

  // Initialize selectedCurrency from first available currency if current selection is invalid
  useEffect(() => {
    if (currencies && currencies.length > 0) {
      const currentExists = currencies.some(c => c.code === selectedCurrency);
      if (!currentExists) {
        setSelectedCurrency(currencies[0].code);
      }
    }
  }, [currencies, selectedCurrency]);

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/agents/pricing/configure", {
        currency: selectedCurrency,
        bidSpreadBps,
        askSpreadBps,
        fxBufferBps,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me/pricing", selectedCurrency] });
      toast({
        title: "Pricing Updated",
        description: `Your ${selectedCurrency} pricing configuration has been saved successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update pricing configuration",
        variant: "destructive",
      });
    },
  });

  const hasChanges = pricing && (
    bidSpreadBps !== pricing.bidSpreadBps ||
    askSpreadBps !== pricing.askSpreadBps ||
    fxBufferBps !== pricing.fxBufferBps
  );

  const currencyInfo = currencies?.find(c => c.code === selectedCurrency);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-pricing">Pricing & Limits</h1>
        <p className="text-muted-foreground">
          Configure your exchange rates and spreads for each currency. Set your bid/ask spreads to control your profit margins.
        </p>
      </div>

      {/* Currency Selector */}
      <Card data-testid="card-currency-selector">
        <CardHeader>
          <CardTitle>Select Currency</CardTitle>
          <CardDescription>Choose a currency to configure pricing</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedCurrency} onValueChange={setSelectedCurrency} disabled={currenciesLoading}>
            <SelectTrigger className="w-full" data-testid="select-currency">
              <SelectValue placeholder={currenciesLoading ? "Loading currencies..." : "Select currency"} />
            </SelectTrigger>
            <SelectContent>
              {currencies?.map((currency) => (
                <SelectItem key={currency.code} value={currency.code} data-testid={`currency-option-${currency.code}`}>
                  {currency.symbol} {currency.code} – {currency.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Current Live Pricing */}
      {pricing && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card data-testid="card-bid-price">
            <CardHeader className="pb-3">
              <CardDescription>You Buy At (from users)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <TrendingDown className="h-5 w-5 text-green-500" />
                <div className="text-2xl font-mono font-bold" data-testid="text-bid-price">
                  {pricing.bidPricePer1kTkoin.toFixed(2)}
                </div>
                <span className="text-sm text-muted-foreground">{selectedCurrency} / 1k TKOIN</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {(bidSpreadBps / 100).toFixed(2)}% discount from mid
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-ask-price">
            <CardHeader className="pb-3">
              <CardDescription>You Sell At (to users)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                <div className="text-2xl font-mono font-bold" data-testid="text-ask-price">
                  {pricing.askPricePer1kTkoin.toFixed(2)}
                </div>
                <span className="text-sm text-muted-foreground">{selectedCurrency} / 1k TKOIN</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {(askSpreadBps / 100).toFixed(2)}% markup from mid
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-margin">
            <CardHeader className="pb-3">
              <CardDescription>Your Margin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <div className="text-2xl font-mono font-bold" data-testid="text-margin">
                  {pricing.margin.toFixed(2)}
                </div>
                <span className="text-sm text-muted-foreground">{selectedCurrency} / 1k TKOIN</span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {((pricing.margin / pricing.bidPricePer1kTkoin) * 100).toFixed(2)}% profit margin
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Spread Configuration */}
      <Card data-testid="card-spread-config">
        <CardHeader>
          <CardTitle>Spread Configuration</CardTitle>
          <CardDescription>
            Adjust your bid/ask spreads to control profit margins. Higher spreads = more profit but less competitive pricing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Bid Spread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="bid-spread">Bid Spread (You buy from users)</Label>
              <Badge variant="outline" data-testid="badge-bid-spread">
                {(bidSpreadBps / 100).toFixed(2)}%
              </Badge>
            </div>
            <Slider
              id="bid-spread"
              min={50}
              max={500}
              step={10}
              value={[bidSpreadBps]}
              onValueChange={(value) => setBidSpreadBps(value[0])}
              data-testid="slider-bid-spread"
            />
            <p className="text-xs text-muted-foreground">
              Range: 0.5% - 5.0%. Lower = pay users more = less profit but more volume
            </p>
          </div>

          {/* Ask Spread */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="ask-spread">Ask Spread (You sell to users)</Label>
              <Badge variant="outline" data-testid="badge-ask-spread">
                {(askSpreadBps / 100).toFixed(2)}%
              </Badge>
            </div>
            <Slider
              id="ask-spread"
              min={50}
              max={500}
              step={10}
              value={[askSpreadBps]}
              onValueChange={(value) => setAskSpreadBps(value[0])}
              data-testid="slider-ask-spread"
            />
            <p className="text-xs text-muted-foreground">
              Range: 0.5% - 5.0%. Lower = charge users less = less profit but more competitive
            </p>
          </div>

          {/* FX Buffer */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="fx-buffer">FX Buffer (Currency risk protection)</Label>
              <Badge variant="outline" data-testid="badge-fx-buffer">
                {(fxBufferBps / 100).toFixed(2)}%
              </Badge>
            </div>
            <Slider
              id="fx-buffer"
              min={0}
              max={200}
              step={5}
              value={[fxBufferBps]}
              onValueChange={(value) => setFxBufferBps(value[0])}
              data-testid="slider-fx-buffer"
            />
            <p className="text-xs text-muted-foreground">
              Range: 0% - 2.0%. Protection against currency fluctuations between quote and settlement
            </p>
          </div>

          {/* Save Button */}
          <div className="flex items-center justify-between pt-4">
            {hasChanges && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertCircle className="h-4 w-4" />
                <span data-testid="text-unsaved-changes">Unsaved changes</span>
              </div>
            )}
            <Button
              className="ml-auto"
              onClick={() => saveMutation.mutate()}
              disabled={!hasChanges || saveMutation.isPending}
              data-testid="button-save-pricing"
            >
              {saveMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Order Limits */}
      {pricing && (
        <Card data-testid="card-order-limits">
          <CardHeader>
            <CardTitle>Order Limits</CardTitle>
            <CardDescription>
              Transaction limits based on your verification tier
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Min Order</dt>
                <dd className="text-xl font-mono font-bold" data-testid="text-min-order">
                  ${pricing.minOrderUsd.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Max Order</dt>
                <dd className="text-xl font-mono font-bold" data-testid="text-max-order">
                  ${pricing.maxOrderUsd.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground mb-1">Daily Limit</dt>
                <dd className="text-xl font-mono font-bold" data-testid="text-daily-limit">
                  ${pricing.dailyLimitUsd.toFixed(2)}
                </dd>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Upgrade your verification tier to increase limits
            </p>
          </CardContent>
        </Card>
      )}

      {/* Profit Calculator */}
      {pricing && (
        <Card data-testid="card-profit-calculator">
          <CardHeader>
            <CardTitle>Profit Calculator</CardTitle>
            <CardDescription>
              Estimate your earnings per transaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Example: 10,000 TKOIN transaction</Label>
                  <div className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You buy from user:</span>
                      <span className="font-mono" data-testid="text-calc-buy">
                        {(pricing.bidPricePer1kTkoin * 10).toFixed(2)} {selectedCurrency}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">You sell to user:</span>
                      <span className="font-mono" data-testid="text-calc-sell">
                        {(pricing.askPricePer1kTkoin * 10).toFixed(2)} {selectedCurrency}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t font-bold">
                      <span>Your profit:</span>
                      <span className="text-green-600 font-mono" data-testid="text-calc-profit">
                        {(pricing.margin * 10).toFixed(2)} {selectedCurrency}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-md p-4">
                  <div className="text-sm font-medium mb-2">💡 Tips for Success</div>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Lower spreads attract more customers</li>
                    <li>• Higher spreads maximize profit per trade</li>
                    <li>• Monitor competitor rates regularly</li>
                    <li>• Adjust FX buffer during volatility</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
