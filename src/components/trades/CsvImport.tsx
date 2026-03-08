import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { FUTURES_CONFIG } from '@/lib/assetConfig';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

const CSV_SOURCES = [
  { id: 'deepcharts', label: 'DeepCharts', description: 'Semicolon-separated CSV from DeepCharts' },
  { id: 'rithmic', label: 'Rithmic', description: 'Order History CSV export from R|Trader Pro' },
] as const;

type CsvSource = typeof CSV_SOURCES[number]['id'];

function parseDeepCharts(text: string, userId: string) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header and at least one row');

  const headers = lines[0].split(';').map(h => h.trim());
  const symIdx = headers.findIndex(h => h.toLowerCase() === 'symbol');
  const dtIdx = headers.findIndex(h => h.toLowerCase() === 'dt');
  const qtyIdx = headers.findIndex(h => h.toLowerCase() === 'quantity');
  const entryIdx = headers.findIndex(h => h.toLowerCase() === 'entry');
  const exitIdx = headers.findIndex(h => h.toLowerCase() === 'exit');
  const pnlIdx = headers.findIndex(h => h.toLowerCase() === 'profitloss');

  if (symIdx === -1 || dtIdx === -1 || qtyIdx === -1 || entryIdx === -1 || exitIdx === -1 || pnlIdx === -1) {
    throw new Error('Missing required columns: Symbol, DT, Quantity, Entry, Exit, ProfitLoss');
  }

  // Check if there's a status column and filter only Filled
  const statusIdx = headers.findIndex(h => h.toLowerCase() === 'status' || h.toLowerCase() === 'orderstatus');

  return lines.slice(1).filter(l => l.trim()).filter(line => {
    if (statusIdx === -1) return true;
    const vals = line.split(';').map(v => v.trim());
    const status = vals[statusIdx]?.toLowerCase() ?? '';
    return status === 'filled' || status === '';
  }).map(line => {
    const vals = line.split(';').map(v => v.trim());
    const qty = parseFloat(vals[qtyIdx]);
    const direction = qty < 0 ? 'short' : 'long';
    const absQty = Math.abs(qty);
    const pnl = parseFloat(vals[pnlIdx]);

    return {
      user_id: userId,
      symbol: vals[symIdx].toUpperCase(),
      direction,
      entry_date: new Date(vals[dtIdx]).toISOString(),
      exit_date: new Date(vals[dtIdx]).toISOString(),
      entry_price: parseFloat(vals[entryIdx]),
      exit_price: parseFloat(vals[exitIdx]),
      quantity: absQty,
      pnl: isNaN(pnl) ? null : pnl,
      pnl_percent: null,
      fees: 0,
      stop_loss: null,
      take_profit: null,
      strategy: null,
      notes: null,
      status: 'closed' as const,
      asset_type: 'Futures',
    };
  });
}

