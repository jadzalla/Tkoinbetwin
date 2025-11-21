import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DevBootstrap() {
  const { user, isLoading, isAdmin } = useAuth();
  const { toast } = useToast();
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapSuccess, setBootstrapSuccess] = useState(false);

  const handleBootstrap = async () => {
    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in first",
        variant: "destructive"
      });
      return;
    }

    setIsBootstrapping(true);
    try {
      const response = await fetch('/api/dev/bootstrap-admin', {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Bootstrap failed');
      }

      const data = await response.json();
      setBootstrapSuccess(true);
      toast({
        title: "Admin access granted!",
        description: `User ${data.userId} now has admin role. Please refresh the page.`,
      });

      setTimeout(() => {
        window.location.href = '/admin';
      }, 2000);
    } catch (error) {
      toast({
        title: "Bootstrap failed",
        description: error instanceof Error ? error.message : "Failed to grant admin access",
        variant: "destructive"
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/login';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Development Bootstrap</h1>
          <p className="text-muted-foreground">Grant admin access for development</p>
        </div>

        {!user ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Authentication Required
              </CardTitle>
              <CardDescription>
                You must be logged in to bootstrap admin access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={handleLogin} 
                className="w-full"
                data-testid="button-login"
              >
                Log in with Replit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5" />
                Bootstrap Admin Access
              </CardTitle>
              <CardDescription>
                Logged in as: {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Security Notice:</strong> This route grants admin privileges to the current user.
                  It is only available when ENABLE_DEV_BOOTSTRAP=true is explicitly set in environment variables.
                  This should NEVER be enabled in production.
                </AlertDescription>
              </Alert>

              {isAdmin ? (
                <Alert>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    You already have admin access! You can access the{' '}
                    <a href="/admin" className="underline">admin panel</a>.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Current status: <strong>{isAdmin ? 'Admin' : 'Regular User'}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Click below to grant yourself admin privileges.
                    </p>
                  </div>

                  <Button
                    onClick={handleBootstrap}
                    disabled={isBootstrapping || bootstrapSuccess}
                    className="w-full"
                    data-testid="button-bootstrap-admin"
                  >
                    {isBootstrapping ? 'Granting Admin Access...' : 'Grant Admin Access'}
                  </Button>

                  {bootstrapSuccess && (
                    <Alert>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <AlertDescription>
                        Admin access granted! Redirecting to admin panel...
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>What does this do?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              This development tool allows the first user to grant themselves admin access without
              requiring database manipulation or environment configuration.
            </p>
            <p>
              Once you have admin access, you can:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-4">
              <li>Manage sovereign platforms</li>
              <li>Configure currencies and tier limits</li>
              <li>Review agent applications</li>
              <li>Configure token burn rates</li>
              <li>Access analytics dashboards</li>
            </ul>
            <p className="pt-2">
              <strong>Note:</strong> In production, initial admin access should be configured via
              database seeds or environment variables, not via this bootstrap route.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
