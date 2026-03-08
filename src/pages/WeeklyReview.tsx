import { useState, useMemo } from 'react';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { KpiCard } from '@/components/KpiCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, parseISO, isWithinInterval } from 'date-fns';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function WeeklyReview() {
  const { data: allTrades } = useTrades();
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [aiSummary, setAiSummary] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const weekTrades = useMemo(() => {
    if (!allTrades) return [];
    return allTrades.filter(t => {
      const d = parseISO(t.entry_date);
      return isWithinInterval(d, { start: weekStart, end: weekEnd });
    });
  }, [allTrades, weekStart, weekEnd]);

  const closedTrades = weekTrades.filter(t => t.status === 'closed' && t.pnl !== null);
  const stats = useTradeStats(weekTrades);

  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { pnl: number; count: number }>();
    closedTrades.forEach(t => {
      const d = format(parseISO(t.entry_date), 'EEE MMM dd');
      const cur = map.get(d) || { pnl: 0, count: 0 };
      map.set(d, { pnl: cur.pnl + (t.pnl ?? 0), count: cur.count + 1 });
    });
    return Array.from(map.entries()).map(([day, v]) => ({ day, ...v }));
  }, [closedTrades]);

  const topTags = useMemo(() => {
    const map = new Map<string, number>();
    closedTrades.forEach(t => {
      (t.tags ?? []).forEach(tag => map.set(tag, (map.get(tag) ?? 0) + 1));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [closedTrades]);

  const generateAiSummary = async () => {
    if (!user || closedTrades.length === 0) {
      toast.error('No closed trades this week');
      return;
    }
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('trade-insights', {
        body: {
          trades: closedTrades.map(t => ({
            symbol: t.symbol, direction: t.direction, pnl: t.pnl,
            strategy: t.strategy, entry_date: t.entry_date, tags: t.tags,
          })),
          prompt: `Generate a weekly trading review for ${format(weekStart, 'MMM dd')} - ${format(weekEnd, 'MMM dd')}. Analyze patterns, best/worst days, tag performance, and give actionable advice for next week. Be concise but insightful.`,
        },
      });
      if (error) throw error;
      setAiSummary(data?.insights || 'No insights generated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate summary');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weekly Review</h1>
          <p className="text-muted-foreground text-sm">סיכום שבועי של פעילות המסחר</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(s => subWeeks(s, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono text-sm font-medium">
            {format(weekStart, 'MMM dd')} — {format(weekEnd, 'MMM dd, yyyy')}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setWeekStart(s => addWeeks(s, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard title="Weekly P&L" value={`$${stats.totalPnl.toFixed(2)}`} variant={stats.totalPnl >= 0 ? 'green' : 'red'} />
        <KpiCard title="Trades" value={String(closedTrades.length)} variant="blue" />
        <KpiCard title="Win Rate" value={`${stats.winRate.toFixed(0)}%`} variant={stats.winRate >= 50 ? 'green' : 'red'} />
        <KpiCard title="Best Trade" value={`$${stats.bestTrade.toFixed(2)}`} variant="green" />
        <KpiCard title="Worst Trade" value={`$${stats.worstTrade.toFixed(2)}`} variant="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Daily Breakdown */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Daily Breakdown</CardTitle></CardHeader>
          <CardContent>
            {dailyBreakdown.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No trades this week</p>
            ) : (
              <div className="space-y-2">
                {dailyBreakdown.map(d => (
                  <div key={d.day} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                    <div>
                      <p className="font-mono text-sm font-medium">{d.day}</p>
                      <p className="text-xs text-muted-foreground">{d.count} trades</p>
                    </div>
                    <span className={`font-mono font-bold ${d.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                      {d.pnl >= 0 ? '+' : ''}${d.pnl.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Tags This Week */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Top Tags This Week</CardTitle></CardHeader>
          <CardContent>
            {topTags.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-6">No tagged trades this week</p>
            ) : (
              <div className="space-y-2">
                {topTags.map(([tag, count]) => (
                  <div key={tag} className="flex items-center justify-between bg-secondary rounded-lg px-4 py-3">
                    <Badge variant="outline" className="font-mono">{tag}</Badge>
                    <span className="text-sm text-muted-foreground">{count} trades</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trades List */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-sm uppercase text-muted-foreground">Week Trades</CardTitle></CardHeader>
        <CardContent>
          {closedTrades.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">No closed trades this week</p>
          ) : (
            <div className="space-y-1">
              {closedTrades.map(t => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold">{t.symbol}</span>
                    <Badge variant="secondary" className="text-[10px]">{t.direction}</Badge>
                    {t.strategy && <Badge variant="outline" className="text-[10px]">{t.strategy}</Badge>}
                    {(t.tags ?? []).map(tag => (
                      <Badge key={tag} variant="secondary" className="text-[10px] bg-primary/10 text-primary">{tag}</Badge>
                    ))}
                  </div>
                  <span className={`font-mono font-bold ${(t.pnl ?? 0) >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                    {(t.pnl ?? 0) >= 0 ? '+' : ''}${(t.pnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm uppercase text-muted-foreground">AI Weekly Summary</CardTitle>
          <Button onClick={generateAiSummary} disabled={aiLoading} size="sm">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Generate Summary
          </Button>
        </CardHeader>
        <CardContent>
          {aiSummary ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{aiSummary}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-6">Click "Generate Summary" for an AI analysis of your week</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
