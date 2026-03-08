import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { toast } from 'sonner';
import { Trophy, Lock, Star, Flame, Target, TrendingUp, Shield, Zap } from 'lucide-react';

const ACHIEVEMENTS = [
  { key: 'first_trade', title: 'First Blood', desc: 'סגור את העסקה הראשונה שלך', icon: Star, check: (s: any) => s.totalTrades >= 1 },
  { key: '10_trades', title: 'Getting Started', desc: '10 עסקאות סגורות', icon: Target, check: (s: any) => s.totalTrades >= 10 },
  { key: '50_trades', title: 'Veteran', desc: '50 עסקאות סגורות', icon: Shield, check: (s: any) => s.totalTrades >= 50 },
  { key: '100_trades', title: 'Centurion', desc: '100 עסקאות סגורות', icon: Trophy, check: (s: any) => s.totalTrades >= 100 },
  { key: 'win_rate_50', title: 'Coin Flipper', desc: 'Win Rate מעל 50%', icon: Zap, check: (s: any) => s.winRate >= 50 && s.totalTrades >= 10 },
  { key: 'win_rate_60', title: 'Edge Hunter', desc: 'Win Rate מעל 60%', icon: Flame, check: (s: any) => s.winRate >= 60 && s.totalTrades >= 20 },
  { key: 'win_rate_70', title: 'Sharp Shooter', desc: 'Win Rate מעל 70%', icon: Trophy, check: (s: any) => s.winRate >= 70 && s.totalTrades >= 20 },
  { key: 'pf_above_2', title: 'Profit Machine', desc: 'Profit Factor מעל 2', icon: TrendingUp, check: (s: any) => s.profitFactor >= 2 && s.totalTrades >= 10 },
  { key: 'pnl_1000', title: '$1K Club', desc: 'רווח כולל מעל $1,000', icon: Star, check: (s: any) => s.totalPnl >= 1000 },
  { key: 'pnl_5000', title: '$5K Milestone', desc: 'רווח כולל מעל $5,000', icon: Trophy, check: (s: any) => s.totalPnl >= 5000 },
  { key: 'pnl_10000', title: '$10K Legend', desc: 'רווח כולל מעל $10,000', icon: Trophy, check: (s: any) => s.totalPnl >= 10000 },
  { key: 'avg_rr_2', title: 'Risk Master', desc: 'Average R:R מעל 2', icon: Shield, check: (s: any) => s.avgRR >= 2 && s.totalTrades >= 10 },
  { key: 'streak_5', title: 'Hot Streak', desc: '5 עסקאות רווחיות ברצף', icon: Flame, check: (_: any, t: any[]) => { let max = 0, cur = 0; t.forEach(tr => { if ((tr.pnl ?? 0) > 0) { cur++; max = Math.max(max, cur); } else cur = 0; }); return max >= 5; } },
  { key: 'streak_10', title: 'On Fire', desc: '10 עסקאות רווחיות ברצף', icon: Flame, check: (_: any, t: any[]) => { let max = 0, cur = 0; t.forEach(tr => { if ((tr.pnl ?? 0) > 0) { cur++; max = Math.max(max, cur); } else cur = 0; }); return max >= 10; } },
  { key: 'no_loss_week', title: 'Perfect Week', desc: 'שבוע בלי הפסד', icon: Star, check: () => false }, // placeholder
];

export default function AchievementsPage() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed').sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [allTrades, selectedAccount]);

  const stats = useTradeStats(trades.length > 0 ? trades : undefined);

  useEffect(() => {
    if (!user) return;
    loadUnlocked();
  }, [user]);

  useEffect(() => {
    if (!user || trades.length === 0) return;
    checkAndUnlock();
  }, [user, trades, stats]);

  const loadUnlocked = async () => {
    const { data } = await supabase.from('achievements').select('achievement_key');
    setUnlocked(new Set((data ?? []).map(d => d.achievement_key)));
  };

  const checkAndUnlock = async () => {
    if (!user) return;
    for (const ach of ACHIEVEMENTS) {
      if (unlocked.has(ach.key)) continue;
      if (ach.check(stats, trades)) {
        const { error } = await supabase.from('achievements').insert({
          user_id: user.id, achievement_key: ach.key,
        } as any);
        if (!error) {
          setUnlocked(prev => new Set([...prev, ach.key]));
          toast.success(`🏆 Achievement Unlocked: ${ach.title}!`);
        }
      }
    }
  };

  const unlockedCount = ACHIEVEMENTS.filter(a => unlocked.has(a.key)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground text-sm">הישגים ומדליות — {unlockedCount}/{ACHIEVEMENTS.length} unlocked</p>
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <Trophy className="h-8 w-8 text-yellow-400" />
          <div className="flex-1">
            <div className="h-3 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 transition-all"
                style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
              />
            </div>
          </div>
          <span className="font-mono font-bold text-lg">{unlockedCount}/{ACHIEVEMENTS.length}</span>
        </div>
      </div>

      {/* Achievement grid */}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ACHIEVEMENTS.map(ach => {
          const isUnlocked = unlocked.has(ach.key);
          return (
            <div
              key={ach.key}
              className={`rounded-xl border p-5 transition-all ${
                isUnlocked
                  ? 'border-yellow-400/30 bg-yellow-400/5'
                  : 'border-border bg-card opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isUnlocked ? 'bg-yellow-400/20' : 'bg-secondary'
                }`}>
                  {isUnlocked ? (
                    <ach.icon className="h-6 w-6 text-yellow-400" />
                  ) : (
                    <Lock className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className={`font-bold ${isUnlocked ? '' : 'text-muted-foreground'}`}>{ach.title}</h4>
                  <p className="text-xs text-muted-foreground">{ach.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
