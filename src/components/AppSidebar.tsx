import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, BookOpen, Calendar, FileText, PenTool,
  Calculator, Settings, LogOut, FlaskConical, Wallet, CandlestickChart, Sparkles, Globe, CalendarClock,
  CalendarRange, Gamepad2, Play, AlertTriangle, DollarSign, GitCompare, Target, ClipboardCheck, Flame, GraduationCap,
  Brain, Link2, Dice5, Trophy, TrendingDown, ShieldAlert, CalendarDays, FlaskRound, Hourglass,
  Fingerprint, Activity, Clover, ArrowDownUp, Clock, TrendingUp,
  Bot, Heart, Zap, ChevronDown, Search
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Input } from '@/components/ui/input';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from '@/components/ui/sidebar';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NavItem {
  title: string;
  url: string;
  icon: any;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  defaultOpen?: boolean;
}

const navGroups: NavGroup[] = [
  {
    label: 'Core',
    defaultOpen: true,
    items: [
      { title: 'Dashboard', url: '/', icon: BarChart3 },
      { title: 'Trade Journal', url: '/trades', icon: PenTool },
      { title: 'Calendar', url: '/calendar', icon: Calendar },
      { title: 'Accounts', url: '/accounts', icon: Wallet },
      { title: 'Ledger', url: '/ledger', icon: FileText },
    ],
  },
  {
    label: 'Strategy',
    defaultOpen: true,
    items: [
      { title: 'Blueprints', url: '/blueprints', icon: BookOpen },
      { title: 'Playbook', url: '/playbook', icon: Gamepad2 },
      { title: 'Pre-Trade Check', url: '/checklist', icon: ClipboardCheck },
      { title: 'Session Plan', url: '/session-plan', icon: CalendarDays },
      { title: 'Goal Tracker', url: '/goals', icon: Target },
    ],
  },
  {
    label: 'Analysis',
    defaultOpen: true,
    items: [
      { title: 'Trade Analysis', url: '/analysis', icon: CandlestickChart },
      { title: 'Trade Compare', url: '/compare', icon: GitCompare },
      { title: 'Trade Replay', url: '/trade-replay', icon: Play },
      { title: 'Weekly Review', url: '/weekly-review', icon: CalendarRange },
      { title: 'R:R Heatmap', url: '/heatmap', icon: Flame },
      { title: 'Drawdown', url: '/drawdown', icon: TrendingDown },
      { title: 'Commissions', url: '/commissions', icon: DollarSign },
    ],
  },
  {
    label: 'AI & Insights',
    items: [
      { title: 'AI Insights', url: '/ai-insights', icon: Sparkles },
      { title: 'Trade Grading', url: '/trade-grading', icon: GraduationCap },
      { title: 'Trade Journal AI', url: '/trade-journal-ai', icon: Bot },
      { title: 'Trade DNA', url: '/trade-dna', icon: Fingerprint },
    ],
  },
  {
    label: 'Psychology',
    items: [
      { title: 'Daily Journal', url: '/mindset', icon: Brain },
      { title: 'Emotion Tracker', url: '/emotions', icon: Heart },
      { title: 'Mistake Tracker', url: '/mistakes', icon: AlertTriangle },
      { title: 'Rule Violations', url: '/violations', icon: ShieldAlert },
    ],
  },
  {
    label: 'Advanced Analytics',
    items: [
      { title: 'Time-in-Trade', url: '/time-in-trade', icon: Hourglass },
      { title: 'Market Regime', url: '/market-regime', icon: Activity },
      { title: 'Correlation', url: '/correlation', icon: Link2 },
      { title: 'Loss Impact', url: '/consecutive-loss', icon: ArrowDownUp },
      { title: 'Optimal Session', url: '/optimal-session', icon: Clock },
      { title: 'A/B Tester', url: '/ab-test', icon: FlaskRound },
      { title: 'Luck vs Skill', url: '/luck-skill', icon: Clover },
    ],
  },
  {
    label: 'Calculators & Tools',
    items: [
      { title: 'Risk Engine', url: '/risk', icon: Calculator },
      { title: 'Calculators', url: '/calculators', icon: FlaskConical },
      { title: 'Monte Carlo', url: '/monte-carlo', icon: Dice5 },
      { title: 'Compounding', url: '/compounding', icon: TrendingUp },
      { title: 'Achievements', url: '/achievements', icon: Trophy },
    ],
  },
  {
    label: 'Macro',
    items: [
      { title: 'Macro Analysis', url: '/macro', icon: Globe },
      { title: 'Economic Calendar', url: '/economic-calendar', icon: CalendarClock },
    ],
  },
  {
    label: 'System',
    items: [
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
];

// Flatten all items for search
const allItems = navGroups.flatMap(g => g.items);

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, user } = useAuth();
  const [search, setSearch] = useState('');

  const searchLower = search.toLowerCase().trim();
  const filteredGroups = searchLower
    ? navGroups.map(g => ({
        ...g,
        items: g.items.filter(i => i.title.toLowerCase().includes(searchLower)),
      })).filter(g => g.items.length > 0)
    : navGroups;

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

          {/* Search */}
          {!collapsed && (
            <div className="px-3 pb-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search..."
                  className="h-8 pl-8 text-xs bg-secondary border-border"
                />
              </div>
            </div>
          )}

          <SidebarGroupContent>
            {filteredGroups.map(group => (
              <CollapsibleNavGroup key={group.label} group={group} collapsed={collapsed} forceOpen={!!searchLower} />
            ))}
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

function CollapsibleNavGroup({ group, collapsed, forceOpen }: { group: NavGroup; collapsed: boolean; forceOpen: boolean }) {
  const [open, setOpen] = useState(group.defaultOpen ?? false);
  const isOpen = forceOpen || open;

  if (collapsed) {
    return (
      <SidebarMenu>
        {group.items.map(item => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild>
              <NavLink to={item.url} end={item.url === '/'} className="hover:bg-sidebar-accent" activeClassName="bg-sidebar-accent text-primary font-medium">
                <item.icon className="h-4 w-4 mr-2" />
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center w-full px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
        <ChevronDown className={`h-3 w-3 mr-1.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
        {group.label}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <SidebarMenu>
          {group.items.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url === '/'}
                  className="hover:bg-sidebar-accent"
                  activeClassName="bg-sidebar-accent text-primary font-medium"
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </CollapsibleContent>
    </Collapsible>
  );
}
