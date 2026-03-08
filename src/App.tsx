import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { AccountProvider } from "@/hooks/useSelectedAccount";
import { ThemeColorProvider } from "@/hooks/useThemeColors";
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
import MacroAnalysis from "./pages/MacroAnalysis";
import EconomicCalendar from "./pages/EconomicCalendar";
import Journal from "./pages/Journal";
import Accounts from "./pages/Accounts";
import SettingsPage from "./pages/Settings";
import WeeklyReview from "./pages/WeeklyReview";
import Playbook from "./pages/Playbook";
import TradeReplay from "./pages/TradeReplay";
import MistakeTracker from "./pages/MistakeTracker";
import CommissionTracker from "./pages/CommissionTracker";
import TradeComparison from "./pages/TradeComparison";
import GoalTracker from "./pages/GoalTracker";
import PreTradeChecklist from "./pages/PreTradeChecklist";
import RiskRewardHeatmap from "./pages/RiskRewardHeatmap";
import AiTradeGrading from "./pages/AiTradeGrading";
import CorrelationTracker from "./pages/CorrelationTracker";
import MindsetJournal from "./pages/MindsetJournal";
import MonteCarloPage from "./pages/MonteCarloPage";
import AchievementsPage from "./pages/Achievements";
import DrawdownAnalyzer from "./pages/DrawdownAnalyzer";
import RuleViolations from "./pages/RuleViolations";
import SessionPlanner from "./pages/SessionPlanner";
import AbStrategyTester from "./pages/AbStrategyTester";
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
    <ThemeColorProvider>
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
                    <Route path="/playbook" element={<Playbook />} />
                    <Route path="/trade-replay" element={<TradeReplay />} />
                    <Route path="/mistakes" element={<MistakeTracker />} />
                    <Route path="/commissions" element={<CommissionTracker />} />
                    <Route path="/compare" element={<TradeComparison />} />
                    <Route path="/goals" element={<GoalTracker />} />
                    <Route path="/checklist" element={<PreTradeChecklist />} />
                    <Route path="/heatmap" element={<RiskRewardHeatmap />} />
                    <Route path="/trade-grading" element={<AiTradeGrading />} />
                    <Route path="/correlation" element={<CorrelationTracker />} />
                    <Route path="/mindset" element={<MindsetJournal />} />
                    <Route path="/monte-carlo" element={<MonteCarloPage />} />
                    <Route path="/achievements" element={<AchievementsPage />} />
                    <Route path="/drawdown" element={<DrawdownAnalyzer />} />
                    <Route path="/violations" element={<RuleViolations />} />
                    <Route path="/session-plan" element={<SessionPlanner />} />
                    <Route path="/ab-test" element={<AbStrategyTester />} />
                    <Route path="/weekly-review" element={<WeeklyReview />} />
                    <Route path="/journal" element={<Journal />} />
                    <Route path="/ledger" element={<Ledger />} />
                    <Route path="/risk" element={<RiskEngine />} />
                    <Route path="/calculators" element={<Calculators />} />
                    <Route path="/macro" element={<MacroAnalysis />} />
                    <Route path="/economic-calendar" element={<EconomicCalendar />} />
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
    </ThemeColorProvider>
  </ThemeProvider>
);

export default App;
