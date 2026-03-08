import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Sparkles, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface GradedTrade {
  trade: Trade;
  grade: string;
  reasons: string[];
}

function gradeTrade(t: Trade): GradedTrade {
  let score = 50;
  const reasons: string[] = [];

  // Win/loss
  if ((t.pnl ?? 0) > 0) { score += 15; reasons.push('✅ Profitable trade'); }
  else { score -= 10; reasons.push('❌ Losing trade'); }

  // Risk management: had SL
  if (t.stop_loss) { score += 10; reasons.push('✅ Stop loss defined'); }
  else { score -= 15; reasons.push('⚠️ No stop loss set'); }

  // Had TP
  if (t.take_profit) { score += 5; reasons.push('✅ Take profit defined'); }

  // R:R check
  if (t.stop_loss && t.take_profit && t.entry_price) {
    const risk = Math.abs(t.entry_price - t.stop_loss);
    const reward = Math.abs(t.take_profit - t.entry_price);
    const rr = risk > 0 ? reward / risk : 0;
    if (rr >= 2) { score += 15; reasons.push(`✅ Great R:R (${rr.toFixed(1)}:1)`); }
    else if (rr >= 1) { score += 5; reasons.push(`⚡ Decent R:R (${rr.toFixed(1)}:1)`); }
    else { score -= 10; reasons.push(`❌ Poor R:R (${rr.toFixed(1)}:1)`); }
  }

  // Strategy defined
  if (t.strategy) { score += 5; reasons.push('✅ Strategy tagged'); }
  else { score -= 5; reasons.push('⚠️ No strategy assigned'); }

  // Notes/journal
  if (t.notes && t.notes.length > 10) { score += 5; reasons.push('✅ Trade documented'); }

  // Fees awareness
  if (t.fees && t.fees > 0 && t.pnl) {
    const feeRatio = t.fees / Math.abs(t.pnl);
    if (feeRatio > 0.3) { score -= 5; reasons.push('⚠️ High fee-to-P&L ratio'); }
  }

  score = Math.min(100, Math.max(0, score));
  let grade = 'F';
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 65) grade = 'C';
  else if (score >= 50) grade = 'D';

  return { trade: t, grade, reasons };
}

const GRADE_COLORS: Record<string, string> = {
  A: 'bg-chart-green/20 text-chart-green border-chart-green/30',
  B: 'bg-chart-blue/20 text-chart-blue border-chart-blue/30',
  C: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  D: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  F: 'bg-chart-red/20 text-chart-red border-chart-red/30',
};

export default function AiTradeGrading() {
  const { data: allTrades, isLoading } = useTrades();
  const { selectedAccount } = useSelectedAccount();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed');
  }, [allTrades, selectedAccount]);

  const graded = useMemo(() => trades.map(gradeTrade).sort((a, b) => {
    const order = { A: 0, B: 1, C: 2, D: 3, F: 4 };
    return (order[a.grade as keyof typeof order] ?? 5) - (order[b.grade as keyof typeof order] ?? 5);
  }), [trades]);

  const distribution = useMemo(() => {
    const d: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    graded.forEach(g => { d[g.grade] = (d[g.grade] || 0) + 1; });
    return d;
  }, [graded]);

  const runAiAnalysis = async () => {
    setAnalyzing(true);
    try {
      const summary = {
        totalTrades: graded.length,
        distribution,
        commonIssues: graded.flatMap(g => g.reasons.filter(r => r.startsWith('⚠️') || r.startsWith('❌'))),
      };
      const { data, error } = await supabase.functions.invoke('trade-insights', {
        body: { message: `Analyze these trade grades and give improvement tips in Hebrew:\n${JSON.stringify(summary)}` },
      });
      if (error) throw error;
      setAiAnalysis(data?.insights || data?.message || 'No response');
    } catch (e: any) {
      toast.error(e.message || 'AI analysis failed');
    }
    setAnalyzing(false);
  };

  if (isLoading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Trade Grading</h1>
          <p className="text-muted-foreground text-sm">ציון אוטומטי A-F לכל עסקה על בסיס ניהול סיכונים, R:R ותיעוד</p>
        </div>
        <Button onClick={runAiAnalysis} disabled={analyzing || graded.length === 0}>
          {analyzing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          AI Analysis
        </Button>
      </div>

      {/* Distribution */}
      <div className="grid grid-cols-5 gap-3">
        {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => (
          <div key={grade} className={`rounded-xl border p-4 text-center ${GRADE_COLORS[grade]}`}>
            <span className="text-3xl font-black font-mono">{grade}</span>
            <p className="text-sm font-bold mt-1">{distribution[grade]}</p>
            <p className="text-[10px] opacity-70">trades</p>
          </div>
        ))}
      </div>

      {aiAnalysis && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Insights</h3>
          <p className="text-sm whitespace-pre-wrap">{aiAnalysis}</p>
        </div>
      )}

      {/* Trade list */}
      <div className="space-y-2">
        {graded.map(({ trade, grade, reasons }) => (
          <div key={trade.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center font-black text-xl font-mono shrink-0 ${GRADE_COLORS[grade]}`}>
              {grade}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold">{trade.symbol}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${trade.direction === 'long' ? 'bg-chart-green/20 text-chart-green' : 'bg-chart-red/20 text-chart-red'}`}>
                  {trade.direction}
                </span>
                <span className={`text-sm font-mono font-bold ${(trade.pnl ?? 0) >= 0 ? 'text-chart-green' : 'text-chart-red'}`}>
                  ${(trade.pnl ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex flex-wrap gap-1">
                {reasons.map((r, i) => (
                  <span key={i} className="text-[11px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">{r}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
        {graded.length === 0 && (
          <p className="text-muted-foreground text-center py-12">No closed trades to grade</p>
        )}
      </div>
    </div>
  );
}
