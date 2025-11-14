import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Dashboard from "@/pages/dashboard";
import Apply from "@/pages/apply";
import Admin from "@/pages/admin";
import AdminCurrencies from "@/pages/admin/currencies";
import AdminPlatforms from "@/pages/admin/platforms";
import AdminToken from "@/pages/admin/token";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      {/* Match /dashboard and all nested routes */}
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/dashboard/:rest+" component={Dashboard} />
      <Route path="/apply" component={Apply} />
      <Route path="/admin/platforms" component={AdminPlatforms} />
      <Route path="/admin/currencies" component={AdminCurrencies} />
      <Route path="/admin/token" component={AdminToken} />
      <Route path="/admin" component={Admin} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
