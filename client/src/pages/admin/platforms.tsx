import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Plus, ArrowLeft, ShieldAlert, Shield, Edit, RefreshCw, Copy, Check, Trash2, Key, Globe } from "lucide-react";
import type { SovereignPlatform, InsertSovereignPlatform, PlatformApiToken } from "@shared/schema";
import { insertSovereignPlatformSchema } from "@shared/schema";
import { z } from "zod";

const createPlatformSchema = insertSovereignPlatformSchema.pick({
  id: true,
  name: true,
  displayName: true,
  description: true,
  webhookUrl: true,
  contactEmail: true,
  supportUrl: true,
  isPublic: true,
  tenantSubdomain: true,
}).extend({
  id: z.string().regex(/^[a-z0-9_-]+$/, "ID must be lowercase alphanumeric with underscores/hyphens only"),
  name: z.string().min(1, "Name is required"),
  displayName: z.string().default(""),
  description: z.string().default(""),
  webhookUrl: z.string().url().or(z.literal("")).default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  supportUrl: z.string().url().or(z.literal("")).default(""),
  tenantSubdomain: z.string().regex(/^[a-z0-9-]*$/, "Must be lowercase alphanumeric with hyphens only").or(z.literal("")).default(""),
});

type CreatePlatform = z.infer<typeof createPlatformSchema>;

const editPlatformSchema = createPlatformSchema.omit({ id: true }).extend({
  apiEnabled: z.boolean().default(false),
  webhookEnabled: z.boolean().default(false),
});
type EditPlatform = z.infer<typeof editPlatformSchema>;

