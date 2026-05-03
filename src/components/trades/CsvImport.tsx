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
  { id: 'rithmic', label: 'Rithmic (Original)', description: 'Order History CSV export from R|Trader Pro (Completed Orders section)' },
  { id: 'rithmic-simple', label: 'Rithmic (Simple)', description: 'CSV גמיש — תומך גם ב-Order History וגם בפורמט פשוט עם עמודות Symbol, Qty, Open/Close Time, Price, PnL' },
] as const;

type CsvSource = typeof CSV_SOURCES[number]['id'];

/** Detect if a symbol matches a futures contract (with or without month code suffix). Returns clean symbol if match, else null. */
function detectFutures(rawSymbol: string): { symbol: string; config: typeof FUTURES_CONFIG[number] } | null {
  if (!rawSymbol) return null;
  const upper = rawSymbol.toUpperCase().trim();
  // Try exact match first
  let cfg = FUTURES_CONFIG.find(f => f.symbol === upper);
  if (cfg) return { symbol: cfg.symbol, config: cfg };
  // Strip continuous-contract markers and month codes (e.g. NQH5, NQZ24, NQ1!, NQ=F)
  const stripped = upper.replace(/=F$/, '').replace(/\d+!?$/, '').replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '');
  cfg = FUTURES_CONFIG.find(f => f.symbol === stripped);
  if (cfg) return { symbol: cfg.symbol, config: cfg };
  // Prefix match (e.g. "NQH5" -> "NQ")
  cfg = FUTURES_CONFIG.find(f => upper.startsWith(f.symbol) && upper.length - f.symbol.length <= 3);
  if (cfg) return { symbol: cfg.symbol, config: cfg };
  return null;
}

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
    const rawSym = vals[symIdx].toUpperCase();
    const fut = detectFutures(rawSym);
    const symbol = fut ? fut.symbol : rawSym;
    const assetType = fut ? 'Futures' : 'Stocks';
    const entryPrice = parseFloat(vals[entryIdx]);
    const exitPrice = parseFloat(vals[exitIdx]);
    // Recompute pnl correctly for futures if file has stock-style raw qty math
    let finalPnl: number | null = isNaN(pnl) ? null : pnl;
    if (fut && (finalPnl === null || isNaN(finalPnl))) {
      const ticks = (exitPrice - entryPrice) / fut.config.tickSize;
      const raw = direction === 'long' ? ticks * fut.config.tickValue * absQty : -ticks * fut.config.tickValue * absQty;
      finalPnl = raw;
    }

    return {
      user_id: userId,
      symbol,
      direction,
      entry_date: new Date(vals[dtIdx]).toISOString(),
      exit_date: new Date(vals[dtIdx]).toISOString(),
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity: absQty,
      pnl: finalPnl,
      pnl_percent: null,
      fees: 0,
      stop_loss: null,
      take_profit: null,
      strategy: null,
      notes: null,
      status: 'closed' as const,
      asset_type: assetType,
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

  // Group by symbol AND trading date to avoid cross-day matching
  const getTradeDate = (time: string) => {
    const d = new Date(time);
    return d.toISOString().slice(0, 10); // YYYY-MM-DD
  };

  // Group by account + symbol + trading date for proper FIFO matching
  const byKey = new Map<string, FilledOrder[]>();
  filledOrders.forEach(o => {
    const key = `${o.account}|${o.symbol}|${getTradeDate(o.time)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(o);
  });

  const trades: any[] = [];

  byKey.forEach((orders, key) => {
    const parts = key.split('|');
    const symbol = parts[1];
    const buys: FilledOrder[] = [];
    const sells: FilledOrder[] = [];

    orders.forEach(o => {
      if (o.side === 'B') buys.push(o);
      else sells.push(o);
    });

    // Match FIFO within same day
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

      // Use FUTURES_CONFIG for accurate P&L calculation
      const cleanSymbol = symbol.replace(/[A-Z]\d$/, ''); // Strip contract month
      const futConfig = FUTURES_CONFIG.find(f => cleanSymbol.startsWith(f.symbol));
      const pointValue = futConfig ? futConfig.tickValue / futConfig.tickSize : 20; // fallback $20/point

      const rawPnl = direction === 'long'
        ? (exitPrice - entryPrice) * matchQty * pointValue
        : (entryPrice - exitPrice) * matchQty * pointValue;

      trades.push({
        user_id: userId,
        symbol: cleanSymbol,
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

function parseOrderHistorySimple(
  lines: string[],
  delimiter: string,
  headers: string[],
  cols: { symbolIdx: number; qtyIdx: number; buySellIdx: number; statusIdx: number; priceIdx: number; timeIdx: number; accountIdx: number },
  userId: string,
) {
  interface FilledOrder {
    symbol: string; side: 'B' | 'S'; qty: number; price: number; time: string; account: string;
  }

  const filled: FilledOrder[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const vals = line.split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
    const status = vals[cols.statusIdx]?.toLowerCase() || '';
    if (status !== 'filled' && status !== '') continue;
    const price = parseFloat(vals[cols.priceIdx]);
    if (isNaN(price) || price === 0) continue;

    filled.push({
      symbol: vals[cols.symbolIdx]?.toUpperCase() || '',
      side: vals[cols.buySellIdx]?.toUpperCase().startsWith('S') ? 'S' : 'B',
      qty: Math.abs(parseInt(vals[cols.qtyIdx]) || 1),
      price,
      time: vals[cols.timeIdx] || '',
      account: cols.accountIdx !== -1 ? vals[cols.accountIdx] || '' : '',
    });
  }

  if (filled.length === 0) throw new Error('No filled orders found');
  filled.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  const getDay = (t: string) => new Date(t).toISOString().slice(0, 10);
  const byKey = new Map<string, FilledOrder[]>();
  filled.forEach(o => {
    const key = `${o.account}|${o.symbol}|${getDay(o.time)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(o);
  });

  const trades: any[] = [];
  byKey.forEach((orders, key) => {
    const symbol = key.split('|')[1];
    const buys = orders.filter(o => o.side === 'B');
    const sells = orders.filter(o => o.side === 'S');
    let bi = 0, si = 0, bRem = 0, sRem = 0;

    while (bi < buys.length && si < sells.length) {
      const buy = buys[bi], sell = sells[si];
      if (bRem === 0) bRem = buy.qty;
      if (sRem === 0) sRem = sell.qty;
      const matchQty = Math.min(bRem, sRem);
      const buyFirst = new Date(buy.time).getTime() <= new Date(sell.time).getTime();
      const direction = buyFirst ? 'long' : 'short';
      const entryPrice = buyFirst ? buy.price : sell.price;
      const exitPrice = buyFirst ? sell.price : buy.price;

      const cleanSymbol = symbol.replace(/[A-Z]\d$/, '');
      const futConfig = FUTURES_CONFIG.find(f => cleanSymbol.startsWith(f.symbol));
      const pointValue = futConfig ? futConfig.tickValue / futConfig.tickSize : 20;
      const pnl = direction === 'long'
        ? (exitPrice - entryPrice) * matchQty * pointValue
        : (entryPrice - exitPrice) * matchQty * pointValue;

      trades.push({
        user_id: userId,
        symbol: cleanSymbol,
        direction,
        entry_date: new Date(buyFirst ? buy.time : sell.time).toISOString(),
        exit_date: new Date(buyFirst ? sell.time : buy.time).toISOString(),
        entry_price: entryPrice,
        exit_price: exitPrice,
        quantity: matchQty,
        pnl,
        pnl_percent: null,
        fees: 0,
        stop_loss: null,
        take_profit: null,
        strategy: null,
        notes: buy.account ? `Rithmic import | Account: ${buy.account}` : null,
        status: 'closed',
        asset_type: 'Futures',
      });

      bRem -= matchQty;
      sRem -= matchQty;
      if (bRem === 0) bi++;
      if (sRem === 0) si++;
    }
  });

  if (trades.length === 0) throw new Error('Could not match any buy/sell pairs');
  return trades;
}

function parseRithmicSimple(text: string, userId: string) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header and at least one row');

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());

  const find = (...names: string[]) => headers.findIndex(h => names.some(n => h.includes(n)));

  const symbolIdx = find('symbol', 'ticker', 'instrument', 'contract');
  const dirIdx = find('direction', 'side', 'buy/sell', 'type', 'long/short');
  const qtyIdx = find('qty', 'quantity', 'contracts', 'lots', 'size', 'amount', 'qty to fill');
  const openTimeIdx = find('open time', 'open_time', 'opentime', 'entry date', 'entry_date', 'entrydate', 'entry time', 'entry_time', 'open date', 'open_date', 'start time', 'start_time', 'start date', 'create time');
  const closeTimeIdx = find('close time', 'close_time', 'closetime', 'exit date', 'exit_date', 'exitdate', 'exit time', 'exit_time', 'close date', 'close_date', 'end time', 'end_time', 'end date', 'update time', 'fill time');
  const openPriceIdx = find('open price', 'open_price', 'openprice', 'entry price', 'entry_price', 'entryprice', 'avg entry', 'fill price', 'avg fill price', 'limit price');
  const closePriceIdx = find('close price', 'close_price', 'closeprice', 'exit price', 'exit_price', 'exitprice', 'avg exit');
  const pnlIdx = find('pnl', 'profit', 'p&l', 'profitloss', 'net', 'realized', 'gain');
  const feesIdx = find('fees', 'commission', 'comm');
  const strategyIdx = find('strategy', 'setup');
  const notesIdx = find('notes', 'comment');
  const statusIdx = find('status', 'order status');
  const buySellIdx = find('buy/sell');
  const accountIdx = find('account');

  if (symbolIdx === -1) throw new Error('Missing "Symbol" column');
  if (qtyIdx === -1) throw new Error('Missing "Qty" column');
  if (openTimeIdx === -1 && closeTimeIdx === -1) throw new Error('Missing time column (e.g. "Open Time", "Create Time", "Update Time")');

  // If this looks like a Rithmic Order History (has Buy/Sell + Status columns but no separate open/close times),
  // redirect to the Rithmic parser logic within simple format
  const isOrderHistory = buySellIdx !== -1 && statusIdx !== -1 && openTimeIdx !== -1 && closePriceIdx === -1;

  if (isOrderHistory) {
    return parseOrderHistorySimple(lines, delimiter, headers, {
      symbolIdx, qtyIdx, buySellIdx: buySellIdx!, statusIdx: statusIdx!,
      priceIdx: openPriceIdx, timeIdx: closeTimeIdx !== -1 ? closeTimeIdx : openTimeIdx,
      accountIdx,
    }, userId);
  }

  if (openTimeIdx === -1) throw new Error('Missing open/entry time column');
  if (closeTimeIdx === -1) throw new Error('Missing close/exit time column');

  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(delimiter).map(v => v.trim());

    const symbol = vals[symbolIdx]?.toUpperCase().replace(/[A-Z]\d$/, '') || '';
    const qtyRaw = parseFloat(vals[qtyIdx]) || 1;
    const qty = Math.abs(qtyRaw);
    const openPrice = openPriceIdx !== -1 ? parseFloat(vals[openPriceIdx]) || 0 : 0;
    const closePrice = closePriceIdx !== -1 ? parseFloat(vals[closePriceIdx]) || 0 : 0;

    let direction = 'long';
    if (dirIdx !== -1) {
      const d = vals[dirIdx]?.toLowerCase() || '';
      direction = (d === 'short' || d === 'sell' || d === 's') ? 'short' : 'long';
    } else if (qtyRaw < 0) {
      direction = 'short';
    }

    let pnl: number | null = null;
    if (pnlIdx !== -1 && vals[pnlIdx]) {
      pnl = parseFloat(vals[pnlIdx]);
      if (isNaN(pnl)) pnl = null;
    }
    if (pnl === null && openPrice && closePrice) {
      const cleanSymbol = symbol.replace(/[A-Z]\d$/, '');
      const futConfig = FUTURES_CONFIG.find(f => cleanSymbol.startsWith(f.symbol));
      const pointValue = futConfig ? futConfig.tickValue / futConfig.tickSize : 1;
      pnl = direction === 'long'
        ? (closePrice - openPrice) * qty * pointValue
        : (openPrice - closePrice) * qty * pointValue;
    }

    const fees = feesIdx !== -1 ? (parseFloat(vals[feesIdx]) || 0) : 0;

    return {
      user_id: userId,
      symbol,
      direction,
      entry_date: new Date(vals[openTimeIdx]).toISOString(),
      exit_date: new Date(vals[closeTimeIdx]).toISOString(),
      entry_price: openPrice,
      exit_price: closePrice || null,
      quantity: qty,
      pnl,
      pnl_percent: null,
      fees,
      stop_loss: null,
      take_profit: null,
      strategy: strategyIdx !== -1 ? vals[strategyIdx] || null : null,
      notes: notesIdx !== -1 ? vals[notesIdx] || null : null,
      status: 'closed' as const,
      asset_type: 'Futures',
    };
  }).filter(t => t.symbol && t.entry_price > 0);
}

export function CsvImport({ selectedAccount }: { selectedAccount: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<CsvSource | null>(null);

  const canImport = selectedAccount !== 'all';

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
        case 'rithmic-simple':
          trades = parseRithmicSimple(text, user.id);
          break;
        default:
          throw new Error('Unknown source');
      }

      if (trades.length === 0) throw new Error('No trades found in file');

      // Assign selected account to all imported trades
      trades = trades.map(t => ({ ...t, account_name: selectedAccount }));

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
        <Button variant="secondary" disabled={!canImport} title={!canImport ? 'Select a specific account first' : undefined}>
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
