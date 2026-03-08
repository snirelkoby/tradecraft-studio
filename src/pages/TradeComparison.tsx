import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, parseISO } from 'date-fns';

export default function TradeComparison() {
  const { data: trades } = useTrades();
  const [tradeA, setTradeA] = useState('');
  const [tradeB, setTradeB] = useState('');

  const closed = useMemo(() => (trades ?? []).filter(t => t.status === 'closed').sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()), [trades]);

  const a = closed.find(t => t.id === tradeA);
  const b = closed.find(t => t.id === tradeB);

  const fields: { label: string; key: string; format?: (v: any) => string }[] = [
    { label: 'Symbol', key: 'symbol' },
    { label: 'Direction', key: 'direction' },
    { label: 'Entry Date', key: 'entry_date', format: v => v ? format(parseISO(v), 'MMM dd, yyyy HH:mm') : '—' },
    { label: 'Exit Date', key: 'exit_date', format: v => v ? format(parseISO(v), 'MMM dd, yyyy HH:mm') : '—' },
    { label: 'Entry Price', key: 'entry_price', format: v => `$${Number(v).toFixed(2)}` },
    { label: 'Exit Price', key: 'exit_price', format: v => v ? `$${Number(v).toFixed(2)}` : '—' },
    { label: 'Quantity', key: 'quantity' },
    { label: 'P&L', key: 'pnl', format: v => v !== null ? `$${Number(v).toFixed(2)}` : '—' },
    { label: 'P&L %', key: 'pnl_percent', format: v => v !== null ? `${Number(v).toFixed(2)}%` : '—' },
    { label: 'Fees', key: 'fees', format: v => v ? `$${Number(v).toFixed(2)}` : '$0' },
    { label: 'Strategy', key: 'strategy', format: v => v || '—' },
    { label: 'Stop Loss', key: 'stop_loss', format: v => v ? `$${Number(v).toFixed(2)}` : '—' },
    { label: 'Take Profit', key: 'take_profit', format: v => v ? `$${Number(v).toFixed(2)}` : '—' },
    { label: 'Tags', key: 'tags', format: v => v?.length ? v.join(', ') : '—' },
    { label: 'Notes', key: 'notes', format: v => v || '—' },
  ];

  const getVal = (trade: any, field: typeof fields[0]) => {
    const raw = trade?.[field.key];
    return field.format ? field.format(raw) : String(raw ?? '—');
  };

  const getPnlColor = (trade: any) => {
    if (!trade?.pnl) return '';
    return trade.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Comparison</h1>
        <p className="text-muted-foreground text-sm">השוואה צד-לצד בין שתי עסקאות</p>
      </div>

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground block mb-2">עסקה A</label>
          <Select value={tradeA} onValueChange={setTradeA}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="בחר עסקה..." /></SelectTrigger>
            <SelectContent>
              {closed.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.symbol} {t.direction} — {format(parseISO(t.entry_date), 'MMM dd')} — ${(t.pnl ?? 0).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="text-xs text-muted-foreground block mb-2">עסקה B</label>
          <Select value={tradeB} onValueChange={setTradeB}>
            <SelectTrigger className="bg-background"><SelectValue placeholder="בחר עסקה..." /></SelectTrigger>
            <SelectContent>
              {closed.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.symbol} {t.direction} — {format(parseISO(t.entry_date), 'MMM dd')} — ${(t.pnl ?? 0).toFixed(2)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Comparison Table */}
      {(a || b) && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-right p-3 text-xs text-muted-foreground font-medium w-1/4">שדה</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium w-[37.5%]">עסקה A</th>
                <th className="text-center p-3 text-xs text-muted-foreground font-medium w-[37.5%]">עסקה B</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, i) => (
                <tr key={field.key} className={i % 2 === 0 ? 'bg-background' : 'bg-secondary/20'}>
                  <td className="p-3 text-muted-foreground text-xs font-medium">{field.label}</td>
                  <td className={`p-3 text-center font-mono text-xs ${field.key === 'pnl' ? getPnlColor(a) : ''}`}>
                    {a ? getVal(a, field) : '—'}
                  </td>
                  <td className={`p-3 text-center font-mono text-xs ${field.key === 'pnl' ? getPnlColor(b) : ''}`}>
                    {b ? getVal(b, field) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!a && !b && (
        <div className="rounded-xl border border-border bg-card p-12 text-center text-muted-foreground">
          בחר שתי עסקאות להשוואה
        </div>
      )}
    </div>
  );
}
