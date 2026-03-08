import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Outlet } from 'react-router-dom';
import { useAccounts } from '@/hooks/useAccounts';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet } from 'lucide-react';

export function Layout() {
  const { data: accounts } = useAccounts();
  const { data: trades } = useTrades();
  const { selectedAccount, setSelectedAccount } = useSelectedAccount();

  // Calculate total P&L from ALL closed trades
  const allClosedPnl = (trades ?? [])
    .filter(t => t.status === 'closed' && t.pnl !== null)
    .reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  // Calculate total starting balance from all accounts
  const totalStartingBalance = (accounts ?? []).reduce((sum, a) => sum + (a.starting_balance ?? 0), 0);

  // Get balance for a specific account
  const getAccountBalance = (accountName: string) => {
    const account = accounts?.find(a => a.name === accountName);
    const startingBalance = account?.starting_balance ?? 0;
    const pnl = (trades ?? [])
      .filter(t => t.account_name === accountName && t.status === 'closed' && t.pnl !== null)
      .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    return startingBalance + pnl;
  };

  // Total balance = starting balance + ALL trade P&L (including trades without matching accounts)
  const totalBalance = totalStartingBalance + allClosedPnl;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10 gap-3">
            <SidebarTrigger className="text-muted-foreground" />
            <div className="ml-auto flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-auto min-w-[180px] h-8 text-xs bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center justify-between gap-4">
                      <span>All Accounts</span>
                      <span className={`font-mono text-xs ${totalBalance >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                        ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </SelectItem>
                  {accounts?.map(a => {
                    const balance = getAccountBalance(a.name);
                    return (
                      <SelectItem key={a.id} value={a.name}>
                        <div className="flex items-center justify-between gap-4">
                          <span>{a.name}</span>
                          <span className={`font-mono text-xs ${balance >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
