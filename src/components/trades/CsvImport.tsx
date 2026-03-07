import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

export function CsvImport() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) throw new Error('CSV must have a header and at least one row');

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z_]/g, ''));
      const rows = lines.slice(1).map(line => {
        const vals = line.split(',').map(v => v.trim());
        const obj: Record<string, any> = {};
        headers.forEach((h, i) => { obj[h] = vals[i] || null; });
        return obj;
      });

      const trades = rows.map(r => ({
        user_id: user.id,
        symbol: (r.symbol || r.ticker || 'UNKNOWN').toUpperCase(),
        direction: (r.direction || r.side || 'long').toLowerCase(),
        entry_date: new Date(r.entry_date || r.date || Date.now()).toISOString(),
        exit_date: r.exit_date ? new Date(r.exit_date).toISOString() : null,
        entry_price: parseFloat(r.entry_price || r.entry || '0'),
        exit_price: r.exit_price || r.exit ? parseFloat(r.exit_price || r.exit) : null,
        stop_loss: r.stop_loss || r.sl ? parseFloat(r.stop_loss || r.sl) : null,
        take_profit: r.take_profit || r.tp ? parseFloat(r.take_profit || r.tp) : null,
        quantity: parseFloat(r.quantity || r.qty || r.size || '1'),
        fees: parseFloat(r.fees || r.commission || '0'),
        pnl: r.pnl ? parseFloat(r.pnl) : null,
        pnl_percent: r.pnl_percent ? parseFloat(r.pnl_percent) : null,
        strategy: r.strategy || null,
        notes: r.notes || null,
        status: r.exit_price || r.exit ? 'closed' : (r.status || 'open'),
        asset_type: r.asset_type || 'stock',
      }));

      const { error } = await supabase.from('trades').insert(trades as any);
      if (error) throw error;

      toast.success(`${trades.length} trades imported successfully`);
      qc.invalidateQueries({ queryKey: ['trades'] });
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
      <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
        <Upload className="h-4 w-4 mr-2" />
        {importing ? 'Importing...' : 'Import CSV'}
      </Button>
    </div>
  );
}