function parseRithmic(text: string, userId: string) {
  const lines = text.split('\n');
  
  // Find "Completed Orders" section
  let startIdx = lines.findIndex(l => l.trim().startsWith('Completed Orders'));
  if (startIdx === -1) throw new Error('Could not find "Completed Orders" section in file');
  
  // Next line is the header
  startIdx += 1;
  const headerLine = lines[startIdx];
  if (!headerLine) throw new Error('No header row found after Completed Orders');
  
  // Parse CSV header (quoted, comma-separated)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; continue; }
      if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(headerLine);
  const col = (name: string) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
  
  const statusIdx = col('Status');
  const buySellIdx = col('Buy/Sell');
  const qtyIdx = col('Qty To Fill');
  const symbolIdx = col('Symbol');
  const avgFillIdx = col('Avg Fill Price');
  const updateTimeIdx = col('Update Time');
  const accountIdx = col('Account');

  if (statusIdx === -1 || buySellIdx === -1 || symbolIdx === -1 || avgFillIdx === -1) {
    throw new Error('Missing required Rithmic columns (Status, Buy/Sell, Symbol, Avg Fill Price)');
  }

  // Parse only Filled orders
  interface FilledOrder {
    account: string;
    side: 'B' | 'S';
    qty: number;
    symbol: string;
    price: number;
    time: string;
  }

  const filledOrders: FilledOrder[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = parseCSVLine(line);
    if (vals[statusIdx] !== 'Filled') continue;
    const price = parseFloat(vals[avgFillIdx]);
    if (isNaN(price) || price === 0) continue;

    filledOrders.push({
      account: vals[accountIdx] || '',
      side: vals[buySellIdx] as 'B' | 'S',
      qty: parseInt(vals[qtyIdx]) || 1,
      symbol: vals[symbolIdx],
      price,
      time: vals[updateTimeIdx] || vals[col('Create Time')] || '',
    });
  }

  if (filledOrders.length === 0) throw new Error('No filled orders found in file');

  // Sort chronologically (oldest first)
  filledOrders.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // FIFO match: group by symbol, pair buys with sells
  const bySymbol = new Map<string, FilledOrder[]>();
  filledOrders.forEach(o => {
    if (!bySymbol.has(o.symbol)) bySymbol.set(o.symbol, []);
    bySymbol.get(o.symbol)!.push(o);
  });

  const trades: any[] = [];

  bySymbol.forEach((orders, symbol) => {
    const buys: FilledOrder[] = [];
    const sells: FilledOrder[] = [];

    orders.forEach(o => {
      if (o.side === 'B') buys.push(o);
      else sells.push(o);
    });

    // Match FIFO
    let bi = 0, si = 0;
    let buyRemaining = 0, sellRemaining = 0;

    while (bi < buys.length && si < sells.length) {
      const buy = buys[bi];
      const sell = sells[si];
      
      if (buyRemaining === 0) buyRemaining = buy.qty;
      if (sellRemaining === 0) sellRemaining = sell.qty;

      const matchQty = Math.min(buyRemaining, sellRemaining);
      
      // Determine direction: if buy came first, it's a long trade
      const buyFirst = new Date(buy.time).getTime() <= new Date(sell.time).getTime();
      const direction = buyFirst ? 'long' : 'short';
      const entryPrice = buyFirst ? buy.price : sell.price;
      const exitPrice = buyFirst ? sell.price : buy.price;
      const entryTime = buyFirst ? buy.time : sell.time;
      const exitTime = buyFirst ? sell.time : buy.time;

      const rawPnl = direction === 'long'
        ? (exitPrice - entryPrice) * matchQty * 20 // NQ tick value approximation: $20/point
        : (entryPrice - exitPrice) * matchQty * 20;

      trades.push({
        user_id: userId,
        symbol: symbol.replace(/[A-Z]\d$/, ''), // Strip contract month (NQH6 -> NQ)
        direction,
        entry_date: new Date(entryTime).toISOString(),
        exit_date: new Date(exitTime).toISOString(),
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: matchQty,
        pnl: rawPnl,
        pnl_percent: null,
        fees: 0,
        stop_loss: null,
        take_profit: null,
        strategy: null,
        notes: `Rithmic import | Account: ${buy.account}`,
        status: 'closed',
        asset_type: 'Futures',
        account_name: buy.account,
      });

      buyRemaining -= matchQty;
      sellRemaining -= matchQty;
      if (buyRemaining === 0) bi++;
      if (sellRemaining === 0) si++;
    }
  });

  if (trades.length === 0) throw new Error('Could not match any buy/sell pairs into trades');
  return trades;
}

export function CsvImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<CsvSource | null>(null);

  const handleSourceSelect = (source: CsvSource) => {
    setSelectedSource(source);
    fileRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !selectedSource) return;

    setImporting(true);
    try {
      const text = await file.text();
      let trades: any[];

      switch (selectedSource) {
        case 'deepcharts':
          trades = parseDeepCharts(text, user.id);
          break;
        case 'rithmic':
          trades = parseRithmic(text, user.id);
          break;
        default:
          throw new Error('Unknown source');
      }

      if (trades.length === 0) throw new Error('No trades found in file');

      for (let i = 0; i < trades.length; i += 100) {
        const batch = trades.slice(i, i + 100);
        const { error } = await supabase.from('trades').insert(batch as any);
        if (error) throw error;
      }

      toast.success(`${trades.length} trades imported from ${selectedSource}`);
      qc.invalidateQueries({ queryKey: ['trades'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      setSelectedSource(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Upload className="h-4 w-4 mr-2" />
          {importing ? 'Importing...' : 'Import CSV'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle>Import Trades</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Choose your data source:</p>
        <div className="space-y-2">
          {CSV_SOURCES.map(source => (
            <button
              key={source.id}
              onClick={() => handleSourceSelect(source.id)}
              disabled={importing}
              className="w-full text-left rounded-lg border border-border bg-secondary p-4 hover:bg-accent/50 transition-colors"
            >
              <p className="font-bold text-sm">{source.label}</p>
              <p className="text-xs text-muted-foreground">{source.description}</p>
            </button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}
