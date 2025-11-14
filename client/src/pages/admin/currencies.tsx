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
import { Plus, ArrowLeft, ShieldAlert, Coins, Edit, Power } from "lucide-react";
import type { Currency, InsertCurrency } from "@shared/schema";
import { insertCurrencySchema } from "@shared/schema";
import { z } from "zod";

// Edit schema omits 'code' since it's immutable (code is the primary key)
const editCurrencySchema = insertCurrencySchema.omit({ code: true });
type EditCurrency = z.infer<typeof editCurrencySchema>;

export default function AdminCurrencies() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState<Currency | null>(null);

  const { data: currencies, isLoading: currenciesLoading } = useQuery<Currency[]>({
    queryKey: ["/api/admin/currencies"],
  });

  // Create form
  const createForm = useForm<InsertCurrency>({
    resolver: zodResolver(insertCurrencySchema),
    defaultValues: {
      code: "",
      name: "",
      symbol: "",
      decimals: 2,
      isActive: true,
      sortOrder: 100,
    },
  });

  // Edit form
  const editForm = useForm<EditCurrency>({
    resolver: zodResolver(editCurrencySchema),
    defaultValues: {
      name: "",
      symbol: "",
      decimals: 2,
      isActive: true,
      sortOrder: 100,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertCurrency) => {
      return await apiRequest("POST", "/api/admin/currencies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setIsCreateOpen(false);
      createForm.reset();
      toast({
        title: "Currency Created",
        description: "New currency has been added successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create currency",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ code, updates }: { code: string; updates: EditCurrency }) => {
      return await apiRequest("PATCH", `/api/admin/currencies/${code}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      setIsEditOpen(false);
      setEditingCurrency(null);
      editForm.reset();
      toast({
        title: "Currency Updated",
        description: "Currency details have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update currency",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ code, isActive }: { code: string; isActive: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/currencies/${code}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/currencies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/currencies"] });
      toast({
        title: "Status Updated",
        description: "Currency status has been toggled successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Toggle Failed",
        description: error.message || "Failed to toggle currency status",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (data: InsertCurrency) => {
    createMutation.mutate(data);
  };

  const handleEditSubmit = (data: EditCurrency) => {
    if (!editingCurrency) return;
    updateMutation.mutate({ code: editingCurrency.code, updates: data });
  };

  const openEditDialog = (currency: Currency) => {
    setEditingCurrency(currency);
    editForm.reset({
      name: currency.name,
      symbol: currency.symbol,
      decimals: currency.decimals,
      isActive: currency.isActive,
      sortOrder: currency.sortOrder,
    });
    setIsEditOpen(true);
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
              <Coins className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold">Currency Management</span>
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
            <h1 className="text-3xl font-bold mb-2">Manage Currencies</h1>
            <p className="text-muted-foreground">Configure supported currencies for the platform</p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-currency">
                <Plus className="h-4 w-4 mr-2" />
                Add Currency
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="dialog-create-currency">
              <DialogHeader>
                <DialogTitle>Add New Currency</DialogTitle>
                <DialogDescription>
                  Create a new currency following ISO 4217 standards
                </DialogDescription>
              </DialogHeader>
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency Code</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            placeholder="USD"
                            maxLength={3}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                            data-testid="input-create-code"
                          />
                        </FormControl>
                        <FormDescription>2-3 uppercase letters (ISO 4217)</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Currency Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="United States Dollar" data-testid="input-create-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="symbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Symbol</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="$" data-testid="input-create-symbol" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={createForm.control}
                      name="decimals"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Decimals</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              max={8}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                field.onChange(isNaN(val) ? 0 : val);
                              }}
                              data-testid="input-create-decimals"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="sortOrder"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sort Order</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="number"
                              min={0}
                              onChange={(e) => {
                                const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                field.onChange(isNaN(val) ? 0 : val);
                              }}
                              data-testid="input-create-sort"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

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
                      {createMutation.isPending ? "Creating..." : "Create Currency"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card data-testid="card-currencies-table">
          <CardHeader>
            <CardTitle>Active & Inactive Currencies</CardTitle>
            <CardDescription>
              {currencies?.length || 0} currencies configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            {currenciesLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
              </div>
            ) : currencies && currencies.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-center">Decimals</TableHead>
                    <TableHead className="text-center">Sort Order</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currencies.map((currency) => (
                    <TableRow key={currency.code} data-testid={`row-currency-${currency.code}`}>
                      <TableCell className="font-mono font-semibold" data-testid={`text-code-${currency.code}`}>
                        {currency.code}
                      </TableCell>
                      <TableCell data-testid={`text-name-${currency.code}`}>
                        {currency.name}
                      </TableCell>
                      <TableCell className="text-lg" data-testid={`text-symbol-${currency.code}`}>
                        {currency.symbol}
                      </TableCell>
                      <TableCell className="text-center font-mono" data-testid={`text-decimals-${currency.code}`}>
                        {currency.decimals}
                      </TableCell>
                      <TableCell className="text-center font-mono" data-testid={`text-sort-${currency.code}`}>
                        {currency.sortOrder}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={currency.isActive ? "default" : "secondary"}
                          data-testid={`badge-status-${currency.code}`}
                        >
                          {currency.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(currency)}
                            data-testid={`button-edit-${currency.code}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={currency.isActive ? "destructive" : "default"}
                            onClick={() => toggleMutation.mutate({
                              code: currency.code,
                              isActive: !currency.isActive
                            })}
                            disabled={toggleMutation.isPending}
                            data-testid={`button-toggle-${currency.code}`}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No currencies found</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent data-testid="dialog-edit-currency">
            <DialogHeader>
              <DialogTitle>Edit Currency</DialogTitle>
              <DialogDescription>
                Update currency details (code cannot be changed)
              </DialogDescription>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <FormLabel>Currency Code</FormLabel>
                  <Input
                    value={editingCurrency?.code || ""}
                    disabled
                    className="bg-muted"
                    data-testid="input-edit-code-disabled"
                  />
                  <FormDescription>Code cannot be changed after creation</FormDescription>
                </div>

                <FormField
                  control={editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Name</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-edit-symbol" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="decimals"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Decimals</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            max={8}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              field.onChange(isNaN(val) ? 0 : val);
                            }}
                            data-testid="input-edit-decimals"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="sortOrder"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sort Order</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={0}
                            onChange={(e) => {
                              const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                              field.onChange(isNaN(val) ? 0 : val);
                            }}
                            data-testid="input-edit-sort"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                    {updateMutation.isPending ? "Updating..." : "Update Currency"}
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