export default function AdminPlatforms() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<SovereignPlatform | null>(null);
  const [generatedToken, setGeneratedToken] = useState<{ token: string; maskedToken: string } | null>(null);
  const [copiedStates, setCopiedStates] = useState<{ [key: string]: boolean }>({});

  const { data: platforms, isLoading: platformsLoading } = useQuery<SovereignPlatform[]>({
    queryKey: ["/api/admin/platforms"],
  });

  const { data: platformTokens } = useQuery<PlatformApiToken[]>({
    queryKey: ["/api/admin/platforms", editingPlatform?.id, "tokens"],
    enabled: !!editingPlatform?.id,
  });

  const createForm = useForm<CreatePlatform>({
    resolver: zodResolver(createPlatformSchema),
    defaultValues: {
      id: "",
      name: "",
      displayName: "",
      description: "",
      webhookUrl: "",
      contactEmail: "",
      supportUrl: "",
      isPublic: false,
      tenantSubdomain: "",
    },
  });

  const editForm = useForm<EditPlatform>({
    resolver: zodResolver(editPlatformSchema),
    defaultValues: {
      name: "",
      displayName: "",
      description: "",
      webhookUrl: "",
      contactEmail: "",
      supportUrl: "",
      isPublic: false,
      apiEnabled: false,
      webhookEnabled: false,
      tenantSubdomain: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePlatform) => {
      return await apiRequest("POST", "/api/admin/platforms", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms"] });
      setIsCreateOpen(false);
      createForm.reset();
      toast({
        title: "Platform Registered",
        description: "New sovereign platform has been registered successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register platform",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ platformId, updates }: { platformId: string; updates: EditPlatform }) => {
      return await apiRequest("PATCH", `/api/admin/platforms/${platformId}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms"] });
      toast({
        title: "Platform Updated",
        description: "Platform details have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update platform",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ platformId, isActive }: { platformId: string; isActive: boolean }) => {
      return await apiRequest("PUT", `/api/admin/platforms/${platformId}/toggle`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms"] });
      toast({
        title: "Status Updated",
        description: "Platform status has been toggled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Toggle Failed",
        description: error.message || "Failed to toggle platform status",
        variant: "destructive",
      });
    },
  });

  const regenerateSecretMutation = useMutation({
    mutationFn: async (platformId: string) => {
      return await apiRequest("POST", `/api/admin/platforms/${platformId}/regenerate-secret`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms"] });
      toast({
        title: "Secret Regenerated",
        description: "Webhook secret has been regenerated successfully. Update your platform configuration.",
        variant: "destructive",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Regeneration Failed",
        description: error.message || "Failed to regenerate webhook secret",
        variant: "destructive",
      });
    },
  });

  const generateTokenMutation = useMutation({
    mutationFn: async (platformId: string) => {
      return await apiRequest("POST", `/api/admin/platforms/${platformId}/generate-token`, {});
    },
    onSuccess: (data: { token: string; maskedToken: string; createdAt: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms", editingPlatform?.id, "tokens"] });
      setGeneratedToken({ token: data.token, maskedToken: data.maskedToken });
      toast({
        title: "API Token Generated",
        description: "New API token has been generated. Copy it now - it won't be shown again!",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Token Generation Failed",
        description: error.message || "Failed to generate API token",
        variant: "destructive",
      });
    },
  });

  const revokeTokenMutation = useMutation({
    mutationFn: async ({ platformId, tokenId }: { platformId: string; tokenId: string }) => {
      return await apiRequest("DELETE", `/api/admin/platforms/${platformId}/tokens/${tokenId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/platforms", editingPlatform?.id, "tokens"] });
      toast({
        title: "Token Revoked",
        description: "API token has been revoked successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Revocation Failed",
        description: error.message || "Failed to revoke token",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: CreatePlatform) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: EditPlatform) => {
    if (!editingPlatform) return;
    updateMutation.mutate({ platformId: editingPlatform.id, updates: data });
  };

  const openEditDialog = (platform: SovereignPlatform) => {
    setEditingPlatform(platform);
    setGeneratedToken(null);
    editForm.reset({
      name: platform.name,
      displayName: platform.displayName || "",
      description: platform.description || "",
      webhookUrl: platform.webhookUrl || "",
      contactEmail: platform.contactEmail || "",
      supportUrl: platform.supportUrl || "",
      isPublic: platform.isPublic,
      apiEnabled: platform.apiEnabled ?? false,
      webhookEnabled: platform.webhookEnabled ?? false,
      tenantSubdomain: platform.tenantSubdomain || "",
    });
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingPlatform(null);
    setGeneratedToken(null);
    editForm.reset();
  };

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedStates({ ...copiedStates, [key]: true });
    setTimeout(() => {
      setCopiedStates({ ...copiedStates, [key]: false });
    }, 2000);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const maskSecret = (secret: string | undefined) => {
    if (!secret) return "••••••••";
    if (secret.length <= 8) return "•".repeat(secret.length);
    return secret.substring(0, 4) + "•".repeat(secret.length - 8) + secret.substring(secret.length - 4);
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
            <CardTitle>Admin Access Required</CardTitle>
            <CardDescription>Please login to access the admin panel</CardDescription>
          </CardHeader>
          <CardContent>
            <a href="/api/login">
              <Button className="w-full" data-testid="button-login">Login to Continue</Button>
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAdmin = user.isAdmin;
  
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>
              This page is restricted to administrators only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Link href="/dashboard" className="flex-1">
                <Button variant="outline" className="w-full" data-testid="button-dashboard">
                  Go to Dashboard
                </Button>
              </Link>
              <Link href="/" className="flex-1">
                <Button className="w-full" data-testid="button-home">
                  Go to Homepage
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex h-16 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back-admin">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Platform Management</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" data-testid="button-profile">
              {user.email}
            </Button>
            <a href="/api/logout">
              <Button variant="outline" size="sm" data-testid="button-logout">Logout</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container py-8 px-4 md:px-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Sovereign Platforms</h1>
            <p className="text-muted-foreground">Manage platform integrations, API access, and webhooks</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-platform">
                <Plus className="h-4 w-4 mr-2" />
                Register Platform
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl" data-testid="dialog-create-platform">
              <DialogHeader>
                <DialogTitle>Register Sovereign Platform</DialogTitle>
                <DialogDescription>
                  Add a new platform to the Tkoin Protocol ecosystem
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform ID</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="platform_example"
                              onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                              data-testid="input-create-id"
                            />
                          </FormControl>
                          <FormDescription>Lowercase, alphanumeric, underscores/hyphens</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Example Platform" data-testid="input-create-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Example Platform Inc." data-testid="input-create-display" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="A brief description of the platform..." rows={3} data-testid="input-create-description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="contactEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact Email (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} type="email" placeholder="contact@example.com" data-testid="input-create-email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="supportUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support URL (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="https://support.example.com" data-testid="input-create-support" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={createForm.control}
                    name="isPublic"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="h-4 w-4"
                            data-testid="input-create-public"
                          />
                        </FormControl>
                        <FormLabel className="!mt-0">List in public platform directory</FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateOpen(false)}
                      data-testid="button-cancel-create"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      data-testid="button-confirm-create"
                    >
                      {createMutation.isPending ? "Registering..." : "Register Platform"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card data-testid="card-platforms-table">
          <CardHeader>
            <CardTitle>Registered Platforms</CardTitle>
            <CardDescription>
              {platforms?.length || 0} platforms registered
            </CardDescription>
          </CardHeader>
          <CardContent>
            {platformsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : platforms && platforms.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Platform ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-center">API</TableHead>
                    <TableHead className="text-center">Webhooks</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platforms.map((platform) => (
                    <TableRow key={platform.id} data-testid={`row-platform-${platform.id}`}>
                      <TableCell className="font-mono font-semibold" data-testid={`text-id-${platform.id}`}>
                        {platform.id}
                      </TableCell>
                      <TableCell data-testid={`text-name-${platform.id}`}>
                        <div>
                          <div className="font-medium">{platform.name}</div>
                          {platform.displayName && (
                            <div className="text-sm text-muted-foreground">{platform.displayName}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={platform.apiEnabled ? "default" : "secondary"}
                          data-testid={`badge-api-${platform.id}`}
                        >
                          {platform.apiEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={platform.webhookEnabled ? "default" : "secondary"}
                          data-testid={`badge-webhook-${platform.id}`}
                        >
                          {platform.webhookEnabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={platform.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${platform.id}`}
                        >
                          {platform.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(platform)}
                            data-testid={`button-edit-${platform.id}`}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Configure
                          </Button>
                          <Button
                            size="sm"
                            variant={platform.isActive ? "outline" : "default"}
                            onClick={() =>
                              toggleMutation.mutate({
                                platformId: platform.id,
                                isActive: !platform.isActive,
                              })
                            }
                            data-testid={`button-toggle-${platform.id}`}
                          >
                            {platform.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>No platforms registered yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Platform Dialog with API Integration & Webhook Sections */}
        <Dialog open={isEditOpen} onOpenChange={(open) => !open && closeEditDialog()}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-platform">
            <DialogHeader>
              <DialogTitle>Configure Platform: {editingPlatform?.name}</DialogTitle>
              <DialogDescription>
                Manage platform details, API access, and webhook integrations
              </DialogDescription>
            </DialogHeader>
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-6">
                {/* Basic Details Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Basic Details</h3>
                  <div className="space-y-4">
                    <FormField
                      control={editForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Platform Name</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Example Platform" data-testid="input-edit-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Example Platform Inc." data-testid="input-edit-display" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={editForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="A brief description..." rows={3} data-testid="input-edit-description" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editForm.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Email (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" placeholder="contact@example.com" data-testid="input-edit-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={editForm.control}
                        name="supportUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Support URL (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://support.example.com" data-testid="input-edit-support" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={editForm.control}
                      name="isPublic"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormControl>
                            <input
                              type="checkbox"
                              checked={field.value}
                              onChange={field.onChange}
                              className="h-4 w-4"
                              data-testid="input-edit-public"
                            />
                          </FormControl>
                          <FormLabel className="!mt-0">List in public platform directory</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <Separator />

                {/* API Integration Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        API Integration
                      </h3>
                      <p className="text-sm text-muted-foreground">Enable programmatic access to Tkoin Protocol</p>
                    </div>
                    <FormField
                      control={editForm.control}
                      name="apiEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormLabel className="text-sm font-normal">API Access</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-api-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {editForm.watch("apiEnabled") && (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                      <FormField
                        control={editForm.control}
                        name="tenantSubdomain"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Tenant Subdomain</FormLabel>
                            <FormControl>
                              <div className="flex items-center gap-2">
                                <Input {...field} placeholder="your-platform" data-testid="input-tenant-subdomain" className="font-mono" />
                                <span className="text-sm text-muted-foreground">.tkoin.protocol</span>
                              </div>
                            </FormControl>
                            <FormDescription>Custom subdomain for API endpoints (optional)</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Base API URL</FormLabel>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const baseUrl = editForm.watch("tenantSubdomain") 
                                ? `https://${editForm.watch("tenantSubdomain")}.tkoin.protocol/api/v1`
                                : `https://api.tkoin.protocol/platform/${editingPlatform?.id}`;
                              copyToClipboard(baseUrl, "base-url");
                            }}
                            data-testid="button-copy-base-url"
                          >
                            {copiedStates["base-url"] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                        <code className="block p-3 bg-muted rounded text-sm font-mono">
                          {editForm.watch("tenantSubdomain") 
                            ? `https://${editForm.watch("tenantSubdomain")}.tkoin.protocol/api/v1`
                            : `https://api.tkoin.protocol/platform/${editingPlatform?.id}`}
                        </code>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>API Tokens</FormLabel>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => editingPlatform && generateTokenMutation.mutate(editingPlatform.id)}
                            disabled={generateTokenMutation.isPending}
                            data-testid="button-generate-token"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {generateTokenMutation.isPending ? "Generating..." : "Generate Token"}
                          </Button>
                        </div>

                        {generatedToken && (
                          <Card className="mb-4 border-primary">
                            <CardHeader className="pb-3">
                              <CardTitle className="text-sm text-primary">New API Token Generated</CardTitle>
                              <CardDescription className="text-xs">
                                Copy this token now - it will not be shown again
                              </CardDescription>
                            </CardHeader>
                            <CardContent>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 p-2 bg-muted rounded text-xs font-mono break-all">
                                  {generatedToken.token}
                                </code>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => copyToClipboard(generatedToken.token, "new-token")}
                                  data-testid="button-copy-new-token"
                                >
                                  {copiedStates["new-token"] ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {platformTokens && platformTokens.length > 0 ? (
                          <div className="space-y-2">
                            {platformTokens.map((token) => (
                              <div
                                key={token.id}
                                className="flex items-center justify-between p-3 border rounded hover-elevate"
                                data-testid={`token-row-${token.id}`}
                              >
                                <div className="flex-1">
                                  <code className="text-xs font-mono">{token.maskedToken}</code>
                                  <div className="flex items-center gap-3 mt-1">
                                    <Badge variant={token.isActive ? "default" : "secondary"} className="text-xs">
                                      {token.isActive ? "Active" : "Revoked"}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      Created {new Date(token.createdAt).toLocaleDateString()}
                                    </span>
                                    {token.lastUsedAt && (
                                      <span className="text-xs text-muted-foreground">
                                        Last used {new Date(token.lastUsedAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {token.isActive && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      editingPlatform &&
                                      revokeTokenMutation.mutate({ platformId: editingPlatform.id, tokenId: token.id })
                                    }
                                    data-testid={`button-revoke-${token.id}`}
                                  >
                                    <Trash2 className="h-3 w-3 mr-1" />
                                    Revoke
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No API tokens generated yet
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Webhook Integration Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Globe className="h-5 w-5" />
                        Webhook Integration
                      </h3>
                      <p className="text-sm text-muted-foreground">Receive real-time notifications from Tkoin Protocol</p>
                    </div>
                    <FormField
                      control={editForm.control}
                      name="webhookEnabled"
                      render={({ field }) => (
                        <FormItem className="flex items-center gap-2 space-y-0">
                          <FormLabel className="text-sm font-normal">Webhooks</FormLabel>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="switch-webhook-enabled"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  {editForm.watch("webhookEnabled") && (
                    <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                      <FormField
                        control={editForm.control}
                        name="webhookUrl"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Webhook Endpoint URL</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="https://platform.example.com/webhooks/tkoin" data-testid="input-webhook-url" />
                            </FormControl>
                            <FormDescription>Your endpoint to receive webhook events</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <FormLabel>Webhook Secret</FormLabel>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => editingPlatform && regenerateSecretMutation.mutate(editingPlatform.id)}
                            disabled={regenerateSecretMutation.isPending}
                            data-testid="button-regenerate-secret"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {regenerateSecretMutation.isPending ? "Regenerating..." : "Regenerate"}
                          </Button>
                        </div>
                        <code className="block p-3 bg-muted rounded text-sm font-mono">
                          {maskSecret(editingPlatform?.webhookSecret)}
                        </code>
                        <p className="text-xs text-muted-foreground mt-1">
                          Use this secret to verify webhook signatures (HMAC-SHA256)
                        </p>
                      </div>

                      <div>
                        <FormLabel className="mb-2 block">Event Permissions</FormLabel>
                        <p className="text-xs text-muted-foreground mb-3">
                          Configure which events your platform should receive (coming soon)
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {["deposit", "withdrawal", "purchase", "sale"].map((event) => (
                            <div key={event} className="flex items-center gap-2 p-2 border rounded bg-background">
                              <input type="checkbox" defaultChecked className="h-4 w-4" disabled />
                              <span className="text-sm capitalize">{event}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeEditDialog}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="button-confirm-edit"
                  >
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
