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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Plus, ArrowLeft, ShieldAlert, Shield, Edit, Power, Eye, EyeOff, RefreshCw, Copy, Check } from "lucide-react";
import type { SovereignPlatform, InsertSovereignPlatform } from "@shared/schema";
import { insertSovereignPlatformSchema } from "@shared/schema";
import { z } from "zod";

// Create schema validation
const createPlatformSchema = insertSovereignPlatformSchema.pick({
  id: true,
  name: true,
  displayName: true,
  description: true,
  webhookUrl: true,
  contactEmail: true,
  supportUrl: true,
  isPublic: true,
}).extend({
  id: z.string().regex(/^[a-z0-9_-]+$/, "ID must be lowercase alphanumeric with underscores/hyphens only"),
  name: z.string().min(1, "Name is required"),
  displayName: z.string().default(""),
  description: z.string().default(""),
  webhookUrl: z.string().url().or(z.literal("")).default(""),
  contactEmail: z.string().email().or(z.literal("")).default(""),
  supportUrl: z.string().url().or(z.literal("")).default(""),
});

type CreatePlatform = z.infer<typeof createPlatformSchema>;

// Edit schema omits id since it's immutable
const editPlatformSchema = createPlatformSchema.omit({ id: true });
type EditPlatform = z.infer<typeof editPlatformSchema>;

export default function AdminPlatforms() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingPlatform, setEditingPlatform] = useState<SovereignPlatform | null>(null);

  const { data: platforms, isLoading: platformsLoading } = useQuery<SovereignPlatform[]>({
    queryKey: ["/api/admin/platforms"],
  });

  // Create form
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
    },
  });

  // Edit form
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
      setIsEditOpen(false);
      setEditingPlatform(null);
      editForm.reset();
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

  const handleCreateSubmit = (data: CreatePlatform) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: EditPlatform) => {
    if (!editingPlatform) return;
    updateMutation.mutate({ platformId: editingPlatform.id, updates: data });
  };

  const openEditDialog = (platform: SovereignPlatform) => {
    setEditingPlatform(platform);
    editForm.reset({
      name: platform.name,
      displayName: platform.displayName || "",
      description: platform.description || "",
      webhookUrl: platform.webhookUrl || "",
      contactEmail: platform.contactEmail || "",
      supportUrl: platform.supportUrl || "",
      isPublic: platform.isPublic,
    });
    setIsEditOpen(true);
  };

  // Removed: toggleSecretVisibility and copyToClipboard
  // Security: Secrets are always masked and never exposed in the UI

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
            <p className="text-muted-foreground">Manage platform integrations and webhook credentials</p>
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

                  <FormField
                    control={createForm.control}
                    name="webhookUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Webhook URL (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://platform.example.com/webhooks/tkoin" data-testid="input-create-webhook" />
                        </FormControl>
                        <FormDescription>Where Tkoin will send credit notifications</FormDescription>
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
                    <TableHead>Webhook URL</TableHead>
                    <TableHead>Webhook Secret</TableHead>
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
                      <TableCell data-testid={`text-webhook-${platform.id}`}>
                        {platform.webhookUrl ? (
                          <span className="text-xs font-mono">{platform.webhookUrl}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not configured</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-secret-${platform.id}`}>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono">
                            {maskSecret(platform.webhookSecret)}
                          </code>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                toast({
                                  title: "Security Notice",
                                  description: "Webhook secrets are always masked for security. Raw secrets are never exposed in the UI.",
                                  variant: "default",
                                });
                              }}
                              data-testid={`button-toggle-secret-${platform.id}`}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                toast({
                                  title: "Cannot Copy Masked Secret",
                                  description: "For security, masked secrets cannot be copied. If you need the full secret, regenerate it and capture it during setup.",
                                  variant: "destructive",
                                });
                              }}
                              data-testid={`button-copy-secret-${platform.id}`}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
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
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={platform.isActive ? "destructive" : "default"}
                            onClick={() => toggleMutation.mutate({
                              platformId: platform.id,
                              isActive: !platform.isActive
                            })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-${platform.id}`}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Regenerate webhook secret for ${platform.name}? This will break existing integrations until updated.`)) {
                                regenerateSecretMutation.mutate(platform.id);
                              }
                            }}
                            disabled={regenerateSecretMutation.isPending}
                            data-testid={`button-regenerate-${platform.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No platforms registered yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl" data-testid="dialog-edit-platform">
            <DialogHeader>
              <DialogTitle>Edit Platform</DialogTitle>
              <DialogDescription>
                Update platform details (ID cannot be changed)
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Platform ID</FormLabel>
                  <Input
                    value={editingPlatform?.id || ""}
                    disabled
                    className="bg-muted"
                    data-testid="input-edit-id-disabled"
                  />
                  <FormDescription>ID cannot be changed after creation</FormDescription>
                </div>

                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-name" />
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
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-display" />
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
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} data-testid="input-edit-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="webhookUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Webhook URL</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-webhook" />
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
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" data-testid="input-edit-email" />
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
                        <FormLabel>Support URL</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-edit-support" />
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

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updateMutation.isPending}
                    data-testid="button-confirm-edit"
                  >
                    {updateMutation.isPending ? "Updating..." : "Update Platform"}
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
