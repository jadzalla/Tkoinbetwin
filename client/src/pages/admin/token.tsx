import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import {
  ArrowLeft,
  Rocket,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Coins,
  TrendingDown,
  DollarSign,
  AlertTriangle,
} from "lucide-react";
import { 
  TOKEN_NAME, 
  TOKEN_SYMBOL, 
  TOKEN_DECIMALS, 
  TOKEN_MAX_SUPPLY_TOKENS,
  TOKEN_BURN_RATE_BP,
  TOKEN_MAX_BURN_RATE_BP,
  TOKEN_DESCRIPTION
} from "@shared/token-constants";
import { baseUnitsToTokens } from "@shared/token-utils";

interface TokenConfig {
  id: string;
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  decimals: number;
  maxSupply: string;
  currentSupply: string;
  circulatingSupply: string;
  burnRateBasisPoints: number;
  maxBurnRateBasisPoints: number;
  treasuryWallet: string;
  mintAuthority?: string;
  freezeAuthority?: string;
  transferFeeConfigAuthority?: string;
  deploymentStatus: 'pending' | 'deployed' | 'failed';
  deployedAt?: Date;
  deploymentSignature?: string;
  deploymentError?: string;
  metadataUri?: string;
  logoUrl?: string;
  description?: string;
  explorerUrl?: string;
  signatureUrl?: string;
}

interface DeploymentResult {
  success: boolean;
  mintAddress?: string;
  signature?: string;
  explorerUrl?: string;
  message?: string;
  alreadyDeployed?: boolean;
  errorCode?: string;
}

// Deployment configuration schema with validation
const deploymentConfigSchema = z.object({
  // Basic Token Info
  tokenName: z.string().min(1, "Token name is required").max(32, "Token name too long"),
  tokenSymbol: z.string().min(1, "Token symbol is required").max(10, "Symbol too long").toUpperCase(),
  decimals: z.coerce.number().int().min(0).max(9).default(9),
  description: z.string().min(1, "Description is required").max(500),
  
  // Supply Configuration
  maxSupply: z.string().min(1, "Max supply is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Max supply must be a positive number"
  ),
  initialMintAmount: z.string().min(1, "Initial mint amount is required").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "Initial mint amount must be a positive number"
  ),
  
  // Fee Configuration (basis points: 100 = 1%)
  burnRateBasisPoints: z.coerce.number().int().min(0).max(200, "Burn rate cannot exceed 2%"),
  maxBurnRateBasisPoints: z.coerce.number().int().min(0).max(200, "Max burn rate cannot exceed 2%"),
  
  // Metadata URIs
  metadataUri: z.string().url("Must be a valid URL"),
  logoUri: z.string().url("Must be a valid URL"),
}).refine(
  (data) => Number(data.initialMintAmount) <= Number(data.maxSupply),
  {
    message: "Initial mint amount cannot exceed max supply",
    path: ["initialMintAmount"],
  }
).refine(
  (data) => data.burnRateBasisPoints <= data.maxBurnRateBasisPoints,
  {
    message: "Burn rate cannot exceed max burn rate",
    path: ["burnRateBasisPoints"],
  }
);

type DeploymentConfigForm = z.infer<typeof deploymentConfigSchema>;

