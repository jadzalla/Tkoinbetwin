import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Wallet, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import bs58 from "bs58";

// Solana wallet detection
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array }>;
      publicKey?: { toString: () => string };
      isConnected: boolean;
    };
  }
}

const MINIMUM_STAKE = 10000;

export default function RegisterAgentPage() {
  const { toast } = useToast();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Check if wallet is already connected on mount
  useEffect(() => {
    if (window.solana?.isConnected && window.solana.publicKey) {
      setWalletAddress(window.solana.publicKey.toString());
    }
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    try {
      if (!window.solana) {
        toast({
          variant: "destructive",
          title: "Wallet Not Found",
          description: "Please install Phantom wallet to continue.",
        });
        return;
      }

      setIsConnecting(true);
      const response = await window.solana.connect();
      const address = response.publicKey.toString();
      setWalletAddress(address);

      toast({
        title: "Wallet Connected",
        description: `Connected to ${address.slice(0, 4)}...${address.slice(-4)}`,
      });
    } catch (error) {
      console.error("Wallet connection error:", error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Failed to connect wallet. Please try again.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect wallet
  const disconnectWallet = async () => {
    try {
      if (window.solana) {
        await window.solana.disconnect();
      }
      setWalletAddress(null);
      toast({
        title: "Wallet Disconnected",
        description: "Your wallet has been disconnected.",
      });
    } catch (error) {
      console.error("Wallet disconnection error:", error);
    }
  };

  // Check eligibility
  const { data: eligibility, isLoading: checkingEligibility } = useQuery<{
    eligible: boolean;
    reason: string;
    stakeBalance: number;
    minimumRequired: number;
    blockchainAvailable: boolean;
  }>({
    queryKey: ["/api/agents/check-eligibility", walletAddress],
    enabled: !!walletAddress,
    queryFn: async () => {
      const response = await apiRequest("POST", "/api/agents/check-eligibility", {
        walletAddress,
      });
      return await response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Register agent mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress || !window.solana) {
        throw new Error("Wallet not connected");
      }

      // Generate message to sign
      const message = `Sign this message to register as a Tkoin agent.\n\nWallet: ${walletAddress}\nTimestamp: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(message);

      // Request signature from wallet
      const { signature } = await window.solana.signMessage(messageBytes, "utf8");
      const signatureBase58 = bs58.encode(signature);

      // Submit registration
      const response = await apiRequest("POST", "/api/agents/register-permissionless", {
        walletAddress,
        signature: signatureBase58,
        message,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Registration Successful!",
          description: data.message || "You are now registered as an agent.",
        });
        // Invalidate queries to refresh agent status
        queryClient.invalidateQueries({ queryKey: ["/api/agents/me"] });
        queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      } else {
        toast({
          variant: "destructive",
          title: "Registration Failed",
          description: data.error || "Failed to register as agent",
        });
      }
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Registration Failed",
        description: error.message || "An unexpected error occurred",
      });
    },
  });

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Become an Agent
          </h1>
          <p className="text-muted-foreground" data-testid="text-page-description">
            Register as a liquidity agent by connecting your Solana wallet with at least {MINIMUM_STAKE.toLocaleString()} TKOIN tokens.
          </p>
        </div>

        {/* Wallet Connection */}
        <Card data-testid="card-wallet-connection">
          <CardHeader>
            <CardTitle>Connect Wallet</CardTitle>
            <CardDescription>
              Connect your Solana wallet to verify your TKOIN balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!walletAddress ? (
              <Button
                onClick={connectWallet}
                disabled={isConnecting}
                className="w-full"
                size="lg"
                data-testid="button-connect-wallet"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="mr-2 h-4 w-4" />
                    Connect Phantom Wallet
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg" data-testid="container-wallet-info">
                  <div>
                    <p className="text-sm text-muted-foreground">Connected Wallet</p>
                    <p className="font-mono text-sm" data-testid="text-wallet-address">
                      {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectWallet}
                    data-testid="button-disconnect-wallet"
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Eligibility Status */}
        {walletAddress && (
          <Card data-testid="card-eligibility-status">
            <CardHeader>
              <CardTitle>Registration Status</CardTitle>
              <CardDescription>
                Current eligibility for permissionless agent registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {checkingEligibility ? (
                <div className="flex items-center justify-center py-8" data-testid="loader-checking-eligibility">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">Checking eligibility...</span>
                </div>
              ) : eligibility ? (
                <div className="space-y-4">
                  {/* Blockchain Availability Warning */}
                  {!eligibility.blockchainAvailable && (
                    <Alert variant="destructive" data-testid="alert-blockchain-unavailable">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Blockchain services are currently unavailable. Please try again later or use the{" "}
                        <a href="/apply" className="underline font-medium" data-testid="link-permissioned-path-alert">
                          permissioned application path
                        </a>
                        .
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Balance Display */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg" data-testid="container-current-balance">
                      <p className="text-sm text-muted-foreground">Current Balance</p>
                      <p className="text-2xl font-bold" data-testid="text-stake-balance">
                        {eligibility.stakeBalance.toLocaleString()} TKOIN
                      </p>
                    </div>
                    <div className="p-4 border rounded-lg" data-testid="container-required-balance">
                      <p className="text-sm text-muted-foreground">Required Balance</p>
                      <p className="text-2xl font-bold" data-testid="text-minimum-required">
                        {eligibility.minimumRequired.toLocaleString()} TKOIN
                      </p>
                    </div>
                  </div>

                  {/* Eligibility Status */}
                  <div className="flex items-center justify-between p-4 border rounded-lg" data-testid="container-eligibility-result">
                    <div className="flex items-center gap-3">
                      {eligibility.eligible ? (
                        <>
                          <CheckCircle2 className="h-6 w-6 text-green-600" data-testid="icon-eligible" />
                          <div>
                            <p className="font-semibold" data-testid="text-eligible">Eligible for Registration</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-eligibility-reason">{eligibility.reason}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-6 w-6 text-destructive" data-testid="icon-not-eligible" />
                          <div>
                            <p className="font-semibold text-destructive" data-testid="text-not-eligible">Not Eligible</p>
                            <p className="text-sm text-muted-foreground" data-testid="text-eligibility-reason">{eligibility.reason}</p>
                          </div>
                        </>
                      )}
                    </div>
                    {eligibility.eligible && (
                      <Badge variant="default" data-testid="badge-eligible">
                        Ready
                      </Badge>
                    )}
                  </div>

                  {/* Register Button */}
                  <Button
                    onClick={() => registerMutation.mutate()}
                    disabled={!eligibility.eligible || !eligibility.blockchainAvailable || registerMutation.isPending}
                    className="w-full"
                    size="lg"
                    data-testid="button-register-agent"
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registering...
                      </>
                    ) : (
                      "Register as Agent"
                    )}
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        {!walletAddress && (
          <div className="grid md:grid-cols-2 gap-4">
            <Card data-testid="card-info-instant">
              <CardHeader>
                <CardTitle className="text-lg">Instant Registration</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Connect your wallet and get instant approval if you hold {MINIMUM_STAKE.toLocaleString()} TKOIN tokens. No waiting, no KYC required.
                </p>
              </CardContent>
            </Card>

            <Card data-testid="card-info-alternative">
              <CardHeader>
                <CardTitle className="text-lg">Alternative Path</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Don't have enough tokens?{" "}
                  <a href="/apply" className="text-primary hover:underline font-medium" data-testid="link-apply-permissioned">
                    Apply through our traditional KYC process
                  </a>{" "}
                  for Verified or Premium tier access.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
