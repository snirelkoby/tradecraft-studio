import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format, subDays, addDays } from 'date-fns';
import { CalendarDays, ChevronLeft, ChevronRight, Save } from 'lucide-react';

interface SessionPlan {
  id?: string;
  date: string;
  bias: string;
  key_levels: string;
  watchlist: string;
  notes: string;
}

const EMPTY: SessionPlan = { date: format(new Date(), 'yyyy-MM-dd'), bias: 'neutral', key_levels: '', watchlist: '', notes: '' };

export default function SessionPlanner() {
  const { user } = useAuth();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [plan, setPlan] = useState<SessionPlan>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadPlan();
  }, [user, date]);

  const loadPlan = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('session_plans')
      .select('*')
      .eq('date', date)
      .maybeSingle();
    if (data) {
      setPlan({ id: data.id, date: data.date, bias: data.bias ?? 'neutral', key_levels: data.key_levels ?? '', watchlist: data.watchlist ?? '', notes: data.notes ?? '' });
    } else {
      setPlan({ ...EMPTY, date });
    }
    setLoading(false);
  };

  const save = async () => {
    if (!user) return;
    if (plan.id) {
      const { error } = await supabase.from('session_plans').update({
        bias: plan.bias, key_levels: plan.key_levels, watchlist: plan.watchlist, notes: plan.notes,
      } as any).eq('id', plan.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from('session_plans').insert({
        user_id: user.id, date, bias: plan.bias, key_levels: plan.key_levels, watchlist: plan.watchlist, notes: plan.notes,
      } as any);
      if (error) return toast.error(error.message);
    }
    toast.success('Session plan saved');
    loadPlan();
  };

  const nav = (days: number) => setDate(format(days > 0 ? addDays(new Date(date), days) : subDays(new Date(date), Math.abs(days)), 'yyyy-MM-dd'));

  const biasColor = plan.bias === 'bullish' ? 'text-green-500' : plan.bias === 'bearish' ? 'text-destructive' : 'text-muted-foreground';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Session Planner</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => nav(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary border border-border">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="border-0 bg-transparent p-0 h-auto w-auto" />
          </div>
          <Button variant="outline" size="icon" onClick={() => nav(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>

      {loading ? <p className="text-muted-foreground text-center py-8">Loading...</p> : (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Market Bias</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Select value={plan.bias} onValueChange={v => setPlan(p => ({ ...p, bias: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bullish">🟢 Bullish</SelectItem>
                  <SelectItem value="bearish">🔴 Bearish</SelectItem>
                  <SelectItem value="neutral">⚪ Neutral</SelectItem>
                  <SelectItem value="no-trade">🚫 No-Trade Day</SelectItem>
                </SelectContent>
              </Select>
              <p className={`text-3xl font-black text-center ${biasColor}`}>{plan.bias.toUpperCase()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Key Levels</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={plan.key_levels}
                onChange={e => setPlan(p => ({ ...p, key_levels: e.target.value }))}
                placeholder="Support: 4200, 4180&#10;Resistance: 4300, 4350&#10;POI: 4250"
                className="bg-secondary min-h-[160px] font-mono text-sm"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Watchlist</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={plan.watchlist}
                onChange={e => setPlan(p => ({ ...p, watchlist: e.target.value }))}
                placeholder="ES — Breakout above 4300&#10;NQ — Watching for rejection at 15200&#10;AAPL — Earnings gap fill"
                className="bg-secondary min-h-[160px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Session Notes</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={plan.notes}
                onChange={e => setPlan(p => ({ ...p, notes: e.target.value }))}
                placeholder="Pre-market observations, plan adjustments..."
                className="bg-secondary min-h-[160px]"
              />
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} size="lg" className="font-bold">
          <Save className="h-4 w-4 mr-2" /> Save Session Plan
        </Button>
      </div>
    </div>
  );
}
