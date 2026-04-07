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
import { Brain, Zap, Eye, ChevronLeft, ChevronRight, Save, BookOpen, TrendingUp } from 'lucide-react';
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
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [entry, setEntry] = useState<MindsetEntry>({
    date: currentDate, energy_level: 5, focus_level: 5, confidence_level: 5,
    mood: '😐 Neutral', pre_session_notes: '', post_session_notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [entryDates, setEntryDates] = useState<Set<string>>(new Set());
  const [weeklySummary, setWeeklySummary] = useState('');
  const [weeklySummaryId, setWeeklySummaryId] = useState<string | null>(null);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Current week range (Sun-Sat) for the selected date
  const currentWeekStart = useMemo(() => {
    return startOfWeek(parseISO(currentDate), { weekStartsOn: 0 });
  }, [currentDate]);

  const currentWeekDays = useMemo(() => {
    return eachDayOfInterval({
      start: currentWeekStart,
      end: endOfWeek(currentWeekStart, { weekStartsOn: 0 }),
    }).map(d => format(d, 'yyyy-MM-dd'));
  }, [currentWeekStart]);

  const tradeDates = useMemo(() => {
    const dates = new Set<string>();
    (allTrades ?? []).forEach(t => dates.add(t.entry_date.slice(0, 10)));
    return dates;
  }, [allTrades]);

  // Weekly stats
  const weeklyStats = useMemo(() => {
    let journalDays = 0;
    let tradeDaysCount = 0;
    let tradedNoJournal = 0;
    let weeklyPnl = 0;
    let weeklyWins = 0;
    let weeklyLosses = 0;
    currentWeekDays.forEach(d => {
      const hasJ = entryDates.has(d);
      const hasT = tradeDates.has(d);
      if (hasJ) journalDays++;
      if (hasT) tradeDaysCount++;
      if (hasT && !hasJ) tradedNoJournal++;
      // Sum PnL for closed trades on this day
      (allTrades ?? []).filter(t => t.status === 'closed' && t.entry_date.slice(0, 10) === d).forEach(t => {
        const pnl = t.pnl ?? 0;
        weeklyPnl += pnl;
        if (pnl > 0) weeklyWins++;
        else if (pnl < 0) weeklyLosses++;
      });
    });
    const totalTrades = weeklyWins + weeklyLosses;
    const winRate = totalTrades > 0 ? (weeklyWins / totalTrades) * 100 : 0;
    return { journalDays, tradeDaysCount, tradedNoJournal, weeklyPnl, weeklyWins, weeklyLosses, totalTrades, winRate };
  }, [currentWeekDays, entryDates, tradeDates, allTrades]);

  // Load entry dates for the visible month
  useEffect(() => {
    if (!user) return;
    const loadEntryDates = async () => {
      const monthStart = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const monthEnd = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const { data } = await supabase.from('mindset_entries').select('date')
        .gte('date', monthStart).lte('date', monthEnd);
      setEntryDates(new Set((data ?? []).map(d => d.date)));
    };
    loadEntryDates();
  }, [user, currentMonth]);

  useEffect(() => {
    if (!user) return;
    loadEntry();
    loadHistory();
  }, [user, currentDate]);

  // Load weekly summary when week changes
  useEffect(() => {
    if (!user) return;
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    const loadWeeklySummary = async () => {
      const { data } = await supabase.from('weekly_summaries').select('*')
        .eq('week_start', weekStartStr).maybeSingle();
      if (data) {
        setWeeklySummary(data.summary ?? '');
        setWeeklySummaryId(data.id);
      } else {
        setWeeklySummary('');
        setWeeklySummaryId(null);
      }
    };
    loadWeeklySummary();
  }, [user, currentWeekStart]);

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
    // Refresh entry dates for calendar colors
    const monthStart = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const monthEnd = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const { data: refreshed } = await supabase.from('mindset_entries').select('date')
      .gte('date', monthStart).lte('date', monthEnd);
    setEntryDates(new Set((refreshed ?? []).map(d => d.date)));
  };

  const saveWeeklySummary = async () => {
    if (!user) return;
    const weekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
    if (weeklySummaryId) {
      const { error } = await supabase.from('weekly_summaries')
        .update({ summary: weeklySummary } as any).eq('id', weeklySummaryId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('weekly_summaries').insert({
        user_id: user.id, week_start: weekStartStr, summary: weeklySummary,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success('Weekly summary saved');
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

  const selectDay = (day: Date) => {
    setCurrentDate(format(day, 'yyyy-MM-dd'));
  };

  const tooltipStyle = {
    background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
    borderRadius: 8, color: 'hsl(var(--foreground))',
  };

  // Check if selected day is Saturday
  const isSaturday = parseISO(currentDate).getDay() === 6;

  if (loading) return <div className="text-muted-foreground text-center py-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Journal</h1>
        <p className="text-muted-foreground text-sm">יומן יומי — מעקב אנרגיה, ריכוז, מצב רוח ותובנות</p>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-mono font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7">
          {DAY_HEADERS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground py-1.5 border-b border-border">{d}</div>
          ))}
          {calendarDays.map((day, i) => {
            const ds = format(day, 'yyyy-MM-dd');
            const inMonth = isSameMonth(day, currentMonth);
            const isSelected = ds === currentDate;
            const isToday = isSameDay(day, new Date());
            const hasEntry = entryDates.has(ds);
            const hasTrade = tradeDates.has(ds);

            let bgClass = '';
            if (hasEntry) {
              bgClass = 'bg-[hsl(var(--chart-green))]/15';
            } else if (hasTrade) {
              bgClass = 'bg-destructive/15';
            }

            return (
              <button
                key={i}
                onClick={() => selectDay(day)}
                className={`relative p-1 min-h-[44px] border-b border-r border-border transition-colors text-center
                  ${!inMonth ? 'opacity-25' : bgClass}
                  ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  hover:bg-accent/50`}
              >
                <span className={`text-xs ${isToday ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center mx-auto' : ''}`}>
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 px-4 py-1.5 text-[10px] text-muted-foreground border-t border-border">
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--chart-green))]" />כתבתי ביומן</div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-destructive" />סחרתי בלי יומן</div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />לא סחרתי ולא כתבתי</div>
        </div>
      </div>

      {/* Weekly Summary Bar */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            סיכום שבועי — {format(currentWeekStart, 'dd/MM')} - {format(endOfWeek(currentWeekStart, { weekStartsOn: 0 }), 'dd/MM')}
          </h3>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className="text-2xl font-black font-mono text-[hsl(var(--chart-green))]">{weeklyStats.journalDays}</div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">ימי יומן</div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className="text-2xl font-black font-mono text-[hsl(var(--chart-blue))]">{weeklyStats.tradeDaysCount}</div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">ימי מסחר</div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className={`text-2xl font-black font-mono ${weeklyStats.tradedNoJournal > 0 ? 'text-destructive' : 'text-[hsl(var(--chart-green))]'}`}>
              {weeklyStats.tradedNoJournal}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">בלי יומן</div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className={`text-2xl font-black font-mono ${weeklyStats.weeklyPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-destructive'}`}>
              ${weeklyStats.weeklyPnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">P&L שבועי</div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className="text-2xl font-black font-mono text-foreground">{weeklyStats.totalTrades}</div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">עסקאות</div>
          </div>
          <div className="rounded-lg bg-secondary p-3 text-center">
            <div className={`text-2xl font-black font-mono ${weeklyStats.winRate >= 50 ? 'text-[hsl(var(--chart-green))]' : 'text-destructive'}`}>
              {weeklyStats.winRate.toFixed(0)}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase mt-1">Win Rate</div>
          </div>
        </div>

        {/* Weekly reflection textarea - prominent on Saturday */}
        <div className={`space-y-2 ${isSaturday ? 'ring-2 ring-primary/30 rounded-lg p-3 bg-primary/5' : ''}`}>
          {isSaturday && (
            <div className="text-xs font-semibold text-primary flex items-center gap-1 mb-1">
              <TrendingUp className="h-3.5 w-3.5" /> שבת — זמן לסיכום שבועי!
            </div>
          )}
          <label className="text-xs text-muted-foreground uppercase block">מה למדתי השבוע? תובנות, שיפורים, מה לשמור/לשנות</label>
          <Textarea
            value={weeklySummary}
            onChange={e => setWeeklySummary(e.target.value)}
            placeholder="מה עבד טוב? מה לשפר? מה הלקחים מהשבוע?"
            className="bg-secondary min-h-[100px]"
          />
          <Button onClick={saveWeeklySummary} size="sm" variant="outline" className="font-bold">
            <Save className="h-3.5 w-3.5 mr-1" /> שמור סיכום שבועי
          </Button>
        </div>
      </div>

      {/* Selected date label */}
      <div className="text-center font-mono font-bold text-lg">{currentDate}</div>

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
