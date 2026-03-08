import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

const CSV_SOURCES = [
  { id: 'deepcharts', label: 'DeepCharts', description: 'Semicolon-separated CSV from DeepCharts / Rithmic' },
] as const;

type CsvSource = typeof CSV_SOURCES[number]['id'];

function parseDeepCharts(text: string, userId: string) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have a header and at least one row');

  // Header: Symbol;DT;Quantity;Entry;Exit;ProfitLoss
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

  return lines.slice(1).filter(l => l.trim()).map(line => {
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
        default:
          throw new Error('Unknown source');
      }

      if (trades.length === 0) throw new Error('No trades found in file');

      // Insert in batches of 100
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
