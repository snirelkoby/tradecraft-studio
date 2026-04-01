import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  isWithinInterval, subDays
} from 'date-fns';

const MOODS = ['🔥 Confident', '😊 Good', '😐 Neutral', '😰 Anxious', '😤 Frustrated', '🥶 Fearful'];

interface JournalEntry {
  id: string;
  date: string;
  pre_market_notes: string | null;
  post_market_notes: string | null;
  mood: string | null;
  lessons: string | null;
}

export default function Journal() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [weeklySummaries, setWeeklySummaries] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Entry form state
  const [entry, setEntry] = useState({
    pre_market_notes: '', post_market_notes: '', mood: '', lessons: '', id: '',
    energy_before: 5, focus_before: 5, confidence_before: 5,
  });
  const [weeklyAi, setWeeklyAi] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Calendar grid computation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 }); // Saturday
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Get weeks for weekly summary sections
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);

  // Trade dates set
  const tradeDates = useMemo(() => {
    const dates = new Set<string>();
    (allTrades ?? []).forEach(t => {
      dates.add(t.entry_date.slice(0, 10));
    });
    return dates;
  }, [allTrades]);

  // Journal dates set
  const journalDates = useMemo(() => {
    const dates = new Set<string>();
    journalEntries.forEach(j => dates.add(j.date));
    return dates;
  }, [journalEntries]);

  // Load journal entries for the month
  useEffect(() => {
    if (!user) return;
    const loadMonth = async () => {
      setLoading(true);
      const monthStart = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const monthEnd = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd');

      const [journalRes, weeklyRes] = await Promise.all([
        supabase.from('journal_entries').select('*').gte('date', monthStart).lte('date', monthEnd),
        supabase.from('weekly_summaries' as any).select('*').gte('week_start', monthStart).lte('week_start', monthEnd),
      ]);

      setJournalEntries((journalRes.data ?? []) as JournalEntry[]);

      const summaries: Record<string, string> = {};
      ((weeklyRes.data ?? []) as any[]).forEach((ws: any) => {
        summaries[ws.week_start] = ws.summary;
      });
      setWeeklySummaries(summaries);
      setLoading(false);
    };
    loadMonth();
  }, [user, currentMonth]);

  // Load selected day entry
  useEffect(() => {
    if (!selectedDate || !user) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const loadDay = async () => {
      const [journalRes, mindsetRes] = await Promise.all([
        supabase.from('journal_entries').select('*').eq('date', dateStr).maybeSingle(),
        supabase.from('mindset_entries').select('*').eq('date', dateStr).maybeSingle(),
      ]);
      const j = journalRes.data;
      const m = mindsetRes.data;
      setEntry({
        id: j?.id ?? '',
        pre_market_notes: j?.pre_market_notes ?? '',
        post_market_notes: j?.post_market_notes ?? '',
        mood: j?.mood ?? '',
        lessons: j?.lessons ?? '',
        energy_before: m?.energy_level ?? 5,
        focus_before: m?.focus_level ?? 5,
        confidence_before: m?.confidence_level ?? 5,
      });
    };
    loadDay();
  }, [selectedDate, user]);

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  // Trades for selected day
  const dayTrades = useMemo(() => {
    if (!allTrades || !selectedDate) return [];
    return allTrades.filter(t => t.entry_date?.slice(0, 10) === selectedDateStr);
  }, [allTrades, selectedDateStr]);

  const dayPnl = dayTrades.filter(t => t.status === 'closed' && t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0);

  const save = async () => {
    if (!user || !selectedDate) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    if (entry.id) {
      const { error } = await supabase.from('journal_entries').update({
        pre_market_notes: entry.pre_market_notes,
        post_market_notes: entry.post_market_notes,
        mood: entry.mood,
        lessons: entry.lessons,
      }).eq('id', entry.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('journal_entries').insert({
        user_id: user.id,
        date: dateStr,
        pre_market_notes: entry.pre_market_notes,
        post_market_notes: entry.post_market_notes,
        mood: entry.mood,
        lessons: entry.lessons,
      });
      if (error) return toast.error(error.message);
    }

    // Save mindset
    const existing = await supabase.from('mindset_entries').select('id').eq('date', dateStr).maybeSingle();
    if (existing.data) {
      await supabase.from('mindset_entries').update({
        energy_level: entry.energy_before,
        focus_level: entry.focus_before,
        confidence_level: entry.confidence_before,
        mood: entry.mood,
      }).eq('id', existing.data.id);
    } else {
      await supabase.from('mindset_entries').insert({
        user_id: user.id,
        date: dateStr,
        energy_level: entry.energy_before,
        focus_level: entry.focus_before,
        confidence_level: entry.confidence_before,
        mood: entry.mood,
      });
    }

    toast.success('Journal saved');
    // Refresh entries
    setJournalEntries(prev => {
      const exists = prev.find(e => e.date === dateStr);
      if (exists) return prev.map(e => e.date === dateStr ? { ...e, ...entry, date: dateStr } : e);
      return [...prev, { id: 'new', date: dateStr, pre_market_notes: entry.pre_market_notes, post_market_notes: entry.post_market_notes, mood: entry.mood, lessons: entry.lessons }];
    });
  };

  const saveWeeklySummary = async (weekStart: string, summary: string) => {
    if (!user) return;
    // Upsert weekly summary
    const { data: existing } = await supabase.from('weekly_summaries' as any).select('id').eq('week_start', weekStart).maybeSingle();
    if ((existing as any)?.id) {
      await supabase.from('weekly_summaries' as any).update({ summary } as any).eq('id', (existing as any).id);
    } else {
      await supabase.from('weekly_summaries' as any).insert({ user_id: user.id, week_start: weekStart, summary } as any);
    }
    setWeeklySummaries(prev => ({ ...prev, [weekStart]: summary }));
    toast.success('Weekly summary saved');
  };

  const getDayStatus = (day: Date): 'journaled' | 'missed' | 'none' => {
    const ds = format(day, 'yyyy-MM-dd');
    const hasJournal = journalDates.has(ds);
    const hasTrades = tradeDates.has(ds);
    if (hasJournal) return 'journaled';
    if (hasTrades) return 'missed';
    return 'none';
  };

  const generateWeeklyAi = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      const weekStart = startOfWeek(selectedDate || new Date(), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(selectedDate || new Date(), { weekStartsOn: 0 });
      const { data: journals } = await supabase.from('journal_entries').select('*')
        .gte('date', format(subDays(weekStart, 21), 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });
      const weekTrades = (allTrades ?? []).filter(t => {
        const td = new Date(t.entry_date);
        return isWithinInterval(td, { start: weekStart, end: weekEnd });
      });
      const thisWeekJournals = (journals ?? []).filter(j => {
        const jd = new Date(j.date);
        return isWithinInterval(jd, { start: weekStart, end: weekEnd });
      });
      const prompt = `אתה מנטור מסחר מקצועי. נתח את השבוע הזה ותן עצות:
יומני השבוע: ${thisWeekJournals.map(j => `${j.date}: mood=${j.mood}, pre=${j.pre_market_notes}, post=${j.post_market_notes}, lessons=${j.lessons}`).join('\n')}
עסקאות: ${weekTrades.length}, P&L: $${weekTrades.filter(t => t.pnl).reduce((s, t) => s + (t.pnl ?? 0), 0).toFixed(0)}
Win rate: ${weekTrades.filter(t => (t.pnl ?? 0) > 0).length}/${weekTrades.filter(t => t.status === 'closed').length}
תן ניתוח בעברית: מה היה טוב, מה צריך לשפר, ועצות לשבוע הבא.`;
      const { data, error } = await supabase.functions.invoke('trade-insights', { body: { prompt } });
      if (error) throw error;
      setWeeklyAi(data?.result || data?.message || 'No analysis available');
    } catch {
      toast.error('Error generating analysis');
    } finally {
      setAiLoading(false);
    }
  };

  const SliderRow = ({ label, value, onChange, emoji }: { label: string; value: number; onChange: (v: number) => void; emoji: string }) => (
    <div className="flex items-center gap-3">
      <span className="text-lg">{emoji}</span>
      <span className="text-xs text-muted-foreground w-20">{label}</span>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={1} max={10} step={1} className="flex-1" />
      <span className="font-mono text-xs font-bold w-6 text-right">{value}</span>
    </div>
  );

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trading Journal</h1>
        <p className="text-muted-foreground text-sm">Calendar view — click a day to write your journal</p>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-lg font-semibold font-mono">{format(currentMonth, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-green))]/30 border border-[hsl(var(--chart-green))]" />
          <span>Journaled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-red))]/30 border border-[hsl(var(--chart-red))]" />
          <span>Traded but no journal</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-secondary border border-border" />
          <span>No activity</span>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {DAY_NAMES.map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
          ))}
        </div>

        {/* Week rows with weekly summary */}
        {weeks.map((week, wi) => {
          const weekStartStr = format(week[0], 'yyyy-MM-dd');
          return (
            <div key={wi}>
              <div className="grid grid-cols-7 border-b border-border">
                {week.map((day, di) => {
                  const ds = format(day, 'yyyy-MM-dd');
                  const status = getDayStatus(day);
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());

                  let cellBg = '';
                  if (status === 'journaled') cellBg = 'bg-[hsl(var(--chart-green))]/10 border-[hsl(var(--chart-green))]/30';
                  else if (status === 'missed') cellBg = 'bg-[hsl(var(--chart-red))]/10 border-[hsl(var(--chart-red))]/30';

                  return (
                    <button
                      key={di}
                      onClick={() => setSelectedDate(day)}
                      className={`relative p-2 min-h-[60px] border-r border-border last:border-r-0 transition-colors text-left
                        ${!isCurrentMonth ? 'opacity-30' : ''}
                        ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                        ${isToday ? 'font-bold' : ''}
                        ${cellBg}
                        hover:bg-accent/50`}
                    >
                      <span className={`text-xs ${isToday ? 'bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center' : ''}`}>
                        {format(day, 'd')}
                      </span>
                      {tradeDates.has(ds) && (
                        <div className="absolute bottom-1 right-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Weekly Summary Row */}
              <div className="border-b border-border bg-secondary/30 px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold shrink-0 w-24">Week Summary</span>
                  <input
                    type="text"
                    className="flex-1 bg-transparent border-none text-xs placeholder:text-muted-foreground/50 focus:outline-none"
                    placeholder="What did you learn this week?"
                    value={weeklySummaries[weekStartStr] ?? ''}
                    onChange={e => setWeeklySummaries(prev => ({ ...prev, [weekStartStr]: e.target.value }))}
                    onBlur={() => {
                      const val = weeklySummaries[weekStartStr];
                      if (val !== undefined) saveWeeklySummary(weekStartStr, val);
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Details */}
      {selectedDate && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">{format(selectedDate, 'EEEE, MMMM dd yyyy')}</h3>
            <div className="flex gap-2">
              <Button onClick={save} size="sm" className="font-bold">Save</Button>
              <Button variant="outline" size="sm" onClick={generateWeeklyAi} disabled={aiLoading}>
                <Sparkles className="h-4 w-4 mr-1" />
                {aiLoading ? 'Analyzing...' : 'AI Analysis'}
              </Button>
            </div>
          </div>

          {/* Mood */}
          <div className="max-w-xs">
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Mood</label>
            <Select value={entry.mood} onValueChange={v => setEntry({ ...entry, mood: v })}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="How are you feeling?" /></SelectTrigger>
              <SelectContent>
                {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Energy/Focus/Confidence */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <h4 className="font-bold text-xs uppercase text-muted-foreground">Mental State</h4>
            <SliderRow label="Energy" value={entry.energy_before} onChange={v => setEntry({ ...entry, energy_before: v })} emoji="⚡" />
            <SliderRow label="Focus" value={entry.focus_before} onChange={v => setEntry({ ...entry, focus_before: v })} emoji="🎯" />
            <SliderRow label="Confidence" value={entry.confidence_before} onChange={v => setEntry({ ...entry, confidence_before: v })} emoji="💪" />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-blue))]" />Pre-Market Notes
              </h4>
              <Textarea
                value={entry.pre_market_notes}
                onChange={e => setEntry({ ...entry, pre_market_notes: e.target.value })}
                className="bg-secondary min-h-[150px]"
                placeholder="Plan, key levels, news events..."
              />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-green))]" />Post-Market Review
              </h4>
              <Textarea
                value={entry.post_market_notes}
                onChange={e => setEntry({ ...entry, post_market_notes: e.target.value })}
                className="bg-secondary min-h-[150px]"
                placeholder="How did the day go? Did you follow your rules?"
              />
            </div>
          </div>

          {/* Day trades */}
          {dayTrades.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h4 className="font-bold text-sm">Today's Trades ({dayTrades.length})</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Trades</p>
                  <p className="font-mono font-bold">{dayTrades.length}</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">P&L</p>
                  <p className={`font-mono font-bold ${dayPnl >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                    {dayPnl >= 0 ? '+' : ''}${dayPnl.toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Winners</p>
                  <p className="font-mono font-bold text-[hsl(var(--chart-green))]">{dayTrades.filter(t => (t.pnl ?? 0) > 0).length}</p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Losers</p>
                  <p className="font-mono font-bold text-[hsl(var(--chart-red))]">{dayTrades.filter(t => (t.pnl ?? 0) < 0).length}</p>
                </div>
              </div>
              <div className="space-y-1">
                {dayTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-secondary rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{t.symbol}</span>
                      <span className={t.direction === 'long' ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}>{t.direction.toUpperCase()}</span>
                    </div>
                    <span className={`font-mono font-bold ${(t.pnl ?? 0) >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                      {t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : 'Open'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lessons */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h4 className="font-bold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-yellow))]" />Lessons Learned
            </h4>
            <Textarea
              value={entry.lessons}
              onChange={e => setEntry({ ...entry, lessons: e.target.value })}
              className="bg-secondary"
              placeholder="Key takeaways from today..."
            />
          </div>

          {/* AI Analysis */}
          {weeklyAi && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
              <h4 className="font-bold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />Weekly AI Analysis
              </h4>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{weeklyAi}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
