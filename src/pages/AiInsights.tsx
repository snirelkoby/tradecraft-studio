import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isBefore, isAfter } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, Trash2, Clock, TrendingUp, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';

export default function AiInsights() {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);
  const [currentInsight, setCurrentInsight] = useState<string | null>(null);

  // Fetch saved insights history
  const { data: history } = useQuery({
    queryKey: ['ai-insights', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const closed = useMemo(() => {
    return (trades ?? [])
      .filter(t => t.status === 'closed' && t.pnl !== null)
      .filter(t => {
        if (selectedAccount !== 'all' && t.account_name !== selectedAccount) return false;
        if (dateFrom && isBefore(parseISO(t.entry_date), parseISO(dateFrom))) return false;
        if (dateTo && isAfter(parseISO(t.entry_date), parseISO(dateTo + 'T23:59:59'))) return false;
        return true;
      })
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());
  }, [trades, dateFrom, dateTo, selectedAccount]);

  // Stats summary
  const stats = useMemo(() => {
    if (closed.length === 0) return null;
    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const winRate = (wins.length / closed.length) * 100;
    return { totalPnl, winRate, totalTrades: closed.length, wins: wins.length };
  }, [closed]);

  const fetchAiInsights = async () => {
    if (!user) return;
    setLoadingAi(true);
    setCurrentInsight(null);
    try {
      const { data, error } = await supabase.functions.invoke('trade-insights', {
        body: { trades: closed },
      });
      if (error) throw error;
      const insights = data.insights || data.error || 'No insights.';
      setCurrentInsight(insights);

      // Save to history
      const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
      const wins = closed.filter(t => (t.pnl ?? 0) > 0);
      const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;

      await supabase.from('ai_insights').insert({
        user_id: user.id,
        account_filter: selectedAccount,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        trades_count: closed.length,
        total_pnl: totalPnl,
        win_rate: winRate,
        insights,
      } as any);
      qc.invalidateQueries({ queryKey: ['ai-insights'] });
    } catch (e: any) {
      setCurrentInsight('שגיאה בטעינת תובנות: ' + (e.message || 'Unknown error'));
      toast.error('Failed to generate insights');
    } finally {
      setLoadingAi(false);
    }
  };

  const deleteInsight = async (id: string) => {
    await supabase.from('ai_insights').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['ai-insights'] });
    toast.success('תובנה נמחקה');
  };

  const [selectedHistory, setSelectedHistory] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);

  const selectedItem = history?.find(h => h.id === selectedHistory);
  const compareItem = history?.find(h => h.id === compareId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Insights
        </h1>
        <p className="text-muted-foreground text-sm">תובנות מבוססות AI על הביצועים שלך, עם היסטוריה והשוואת תקופות</p>
      </div>

      {/* Generate new insight */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="font-semibold text-sm">ניתוח חדש</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="bg-secondary text-xs w-36" />
            <span className="text-muted-foreground text-xs">→</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="bg-secondary text-xs w-36" />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setDateFrom(''); setDateTo(''); }}>נקה</Button>
            )}
          </div>
          <Button onClick={fetchAiInsights} disabled={loadingAi || closed.length === 0} className="gap-2">
            {loadingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            נתח {closed.length} עסקאות
          </Button>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="flex gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">עסקאות:</span>
              <span className="font-mono font-bold">{stats.totalTrades}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">P&L:</span>
              <span className={`font-mono font-bold ${stats.totalPnl >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                ${stats.totalPnl.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Win Rate:</span>
              <span className="font-mono font-bold">{stats.winRate.toFixed(1)}%</span>
            </div>
          </div>
        )}

        {/* Current insight result */}
        {(loadingAi || currentInsight) && (
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            {loadingAi ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                מנתח את העסקאות שלך...
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm" dir="rtl">
                <ReactMarkdown>{currentInsight || ''}</ReactMarkdown>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison mode */}
      {compareId && compareItem && selectedItem && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              השוואת תקופות
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setCompareId(null)}>סגור השוואה</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(parseISO(selectedItem.created_at), 'dd/MM/yyyy HH:mm')}
                {' · '}{selectedItem.trades_count} עסקאות · P&L: ${Number(selectedItem.total_pnl ?? 0).toFixed(2)}
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 prose prose-sm dark:prose-invert max-w-none text-xs max-h-96 overflow-y-auto" dir="rtl">
                <ReactMarkdown>{selectedItem.insights}</ReactMarkdown>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(parseISO(compareItem.created_at), 'dd/MM/yyyy HH:mm')}
                {' · '}{compareItem.trades_count} עסקאות · P&L: ${Number(compareItem.total_pnl ?? 0).toFixed(2)}
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-3 prose prose-sm dark:prose-invert max-w-none text-xs max-h-96 overflow-y-auto" dir="rtl">
                <ReactMarkdown>{compareItem.insights}</ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="space-y-3">
        <h2 className="font-semibold text-sm">היסטוריית תובנות</h2>
        {(!history || history.length === 0) ? (
          <p className="text-muted-foreground text-sm py-8 text-center">עדיין אין תובנות שמורות. לחץ על "נתח" כדי ליצור את הראשונה.</p>
        ) : (
          <div className="space-y-2">
            {history.map(item => (
              <div
                key={item.id}
                className={`rounded-xl border bg-card p-4 cursor-pointer transition-colors ${
                  selectedHistory === item.id ? 'border-primary' : 'border-border hover:border-primary/40'
                }`}
                onClick={() => setSelectedHistory(selectedHistory === item.id ? null : item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">{format(parseISO(item.created_at), 'dd/MM/yyyy HH:mm')}</span>
                    <span className="text-muted-foreground">{item.trades_count} עסקאות</span>
                    <span className={`font-mono font-bold ${Number(item.total_pnl ?? 0) >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                      ${Number(item.total_pnl ?? 0).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">WR: {Number(item.win_rate ?? 0).toFixed(1)}%</span>
                    {item.account_filter !== 'all' && (
                      <span className="text-muted-foreground">חשבון: {item.account_filter}</span>
                    )}
                    {item.date_from && (
                      <span className="text-muted-foreground">{item.date_from} → {item.date_to || '...'}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {selectedHistory && selectedHistory !== item.id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7"
                        onClick={(e) => { e.stopPropagation(); setCompareId(item.id); }}
                      >
                        השווה
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={(e) => { e.stopPropagation(); deleteInsight(item.id); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {selectedHistory === item.id && !compareId && (
                  <div className="mt-3 pt-3 border-t border-border prose prose-sm dark:prose-invert max-w-none text-sm" dir="rtl">
                    <ReactMarkdown>{item.insights}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
