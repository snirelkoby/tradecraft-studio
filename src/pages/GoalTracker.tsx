import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Target, TrendingUp, TrendingDown, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';

interface Goal {
  id?: string;
  month: string;
  pnl_target: number;
  win_rate_target: number;
  max_drawdown_target: number;
  max_trades_target: number;
  notes: string;
}

export default function GoalTracker() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const [currentMonth, setCurrentMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [goal, setGoal] = useState<Goal>({ month: currentMonth, pnl_target: 0, win_rate_target: 0, max_drawdown_target: 0, max_trades_target: 0, notes: '' });
  const [loading, setLoading] = useState(true);

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed' && t.pnl !== null && t.entry_date.startsWith(currentMonth));
  }, [allTrades, selectedAccount, currentMonth]);

  const actuals = useMemo(() => {
    const pnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const wins = trades.filter(t => (t.pnl ?? 0) > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    let peak = 0, dd = 0, maxDd = 0;
    const sorted = [...trades].sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
    let cum = 0;
    sorted.forEach(t => {
      cum += t.pnl ?? 0;
      if (cum > peak) peak = cum;
      dd = peak - cum;
      if (dd > maxDd) maxDd = dd;
    });
    return { pnl, winRate, maxDrawdown: maxDd, totalTrades: trades.length };
  }, [trades]);

  useEffect(() => {
    if (!user) return;
    loadGoal();
  }, [user, currentMonth]);

  const loadGoal = async () => {
    setLoading(true);
    const { data } = await supabase.from('goals').select('*').eq('month', currentMonth).maybeSingle();
    if (data) {
      setGoal({
        id: data.id,
        month: data.month,
        pnl_target: data.pnl_target ?? 0,
        win_rate_target: data.win_rate_target ?? 0,
        max_drawdown_target: data.max_drawdown_target ?? 0,
        max_trades_target: data.max_trades_target ?? 0,
        notes: data.notes ?? '',
      });
    } else {
      setGoal({ month: currentMonth, pnl_target: 0, win_rate_target: 0, max_drawdown_target: 0, max_trades_target: 0, notes: '' });
    }
    setLoading(false);
  };

  const saveGoal = async () => {
    if (!user) return;
    if (goal.id) {
      const { error } = await supabase.from('goals').update({
        pnl_target: goal.pnl_target,
        win_rate_target: goal.win_rate_target,
        max_drawdown_target: goal.max_drawdown_target,
        max_trades_target: goal.max_trades_target,
        notes: goal.notes,
      } as any).eq('id', goal.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('goals').insert({
        user_id: user.id,
        month: currentMonth,
        pnl_target: goal.pnl_target,
        win_rate_target: goal.win_rate_target,
        max_drawdown_target: goal.max_drawdown_target,
        max_trades_target: goal.max_trades_target,
        notes: goal.notes,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success('Goals saved');
    loadGoal();
  };

  const shiftMonth = (dir: number) => {
    const [y, m] = currentMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCurrentMonth(format(d, 'yyyy-MM'));
  };

  const pct = (actual: number, target: number, invert = false) => {
    if (target === 0) return 0;
    const raw = invert ? Math.max(0, (1 - actual / target) * 100) : (actual / target) * 100;
    return Math.min(100, Math.max(0, raw));
  };

  const goalCards = [
    { label: 'P&L Target', icon: TrendingUp, target: goal.pnl_target, actual: actuals.pnl, format: (v: number) => `$${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, progress: pct(actuals.pnl, goal.pnl_target), color: 'text-chart-green' },
    { label: 'Win Rate Target', icon: Target, target: goal.win_rate_target, actual: actuals.winRate, format: (v: number) => `${v.toFixed(1)}%`, progress: pct(actuals.winRate, goal.win_rate_target), color: 'text-chart-blue' },
    { label: 'Max Drawdown Limit', icon: TrendingDown, target: goal.max_drawdown_target, actual: actuals.maxDrawdown, format: (v: number) => `$${v.toFixed(2)}`, progress: pct(actuals.maxDrawdown, goal.max_drawdown_target, true), color: 'text-chart-red' },
    { label: 'Trade Count Target', icon: BarChart3, target: goal.max_trades_target, actual: actuals.totalTrades, format: (v: number) => `${v}`, progress: pct(actuals.totalTrades, goal.max_trades_target), color: 'text-chart-purple' },
  ];

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Goal Tracker</h1>
          <p className="text-muted-foreground text-sm">הגדר יעדים חודשיים ועקוב אחרי ההתקדמות</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-mono font-bold text-lg min-w-[120px] text-center">{currentMonth}</span>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Progress Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {goalCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <card.icon className={`h-5 w-5 ${card.color}`} />
              <span className="text-sm font-semibold text-muted-foreground uppercase">{card.label}</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-2xl font-bold font-mono">{card.format(card.actual)}</span>
              <span className="text-xs text-muted-foreground">/ {card.format(card.target)}</span>
            </div>
            <Progress value={card.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{card.progress.toFixed(0)}%</p>
          </div>
        ))}
      </div>

      {/* Goal Settings */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-bold text-lg">Set Monthly Goals</h3>
        <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-1 block">P&L Target ($)</label>
            <Input type="number" value={goal.pnl_target} onChange={e => setGoal(p => ({ ...p, pnl_target: parseFloat(e.target.value) || 0 }))} className="bg-secondary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Win Rate Target (%)</label>
            <Input type="number" value={goal.win_rate_target} onChange={e => setGoal(p => ({ ...p, win_rate_target: parseFloat(e.target.value) || 0 }))} className="bg-secondary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Max Drawdown Limit ($)</label>
            <Input type="number" value={goal.max_drawdown_target} onChange={e => setGoal(p => ({ ...p, max_drawdown_target: parseFloat(e.target.value) || 0 }))} className="bg-secondary" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Trade Count Target</label>
            <Input type="number" value={goal.max_trades_target} onChange={e => setGoal(p => ({ ...p, max_trades_target: parseInt(e.target.value) || 0 }))} className="bg-secondary" />
          </div>
        </div>
        <Button onClick={saveGoal} className="font-bold">SAVE GOALS</Button>
      </div>
    </div>
  );
}
