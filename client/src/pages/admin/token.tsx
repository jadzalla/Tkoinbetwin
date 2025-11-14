import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
} from "lucide-react";

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
  deploymentStatus: 'pending' | 'deployed' | 'failed';
  deployedAt?: Date;
  deploymentSignature?: string;
  deploymentError?: string;
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
          tokenName: "Tkoin",
          tokenSymbol: "TK",
          decimals: 6,
          maxSupply: "1000000000",
          burnRateBasisPoints: 100, // 1%
          maxBurnRateBasisPoints: 200, // 2%
          description: "Tkoin Protocol - Sovereignty Stack liquidity token",
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

  const formatSupply = (supply: string, decimals: number) => {
    if (!supply || supply === '0') return '0';
    const num = parseFloat(supply) / Math.pow(10, decimals);
    return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
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
                  <div className="font-semibold">Tkoin</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Symbol</div>
                  <div className="font-semibold">TK</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Decimals</div>
                  <div className="font-semibold">6</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Max Supply</div>
                  <div className="font-semibold">1,000,000,000 TK</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Burn Rate</div>
                  <div className="font-semibold">1% (0-2% adjustable)</div>
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
                <Alert className="border-green-600 bg-green-50 dark:bg-green-950">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertTitle className="text-green-600">Token Deployed Successfully</AlertTitle>
                  <AlertDescription className="text-green-600">
                    Your TKOIN token is live on Solana devnet. Agents can now perform buy/sell operations.
                  </AlertDescription>
                </Alert>
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
                          {formatSupply(config.maxSupply, config.decimals)}
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
                          {formatSupply(config.currentSupply, config.decimals)}
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
