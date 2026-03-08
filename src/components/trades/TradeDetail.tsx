import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TradingViewWidget } from './TradingViewWidget';
import { ScreenshotUpload } from './ScreenshotUpload';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];

interface TradeDetailProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TradeDetail({ trade, open, onOpenChange }: TradeDetailProps) {
  if (!trade) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="text-xl font-bold">{trade.symbol}</span>
            <Badge variant={trade.direction === 'long' ? 'default' : 'secondary'}>
              {trade.direction === 'long' ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
              {trade.direction.toUpperCase()}
            </Badge>
            {trade.asset_type && (
              <Badge variant="outline" className="text-xs">{trade.asset_type}</Badge>
            )}
            <Badge variant={trade.status === 'open' ? 'default' : 'secondary'}>{trade.status}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricBox label="Entry" value={`$${trade.entry_price}`} />
            <MetricBox label="Exit" value={trade.exit_price ? `$${trade.exit_price}` : '—'} />
            <MetricBox label="Stop Loss" value={trade.stop_loss ? `$${trade.stop_loss}` : '—'} />
            <MetricBox label="Take Profit" value={trade.take_profit ? `$${trade.take_profit}` : '—'} />
            <MetricBox label="Qty" value={trade.quantity.toString()} />
            <MetricBox label="Fees" value={`$${trade.fees ?? 0}`} />
            <MetricBox
              label="P&L"
              value={trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '—'}
              className={trade.pnl !== null ? (trade.pnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]') : ''}
            />
            <MetricBox
              label="P&L %"
              value={trade.pnl_percent !== null ? `${trade.pnl_percent.toFixed(2)}%` : '—'}
              className={trade.pnl_percent !== null ? (trade.pnl_percent >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]') : ''}
            />
          </div>

          {/* Dates */}
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Entry: {format(parseISO(trade.entry_date), 'MMM dd, yyyy HH:mm')}</span>
            {trade.exit_date && <span>Exit: {format(parseISO(trade.exit_date), 'MMM dd, yyyy HH:mm')}</span>}
          </div>

          {/* TradingView Chart with entry/exit markers */}
          <TradingViewWidget
            symbol={trade.symbol}
            assetType={trade.asset_type ?? undefined}
            entryPrice={trade.entry_price}
            exitPrice={trade.exit_price}
            entryDate={trade.entry_date}
            exitDate={trade.exit_date}
            direction={trade.direction}
          />

          {/* Screenshot */}
          <div>
            <label className="text-xs text-muted-foreground uppercase mb-2 block">Screenshot</label>
            <ScreenshotUpload tradeId={trade.id} currentUrl={trade.screenshot_url} />
          </div>

          {/* Notes */}
          {trade.notes && (
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Notes</label>
              <p className="text-sm bg-secondary rounded-lg p-3">{trade.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetricBox({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="bg-secondary rounded-lg p-3">
      <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      <p className={`font-mono font-bold text-sm ${className}`}>{value}</p>
    </div>
  );
}
