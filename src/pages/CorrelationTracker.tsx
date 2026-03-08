import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { format, parseISO } from 'date-fns';

export default function CorrelationTracker() {
  const { data: allTrades, isLoading } = useTrades();
  const { selectedAccount } = useSelectedAccount();

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed' && t.pnl !== null);
  }, [allTrades, selectedAccount]);

  const symbols = useMemo(() => [...new Set(trades.map(t => t.symbol))].sort(), [trades]);

  // Build daily P&L series per symbol
  const dailyPnl = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    trades.forEach(t => {
      const day = format(parseISO(t.entry_date), 'yyyy-MM-dd');
      if (!map[t.symbol]) map[t.symbol] = {};
      map[t.symbol][day] = (map[t.symbol][day] || 0) + (t.pnl ?? 0);
    });
    return map;
  }, [trades]);

  // Get all dates
  const allDates = useMemo(() => {
    const dates = new Set<string>();
    Object.values(dailyPnl).forEach(series => Object.keys(series).forEach(d => dates.add(d)));
    return [...dates].sort();
  }, [dailyPnl]);

  // Pearson correlation
  const correlate = (a: string, b: string): number | null => {
    const seriesA = dailyPnl[a] || {};
    const seriesB = dailyPnl[b] || {};
    const common = allDates.filter(d => d in seriesA && d in seriesB);
    if (common.length < 3) return null;
    const vA = common.map(d => seriesA[d]);
    const vB = common.map(d => seriesB[d]);
    const n = vA.length;
    const meanA = vA.reduce((s, v) => s + v, 0) / n;
    const meanB = vB.reduce((s, v) => s + v, 0) / n;
    let cov = 0, varA = 0, varB = 0;
    for (let i = 0; i < n; i++) {
      const dA = vA[i] - meanA, dB = vB[i] - meanB;
      cov += dA * dB;
      varA += dA * dA;
      varB += dB * dB;
    }
    if (varA === 0 || varB === 0) return null;
    return cov / Math.sqrt(varA * varB);
  };

  const matrix = useMemo(() => {
    return symbols.map(a => symbols.map(b => a === b ? 1 : correlate(a, b)));
  }, [symbols, dailyPnl, allDates]);

  const getColor = (val: number | null) => {
    if (val === null) return 'bg-secondary/30 text-muted-foreground';
    if (val >= 0.7) return 'bg-chart-green/60 text-white';
    if (val >= 0.3) return 'bg-chart-green/25';
    if (val >= -0.3) return 'bg-muted';
    if (val >= -0.7) return 'bg-chart-red/25';
    return 'bg-chart-red/60 text-white';
  };

  // Pair stats
  const pairs = useMemo(() => {
    const result: { a: string; b: string; corr: number; trades: number }[] = [];
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const c = correlate(symbols[i], symbols[j]);
        if (c !== null) {
          const common = allDates.filter(d => (dailyPnl[symbols[i]]?.[d] !== undefined) && (dailyPnl[symbols[j]]?.[d] !== undefined));
          result.push({ a: symbols[i], b: symbols[j], corr: c, trades: common.length });
        }
      }
    }
    return result.sort((a, b) => Math.abs(b.corr) - Math.abs(a.corr));
  }, [symbols, dailyPnl, allDates]);

  if (isLoading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Correlation Tracker</h1>
        <p className="text-muted-foreground text-sm">מעקב קורלציה בין הנכסים שאתה סוחר — מבוסס P&L יומי</p>
      </div>

      {symbols.length < 2 ? (
        <div className="rounded-xl border border-dashed border-border bg-secondary/30 p-12 text-center">
          <p className="text-muted-foreground">נדרשים לפחות 2 סימולים שונים עם עסקאות סגורות</p>
        </div>
      ) : (
        <>
          {/* Matrix */}
          <div className="rounded-xl border border-border bg-card p-5 overflow-x-auto">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Correlation Matrix</h3>
            <div className="min-w-[400px]">
              <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${symbols.length}, 1fr)` }}>
                <div />
                {symbols.map(s => (
                  <div key={s} className="text-[10px] text-muted-foreground text-center font-mono truncate">{s}</div>
                ))}
                {symbols.map((rowSym, ri) => (
                  <>
                    <div key={`label-${ri}`} className="text-xs font-mono text-muted-foreground flex items-center truncate">{rowSym}</div>
                    {symbols.map((_, ci) => {
                      const val = matrix[ri]?.[ci] ?? null;
                      return (
                        <div
                          key={`${ri}-${ci}`}
                          className={`h-10 rounded flex items-center justify-center text-[11px] font-mono font-bold ${getColor(val)}`}
                          title={val !== null ? `${rowSym} ↔ ${symbols[ci]}: ${val.toFixed(3)}` : 'Not enough data'}
                        >
                          {val !== null ? val.toFixed(2) : '—'}
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <span>Legend:</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-red/60 inline-block" /> Strong negative</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-red/25 inline-block" /> Moderate negative</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-muted inline-block" /> Neutral</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-green/25 inline-block" /> Moderate positive</span>
              <span className="flex items-center gap-1"><span className="w-4 h-3 rounded bg-chart-green/60 inline-block" /> Strong positive</span>
            </div>
          </div>

          {/* Top pairs */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Strongest Correlations</h3>
            <div className="space-y-2">
              {pairs.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <span className="font-mono font-bold text-sm min-w-[140px]">{p.a} ↔ {p.b}</span>
                  <span className="text-xs text-muted-foreground">{p.trades} common days</span>
                  <div className={`ml-auto px-3 py-1 rounded font-mono font-bold text-xs ${getColor(p.corr)}`}>
                    {p.corr.toFixed(3)}
                  </div>
                </div>
              ))}
              {pairs.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Not enough overlapping data</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
