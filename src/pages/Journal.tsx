import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { format, addDays, subDays, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';

const MOODS = ['🔥 Confident', '😊 Good', '😐 Neutral', '😰 Anxious', '😤 Frustrated', '🥶 Fearful'];

export default function Journal() {
  const { user } = useAuth();
  const { data: allTrades } = useTrades();
  const [date, setDate] = useState(new Date());
  const [entry, setEntry] = useState({
    pre_market_notes: '', post_market_notes: '', mood: '', lessons: '', id: '',
    energy_before: 5, focus_before: 5, confidence_before: 5,
    energy_after: 5, focus_after: 5, confidence_after: 5,
  });
  const [loading, setLoading] = useState(true);
  const [weeklyAi, setWeeklyAi] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const dateStr = format(date, 'yyyy-MM-dd');

  // Trades for this day
  const dayTrades = useMemo(() => {
    if (!allTrades) return [];
    return allTrades.filter(t => t.entry_date?.slice(0, 10) === dateStr);
  }, [allTrades, dateStr]);

  const dayPnl = dayTrades.filter(t => t.status === 'closed' && t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0);

  useEffect(() => {
    if (!user) return;
    loadEntry();
  }, [user, dateStr]);

  const loadEntry = async () => {
    setLoading(true);
    // Load from mindset_entries for energy/focus/confidence
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
      energy_after: 5,
      focus_after: 5,
      confidence_after: 5,
    });
    setLoading(false);
  };

  const save = async () => {
    if (!user) return;

    // Save journal entry
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

    // Save mindset entry (upsert)
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
    loadEntry();
  };

  const generateWeeklyAi = async () => {
    if (!user) return;
    setAiLoading(true);
    try {
      const weekStart = startOfWeek(date, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(date, { weekStartsOn: 0 });

      // Get journal entries for this week and previous weeks
      const { data: journals } = await supabase.from('journal_entries').select('*')
        .gte('date', format(subDays(weekStart, 21), 'yyyy-MM-dd'))
        .lte('date', format(weekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      // Get trades for this week
      const weekTrades = (allTrades ?? []).filter(t => {
        const td = new Date(t.entry_date);
        return isWithinInterval(td, { start: weekStart, end: weekEnd });
      });

      const thisWeekJournals = (journals ?? []).filter(j => {
        const jd = new Date(j.date);
        return isWithinInterval(jd, { start: weekStart, end: weekEnd });
      });
      const prevWeekJournals = (journals ?? []).filter(j => {
        const jd = new Date(j.date);
        return !isWithinInterval(jd, { start: weekStart, end: weekEnd });
      });

      const prompt = `אתה מנטור מסחר מקצועי. נתח את השבוע הזה ותן עצות:

יומני השבוע הנוכחי:
${thisWeekJournals.map(j => `${j.date}: mood=${j.mood}, pre=${j.pre_market_notes}, post=${j.post_market_notes}, lessons=${j.lessons}`).join('\n')}

עסקאות השבוע: ${weekTrades.length} עסקאות, P&L: $${weekTrades.filter(t => t.pnl).reduce((s, t) => s + (t.pnl ?? 0), 0).toFixed(0)}
Win rate: ${weekTrades.filter(t => (t.pnl ?? 0) > 0).length}/${weekTrades.filter(t => t.status === 'closed').length}

יומני שבועות קודמים (להשוואה):
${prevWeekJournals.slice(-7).map(j => `${j.date}: mood=${j.mood}, lessons=${j.lessons}`).join('\n')}

תן ניתוח בעברית: מה היה טוב, מה צריך לשפר, דפוסים שחוזרים, ועצות קונקרטיות לשבוע הבא.`;

      const { data, error } = await supabase.functions.invoke('trade-insights', {
        body: { prompt },
      });
      if (error) throw error;
      setWeeklyAi(data?.result || data?.message || 'No analysis available');
    } catch (err: any) {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trading Journal</h1>
        <p className="text-muted-foreground text-sm">Daily pre & post market reflections</p>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setDate(subDays(date, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h2 className="text-lg font-semibold font-mono">{format(date, 'EEEE, MMMM dd yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Loading...</p>
      ) : (
        <div className="space-y-4">
          {/* Mood */}
          <div className="max-w-xs">
            <label className="text-xs text-muted-foreground uppercase mb-1 block">Mood / Mental State</label>
            <Select value={entry.mood} onValueChange={v => setEntry({ ...entry, mood: v })}>
              <SelectTrigger className="bg-secondary"><SelectValue placeholder="How are you feeling?" /></SelectTrigger>
              <SelectContent>
                {MOODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Energy/Focus/Confidence - Pre-market */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-blue))]" />
                Pre-Market State
              </h3>
              <SliderRow label="Energy" value={entry.energy_before} onChange={v => setEntry({ ...entry, energy_before: v })} emoji="⚡" />
              <SliderRow label="Focus" value={entry.focus_before} onChange={v => setEntry({ ...entry, focus_before: v })} emoji="🎯" />
              <SliderRow label="Confidence" value={entry.confidence_before} onChange={v => setEntry({ ...entry, confidence_before: v })} emoji="💪" />
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-green))]" />
                Post-Market State
              </h3>
              <SliderRow label="Energy" value={entry.energy_after} onChange={v => setEntry({ ...entry, energy_after: v })} emoji="⚡" />
              <SliderRow label="Focus" value={entry.focus_after} onChange={v => setEntry({ ...entry, focus_after: v })} emoji="🎯" />
              <SliderRow label="Confidence" value={entry.confidence_after} onChange={v => setEntry({ ...entry, confidence_after: v })} emoji="💪" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Pre-market */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-blue))]" />
                Pre-Market Notes
              </h3>
              <p className="text-xs text-muted-foreground">Market outlook, plan for today, key levels to watch</p>
              <Textarea
                value={entry.pre_market_notes}
                onChange={e => setEntry({ ...entry, pre_market_notes: e.target.value })}
                className="bg-secondary min-h-[200px]"
                placeholder="What's your plan for today? Key levels? News events?"
              />
            </div>

            {/* Post-market */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-green))]" />
                Post-Market Review
              </h3>
              <p className="text-xs text-muted-foreground">What happened? Did you follow your plan?</p>
              <Textarea
                value={entry.post_market_notes}
                onChange={e => setEntry({ ...entry, post_market_notes: e.target.value })}
                className="bg-secondary min-h-[200px]"
                placeholder="How did the day go? Did you follow your rules?"
              />
            </div>
          </div>

          {/* Day highlights */}
          {dayTrades.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Today's Trades ({dayTrades.length})
              </h3>
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
                  <p className="font-mono font-bold text-[hsl(var(--chart-green))]">
                    {dayTrades.filter(t => (t.pnl ?? 0) > 0).length}
                  </p>
                </div>
                <div className="rounded-lg bg-secondary p-3">
                  <p className="text-[10px] text-muted-foreground uppercase">Losers</p>
                  <p className="font-mono font-bold text-[hsl(var(--chart-red))]">
                    {dayTrades.filter(t => (t.pnl ?? 0) < 0).length}
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                {dayTrades.map(t => (
                  <div key={t.id} className="flex items-center justify-between text-xs bg-secondary rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">{t.symbol}</span>
                      <span className={t.direction === 'long' ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}>
                        {t.direction.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">{t.strategy || ''}</span>
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
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-yellow))]" />
              Lessons Learned
            </h3>
            <Textarea
              value={entry.lessons}
              onChange={e => setEntry({ ...entry, lessons: e.target.value })}
              className="bg-secondary"
              placeholder="Key takeaways from today..."
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={save} className="font-bold">SAVE JOURNAL ENTRY</Button>
            <Button variant="outline" onClick={generateWeeklyAi} disabled={aiLoading}>
              <Sparkles className="h-4 w-4 mr-2" />
              {aiLoading ? 'Analyzing...' : 'Weekly AI Analysis'}
            </Button>
          </div>

          {/* Weekly AI Analysis */}
          {weeklyAi && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Weekly AI Analysis
              </h3>
              <div className="text-sm whitespace-pre-wrap leading-relaxed">{weeklyAi}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
