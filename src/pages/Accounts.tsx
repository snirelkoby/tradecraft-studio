import { useState } from 'react';
import { useAccounts, useAddAccount, useDeleteAccount, useUpdateAccount } from '@/hooks/useAccounts';
import { useAllAccountTransactions, useAddTransaction } from '@/hooks/useAccountTransactions';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Wallet, Pencil, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { StockWatchlist } from '@/components/accounts/StockWatchlist';

const ACCOUNT_TYPES = [
  { value: 'day_trading', label: 'Day Trading' },
  { value: 'scalping', label: 'Scalping' },
  { value: 'swing', label: 'Swing Trading' },
  { value: 'investing', label: 'Investing' },
];

export default function Accounts() {
  const { data: accounts, isLoading } = useAccounts();
  const { data: trades } = useTrades();
  const { data: allTransactions } = useAllAccountTransactions();
  const addAccount = useAddAccount();
  const deleteAccount = useDeleteAccount();
  const updateAccount = useUpdateAccount();
  const addTransaction = useAddTransaction();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('day_trading');
  const [balance, setBalance] = useState('');

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editBalance, setEditBalance] = useState('');

  // Transaction state
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txAccountId, setTxAccountId] = useState('');
  const [txAccountName, setTxAccountName] = useState('');
  const [txType, setTxType] = useState<'deposit' | 'withdrawal'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txNote, setTxNote] = useState('');

  // History state
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState('');
  const [historyAccountName, setHistoryAccountName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) { toast.error('Enter account name'); return; }
    addAccount.mutate(
      { name: name.trim(), account_type: type, starting_balance: parseFloat(balance) || 0 },
      {
        onSuccess: () => {
          toast.success('Account created');
          setDialogOpen(false);
          setName('');
          setBalance('');
        },
      }
    );
  };

  const openEdit = (acc: { id: string; name: string; account_type: string; starting_balance: number }) => {
    setEditId(acc.id);
    setEditName(acc.name);
    setEditType(acc.account_type);
    setEditBalance(String(acc.starting_balance));
    setEditDialogOpen(true);
  };

  const handleEdit = () => {
    if (!editName.trim()) { toast.error('Enter account name'); return; }
    updateAccount.mutate(
      { id: editId, name: editName.trim(), account_type: editType, starting_balance: parseFloat(editBalance) || 0 },
      {
        onSuccess: () => {
          toast.success('Account updated');
          setEditDialogOpen(false);
        },
      }
    );
  };

  const openTxDialog = (accId: string, accName: string, type: 'deposit' | 'withdrawal') => {
    setTxAccountId(accId);
    setTxAccountName(accName);
    setTxType(type);
    setTxAmount('');
    setTxNote('');
    setTxDialogOpen(true);
  };

  const handleTransaction = () => {
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) { toast.error('הזן סכום תקין'); return; }
    addTransaction.mutate(
      { account_id: txAccountId, type: txType, amount, note: txNote || undefined },
      {
        onSuccess: () => {
          toast.success(txType === 'deposit' ? 'הפקדה בוצעה' : 'משיכה בוצעה');
          setTxDialogOpen(false);
        },
      }
    );
  };

  const openHistory = (accId: string, accName: string) => {
    setHistoryAccountId(accId);
    setHistoryAccountName(accName);
    setHistoryDialogOpen(true);
  };

  const getAccountTxTotal = (accountId: string) => {
    return (allTransactions ?? [])
      .filter(tx => tx.account_id === accountId)
      .reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
  };

  const getAccountPnl = (accountName: string) => {
    return (trades ?? [])
      .filter(t => t.account_name === accountName && t.status === 'closed' && t.pnl !== null)
      .reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  };

  const getAccountTradeCount = (accountName: string) => {
    return (trades ?? []).filter(t => t.account_name === accountName).length;
  };

  const accountHistory = (allTransactions ?? []).filter(tx => tx.account_id === historyAccountId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounts</h1>
          <p className="text-muted-foreground text-sm">Manage your trading accounts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Account</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle>Create Account</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground uppercase">Account Name</label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="My Account" className="bg-secondary" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase">Account Type</label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase">Starting Balance</label>
                <Input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="50000" className="bg-secondary" />
              </div>
              <Button onClick={handleAdd} className="w-full" disabled={addAccount.isPending}>Create Account</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase">Account Name</label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase">Account Type</label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger className="bg-secondary"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase">Starting Balance</label>
              <Input type="number" value={editBalance} onChange={e => setEditBalance(e.target.value)} className="bg-secondary" />
            </div>
            <Button onClick={handleEdit} className="w-full" disabled={updateAccount.isPending}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle>{txType === 'deposit' ? 'הפקדה' : 'משיכה'} — {txAccountName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase">סכום</label>
              <Input type="number" value={txAmount} onChange={e => setTxAmount(e.target.value)} placeholder="1000" className="bg-secondary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase">הערה (אופציונלי)</label>
              <Input value={txNote} onChange={e => setTxNote(e.target.value)} placeholder="Funding..." className="bg-secondary" />
            </div>
            <Button onClick={handleTransaction} className="w-full" disabled={addTransaction.isPending}>
              {txType === 'deposit' ? 'הפקד' : 'משוך'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle>היסטוריית תנועות — {historyAccountName}</DialogTitle></DialogHeader>
          {accountHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">אין תנועות</p>
          ) : (
            <div className="max-h-[400px] overflow-auto space-y-2">
              {accountHistory.map(tx => (
                <div key={tx.id} className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    {tx.type === 'deposit'
                      ? <ArrowDownLeft className="h-4 w-4 text-chart-green" />
                      : <ArrowUpRight className="h-4 w-4 text-chart-red" />}
                    <div>
                      <p className="text-sm font-medium">{tx.type === 'deposit' ? 'הפקדה' : 'משיכה'}</p>
                      {tx.note && <p className="text-xs text-muted-foreground">{tx.note}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-sm font-bold ${tx.type === 'deposit' ? 'text-chart-green' : 'text-chart-red'}`}>
                      {tx.type === 'deposit' ? '+' : '-'}${tx.amount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{format(parseISO(tx.created_at), 'dd/MM/yy HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <p className="text-center py-12 text-muted-foreground">Loading...</p>
      ) : !accounts?.length ? (
        <div className="text-center py-16">
          <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No accounts yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => {
            const pnl = getAccountPnl(acc.name);
            const txTotal = getAccountTxTotal(acc.id);
            const currentBalance = acc.starting_balance + pnl + txTotal;
            const tradeCount = getAccountTradeCount(acc.name);
            const typeLabel = ACCOUNT_TYPES.find(t => t.value === acc.account_type)?.label ?? acc.account_type;

            return (
              <Card key={acc.id} className="bg-card border-border">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-bold">{acc.name}</CardTitle>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(acc)}>
                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      if (confirm('Delete this account?')) deleteAccount.mutate(acc.id);
                    }}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <span className="inline-block text-xs bg-secondary text-muted-foreground px-2 py-1 rounded-md">{typeLabel}</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Starting</p>
                      <p className="font-mono font-bold text-sm">${acc.starting_balance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Current</p>
                      <p className={`font-mono font-bold text-sm ${currentBalance >= acc.starting_balance ? 'text-chart-green' : 'text-chart-red'}`}>
                        ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">P&L</p>
                      <p className={`font-mono font-bold text-sm ${pnl >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Deposits/Withdrawals</p>
                      <p className={`font-mono font-bold text-sm ${txTotal >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                        {txTotal >= 0 ? '+' : ''}${txTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Trades</p>
                      <p className="font-mono font-bold text-sm">{tradeCount}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openTxDialog(acc.id, acc.name, 'deposit')}>
                      <ArrowDownLeft className="h-3 w-3 mr-1" />הפקדה
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openTxDialog(acc.id, acc.name, 'withdrawal')}>
                      <ArrowUpRight className="h-3 w-3 mr-1" />משיכה
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => openHistory(acc.id, acc.name)}>
                      היסטוריה
                    </Button>
                  </div>
                  <div className="pt-2 border-t border-border">
                    <StockWatchlist accountId={acc.id} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
