import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface Mistake {
  id: string;
  trade_id: string | null;
  category: string;
  description: string | null;
  severity: string;
  created_at: string;
}

const CATEGORIES = [
  { value: 'fomo', label: '🔥 FOMO', color: 'hsl(var(--chart-red))' },
  { value: 'over_leverage', label: '💣 Over-Leverage', color: 'hsl(var(--chart-orange, 30 90% 55%))' },
  { value: 'early_exit', label: '🏃 Early Exit', color: 'hsl(45 90% 55%)' },
  { value: 'revenge_trading', label: '😡 Revenge Trading', color: 'hsl(280 70% 55%)' },
  { value: 'no_stop_loss', label: '🚫 No Stop Loss', color: 'hsl(350 80% 50%)' },
  { value: 'chasing', label: '🏎️ Chasing', color: 'hsl(200 70% 55%)' },
  { value: 'overtrading', label: '📈 Overtrading', color: 'hsl(160 60% 45%)' },
  { value: 'other', label: '❓ Other', color: 'hsl(var(--muted-foreground))' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

export default function MistakeTracker() {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ trade_id: '', category: 'fomo', description: '', severity: 'medium' });

  const closedTrades = (trades ?? []).filter(t => t.status === 'closed');

  useEffect(() => {
    if (!user) return;
    loadMistakes();
  }, [user]);

  const loadMistakes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trade_mistakes')
      .select('*')
      .order('created_at', { ascending: false });
    setMistakes((data as any as Mistake[]) || []);
    setLoading(false);
  };

  const addMistake = async () => {
    if (!user) return;
    const { error } = await supabase.from('trade_mistakes').insert({
      user_id: user.id,
      trade_id: form.trade_id || null,
      category: form.category,
      description: form.description || null,
      severity: form.severity,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('טעות נרשמה');
    setShowForm(false);
    setForm({ trade_id: '', category: 'fomo', description: '', severity: 'medium' });
    loadMistakes();
  };

  const deleteMistake = async (id: string) => {
    await supabase.from('trade_mistakes').delete().eq('id', id);
    loadMistakes();
  };

  const categoryStats = useMemo(() => {
    const map = new Map<string, number>();
    mistakes.forEach(m => map.set(m.category, (map.get(m.category) ?? 0) + 1));
    return Array.from(map.entries()).map(([cat, count]) => ({
      category: CATEGORIES.find(c => c.value === cat)?.label.split(' ').slice(1).join(' ') || cat,
      count,
      color: CATEGORIES.find(c => c.value === cat)?.color || 'hsl(var(--muted-foreground))',
    })).sort((a, b) => b.count - a.count);
  }, [mistakes]);

  const tooltipStyle = { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' };

  const getCatLabel = (val: string) => CATEGORIES.find(c => c.value === val)?.label || val;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mistake Tracker</h1>
          <p className="text-muted-foreground text-sm">מעקב טעויות חוזרות וניתוח דפוסים</p>
        </div>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4 mr-1" /> רשום טעות
        </Button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">קטגוריה</label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">חומרה</label>
              <Select value={form.severity} onValueChange={v => setForm({ ...form, severity: v })}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>{SEVERITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">עסקה (אופציונלי)</label>
              <Select value={form.trade_id} onValueChange={v => setForm({ ...form, trade_id: v })}>
                <SelectTrigger className="bg-background"><SelectValue placeholder="ללא" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">ללא</SelectItem>
                  {closedTrades.slice(0, 50).map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.symbol} — {format(parseISO(t.entry_date), 'MMM dd')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="מה קרה? מה הלקח?" className="bg-background" />
          <Button onClick={addMistake} size="sm">שמור</Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">טעויות לפי קטגוריה</h3>
          {categoryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={categoryStats}>
                <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>}
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">התפלגות</h3>
          {categoryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryStats} dataKey="count" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={3}>
                  {categoryStats.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-muted-foreground text-center py-8">אין נתונים</p>}
        </div>
      </div>

      {/* Mistake List */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">היסטוריית טעויות ({mistakes.length})</h3>
        {loading ? <p className="text-sm text-muted-foreground">טוען...</p> : mistakes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">לא נרשמו טעויות עדיין — זה דבר טוב! 🎉</p>
        ) : (
          <div className="space-y-2">
            {mistakes.map(m => (
              <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 group">
                <span className="text-lg">{CATEGORIES.find(c => c.value === m.category)?.label.split(' ')[0]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{getCatLabel(m.category)}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${m.severity === 'critical' ? 'bg-destructive/20 text-destructive' : m.severity === 'high' ? 'bg-[hsl(var(--chart-red))]/20 text-[hsl(var(--chart-red))]' : 'bg-secondary text-muted-foreground'}`}>
                      {m.severity}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{format(parseISO(m.created_at), 'MMM dd, HH:mm')}</span>
                  </div>
                  {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteMistake(m.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
