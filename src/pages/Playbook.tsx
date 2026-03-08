import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';

const TIERS = ['AAA', 'AA', 'A', 'B', 'C', 'D'];

interface Blueprint {
  id: string;
  tier: string;
  name: string;
}

interface SetupStats {
  blueprint: Blueprint;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
  profitFactor: number;
}

export default function Playbook() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from('blueprints').select('id, tier, name').order('created_at').then(({ data }) => {
      setBlueprints((data ?? []).map(b => ({ id: b.id, tier: b.tier, name: b.name ?? '' })));
      setLoading(false);
    });
  }, [user]);

  const setupStats = useMemo(() => {
    if (!allTrades || blueprints.length === 0) return [];
    const closed = allTrades.filter(t => t.status === 'closed' && t.pnl !== null);

    return blueprints.map(bp => {
      // Match trades by strategy (tier) AND optionally by tag matching blueprint name
      const matched = closed.filter(t => {
        if (t.strategy === bp.tier) {
          if (!bp.name) return true;
          // Also match if trade has a tag matching the blueprint name
          if ((t.tags ?? []).some(tag => tag.toLowerCase() === bp.name.toLowerCase())) return true;
          // Or if strategy matches and no specific blueprint name filter
          return true;
        }
        return false;
      });

      // If blueprint has a name, prefer trades that specifically reference it via tags
      const specificMatched = bp.name
        ? matched.filter(t => (t.tags ?? []).some(tag => tag.toLowerCase() === bp.name.toLowerCase()))
        : [];
      
      const trades = specificMatched.length > 0 ? specificMatched : matched;
      const wins = trades.filter(t => (t.pnl ?? 0) > 0);
      const losses = trades.filter(t => (t.pnl ?? 0) < 0);
      const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
      const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

      return {
        blueprint: bp,
        trades: trades.length,
        wins: wins.length,
        losses: losses.length,
        winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
        totalPnl,
        avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
        avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
        avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
        bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl ?? 0)) : 0,
        worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl ?? 0)) : 0,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
      } as SetupStats;
    });
  }, [allTrades, blueprints]);

  const statsByTier = useMemo(() => {
    const map: Record<string, SetupStats[]> = {};
    TIERS.forEach(t => { map[t] = []; });
    setupStats.forEach(s => {
      if (map[s.blueprint.tier]) map[s.blueprint.tier].push(s);
    });
    return map;
  }, [setupStats]);

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Playbook</h1>
        <p className="text-muted-foreground text-sm">ביצועים בפועל לכל Blueprint/Setup — תייג עסקאות לפי שם Setup לקבלת נתונים מדויקים</p>
      </div>

      <Tabs defaultValue="AAA">
        <TabsList className="bg-secondary border border-border">
          {TIERS.map(t => (
            <TabsTrigger key={t} value={t} className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-mono font-bold">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIERS.map(tier => {
          const setups = statsByTier[tier] || [];
          return (
            <TabsContent key={tier} value={tier} className="mt-4">
              {setups.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">No setups in {tier} tier. Create them in Blueprints first.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {setups.map(s => (
                    <Card key={s.blueprint.id} className="bg-card border-border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base font-bold">{s.blueprint.name || `${tier} Setup`}</CardTitle>
                          <Badge variant={s.totalPnl >= 0 ? 'default' : 'destructive'} className="font-mono">
                            {s.totalPnl >= 0 ? '+' : ''}${s.totalPnl.toFixed(2)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="bg-secondary rounded-lg p-3 text-center">
                            <BarChart3 className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                            <p className="font-mono font-bold text-lg">{s.trades}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">Trades</p>
                          </div>
                          <div className="bg-secondary rounded-lg p-3 text-center">
                            <Target className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                            <p className={`font-mono font-bold text-lg ${s.winRate >= 50 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                              {s.winRate.toFixed(0)}%
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase">Win Rate</p>
                          </div>
                          <div className="bg-secondary rounded-lg p-3 text-center">
                            <p className="text-[10px] text-muted-foreground mb-1">PF</p>
                            <p className="font-mono font-bold text-lg">
                              {s.profitFactor === Infinity ? '∞' : s.profitFactor.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-muted-foreground uppercase">Profit Factor</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">Avg P&L</span>
                            <span className={`font-mono font-bold ${s.avgPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                              ${s.avgPnl.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">W/L</span>
                            <span className="font-mono">{s.wins}W / {s.losses}L</span>
                          </div>
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">Avg Win</span>
                            <span className="font-mono text-[hsl(var(--chart-green))]">${s.avgWin.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">Avg Loss</span>
                            <span className="font-mono text-[hsl(var(--chart-red))]">-${s.avgLoss.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">Best</span>
                            <span className="font-mono text-[hsl(var(--chart-green))]">${s.bestTrade.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between bg-secondary/50 rounded px-3 py-2">
                            <span className="text-muted-foreground">Worst</span>
                            <span className="font-mono text-[hsl(var(--chart-red))]">${s.worstTrade.toFixed(2)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
