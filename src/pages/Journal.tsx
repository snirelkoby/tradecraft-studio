import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays } from 'date-fns';

const MOODS = ['🔥 Confident', '😊 Good', '😐 Neutral', '😰 Anxious', '😤 Frustrated', '🥶 Fearful'];

export default function Journal() {
  const { user } = useAuth();
  const [date, setDate] = useState(new Date());
  const [entry, setEntry] = useState({ pre_market_notes: '', post_market_notes: '', mood: '', lessons: '', id: '' });
  const [loading, setLoading] = useState(true);

  const dateStr = format(date, 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    loadEntry();
  }, [user, dateStr]);

  const loadEntry = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('date', dateStr)
      .maybeSingle();

    if (data) {
      setEntry({
        id: data.id,
        pre_market_notes: data.pre_market_notes ?? '',
        post_market_notes: data.post_market_notes ?? '',
        mood: data.mood ?? '',
        lessons: data.lessons ?? '',
      });
    } else {
      setEntry({ id: '', pre_market_notes: '', post_market_notes: '', mood: '', lessons: '' });
    }
    setLoading(false);
  };

  const save = async () => {
    if (!user) return;

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
    toast.success('Journal saved');
    loadEntry();
  };

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

          <Button onClick={save} className="font-bold">SAVE JOURNAL ENTRY</Button>
        </div>
      )}
    </div>
  );
}
