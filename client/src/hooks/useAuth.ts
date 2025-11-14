import { useQuery } from "@tanstack/react-query";

export interface AuthUser {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  isAgent: boolean;
  agentStatus?: string;
  agentId?: string;
  isAdmin: boolean;
}

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAgent: user?.isAgent || false,
    isActiveAgent: user?.isAgent && user?.agentStatus === 'active',
    isAdmin: user?.isAdmin || false,
  };
}
