import { useTrades } from '@/hooks/useTrades';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';

export default function Ledger() {
  const { data: trades, isLoading } = useTrades();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operational Ledger</h1>
        <p className="text-muted-foreground text-sm">Complete trade history</p>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading...</p>
        ) : !trades?.length ? (
          <p className="text-center py-12 text-muted-foreground">No entries</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Symbol</TableHead>
                  <TableHead className="text-muted-foreground">Dir</TableHead>
                  <TableHead className="text-muted-foreground">Entry</TableHead>
                  <TableHead className="text-muted-foreground">Exit</TableHead>
                  <TableHead className="text-muted-foreground">Qty</TableHead>
                  <TableHead className="text-muted-foreground">P&L</TableHead>
                  <TableHead className="text-muted-foreground">P&L %</TableHead>
                  <TableHead className="text-muted-foreground">Strategy</TableHead>
                  <TableHead className="text-muted-foreground">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map(t => (
                  <TableRow key={t.id} className="border-border">
                    <TableCell className="font-mono text-xs">{format(parseISO(t.entry_date), 'yyyy-MM-dd')}</TableCell>
                    <TableCell className="font-bold">{t.symbol}</TableCell>
                    <TableCell className="text-xs uppercase">{t.direction}</TableCell>
                    <TableCell className="font-mono text-xs">${t.entry_price}</TableCell>
                    <TableCell className="font-mono text-xs">{t.exit_price ? `$${t.exit_price}` : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{t.quantity}</TableCell>
                    <TableCell>
                      {t.pnl !== null ? (
                        <span className={`font-mono font-bold ${t.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      {t.pnl_percent !== null ? (
                        <span className={`font-mono text-xs ${t.pnl_percent >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                          {t.pnl_percent >= 0 ? '+' : ''}{t.pnl_percent.toFixed(2)}%
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{t.strategy ?? '—'}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{t.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
