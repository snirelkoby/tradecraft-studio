import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { AccountProvider } from "@/hooks/useSelectedAccount";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Trades from "./pages/Trades";
import TradeAnalysis from "./pages/TradeAnalysis";
import AiInsights from "./pages/AiInsights";
import CalendarView from "./pages/CalendarView";
import Blueprints from "./pages/Blueprints";
import Ledger from "./pages/Ledger";
import RiskEngine from "./pages/RiskEngine";
import Calculators from "./pages/Calculators";
import Journal from "./pages/Journal";
import Accounts from "./pages/Accounts";
import SettingsPage from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Loading...</div>;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AccountProvider>
              <Routes>
                <Route path="/auth" element={<AuthRoute />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/trades" element={<Trades />} />
                  <Route path="/analysis" element={<TradeAnalysis />} />
                  <Route path="/ai-insights" element={<AiInsights />} />
                  <Route path="/calendar" element={<CalendarView />} />
                  <Route path="/blueprints" element={<Blueprints />} />
                  <Route path="/journal" element={<Journal />} />
                  <Route path="/ledger" element={<Ledger />} />
                  <Route path="/risk" element={<RiskEngine />} />
                  <Route path="/calculators" element={<Calculators />} />
                  <Route path="/accounts" element={<Accounts />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AccountProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
