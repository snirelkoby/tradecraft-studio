import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import {
  format, subDays, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths
} from 'date-fns';
import { Brain, Zap, Eye, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const MOODS = ['😤 Frustrated', '😰 Anxious', '😐 Neutral', '🙂 Calm', '🔥 In the Zone'];

interface MindsetEntry {
  id?: string;
  date: string;
  energy_level: number;
  focus_level: number;
  confidence_level: number;
  mood: string;
  pre_session_notes: string;
  post_session_notes: string;
}

export default function MindsetJournal() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const [currentDate, setCurrentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [entry, setEntry] = useState<MindsetEntry>({
    date: currentDate, energy_level: 5, focus_level: 5, confidence_level: 5,
    mood: '😐 Neutral', pre_session_notes: '', post_session_notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadEntry();
    loadHistory();
  }, [user, currentDate]);

  const loadEntry = async () => {
    setLoading(true);
    const { data } = await supabase.from('mindset_entries').select('*').eq('date', currentDate).maybeSingle();
    if (data) {
      setEntry({
        id: data.id, date: data.date,
        energy_level: data.energy_level, focus_level: data.focus_level,
        confidence_level: data.confidence_level, mood: data.mood ?? '😐 Neutral',
        pre_session_notes: data.pre_session_notes ?? '', post_session_notes: data.post_session_notes ?? '',
      });
    } else {
      setEntry({
        date: currentDate, energy_level: 5, focus_level: 5, confidence_level: 5,
        mood: '😐 Neutral', pre_session_notes: '', post_session_notes: '',
      });
    }
    setLoading(false);
  };

  const loadHistory = async () => {
    const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const { data } = await supabase.from('mindset_entries').select('*')
      .gte('date', from).order('date', { ascending: true });
    setHistory(data ?? []);
  };

  const saveEntry = async () => {
    if (!user) return;
    const payload = {
      energy_level: entry.energy_level, focus_level: entry.focus_level,
      confidence_level: entry.confidence_level, mood: entry.mood,
      pre_session_notes: entry.pre_session_notes, post_session_notes: entry.post_session_notes,
    };
    if (entry.id) {
      const { error } = await supabase.from('mindset_entries').update(payload as any).eq('id', entry.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('mindset_entries').insert({
        user_id: user.id, date: currentDate, ...payload,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success('Saved');
    loadEntry();
    loadHistory();
  };

  // Correlation with P&L
  const chartData = useMemo(() => {
    if (!allTrades) return [];
    return history.map(h => {
      const dayTrades = allTrades.filter(t => t.status === 'closed' && t.entry_date.startsWith(h.date));
      const pnl = dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
      return {
        date: format(parseISO(h.date), 'MMM dd'),
        energy: h.energy_level, focus: h.focus_level, confidence: h.confidence_level,
        pnl,
      };
    });
  }, [history, allTrades]);

  const shiftDate = (dir: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + dir);
    setCurrentDate(format(d, 'yyyy-MM-dd'));
  };

  const tooltipStyle = {
    background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, color: 'hsl(var(--foreground))',
  };

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Journal</h1>
          <p className="text-muted-foreground text-sm">יומן יומי — מעקב אנרגיה, ריכוז, מצב רוח ותובנות</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => shiftDate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="font-mono font-bold text-lg min-w-[120px] text-center">{currentDate}</span>
          <Button variant="ghost" size="icon" onClick={() => shiftDate(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Levels */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { key: 'energy_level' as const, label: 'Energy', icon: Zap, color: 'text-yellow-400' },
          { key: 'focus_level' as const, label: 'Focus', icon: Eye, color: 'text-chart-blue' },
          { key: 'confidence_level' as const, label: 'Confidence', icon: Brain, color: 'text-chart-purple' },
        ].map(({ key, label, icon: Icon, color }) => (
          <div key={key} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${color}`} />
              <span className="text-sm font-semibold uppercase text-muted-foreground">{label}</span>
              <span className="ml-auto text-2xl font-black font-mono">{entry[key]}</span>
            </div>
            <Slider
              value={[entry[key]]}
              onValueChange={([v]) => setEntry(p => ({ ...p, [key]: v }))}
              min={1} max={10} step={1}
            />
          </div>
        ))}
      </div>

      {/* Mood */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase">Mood</h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map(m => (
            <button
              key={m}
              onClick={() => setEntry(p => ({ ...p, mood: m }))}
              className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                entry.mood === m ? 'bg-primary text-primary-foreground font-bold' : 'bg-secondary hover:bg-accent'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <label className="text-xs text-muted-foreground uppercase block">Pre-Session Notes</label>
          <Textarea
            value={entry.pre_session_notes}
            onChange={e => setEntry(p => ({ ...p, pre_session_notes: e.target.value }))}
            placeholder="מה המטרות שלך היום? מה הגישה?"
            className="bg-secondary min-h-[120px]"
          />
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <label className="text-xs text-muted-foreground uppercase block">Post-Session Reflection</label>
          <Textarea
            value={entry.post_session_notes}
            onChange={e => setEntry(p => ({ ...p, post_session_notes: e.target.value }))}
            placeholder="איך הלך? מה למדת? עקבת אחרי התוכנית?"
            className="bg-secondary min-h-[120px]"
          />
        </div>
      </div>

      <Button onClick={saveEntry} className="font-bold">
        <Save className="h-4 w-4 mr-2" /> SAVE ENTRY
      </Button>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Mindset vs P&L (30 Days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 10]} />
              <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `$${v}`} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line yAxisId="left" type="monotone" dataKey="energy" stroke="hsl(45, 90%, 55%)" strokeWidth={2} dot={false} name="Energy" />
              <Line yAxisId="left" type="monotone" dataKey="focus" stroke="hsl(var(--chart-blue))" strokeWidth={2} dot={false} name="Focus" />
              <Line yAxisId="left" type="monotone" dataKey="confidence" stroke="hsl(var(--chart-purple))" strokeWidth={2} dot={false} name="Confidence" />
              <Line yAxisId="right" type="monotone" dataKey="pnl" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={false} name="P&L" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
