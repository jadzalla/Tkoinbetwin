import { LayoutDashboard, DollarSign, Receipt, Trophy, TrendingUp, Wallet, Settings, Medal, Award as AwardIcon, Lock } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { Agent } from "@shared/schema";

const menuItems = [
  { path: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { path: "/dashboard/pricing", icon: DollarSign, label: "Pricing & Limits" },
  { path: "/dashboard/transactions", icon: Receipt, label: "Transactions" },
  { path: "/dashboard/commissions", icon: Trophy, label: "Commissions & Earnings" },
  { path: "/dashboard/analytics", icon: TrendingUp, label: "Analytics" },
  { path: "/dashboard/inventory", icon: Wallet, label: "Inventory & Funding" },
  { path: "/dashboard/staking", icon: Lock, label: "Staking & Tiers" },
  { path: "/dashboard/settings", icon: Settings, label: "Settings" },
];

interface AppSidebarAgentProps {
  agent: Agent;
}

export function AppSidebarAgent({ agent }: AppSidebarAgentProps) {
  const [location] = useLocation();

  const getTierIcon = (tier: string) => {
    if (tier === "bronze") return <Medal className="h-4 w-4 text-orange-500" />;
    if (tier === "silver") return <AwardIcon className="h-4 w-4 text-gray-400" />;
    if (tier === "gold") return <Trophy className="h-4 w-4 text-yellow-500" />;
    return null;
  };

  const getTierLabel = (tier: string) => {
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  };

  return (
    <Sidebar data-testid="sidebar-agent">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Agent Portal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    data-active={location === item.path}
                    data-testid={`nav-${item.label.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-')}`}
                  >
                    <Link href={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="p-4 border-t">
          <div className="flex items-center gap-2 mb-2">
            {getTierIcon(agent.commissionTier)}
            <span className="text-sm font-medium" data-testid="text-tier-label">
              {getTierLabel(agent.commissionTier)} Tier
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {Number(agent.totalMinted).toLocaleString()} TKOIN minted
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
