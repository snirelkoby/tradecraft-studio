import {
  BarChart3, BookOpen, Calendar, FileText, PenTool,
  Calculator, Settings, LogOut, Notebook, FlaskConical, Wallet, CandlestickChart
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
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Blueprints', url: '/blueprints', icon: BookOpen },
  { title: 'Daily Journal', url: '/journal', icon: Notebook },
  { title: 'Accounts', url: '/accounts', icon: Wallet },
  { title: 'Ledger', url: '/ledger', icon: FileText },
  { title: 'Risk Engine', url: '/risk', icon: Calculator },
  { title: 'Calculators', url: '/calculators', icon: FlaskConical },
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
