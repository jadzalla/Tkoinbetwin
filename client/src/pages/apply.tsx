import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { CheckCircle2, Loader2, Building2, User } from "lucide-react";

const agentApplicationSchema = z.object({
  email: z.string().email("Valid email address is required"),
  businessName: z.string().min(2, "Business name must be at least 2 characters"),
  businessType: z.enum(["individual", "llc", "corporation", "partnership"], {
    errorMap: () => ({ message: "Please select a business type" })
  }),
  country: z.string().min(2, "Country is required"),
  city: z.string().min(2, "City is required"),
  address: z.string().min(5, "Full address is required"),
  phoneNumber: z.string().min(8, "Valid phone number is required"),
  requestedTier: z.enum(["basic", "verified", "premium"]).default("basic"),
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
      email: user?.email || "",
      businessName: "",
      businessType: "individual",
      country: "",
      city: "",
      address: "",
      phoneNumber: "",
      requestedTier: "basic",
    },
  });

  // Populate email when user data loads
  useEffect(() => {
    if (user?.email) {
      form.setValue("email", user.email);
    }
  }, [user?.email, form]);

  const applyMutation = useMutation({
    mutationFn: async (data: AgentApplication) => {
      return await apiRequest("POST", "/api/applications/submit", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/applications/me"] });
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
            <div className="bg-muted p-4 rounded-md space-y-2">
              <h4 className="font-medium text-sm">What's Next?</h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Admin review (typically 1-2 business days)</li>
                <li>Email notification upon approval</li>
                <li>Complete wallet setup to start earning</li>
              </ul>
            </div>
            <Button className="w-full" onClick={() => setLocation("/")} data-testid="button-go-home">
              Return Home
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
          <h1 className="text-3xl font-bold mb-2" data-testid="heading-apply">Apply to Become an Agent</h1>
          <p className="text-muted-foreground">
            Join our network of verified agents and start earning commissions by facilitating Tkoin exchanges
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Agent Application</CardTitle>
            <CardDescription>
              Provide your business information. All fields are required. You'll configure your Solana wallet after approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Business Information Section */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Building2 className="h-4 w-4" />
                    <span>Business Information</span>
                  </div>

                  <FormField
                    control={form.control}
                    name="businessName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business / Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your business or personal name" {...field} data-testid="input-business-name" />
                        </FormControl>
                        <FormDescription>
                          This name will be shown to customers in the agent directory
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="businessType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-business-type">
                              <SelectValue placeholder="Select business type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="individual" data-testid="option-individual">Individual / Sole Proprietor</SelectItem>
                            <SelectItem value="llc" data-testid="option-llc">LLC (Limited Liability Company)</SelectItem>
                            <SelectItem value="corporation" data-testid="option-corporation">Corporation</SelectItem>
                            <SelectItem value="partnership" data-testid="option-partnership">Partnership</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Your business entity type for compliance purposes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="requestedTier"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Requested Tier</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-requested-tier">
                              <SelectValue placeholder="Select tier" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="basic" data-testid="option-basic">Basic (0-9,999 TK stake)</SelectItem>
                            <SelectItem value="verified" data-testid="option-verified">Verified (10K-49,999 TK stake)</SelectItem>
                            <SelectItem value="premium" data-testid="option-premium">Premium (50K+ TK stake)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          You can upgrade tiers later by staking more TKOIN
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4 pt-4 border-t">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4" />
                    <span>Contact Information</span>
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="your@email.com" 
                            {...field} 
                            readOnly 
                            className="bg-muted cursor-not-allowed"
                            data-testid="input-email" 
                          />
                        </FormControl>
                        <FormDescription>
                          Your email from your Replit account (cannot be changed here)
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
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Address</FormLabel>
                        <FormControl>
                          <Input placeholder="Street address, suite/unit" {...field} data-testid="input-address" />
                        </FormControl>
                        <FormDescription>
                          Required for compliance and verification purposes
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone Number</FormLabel>
                        <FormControl>
                          <Input placeholder="+1234567890" {...field} data-testid="input-phone" />
                        </FormControl>
                        <FormDescription>
                          Include country code (e.g., +1 for US)
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex gap-4 pt-4">
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
