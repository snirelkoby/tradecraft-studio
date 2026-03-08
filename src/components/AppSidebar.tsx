import {
  BarChart3, BookOpen, Calendar, FileText, PenTool,
  Calculator, Settings, LogOut, Notebook, FlaskConical, Wallet, CandlestickChart, Sparkles, Globe, CalendarClock,
  CalendarRange, Gamepad2, Play, AlertTriangle, DollarSign, GitCompare, Target, ClipboardCheck, Flame, GraduationCap,
  Brain, Link2, Dice5, Trophy, TrendingDown, ShieldAlert, CalendarDays, FlaskRound
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', url: '/', icon: BarChart3 },
  { title: 'Trade Journal', url: '/trades', icon: PenTool },
  { title: 'Trade Analysis', url: '/analysis', icon: CandlestickChart },
  { title: 'AI Insights', url: '/ai-insights', icon: Sparkles },
  { title: 'Weekly Review', url: '/weekly-review', icon: CalendarRange },
  { title: 'Playbook', url: '/playbook', icon: Gamepad2 },
  { title: 'Trade Replay', url: '/trade-replay', icon: Play },
  { title: 'Mistake Tracker', url: '/mistakes', icon: AlertTriangle },
  { title: 'Commissions', url: '/commissions', icon: DollarSign },
  { title: 'Trade Compare', url: '/compare', icon: GitCompare },
  { title: 'Trade Grading', url: '/trade-grading', icon: GraduationCap },
  { title: 'Goal Tracker', url: '/goals', icon: Target },
  { title: 'Pre-Trade Check', url: '/checklist', icon: ClipboardCheck },
  { title: 'R:R Heatmap', url: '/heatmap', icon: Flame },
  { title: 'Correlation', url: '/correlation', icon: Link2 },
  { title: 'Mindset Journal', url: '/mindset', icon: Brain },
  { title: 'Monte Carlo', url: '/monte-carlo', icon: Dice5 },
  { title: 'Achievements', url: '/achievements', icon: Trophy },
  { title: 'Drawdown', url: '/drawdown', icon: TrendingDown },
  { title: 'Rule Violations', url: '/violations', icon: ShieldAlert },
  { title: 'Session Plan', url: '/session-plan', icon: CalendarDays },
  { title: 'A/B Tester', url: '/ab-test', icon: FlaskRound },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Blueprints', url: '/blueprints', icon: BookOpen },
  { title: 'Daily Journal', url: '/journal', icon: Notebook },
  { title: 'Accounts', url: '/accounts', icon: Wallet },
  { title: 'Ledger', url: '/ledger', icon: FileText },
  { title: 'Risk Engine', url: '/risk', icon: Calculator },
  { title: 'Calculators', url: '/calculators', icon: FlaskConical },
  { title: 'Macro Analysis', url: '/macro', icon: Globe },
  { title: 'Economic Calendar', url: '/economic-calendar', icon: CalendarClock },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-4 py-6">
            {!collapsed && (
              <span className="text-lg font-black tracking-tight">
                EDGE<span className="text-primary">LAB</span>
              </span>
            )}
            {collapsed && <span className="text-lg font-black text-primary">E</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 mr-2" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center justify-between mb-2 px-2">
          {!collapsed && (
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          )}
          <ThemeToggle />
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} className="text-muted-foreground hover:text-destructive">
              <LogOut className="h-4 w-4 mr-2" />
              {!collapsed && <span>Sign Out</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
