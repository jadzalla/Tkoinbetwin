import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { formatBaseUnits } from "@shared/token-utils";

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

export default function AdminToken() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isDeploying, setIsDeploying] = useState(false);
  const [redeployDialogOpen, setRedeployDialogOpen] = useState(false);
  const [redeployReason, setRedeployReason] = useState("");

  // Fetch token configuration
  const { data: configResponse, isLoading: configLoading, refetch } = useQuery({
    queryKey: ["/api/admin/token/config"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  const config = (configResponse as { config: TokenConfig | null } | undefined)?.config;

  // Deploy mutation
  const deployMutation = useMutation({
    mutationFn: async () => {
      setIsDeploying(true);
      try {
        const response = await apiRequest("POST", "/api/admin/token/deploy", {
          tokenName: TOKEN_NAME,
          tokenSymbol: TOKEN_SYMBOL,
          decimals: TOKEN_DECIMALS,
          maxSupply: TOKEN_MAX_SUPPLY_TOKENS,
          burnRateBasisPoints: TOKEN_BURN_RATE_BP,
          maxBurnRateBasisPoints: TOKEN_MAX_BURN_RATE_BP,
          description: TOKEN_DESCRIPTION,
        });
        const result = await response.json();
        return result as DeploymentResult;
      } finally {
        setIsDeploying(false);
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

  // Redeploy mutation (force redeploy)
  const redeployMutation = useMutation({
    mutationFn: async (reason: string) => {
      setIsDeploying(true);
      try {
        const response = await apiRequest("POST", "/api/admin/token/deploy", {
          tokenName: TOKEN_NAME,
          tokenSymbol: TOKEN_SYMBOL,
          decimals: TOKEN_DECIMALS,
          maxSupply: TOKEN_MAX_SUPPLY_TOKENS,
          burnRateBasisPoints: TOKEN_BURN_RATE_BP,
          maxBurnRateBasisPoints: TOKEN_MAX_BURN_RATE_BP,
          description: TOKEN_DESCRIPTION,
          forceRedeploy: true,
          redeployReason: reason,
        });
        const result = await response.json();
        return result as DeploymentResult;
      } finally {
        setIsDeploying(false);
        setRedeployDialogOpen(false);
        setRedeployReason("");
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/token/config"] });
      
      const result = data as unknown as DeploymentResult;
      toast({
        title: "Token Redeployed Successfully",
        description: `Mint address: ${result.mintAddress}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Redeployment Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

      {/* Deployment Status */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>TKOIN Token-2022</CardTitle>
              <CardDescription>Solana Token-2022 with transfer fee extension</CardDescription>
            </div>
            {config && getStatusBadge(config.deploymentStatus)}
          </div>
        </CardHeader>
        <CardContent>
          {!config ? (
            <div className="space-y-4">
              <Alert>
                <Rocket className="h-4 w-4" />
                <AlertTitle>Token Not Deployed</AlertTitle>
                <AlertDescription>
                  Deploy the TKOIN token to enable agent operations. This will create a Token-2022 on Solana devnet with a 1% configurable burn mechanism.
                </AlertDescription>
              </Alert>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">Token Name</div>
                  <div className="font-semibold">{TOKEN_NAME}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Symbol</div>
                  <div className="font-semibold">{TOKEN_SYMBOL}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Decimals</div>
                  <div className="font-semibold">{TOKEN_DECIMALS}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Supply</div>
                  <div className="font-semibold">{parseFloat(TOKEN_MAX_SUPPLY_TOKENS).toLocaleString()} {TOKEN_SYMBOL}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Burn Rate</div>
                  <div className="font-semibold">{TOKEN_BURN_RATE_BP / 100}% (0-{TOKEN_MAX_BURN_RATE_BP / 100}% adjustable)</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Network</div>
                  <div className="font-semibold">Solana Devnet</div>
                </div>
              </div>
              <Button
                onClick={() => deployMutation.mutate()}
                disabled={deployMutation.isPending || isDeploying}
                size="lg"
                className="w-full"
                data-testid="button-deploy"
              >
                {(deployMutation.isPending || isDeploying) ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4 mr-2" />
                    Deploy TKOIN Token
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Deployment Info */}
              {config.deploymentStatus === 'deployed' && (
                <>
                  <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle className="text-green-600">Token Deployed Successfully</AlertTitle>
                    <AlertDescription className="text-green-600">
                      Your TKOIN token is live on Solana devnet. Agents can now perform buy/sell operations.
                    </AlertDescription>
                  </Alert>
                  
                  <Dialog open={redeployDialogOpen} onOpenChange={setRedeployDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" data-testid="button-redeploy">
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Redeploy Token
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Redeploy TKOIN Token</DialogTitle>
                        <DialogDescription>
                          This will create a new Token-2022 deployment with updated metadata and initial supply. 
                          The old token will remain on-chain but this system will use the new mint address.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="redeploy-reason">Reason for Redeployment *</Label>
                          <Input
                            id="redeploy-reason"
                            placeholder="e.g., Add metadata and initial supply"
                            value={redeployReason}
                            onChange={(e) => setRedeployReason(e.target.value)}
                            data-testid="input-redeploy-reason"
                          />
                        </div>
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Warning</AlertTitle>
                          <AlertDescription>
                            This action will deploy a new token. Make sure you understand the implications before proceeding.
                          </AlertDescription>
                        </Alert>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setRedeployDialogOpen(false);
                            setRedeployReason("");
                          }}
                          data-testid="button-cancel-redeploy"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (!redeployReason.trim()) {
                              toast({
                                title: "Reason Required",
                                description: "Please provide a reason for redeployment",
                                variant: "destructive",
                              });
                              return;
                            }
                            redeployMutation.mutate(redeployReason);
                          }}
                          disabled={redeployMutation.isPending || isDeploying || !redeployReason.trim()}
                          data-testid="button-confirm-redeploy"
                        >
                          {(redeployMutation.isPending || isDeploying) ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Redeploying...
                            </>
                          ) : (
                            <>
                              <Rocket className="w-4 h-4 mr-2" />
                              Confirm Redeploy
                            </>
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}

              {config.deploymentStatus === 'failed' && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Deployment Failed</AlertTitle>
                  <AlertDescription>
                    {config.deploymentError || 'Unknown error occurred during deployment'}
                  </AlertDescription>
                </Alert>
              )}

              {config.deploymentStatus === 'pending' && (
                <Alert className="border-yellow-600 bg-yellow-50 dark:bg-yellow-950">
                  <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />
                  <AlertTitle className="text-yellow-600">Deployment In Progress</AlertTitle>
                  <AlertDescription className="text-yellow-600">
                    The token deployment is being processed on-chain. This may take a few moments...
                  </AlertDescription>
                </Alert>
              )}

              {/* Token Details */}
              {config.deploymentStatus === 'deployed' && (
                <>
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

                  {/* Token-2022 Extensions & Metadata */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Token-2022 Extensions & Metadata</CardTitle>
                      <CardDescription>Solana Token-2022 advanced features</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Extensions */}
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">Active Extensions</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" data-testid="badge-extension-transfer-fee">
                              Transfer Fee
                            </Badge>
                            <Badge variant="outline" data-testid="badge-extension-metadata">
                              Metadata Pointer
                            </Badge>
                          </div>
                        </div>

                        {/* Authorities */}
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">Authorities</div>
                          <div className="space-y-1 text-xs">
                            {config.mintAuthority && (
                              <div>
                                <span className="text-muted-foreground">Mint: </span>
                                <span className="font-mono" data-testid="text-mint-authority">
                                  {config.mintAuthority.slice(0, 8)}...{config.mintAuthority.slice(-8)}
                                </span>
                              </div>
                            )}
                            {config.freezeAuthority && (
                              <div>
                                <span className="text-muted-foreground">Freeze: </span>
                                <span className="font-mono" data-testid="text-freeze-authority">
                                  {config.freezeAuthority.slice(0, 8)}...{config.freezeAuthority.slice(-8)}
                                </span>
                              </div>
                            )}
                            {config.transferFeeConfigAuthority && (
                              <div>
                                <span className="text-muted-foreground">Transfer Fee: </span>
                                <span className="font-mono" data-testid="text-transfer-fee-authority">
                                  {config.transferFeeConfigAuthority.slice(0, 8)}...{config.transferFeeConfigAuthority.slice(-8)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Metadata */}
                      {(config.metadataUri || config.description || config.logoUrl) && (
                        <div className="border-t pt-4 space-y-3">
                          <div className="text-sm font-semibold">On-Chain Metadata</div>
                          
                          {config.description && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Description</div>
                              <div className="text-sm" data-testid="text-description">
                                {config.description}
                              </div>
                            </div>
                          )}

                          {config.metadataUri && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Metadata URI</div>
                              <a
                                href={config.metadataUri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                                data-testid="link-metadata-uri"
                              >
                                {config.metadataUri.slice(0, 40)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}

                          {config.logoUrl && (
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Logo URL</div>
                              <a
                                href={config.logoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-mono text-primary hover:underline flex items-center gap-1"
                                data-testid="link-logo-url"
                              >
                                {config.logoUrl.slice(0, 40)}...
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => refetch()}
                      data-testid="button-refresh"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration Details */}
      {config && (
        <Card>
          <CardHeader>
            <CardTitle>Token Configuration</CardTitle>
            <CardDescription>Technical details and parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Token Name</div>
                <div className="font-semibold" data-testid="text-token-name">{config.tokenName}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Symbol</div>
                <div className="font-semibold" data-testid="text-token-symbol">{config.tokenSymbol}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Decimals</div>
                <div className="font-semibold" data-testid="text-decimals">{config.decimals}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Status</div>
                <div>{getStatusBadge(config.deploymentStatus)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
