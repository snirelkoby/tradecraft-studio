import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ShieldAlert, Trash2, Zap, RefreshCw } from 'lucide-react';

const VIOLATION_TYPES = [
  { key: 'oversized_position', label: 'Oversized Position', desc: 'Position exceeds max allocation from Blueprint' },
  { key: 'no_stop_loss', label: 'No Stop Loss', desc: 'Trade entered without a stop loss' },
  { key: 'no_strategy', label: 'No Strategy Tag', desc: 'Trade has no strategy assigned' },
  { key: 'revenge_trade', label: 'Possible Revenge Trade', desc: 'Trade opened within minutes of a losing trade' },
  { key: 'no_take_profit', label: 'No Take Profit', desc: 'Trade entered without a take profit target' },
];

interface Violation {
  id: string;
  trade_id: string | null;
  violation_type: string;
  description: string | null;
  severity: string;
  created_at: string;
}

export default function RuleViolations() {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const [violations, setViolations] = useState<Violation[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadViolations();
  }, [user]);

  const loadViolations = async () => {
    const { data } = await supabase
      .from('rule_violations')
      .select('*')
      .order('created_at', { ascending: false });
    setViolations((data as any[]) ?? []);
  };

  const scanTrades = async () => {
    if (!trades || !user) return;
    setScanning(true);
    const newViolations: Omit<Violation, 'id' | 'created_at'>[] = [];

    const sorted = [...trades]
      .filter(t => t.status === 'closed')
      .sort((a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime());

    sorted.forEach((t, idx) => {
      if (!t.stop_loss) {
        newViolations.push({ trade_id: t.id, violation_type: 'no_stop_loss', description: `${t.symbol} — no SL set`, severity: 'high' });
      }
      if (!t.take_profit) {
        newViolations.push({ trade_id: t.id, violation_type: 'no_take_profit', description: `${t.symbol} — no TP set`, severity: 'medium' });
      }
      if (!t.strategy) {
        newViolations.push({ trade_id: t.id, violation_type: 'no_strategy', description: `${t.symbol} — no strategy`, severity: 'low' });
      }
      // Revenge trade detection: within 30 min of previous losing trade
      if (idx > 0) {
        const prev = sorted[idx - 1];
        if ((prev.pnl ?? 0) < 0) {
          const gap = new Date(t.entry_date).getTime() - new Date(prev.exit_date ?? prev.entry_date).getTime();
          if (gap < 30 * 60 * 1000 && gap >= 0) {
            newViolations.push({ trade_id: t.id, violation_type: 'revenge_trade', description: `${t.symbol} — opened ${Math.round(gap / 60000)}min after loss`, severity: 'high' });
          }
        }
      }
    });

    if (newViolations.length > 0) {
      const { error } = await supabase.from('rule_violations').insert(
        newViolations.map(v => ({ ...v, user_id: user.id })) as any[]
      );
      if (error) toast.error(error.message);
      else toast.success(`נמצאו ${newViolations.length} הפרות חדשות`);
    } else {
      toast.success('לא נמצאו הפרות — כל הכבוד!');
    }
    await loadViolations();
    setScanning(false);
  };

  const deleteViolation = async (id: string) => {
    await supabase.from('rule_violations').delete().eq('id', id);
    setViolations(prev => prev.filter(v => v.id !== id));
  };

  const severityColor = (s: string) => s === 'high' ? 'destructive' : s === 'medium' ? 'default' : 'secondary';

  const stats = useMemo(() => {
    const high = violations.filter(v => v.severity === 'high').length;
    const med = violations.filter(v => v.severity === 'medium').length;
    const byType: Record<string, number> = {};
    violations.forEach(v => { byType[v.violation_type] = (byType[v.violation_type] || 0) + 1; });
    const topType = Object.entries(byType).sort((a, b) => b[1] - a[1])[0];
    return { high, med, total: violations.length, topType: topType ? topType[0] : '-' };
  }, [violations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Rule Violations Log</h1>
        <Button onClick={scanTrades} disabled={scanning}>
          {scanning ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Scan Trades
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Violations</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold text-destructive">{stats.high}</p>
          <p className="text-xs text-muted-foreground">High Severity</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.med}</p>
          <p className="text-xs text-muted-foreground">Medium Severity</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{VIOLATION_TYPES.find(v => v.key === stats.topType)?.label ?? '-'}</p>
          <p className="text-xs text-muted-foreground">Most Common</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Violation History</CardTitle></CardHeader>
        <CardContent>
          {violations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">אין הפרות — לחץ "Scan Trades" לבדוק</p>
          ) : (
            <div className="space-y-2">
              {violations.map(v => (
                <div key={v.id} className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center gap-3">
                    <Badge variant={severityColor(v.severity) as any}>{v.severity}</Badge>
                    <div>
                      <p className="text-sm font-medium">{VIOLATION_TYPES.find(vt => vt.key === v.violation_type)?.label ?? v.violation_type}</p>
                      <p className="text-xs text-muted-foreground">{v.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(v.created_at).toLocaleDateString()}</span>
                    <Button variant="ghost" size="icon" onClick={() => deleteViolation(v.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
