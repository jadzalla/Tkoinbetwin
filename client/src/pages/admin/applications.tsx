import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { 
  FileText, 
  CheckCircle, 
  XCircle, 
  Clock, 
  ArrowLeft, 
  Building2, 
  Mail, 
  Phone, 
  MapPin,
  User,
  Loader2
} from "lucide-react";
import { format } from "date-fns";

interface AgentApplication {
  id: string;
  replitUserId: string;
  email: string;
  businessName: string;
  businessType: string;
  country: string;
  city: string;
  address: string;
  phoneNumber: string;
  requestedTier: string;
  status: string;
  kycStatus: string;
  kycDocuments: any[];
  kycNotes?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminApplications() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<AgentApplication | null>(null);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  // Fetch applications
  const queryParams = statusFilter !== "all" ? { status: statusFilter } : {};
  const applicationsUrl = statusFilter !== "all" 
    ? `/api/admin/applications?status=${statusFilter}`
    : "/api/admin/applications";
  
  const { data: applications, isLoading: applicationsLoading } = useQuery<AgentApplication[]>({
    queryKey: ["/api/admin/applications", queryParams],
    queryFn: async () => {
      const response = await fetch(applicationsUrl);
      if (!response.ok) throw new Error("Failed to fetch applications");
      return response.json();
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes?: string }) => {
      return await apiRequest("POST", `/api/admin/applications/${id}/approve`, {
        reviewNotes: notes,
      });
    },
    onSuccess: () => {
      // Invalidate all application queries (tuple-based prefix matching)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({
        title: "Application Approved",
        description: "Agent account has been created successfully.",
      });
      setIsApproveDialogOpen(false);
      setSelectedApplication(null);
      setReviewNotes("");
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message || "Failed to approve application",
        variant: "destructive",
      });
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest("POST", `/api/admin/applications/${id}/reject`, {
        rejectionReason: reason,
      });
    },
    onSuccess: () => {
      // Invalidate all application queries (tuple-based prefix matching)
      queryClient.invalidateQueries({ queryKey: ["/api/admin/applications"] });
      toast({
        title: "Application Rejected",
        description: "Application has been rejected.",
      });
      setIsRejectDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Rejection Failed",
        description: error.message || "Failed to reject application",
        variant: "destructive",
      });
    },
  });

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

  if (!user?.isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to access this page</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full" data-testid="button-go-home">Return Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleApprove = (application: AgentApplication) => {
    setSelectedApplication(application);
    setIsApproveDialogOpen(true);
  };

  const handleReject = (application: AgentApplication) => {
    setSelectedApplication(application);
    setIsRejectDialogOpen(true);
  };

  const confirmApprove = () => {
    if (selectedApplication) {
      approveMutation.mutate({ id: selectedApplication.id, notes: reviewNotes });
    }
  };

  const confirmReject = () => {
    if (selectedApplication && rejectionReason.trim()) {
      rejectMutation.mutate({ id: selectedApplication.id, reason: rejectionReason });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400" data-testid={`badge-status-pending`}><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400" data-testid={`badge-status-approved`}><CheckCircle className="w-3 h-3 mr-1" />Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400" data-testid={`badge-status-rejected`}><XCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    const colors = {
      basic: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
      verified: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
      premium: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
    };
    return <Badge variant="outline" className={colors[tier as keyof typeof colors] || ""}>{tier}</Badge>;
  };

  const filteredApplications = applications || [];
  const pendingCount = filteredApplications.filter(a => a.status === "pending").length;

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4 mb-2">
              <Link href="/admin">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <h1 className="text-3xl font-bold" data-testid="heading-applications">Agent Applications</h1>
            </div>
            <p className="text-muted-foreground">
              Review and manage agent applications
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 px-4 py-2">
              <Clock className="w-4 h-4 mr-2" />
              {pendingCount} Pending
            </Badge>
          )}
        </div>

        {/* Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter Applications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <label className="text-sm font-medium">Status:</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48" data-testid="select-status-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" data-testid="option-all">All Applications</SelectItem>
                  <SelectItem value="pending" data-testid="option-pending">Pending Only</SelectItem>
                  <SelectItem value="approved" data-testid="option-approved">Approved</SelectItem>
                  <SelectItem value="rejected" data-testid="option-rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filteredApplications.length} application{filteredApplications.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Applications List</CardTitle>
            <CardDescription>
              Review business information and approve or reject applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {applicationsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {statusFilter === "all" ? "No applications found" : `No ${statusFilter} applications`}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Business Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Requested Tier</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApplications.map((application) => (
                      <TableRow key={application.id} data-testid={`row-application-${application.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium" data-testid={`text-business-name-${application.id}`}>{application.businessName}</p>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {application.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="capitalize">{application.businessType}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {application.city}, {application.country}
                          </div>
                        </TableCell>
                        <TableCell>{getTierBadge(application.requestedTier)}</TableCell>
                        <TableCell>{getStatusBadge(application.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(application.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {application.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => handleApprove(application)}
                                data-testid={`button-approve-${application.id}`}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleReject(application)}
                                data-testid={`button-reject-${application.id}`}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              {application.status === "approved" ? "Approved" : "Rejected"}
                            </span>
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

        {/* Approve Dialog */}
        <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
          <DialogContent data-testid="dialog-approve">
            <DialogHeader>
              <DialogTitle>Approve Application</DialogTitle>
              <DialogDescription>
                This will create an agent account for {selectedApplication?.businessName}
              </DialogDescription>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-md space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Business:</span>
                    <span>{selectedApplication.businessName} ({selectedApplication.businessType})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Email:</span>
                    <span>{selectedApplication.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Location:</span>
                    <span>{selectedApplication.city}, {selectedApplication.country}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Phone:</span>
                    <span>{selectedApplication.phoneNumber}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Requested Tier:</span>
                    {getTierBadge(selectedApplication.requestedTier)}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Review Notes (Optional)</label>
                  <Textarea
                    placeholder="Add any notes about this approval..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    data-testid="textarea-review-notes"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsApproveDialogOpen(false)}
                data-testid="button-cancel-approve"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmApprove} 
                disabled={approveMutation.isPending}
                data-testid="button-confirm-approve"
              >
                {approveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Approve & Create Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent data-testid="dialog-reject">
            <DialogHeader>
              <DialogTitle>Reject Application</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting {selectedApplication?.businessName}'s application
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Rejection Reason *</label>
                <Textarea
                  placeholder="Explain why this application is being rejected..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                  data-testid="textarea-rejection-reason"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsRejectDialogOpen(false)}
                data-testid="button-cancel-reject"
              >
                Cancel
              </Button>
              <Button 
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={confirmReject} 
                disabled={rejectMutation.isPending || !rejectionReason.trim()}
                data-testid="button-confirm-reject"
              >
                {rejectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reject Application
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
