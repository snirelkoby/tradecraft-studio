import { useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';

export default function CommissionTracker() {
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed');
  }, [allTrades, selectedAccount]);

  // By broker
  const byBroker = useMemo(() => {
    const map = new Map<string, { fees: number; count: number }>();
    trades.forEach(t => {
      const broker = (t as any).broker || 'Unknown';
      const entry = map.get(broker) ?? { fees: 0, count: 0 };
      entry.fees += t.fees ?? 0;
      entry.count++;
      map.set(broker, entry);
    });
    return Array.from(map.entries()).map(([broker, v]) => ({ broker, fees: v.fees, count: v.count }));
  }, [trades]);

  // By month
  const byMonth = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => {
      const month = format(parseISO(t.entry_date), 'yyyy-MM');
      map.set(month, (map.get(month) ?? 0) + (t.fees ?? 0));
    });
    let cum = 0;
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, fees]) => {
      cum += fees;
      return { month: format(parseISO(month + '-01'), 'MMM yy'), fees, cumulative: cum };
    });
  }, [trades]);

  // By asset type
  const byAsset = useMemo(() => {
    const map = new Map<string, number>();
    trades.forEach(t => {
      const asset = t.asset_type || 'unknown';
      map.set(asset, (map.get(asset) ?? 0) + (t.fees ?? 0));
    });
    return Array.from(map.entries()).map(([asset, fees]) => ({ asset, fees })).sort((a, b) => b.fees - a.fees);
  }, [trades]);

  const totalFees = trades.reduce((sum, t) => sum + (t.fees ?? 0), 0);
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const feesPct = totalPnl !== 0 ? (totalFees / Math.abs(totalPnl)) * 100 : 0;

  const tooltipStyle = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Commission Tracker</h1>
        <p className="text-muted-foreground text-sm">מעקב עמלות מפורט לפי ברוקר, נכס וחודש</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">סה״כ עמלות</p>
          <p className="text-xl font-bold font-mono text-[hsl(var(--chart-red))]">${totalFees.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">עמלות / P&L</p>
          <p className="text-xl font-bold font-mono">{feesPct.toFixed(1)}%</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">ממוצע לעסקה</p>
          <p className="text-xl font-bold font-mono">${trades.length ? (totalFees / trades.length).toFixed(2) : '0.00'}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">עסקאות</p>
          <p className="text-xl font-bold font-mono">{trades.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* By Broker */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">עמלות לפי ברוקר</h3>
          {byBroker.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byBroker}>
                <XAxis dataKey="broker" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Fees']} />
                <Bar dataKey="fees" radius={[4, 4, 0, 0]} fill="hsl(var(--chart-red))" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>}
        </div>

        {/* By Asset */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">עמלות לפי סוג נכס</h3>
          {byAsset.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byAsset}>
                <XAxis dataKey="asset" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`, 'Fees']} />
                <Bar dataKey="fees" radius={[4, 4, 0, 0]}>
                  {byAsset.map((_, i) => <Cell key={i} fill={`hsl(${(i * 40) + 200} 60% 55%)`} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>}
        </div>
      </div>

      {/* Cumulative By Month */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">עמלות מצטברות לפי חודש</h3>
        {byMonth.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={byMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`$${v.toFixed(2)}`]} />
              <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--chart-red))" strokeWidth={2} dot={false} name="Cumulative" />
              <Bar dataKey="fees" fill="hsl(var(--chart-red))" opacity={0.3} name="Monthly" />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>}
      </div>
    </div>
  );
}
