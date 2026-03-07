import { useState } from 'react';
import { useTrades, useDeleteTrade } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, TrendingUp, TrendingDown, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { TradeForm } from '@/components/trades/TradeForm';
import { TradeDetail } from '@/components/trades/TradeDetail';
import { CsvImport } from '@/components/trades/CsvImport';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

export default function Trades() {
  const { data: trades, isLoading } = useTrades();
  const deleteTrade = useDeleteTrade();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trade Journal</h1>
          <p className="text-muted-foreground text-sm">Log and manage your trades</p>
        </div>
        <div className="flex gap-2">
          <CsvImport />
          <Dialog open={formOpen} onOpenChange={setFormOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />New Trade</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
              <DialogHeader>
                <DialogTitle>Record New Trade</DialogTitle>
              </DialogHeader>
              <TradeForm onSuccess={() => setFormOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <p className="text-center py-12 text-muted-foreground">Loading...</p>
        ) : !trades?.length ? (
          <p className="text-center py-12 text-muted-foreground">No trades recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Date</TableHead>
                  <TableHead className="text-muted-foreground">Symbol</TableHead>
                  <TableHead className="text-muted-foreground">Type</TableHead>
                  <TableHead className="text-muted-foreground">Dir</TableHead>
                  <TableHead className="text-muted-foreground">Entry</TableHead>
                  <TableHead className="text-muted-foreground">Exit</TableHead>
                  <TableHead className="text-muted-foreground">P&L</TableHead>
                  <TableHead className="text-muted-foreground">Strategy</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map(t => (
                  <TableRow key={t.id} className="border-border cursor-pointer hover:bg-accent/50" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                    <TableCell className="font-mono text-xs">{format(parseISO(t.entry_date), 'MMM dd')}</TableCell>
                    <TableCell className="font-bold">{t.symbol}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{(t as any).asset_type || '—'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {t.direction === 'long' ? <TrendingUp className="h-3 w-3 text-[hsl(var(--chart-green))]" /> : <TrendingDown className="h-3 w-3 text-[hsl(var(--chart-red))]" />}
                        <span className="text-xs uppercase">{t.direction}</span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">${t.entry_price}</TableCell>
                    <TableCell className="font-mono text-xs">{t.exit_price ? `$${t.exit_price}` : '—'}</TableCell>
                    <TableCell>
                      {t.pnl !== null ? (
                        <span className={`font-mono font-bold text-sm ${t.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                          {t.pnl >= 0 ? '+' : ''}${t.pnl.toFixed(2)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>{t.strategy && <Badge variant="secondary" className="text-xs">{t.strategy}</Badge>}</TableCell>
                    <TableCell><Badge variant={t.status === 'open' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedTrade(t); setDetailOpen(true); }}>
                          <Eye className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm('Delete this trade?')) deleteTrade.mutate(t.id); }}>
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <TradeDetail trade={selectedTrade} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  );
}
