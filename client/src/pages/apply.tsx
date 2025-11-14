import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { CheckCircle2, Loader2 } from "lucide-react";

const agentApplicationSchema = z.object({
  solanaWallet: z.string().min(32, "Invalid Solana wallet address"),
  displayName: z.string().min(2, "Display name must be at least 2 characters"),
  country: z.string().min(2, "Country is required"),
  city: z.string().min(2, "City is required"),
  bio: z.string().optional(),
});

type AgentApplication = z.infer<typeof agentApplicationSchema>;

export default function Apply() {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<AgentApplication>({
    resolver: zodResolver(agentApplicationSchema),
    defaultValues: {
      solanaWallet: "",
      displayName: "",
      country: "",
      city: "",
      bio: "",
    },
  });

  const applyMutation = useMutation({
    mutationFn: async (data: AgentApplication) => {
      return await apiRequest("POST", "/api/agents/apply", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me"] });
      setSubmitted(true);
      toast({
        title: "Application Submitted",
        description: "Your agent application has been submitted successfully. We'll review it soon.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Application Failed",
        description: error.message || "Failed to submit application. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AgentApplication) => {
    applyMutation.mutate(data);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Login Required</CardTitle>
            <CardDescription>Please login to apply as an agent</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/login">
              <Button className="w-full" data-testid="button-login">Login to Apply</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.isAgent) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Already an Agent</CardTitle>
            <CardDescription>You are already registered as an agent</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/dashboard")} data-testid="button-dashboard">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-center">Application Submitted!</CardTitle>
            <CardDescription className="text-center">
              Thank you for applying to become a Tkoin agent. Our team will review your application and get back to you soon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              You can check your application status in your dashboard.
            </p>
            <Button className="w-full" onClick={() => setLocation("/dashboard")} data-testid="button-go-dashboard">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="container max-w-2xl px-4 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Apply to Become an Agent</h1>
          <p className="text-muted-foreground">
            Join our network of verified agents and start earning commissions by facilitating Tkoin exchanges
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agent Application</CardTitle>
            <CardDescription>
              Fill out the form below to apply. All fields are required unless marked optional.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="solanaWallet"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solana Wallet Address</FormLabel>
                      <FormControl>
                        <Input placeholder="Your Solana wallet address" {...field} data-testid="input-wallet" />
                      </FormControl>
                      <FormDescription>
                        This wallet will be used for receiving Tkoin inventory and commissions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Your public display name" {...field} data-testid="input-display-name" />
                      </FormControl>
                      <FormDescription>
                        This name will be shown to customers in the agent directory
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="country"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Country</FormLabel>
                        <FormControl>
                          <Input placeholder="Country" {...field} data-testid="input-country" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="City" {...field} data-testid="input-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bio (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell customers about yourself and your services..."
                          className="resize-none"
                          {...field}
                          data-testid="input-bio"
                        />
                      </FormControl>
                      <FormDescription>
                        Share information about your exchange services, payment methods accepted, etc.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setLocation("/")}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={applyMutation.isPending}
                    className="flex-1"
                    data-testid="button-submit"
                  >
                    {applyMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Submit Application
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
