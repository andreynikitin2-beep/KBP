import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Catalog from "@/pages/catalog";
import MaterialView from "@/pages/material-view";
import MaterialWizard from "@/pages/material-wizard";
import Admin from "@/pages/admin";
import Subscriptions from "@/pages/subscriptions";
import MyMaterials from "@/pages/my-materials";
import MyOnboarding from "@/pages/my-onboarding";
import ArchivePage from "@/pages/archive";
import LoginPage from "@/pages/login";
import { useKB } from "@/lib/kbStore";

import { queryClient } from "./lib/queryClient";

function AdminRoute() {
  const { me } = useKB();
  if (!me.roles.includes("Администратор")) {
    return <Redirect to="/" />;
  }
  return <Admin />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/catalog" component={Catalog} />
      <Route path="/subscriptions" component={Subscriptions} />
      <Route path="/my-materials" component={MyMaterials} />
      <Route path="/my-onboarding" component={MyOnboarding} />
      <Route path="/archive" component={ArchivePage} />
      <Route path="/materials/new" component={MaterialWizard} />
      <Route path="/materials/:id" component={MaterialView} />
      <Route path="/admin" component={AdminRoute} />
      <Route path="/home">
        <Redirect to="/" />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate() {
  const { isAuthenticated, setMeId } = useKB();

  if (!isAuthenticated) {
    return <LoginPage onLogin={(userId) => setMeId(userId)} />;
  }

  return <Router />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthGate />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
