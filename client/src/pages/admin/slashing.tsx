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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "wouter";
import { Plus, ArrowLeft, AlertTriangle, CheckCircle, XCircle, Undo } from "lucide-react";
import type { SlashingEvent } from "@shared/schema";
import { z } from "zod";

// Form schema for creating slashing events
const createSlashingSchema = z.object({
  agentId: z.string().min(1, "Agent ID is required"),
  violationType: z.string().min(1, "Violation type is required"),
  severity: z.enum(["minor", "major", "critical"], {
    required_error: "Please select a severity level",
  }),
  description: z.string().min(10, "Description must be at least 10 characters"),
  evidenceUrl: z.string().url().optional().or(z.literal("")),
});

type CreateSlashing = z.infer<typeof createSlashingSchema>;

// Reverse slash schema
const reverseSlashSchema = z.object({
  reversalReason: z.string().min(10, "Reversal reason must be at least 10 characters"),
});

type ReverseSlash = z.infer<typeof reverseSlashSchema>;

// Extended SlashingEvent with agent details
type SlashingEventWithAgent = SlashingEvent & {
  agentEmail: string;
  agentName: string;
};

export default function AdminSlashing() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isExecuteOpen, setIsExecuteOpen] = useState(false);
  const [isReverseOpen, setIsReverseOpen] = useState(false);
  const [selectedSlash, setSelectedSlash] = useState<SlashingEventWithAgent | null>(null);

  // Fetch pending slashes
  const { data: pendingSlashes, isLoading: pendingLoading } = useQuery<SlashingEventWithAgent[]>({
    queryKey: ["/api/admin/slashing/pending"],
  });

  // Fetch all slashing history
  const { data: slashingHistory, isLoading: historyLoading } = useQuery<SlashingEventWithAgent[]>({
    queryKey: ["/api/admin/slashing"],
  });

  // Create slashing form
  const createForm = useForm<CreateSlashing>({
    resolver: zodResolver(createSlashingSchema),
    defaultValues: {
      agentId: "",
      violationType: "",
      severity: "minor",
      description: "",
      evidenceUrl: "",
    },
  });

  // Reverse slash form
  const reverseForm = useForm<ReverseSlash>({
    resolver: zodResolver(reverseSlashSchema),
    defaultValues: {
      reversalReason: "",
    },
  });

  // Create slashing mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateSlashing) => {
      return await apiRequest("POST", "/api/admin/slashing", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing"] });
      setIsCreateOpen(false);
      createForm.reset();
      toast({
        title: "Slashing Event Created",
        description: "The slashing event has been created and is pending review",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create slashing event",
      });
    },
  });

  // Execute slash mutation
  const executeMutation = useMutation({
    mutationFn: async (slashId: string) => {
      return await apiRequest("POST", `/api/admin/slashing/${slashId}/execute`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing"] });
      setIsExecuteOpen(false);
      setSelectedSlash(null);
      toast({
        title: "Slash Executed",
        description: "The agent's stake has been reduced and tier updated",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to execute slash",
      });
    },
  });

  // Reverse slash mutation
  const reverseMutation = useMutation({
    mutationFn: async ({ slashId, reason }: { slashId: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/slashing/${slashId}/reverse`, {
        reversalReason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slashing"] });
      setIsReverseOpen(false);
      setSelectedSlash(null);
      reverseForm.reset();
      toast({
        title: "Slash Reversed",
        description: "The agent's stake has been restored",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to reverse slash",
      });
    },
  });

  // Helper to format token amounts
  const formatTokens = (baseUnits: string) => {
    const tokens = Number(baseUnits) / 1_000_000_000;
    return tokens.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  // Helper to get severity badge color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "minor":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "major":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "critical":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "";
    }
  };

  // Helper to get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "executed":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "reversed":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default:
        return "";
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="container mx-auto p-8">
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
    <div className="container mx-auto p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/admin" data-testid="link-back-admin">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Agent Slashing</h1>
          </div>
          <p className="text-muted-foreground mt-2" data-testid="text-page-description">
            Manage stake penalties for agent violations
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-slash">
          <Plus className="h-4 w-4 mr-2" />
          Create Slashing Event
        </Button>
      </div>

      {/* Pending Slashes */}
      <Card data-testid="card-pending-slashes">
        <CardHeader>
          <CardTitle>Pending Slashing Events</CardTitle>
          <CardDescription>Review and execute pending slashes</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="text-center py-8" data-testid="text-pending-loading">Loading...</div>
          ) : !pendingSlashes || pendingSlashes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-pending-empty">
              No pending slashing events
            </div>
          ) : (
            <div className="grid gap-4" data-testid="list-pending-slashes">
              {pendingSlashes.map((slash) => (
                <Card key={slash.id} data-testid={`card-pending-slash-${slash.id}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-agent-${slash.id}`}>
                          {slash.agentName} ({slash.agentEmail})
                        </CardTitle>
                        <CardDescription data-testid={`text-violation-${slash.id}`}>
                          {slash.violationType}
                        </CardDescription>
                      </div>
                      <Badge className={getSeverityColor(slash.severity)} data-testid={`badge-severity-${slash.id}`}>
                        {slash.severity}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p data-testid={`text-description-${slash.id}`}>{slash.description}</p>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Penalty:</span>
                        <br />
                        <span className="font-medium" data-testid={`text-penalty-${slash.id}`}>
                          {slash.slashPercentage}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Slashed Amount:</span>
                        <br />
                        <span className="font-medium" data-testid={`text-amount-${slash.id}`}>
                          {formatTokens(slash.slashedAmount)} TKOIN
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Remaining Stake:</span>
                        <br />
                        <span className="font-medium" data-testid={`text-remaining-${slash.id}`}>
                          {formatTokens(slash.remainingStake)} TKOIN
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        onClick={() => {
                          setSelectedSlash(slash);
                          setIsExecuteOpen(true);
                        }}
                        data-testid={`button-execute-${slash.id}`}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Execute Slash
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedSlash(slash);
                          setIsReverseOpen(true);
                        }}
                        data-testid={`button-reject-${slash.id}`}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Slashing History */}
      <Card data-testid="card-slashing-history">
        <CardHeader>
          <CardTitle>Slashing History</CardTitle>
          <CardDescription>All slashing events</CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="text-center py-8" data-testid="text-history-loading">Loading...</div>
          ) : !slashingHistory || slashingHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-history-empty">
              No slashing events yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table data-testid="table-slashing-history">
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Violation</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Penalty</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {slashingHistory.map((slash) => (
                    <TableRow key={slash.id} data-testid={`row-slash-${slash.id}`}>
                      <TableCell data-testid={`cell-agent-${slash.id}`}>
                        <div className="font-medium">{slash.agentName}</div>
                        <div className="text-sm text-muted-foreground">{slash.agentEmail}</div>
                      </TableCell>
                      <TableCell data-testid={`cell-violation-${slash.id}`}>{slash.violationType}</TableCell>
                      <TableCell>
                        <Badge className={getSeverityColor(slash.severity)} data-testid={`badge-severity-history-${slash.id}`}>
                          {slash.severity}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-penalty-${slash.id}`}>{slash.slashPercentage}%</TableCell>
                      <TableCell data-testid={`cell-amount-history-${slash.id}`}>
                        {formatTokens(slash.slashedAmount)} TKOIN
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(slash.status)} data-testid={`badge-status-${slash.id}`}>
                          {slash.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`cell-date-${slash.id}`}>
                        {new Date(slash.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {slash.status === "executed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedSlash(slash);
                              setIsReverseOpen(true);
                            }}
                            data-testid={`button-reverse-${slash.id}`}
                          >
                            <Undo className="h-4 w-4 mr-2" />
                            Reverse
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Slashing Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent data-testid="dialog-create-slash">
          <DialogHeader>
            <DialogTitle>Create Slashing Event</DialogTitle>
            <DialogDescription>
              Create a new slashing event for an agent violation
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="agentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="agent-uuid" data-testid="input-agent-id" />
                    </FormControl>
                    <FormDescription>The ID of the agent to slash</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="violationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Violation Type</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., fraud, failed_delivery, kyc_breach" data-testid="input-violation-type" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="severity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Severity</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-severity">
                          <SelectValue placeholder="Select severity" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="minor" data-testid="option-severity-minor">Minor (10% penalty)</SelectItem>
                        <SelectItem value="major" data-testid="option-severity-major">Major (25% penalty)</SelectItem>
                        <SelectItem value="critical" data-testid="option-severity-critical">Critical (50% penalty)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Detailed description of the violation" data-testid="input-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="evidenceUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Evidence URL (Optional)</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." data-testid="input-evidence-url" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-create">
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                  {createMutation.isPending ? "Creating..." : "Create Slashing Event"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Execute Slash Confirmation */}
      <AlertDialog open={isExecuteOpen} onOpenChange={setIsExecuteOpen}>
        <AlertDialogContent data-testid="dialog-execute-slash">
          <AlertDialogHeader>
            <AlertDialogTitle>Execute Slash</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to execute this slash? This will reduce the agent's stake by{" "}
              {selectedSlash && formatTokens(selectedSlash.slashedAmount)} TKOIN and may downgrade their tier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-execute">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedSlash && executeMutation.mutate(selectedSlash.id)}
              disabled={executeMutation.isPending}
              data-testid="button-confirm-execute"
            >
              {executeMutation.isPending ? "Executing..." : "Execute Slash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reverse Slash Dialog */}
      <Dialog open={isReverseOpen} onOpenChange={setIsReverseOpen}>
        <DialogContent data-testid="dialog-reverse-slash">
          <DialogHeader>
            <DialogTitle>Reverse Slash</DialogTitle>
            <DialogDescription>
              Provide a reason for reversing this slashing event
            </DialogDescription>
          </DialogHeader>
          <Form {...reverseForm}>
            <form
              onSubmit={reverseForm.handleSubmit((data) =>
                selectedSlash && reverseMutation.mutate({ slashId: selectedSlash.id, reason: data.reversalReason })
              )}
              className="space-y-4"
            >
              <FormField
                control={reverseForm.control}
                name="reversalReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reversal Reason</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Explain why this slash is being reversed" data-testid="input-reversal-reason" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsReverseOpen(false)} data-testid="button-cancel-reverse">
                  Cancel
                </Button>
                <Button type="submit" disabled={reverseMutation.isPending} data-testid="button-submit-reverse">
                  {reverseMutation.isPending ? "Reversing..." : "Reverse Slash"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