export default function AdminToken() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [redeployReason, setRedeployReason] = useState("");
  
  // Form setup with default values
  const form = useForm<DeploymentConfigForm>({
    resolver: zodResolver(deploymentConfigSchema),
    defaultValues: {
      tokenName: TOKEN_NAME,
      tokenSymbol: TOKEN_SYMBOL,
      decimals: TOKEN_DECIMALS,
      maxSupply: TOKEN_MAX_SUPPLY_TOKENS,
      initialMintAmount: "100000000",
      burnRateBasisPoints: TOKEN_BURN_RATE_BP,
      maxBurnRateBasisPoints: TOKEN_MAX_BURN_RATE_BP,
      description: TOKEN_DESCRIPTION,
      metadataUri: "https://tkoin.finance/metadata.json",
      logoUri: "https://betwin.tkoin.finance/logo.png",
    },
  });

  // Fetch token configuration
  const { data: configResponse, isLoading: configLoading } = useQuery({
    queryKey: ["/api/admin/token/config"],
    refetchInterval: 5000,
  });

  const config = (configResponse as { config: TokenConfig | null } | undefined)?.config;

  // Hydrate form when config loads
  useEffect(() => {
    if (config) {
      // Convert base units back to tokens for form display
      console.log('DEBUG: Config loaded:', {
        maxSupply: config.maxSupply,
        currentSupply: config.currentSupply,
        decimals: config.decimals
      });
      
      const maxSupplyTokens = baseUnitsToTokens(config.maxSupply, config.decimals);
      const currentSupplyTokens = baseUnitsToTokens(config.currentSupply, config.decimals);
      
      console.log('DEBUG: Converted values:', {
        maxSupplyTokens,
        currentSupplyTokens
      });
      
      form.reset({
        tokenName: config.tokenName,
        tokenSymbol: config.tokenSymbol,
        decimals: config.decimals,
        maxSupply: maxSupplyTokens,
        initialMintAmount: currentSupplyTokens,
        burnRateBasisPoints: config.burnRateBasisPoints,
        maxBurnRateBasisPoints: config.maxBurnRateBasisPoints,
        description: config.description || TOKEN_DESCRIPTION,
        metadataUri: config.metadataUri || "https://tkoin.finance/metadata.json",
        logoUri: config.logoUrl || "https://betwin.tkoin.finance/logo.png",
      });
    }
  }, [config, form]);

  // Unified Deploy/Redeploy mutation
  const deployTokenMutation = useMutation({
    mutationFn: async ({ isRedeploy, reason }: { isRedeploy: boolean; reason?: string }) => {
      setIsDeploying(true);
      const formData = form.getValues();
      try {
        const response = await apiRequest("POST", "/api/admin/token/deploy", {
          ...formData,
          forceRedeploy: isRedeploy,
          redeployReason: reason,
        });
        const result = await response.json();
        return result as DeploymentResult;
      } finally {
        setIsDeploying(false);
        setConfirmDialogOpen(false);
        setRedeployReason("");
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/token/config"] });
      
      const result = data as unknown as DeploymentResult;
      if (result.alreadyDeployed) {
        toast({
          title: "Token Already Deployed",
          description: `Mint address: ${result.mintAddress}`,
        });
      } else {
        toast({
          title: "Token Deployed Successfully",
          description: `Mint address: ${result.mintAddress}`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Deployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleReviewAndDeploy = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      setConfirmDialogOpen(true);
    }
  };

  const handleConfirmDeploy = () => {
    const isRedeploy = !!config;
    if (isRedeploy && !redeployReason.trim()) {
      toast({
        title: "Reason Required",
        description: "Please provide a reason for redeployment",
        variant: "destructive",
      });
      return;
    }
    deployTokenMutation.mutate({ isRedeploy, reason: redeployReason });
  };

  if (authLoading || configLoading) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex items-center gap-2 mb-6">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Token Management</h1>
        </div>
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Alert variant="destructive">
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to access this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'deployed':
        return <Badge className="bg-green-600" data-testid="badge-status-deployed"><CheckCircle className="w-3 h-3 mr-1" />Deployed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600" data-testid="badge-status-pending"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive" data-testid="badge-status-failed"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="secondary" data-testid="badge-status-unknown">Unknown</Badge>;
    }
  };

  const formValues = form.watch();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link href="/admin">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Token Management</h1>
      </div>

      {/* Deployment Configuration Form */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>TKOIN Token-2022 Configuration</CardTitle>
              <CardDescription>Configure deployment parameters for Solana Token-2022</CardDescription>
            </div>
            {config && getStatusBadge(config.deploymentStatus)}
          </div>
        </CardHeader>
        <CardContent>
          {config?.deploymentStatus === 'deployed' && (
            <Alert className="border-green-600 bg-green-50 dark:bg-green-950 mb-6">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-600">Token Deployed Successfully</AlertTitle>
              <AlertDescription className="text-green-600">
                Your TKOIN token is live on Solana devnet. You can redeploy with updated configuration if needed.
              </AlertDescription>
            </Alert>
          )}

          {config?.deploymentStatus === 'failed' && (
            <Alert variant="destructive" className="mb-6">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Deployment Failed</AlertTitle>
              <AlertDescription>
                {config.deploymentError || 'Unknown error occurred during deployment'}
              </AlertDescription>
            </Alert>
          )}

          {config?.deploymentStatus === 'pending' && (
            <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950 mb-6">
              <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
              <AlertTitle className="text-yellow-600">Deployment In Progress</AlertTitle>
              <AlertDescription className="text-yellow-600">
                The token deployment is being processed on-chain. This may take a few moments...
              </AlertDescription>
            </Alert>
          )}

          {!config && (
            <Alert className="mb-6">
              <Rocket className="h-4 w-4" />
              <AlertTitle>Token Not Deployed</AlertTitle>
              <AlertDescription>
                Configure and deploy the TKOIN token to enable agent operations. This will create a Token-2022 on Solana devnet.
              </AlertDescription>
            </Alert>
          )}

          <Form {...form}>
            <form className="space-y-6">
              {/* Basic Token Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Token Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tokenName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Tkoin" {...field} data-testid="input-token-name" />
                        </FormControl>
                        <FormDescription>Full name of the token</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tokenSymbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token Symbol</FormLabel>
                        <FormControl>
                          <Input placeholder="TK" {...field} data-testid="input-token-symbol" />
                        </FormControl>
                        <FormDescription>Token ticker symbol (uppercase)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="decimals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Decimals</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="9" {...field} data-testid="input-decimals" />
                        </FormControl>
                        <FormDescription>Decimal places (Solana standard: 9)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Tkoin Protocol - Sovereignty Stack liquidity token" 
                          {...field} 
                          data-testid="input-description"
                          rows={3}
                        />
                      </FormControl>
                      <FormDescription>Token description for metadata</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Supply Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Supply Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="maxSupply"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Supply</FormLabel>
                        <FormControl>
                          <Input placeholder="1000000000" {...field} data-testid="input-max-supply" />
                        </FormControl>
                        <FormDescription>Maximum tokens that can exist</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="initialMintAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Mint Amount</FormLabel>
                        <FormControl>
                          <Input placeholder="100000000" {...field} data-testid="input-initial-mint" />
                        </FormControl>
                        <FormDescription>Tokens to mint at deployment</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Fee Configuration */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Burn Rate Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="burnRateBasisPoints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Burn Rate (Basis Points)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="200" {...field} data-testid="input-burn-rate" />
                        </FormControl>
                        <FormDescription>Current burn rate (100 = 1%)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="maxBurnRateBasisPoints"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Burn Rate (Basis Points)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="200" {...field} data-testid="input-max-burn-rate" />
                        </FormControl>
                        <FormDescription>Maximum adjustable burn rate (200 = 2%)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Metadata URIs */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Metadata & Assets</h3>
                <div className="grid grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="metadataUri"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Metadata URI</FormLabel>
                        <FormControl>
                          <Input placeholder="https://tkoin.finance/metadata.json" {...field} data-testid="input-metadata-uri" />
                        </FormControl>
                        <FormDescription>URL to token metadata JSON</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="logoUri"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Logo URI</FormLabel>
                        <FormControl>
                          <Input placeholder="https://betwin.tkoin.finance/logo.png" {...field} data-testid="input-logo-uri" />
                        </FormControl>
                        <FormDescription>URL to token logo image</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Review & Deploy Button */}
              <div className="pt-4">
                <Button
                  type="button"
                  onClick={handleReviewAndDeploy}
                  disabled={isDeploying || config?.deploymentStatus === 'pending'}
                  size="lg"
                  className="w-full"
                  data-testid="button-review-deploy"
                >
                  <Rocket className="w-4 h-4 mr-2" />
                  {config ? 'Review & Redeploy' : 'Review & Deploy'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Deployed Token Details */}
      {config?.deploymentStatus === 'deployed' && (
        <Card>
          <CardHeader>
            <CardTitle>Deployed Token Details</CardTitle>
            <CardDescription>Live token information on Solana devnet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Mint Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs font-mono break-all" data-testid="text-mint-address">
                    {config.mintAddress}
                  </div>
                  {config.explorerUrl && (
                    <a
                      href={config.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                      data-testid="link-explorer"
                    >
                      View on Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="w-4 h-4" />
                    Max Supply
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-max-supply">
                    {formatBaseUnits(config.maxSupply, config.decimals)}
                  </div>
                  <div className="text-xs text-muted-foreground">TK</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Current Supply
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-current-supply">
                    {formatBaseUnits(config.currentSupply, config.decimals)}
                  </div>
                  <div className="text-xs text-muted-foreground">TK minted</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Burn Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-burn-rate">
                    {config.burnRateBasisPoints / 100}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Adjustable 0-{config.maxBurnRateBasisPoints / 100}%
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Treasury</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xs font-mono break-all" data-testid="text-treasury">
                    {config.treasuryWallet}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Deployment</CardTitle>
                </CardHeader>
                <CardContent>
                  {config.deployedAt && (
                    <div className="text-sm" data-testid="text-deployed-at">
                      {new Date(config.deployedAt).toLocaleString()}
                    </div>
                  )}
                  {config.signatureUrl && (
                    <a
                      href={config.signatureUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
                      data-testid="link-signature"
                    >
                      View Transaction <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{config ? 'Confirm Redeployment' : 'Confirm Deployment'}</DialogTitle>
            <DialogDescription>
              {config 
                ? 'Review the configuration and provide a reason for redeploying the token.'
                : 'Review the configuration before deploying the TKOIN token to Solana devnet.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Configuration Summary */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Configuration Summary</h4>
              <div className="border rounded-md">
                <div className="grid grid-cols-2 gap-px bg-border">
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Token Name</div>
                    <div className="font-medium" data-testid="summary-token-name">{formValues.tokenName}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Symbol</div>
                    <div className="font-medium" data-testid="summary-token-symbol">{formValues.tokenSymbol}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Decimals</div>
                    <div className="font-medium" data-testid="summary-decimals">{formValues.decimals}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Max Supply</div>
                    <div className="font-medium" data-testid="summary-max-supply">{parseFloat(formValues.maxSupply).toLocaleString()}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Initial Mint</div>
                    <div className="font-medium" data-testid="summary-initial-mint">{parseFloat(formValues.initialMintAmount).toLocaleString()}</div>
                  </div>
                  <div className="bg-card p-3">
                    <div className="text-xs text-muted-foreground">Burn Rate</div>
                    <div className="font-medium" data-testid="summary-burn-rate">{formValues.burnRateBasisPoints / 100}% (Max: {formValues.maxBurnRateBasisPoints / 100}%)</div>
                  </div>
                  <div className="bg-card p-3 col-span-2">
                    <div className="text-xs text-muted-foreground">Description</div>
                    <div className="text-sm" data-testid="summary-description">{formValues.description}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Redeployment Reason (only if redeploying) */}
            {config && (
              <div className="space-y-2">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Redeployment Warning</AlertTitle>
                  <AlertDescription>
                    This will create a new token. The old token will remain on-chain but this system will use the new mint address.
                  </AlertDescription>
                </Alert>
                <div>
                  <label htmlFor="redeploy-reason" className="text-sm font-medium">
                    Reason for Redeployment *
                  </label>
                  <Textarea
                    id="redeploy-reason"
                    placeholder="e.g., Update metadata URIs and adjust initial supply"
                    value={redeployReason}
                    onChange={(e) => setRedeployReason(e.target.value)}
                    data-testid="input-redeploy-reason"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDialogOpen(false);
                setRedeployReason("");
              }}
              data-testid="button-cancel-deploy"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeploy}
              disabled={isDeploying || (config && !redeployReason.trim())}
              data-testid="button-confirm-deploy"
            >
              {isDeploying ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {config ? 'Redeploying...' : 'Deploying...'}
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4 mr-2" />
                  {config ? 'Confirm Redeploy' : 'Confirm Deploy'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
