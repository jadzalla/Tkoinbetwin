import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Link } from "wouter";
import { ArrowLeft, Edit2, DollarSign, TrendingUp, Shield, Award } from "lucide-react";
import { z } from "zod";

const editLimitSchema = z.object({
  value: z.coerce.number().positive().min(100, "Limit must be at least $100"),
});

type EditLimitForm = z.infer<typeof editLimitSchema>;

interface TierLimits {
  basic: { daily: number; monthly: number };
  verified: { daily: number; monthly: number };
  premium: { daily: number; monthly: number };
}

export default function AdminTierLimits() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<{ tier: 'basic' | 'verified' | 'premium'; limitType: 'daily' | 'monthly' } | null>(null);

  const { data: tierLimits, isLoading } = useQuery<TierLimits>({
    queryKey: ["/api/admin/tier-limits"],
  });

  const form = useForm<EditLimitForm>({
    resolver: zodResolver(editLimitSchema),
    defaultValues: {
      value: 0,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ tier, limitType, value }: { tier: string; limitType: string; value: number }) => {
      return await apiRequest("PATCH", "/api/admin/tier-limits", { tier, limitType, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tier-limits"] });
      setIsEditOpen(false);
      setEditingTier(null);
      form.reset();
      toast({
        title: "Limit Updated",
        description: "Tier transaction limit has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update tier limit",
        variant: "destructive",
      });
    },
  });

  const openEditDialog = (tier: 'basic' | 'verified' | 'premium', limitType: 'daily' | 'monthly', currentValue: number) => {
    setEditingTier({ tier, limitType });
    form.reset({ value: currentValue });
    setIsEditOpen(true);
  };

  const handleSubmit = (data: EditLimitForm) => {
    if (!editingTier) return;
    updateMutation.mutate({
      tier: editingTier.tier,
      limitType: editingTier.limitType,
      value: data.value,
    });
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic': return Shield;
      case 'verified': return TrendingUp;
      case 'premium': return Award;
      default: return Shield;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'text-gray-500';
      case 'verified': return 'text-blue-500';
      case 'premium': return 'text-purple-500';
      default: return 'text-gray-500';
    }
  };

  if (!user?.isAdmin) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You must be an admin to access this page</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Tier Limits Configuration</h1>
        <p className="text-muted-foreground mt-2" data-testid="text-page-description">
          Configure transaction limits for each agent verification tier
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
        </div>
      ) : tierLimits ? (
        <div className="grid gap-6 md:grid-cols-3">
          {(['basic', 'verified', 'premium'] as const).map((tier) => {
            const Icon = getTierIcon(tier);
            const tierData = tierLimits[tier];
            
            return (
              <Card key={tier} data-testid={`card-tier-${tier}`}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${getTierColor(tier)}`} />
                    <CardTitle className="capitalize">{tier} Tier</CardTitle>
                  </div>
                  <CardDescription>
                    Transaction limits for {tier} tier agents
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Daily Limit</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(tier, 'daily', tierData.daily)}
                        data-testid={`button-edit-${tier}-daily`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold" data-testid={`text-${tier}-daily`}>
                        {tierData.daily.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Monthly Limit</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEditDialog(tier, 'monthly', tierData.monthly)}
                        data-testid={`button-edit-${tier}-monthly`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-2xl font-bold" data-testid={`text-${tier}-monthly`}>
                        {tierData.monthly.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent data-testid="dialog-edit-limit">
          <DialogHeader>
            <DialogTitle>Edit Tier Limit</DialogTitle>
            <DialogDescription>
              {editingTier && (
                <>Update the {editingTier.limitType} transaction limit for {editingTier.tier} tier agents</>
              )}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limit Amount (USD)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="number"
                          placeholder="1000"
                          data-testid="input-limit-value"
                        />
                      </div>
                    </FormControl>
                    <FormDescription>
                      Minimum value is $100. Higher tiers must have higher limits than lower tiers.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  data-testid="button-save"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
