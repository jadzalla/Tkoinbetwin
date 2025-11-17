import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Settings, AlertTriangle, Shield } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { baseUnitsToTokens, tokensToBaseUnits } from "@shared/token-utils";
import { TOKEN_DECIMALS } from "@shared/token-constants";
import type { BurnConfig } from "@shared/schema";

export default function BurnConfigPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery<BurnConfig>({
    queryKey: ["/api/admin/burn/config"],
    enabled: !!user?.isAdmin,
  });

  // Local state for form
  const [enabled, setEnabled] = useState(false);
  const [network, setNetwork] = useState<"devnet" | "mainnet">("devnet");
  const [burnRate, setBurnRate] = useState("");
  const [minBurnTokens, setMinBurnTokens] = useState("");
  const [maxBurnTokens, setMaxBurnTokens] = useState("");
  const [maxTreasuryPercent, setMaxTreasuryPercent] = useState("");
  const [cooldownHours, setCooldownHours] = useState("");

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setNetwork(config.network as "devnet" | "mainnet");
      setBurnRate(config.burnRatePercentage);
      setMinBurnTokens(baseUnitsToTokens(config.minBurnAmount));
      setMaxBurnTokens(baseUnitsToTokens(config.maxBurnAmount));
      setMaxTreasuryPercent(config.maxTreasuryBurnPercentage);
      setCooldownHours(config.cooldownPeriodHours.toString());
    }
  }, [config]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BurnConfig>) => {
      return await apiRequest("PATCH", "/api/admin/burn/config", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/burn/config"] });
      toast({
        title: "Configuration Updated",
        description: "Burn service configuration has been saved successfully.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    const updates: Partial<BurnConfig> = {
      enabled,
      network,
      burnRatePercentage: burnRate,
      minBurnAmount: tokensToBaseUnits(minBurnTokens, TOKEN_DECIMALS),
      maxBurnAmount: tokensToBaseUnits(maxBurnTokens, TOKEN_DECIMALS),
      maxTreasuryBurnPercentage: maxTreasuryPercent,
      cooldownPeriodHours: parseInt(cooldownHours),
    };

    updateMutation.mutate(updates);
  };

  if (authLoading || configLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <div className="mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Panel
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-burn-config">
          Burn Service Configuration
        </h1>
        <p className="text-muted-foreground">
          Configure safety limits and parameters for the manual burn approval system
        </p>
      </div>

      {/* Warning Card */}
      <Card className="mb-6 border-amber-500/50 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            Safety Notice
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• Always test on <strong>devnet</strong> before enabling on mainnet</p>
          <p>• Set conservative limits to protect treasury balance</p>
          <p>• All burn proposals require manual approval before execution</p>
          <p>• Changes take effect immediately upon saving</p>
        </CardContent>
      </Card>

      {/* Main Configuration */}
      <Card data-testid="card-config">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Service Settings
          </CardTitle>
          <CardDescription>
            Configure burn service parameters and safety limits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enabled" data-testid="label-enabled">Enable Burn Service</Label>
              <p className="text-sm text-muted-foreground">
                Allow creation of burn proposals
              </p>
            </div>
            <Switch
              id="enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
              data-testid="switch-enabled"
            />
          </div>

          {/* Network Selection */}
          <div className="space-y-2">
            <Label htmlFor="network" data-testid="label-network">Network</Label>
            <Select value={network} onValueChange={(v) => setNetwork(v as "devnet" | "mainnet")}>
              <SelectTrigger id="network" data-testid="select-network">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="devnet" data-testid="option-devnet">
                  Devnet (Testing)
                </SelectItem>
                <SelectItem value="mainnet" data-testid="option-mainnet">
                  Mainnet (Production)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              Select blockchain network for burn operations
            </p>
          </div>

          {/* Burn Rate */}
          <div className="space-y-2">
            <Label htmlFor="burnRate" data-testid="label-burn-rate">
              Default Burn Rate (% of Treasury)
            </Label>
            <Input
              id="burnRate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={burnRate}
              onChange={(e) => setBurnRate(e.target.value)}
              placeholder="1.00"
              data-testid="input-burn-rate"
            />
            <p className="text-sm text-muted-foreground">
              Percentage of treasury balance to propose for burning (0-100%)
            </p>
          </div>

          {/* Safety Limits */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Safety Limits</h3>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Min Burn */}
              <div className="space-y-2">
                <Label htmlFor="minBurn" data-testid="label-min-burn">
                  Minimum Burn (TKOIN)
                </Label>
                <Input
                  id="minBurn"
                  type="number"
                  step="0.01"
                  min="0"
                  value={minBurnTokens}
                  onChange={(e) => setMinBurnTokens(e.target.value)}
                  placeholder="1000000"
                  data-testid="input-min-burn"
                />
                <p className="text-sm text-muted-foreground">
                  Minimum allowed burn amount
                </p>
              </div>

              {/* Max Burn */}
              <div className="space-y-2">
                <Label htmlFor="maxBurn" data-testid="label-max-burn">
                  Maximum Burn (TKOIN)
                </Label>
                <Input
                  id="maxBurn"
                  type="number"
                  step="0.01"
                  min="0"
                  value={maxBurnTokens}
                  onChange={(e) => setMaxBurnTokens(e.target.value)}
                  placeholder="100000000"
                  data-testid="input-max-burn"
                />
                <p className="text-sm text-muted-foreground">
                  Maximum allowed burn amount
                </p>
              </div>
            </div>

            {/* Max Treasury Percentage */}
            <div className="space-y-2">
              <Label htmlFor="maxTreasuryPercent" data-testid="label-max-treasury-percent">
                Maximum Treasury Burn (%)
              </Label>
              <Input
                id="maxTreasuryPercent"
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={maxTreasuryPercent}
                onChange={(e) => setMaxTreasuryPercent(e.target.value)}
                placeholder="5.00"
                data-testid="input-max-treasury-percent"
              />
              <p className="text-sm text-muted-foreground">
                Maximum percentage of treasury that can be burned in a single proposal (0-100%)
              </p>
            </div>

            {/* Cooldown Period */}
            <div className="space-y-2">
              <Label htmlFor="cooldown" data-testid="label-cooldown">
                Cooldown Period (Hours)
              </Label>
              <Input
                id="cooldown"
                type="number"
                step="1"
                min="0"
                value={cooldownHours}
                onChange={(e) => setCooldownHours(e.target.value)}
                placeholder="24"
                data-testid="input-cooldown"
              />
              <p className="text-sm text-muted-foreground">
                Minimum time between burn executions
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              data-testid="button-save-config"
            >
              {updateMutation.isPending ? "Saving..." : "Save Configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Config Summary */}
      {config && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Current Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium" data-testid="text-status">
                {config.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network:</span>
              <span className="font-medium capitalize" data-testid="text-network">
                {config.network}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Last Updated:</span>
              <span className="font-medium" data-testid="text-updated">
                {config.updatedAt ? new Date(config.updatedAt).toLocaleString() : "Never"}
              </span>
            </div>
            {config.updatedBy && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated By:</span>
                <span className="font-medium" data-testid="text-updated-by">
                  {config.updatedBy}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
