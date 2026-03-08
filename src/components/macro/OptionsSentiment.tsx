import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const SENTIMENT_LEVELS = [
  { value: 'very_bullish', label: 'VERY BULLISH', icon: ChevronUp, color: 'text-chart-green', bg: 'bg-chart-green/20 border-chart-green/50' },
  { value: 'bullish', label: 'BULLISH', icon: TrendingUp, color: 'text-chart-green/80', bg: 'bg-chart-green/10 border-chart-green/30' },
  { value: 'neutral', label: 'NEUTRAL', icon: Minus, color: 'text-muted-foreground', bg: 'bg-muted border-muted-foreground/30' },
  { value: 'bearish', label: 'BEARISH', icon: TrendingDown, color: 'text-chart-red/80', bg: 'bg-chart-red/10 border-chart-red/30' },
  { value: 'very_bearish', label: 'VERY BEARISH', icon: ChevronDown, color: 'text-chart-red', bg: 'bg-chart-red/20 border-chart-red/50' },
];

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function getWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 4); // Friday
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[start.getMonth()]} ${start.getDate()} - ${months[end.getMonth()]} ${end.getDate()}, ${start.getFullYear()}`;
}

export function OptionsSentiment() {
  const { user } = useAuth();
  const [sentiment, setSentiment] = useState('neutral');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekStart = getWeekStart(new Date());

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('options_sentiment')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', weekStart)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSentiment((data as any).sentiment || 'neutral');
          setNotes((data as any).notes || '');
        }
        setLoading(false);
      });
  }, [user, weekStart]);

  const saveSentiment = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('options_sentiment')
        .upsert(
          { user_id: user.id, week_start: weekStart, sentiment, notes, updated_at: new Date().toISOString() } as any,
          { onConflict: 'user_id,week_start' }
        );
      if (error) throw error;
      toast.success('Sentiment נשמר');
    } catch {
      toast.error('שמירה נכשלה');
    } finally {
      setSaving(false);
    }
  };

  const selectedLevel = SENTIMENT_LEVELS.find(l => l.value === sentiment) || SENTIMENT_LEVELS[2];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Options Sentiment — השבוע הקרוב</h3>
          <p className="text-xs text-muted-foreground">{getWeekRange(weekStart)}</p>
        </div>
        <Button onClick={saveSentiment} disabled={saving} variant="secondary" size="sm">
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          שמור
        </Button>
      </div>

      {/* Current selection display */}
      <div className={cn(
        "flex items-center justify-center gap-3 p-4 rounded-lg border-2",
        selectedLevel.bg
      )}>
        <selectedLevel.icon className={cn("h-8 w-8", selectedLevel.color)} />
        <span className={cn("text-2xl font-bold", selectedLevel.color)}>
          {selectedLevel.label}
        </span>
      </div>

      {/* Sentiment buttons */}
      <div className="grid grid-cols-5 gap-2">
        {SENTIMENT_LEVELS.map((level) => {
          const Icon = level.icon;
          const isSelected = sentiment === level.value;
          return (
            <button
              key={level.value}
              onClick={() => setSentiment(level.value)}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all",
                isSelected ? level.bg : "bg-secondary/50 border-transparent hover:border-border"
              )}
            >
              <Icon className={cn("h-5 w-5", isSelected ? level.color : "text-muted-foreground")} />
              <span className={cn("text-[10px] font-medium", isSelected ? level.color : "text-muted-foreground")}>
                {level.label.split(' ')[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notes */}
      <Textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="הערות על האופציות, GEX, PUT/CALL Ratio, מקסימום כאב..."
        className="bg-secondary resize-none"
        rows={3}
      />

      {/* Sentiment History Chart */}
      <SentimentHistoryChart />
    </div>
  );
}

const SENTIMENT_NUMERIC: Record<string, number> = {
  very_bearish: -2,
  bearish: -1,
  neutral: 0,
  bullish: 1,
  very_bullish: 2,
};

const SENTIMENT_LABEL_MAP: Record<number, string> = {
  [-2]: 'V.Bear',
  [-1]: 'Bear',
  [0]: 'Neutral',
  [1]: 'Bull',
  [2]: 'V.Bull',
};

function SentimentHistoryChart() {
  const { user } = useAuth();
  const [history, setHistory] = useState<{ date: string; value: number; label: string; notes: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('options_sentiment')
      .select('week_start, sentiment, notes')
      .eq('user_id', user.id)
      .order('week_start', { ascending: true })
      .then(({ data }) => {
        if (data) {
          setHistory(
            (data as any[]).map((d) => ({
              date: d.week_start,
              value: SENTIMENT_NUMERIC[d.sentiment] ?? 0,
              label: d.sentiment?.replace('_', ' ').toUpperCase() || 'NEUTRAL',
              notes: d.notes,
            }))
          );
        }
        setLoading(false);
      });
  }, [user]);

  if (loading) return null;
  if (history.length < 2) {
    return (
      <p className="text-xs text-muted-foreground text-center py-2">
        שמור לפחות 2 שבועות כדי לראות גרף היסטורי
      </p>
    );
  }

  const formatDate = (date: string) => {
    const d = new Date(date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  return (
    <div className="space-y-2 pt-2 border-t border-border">
      <h4 className="text-sm font-semibold">Sentiment History — היסטוריה</h4>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={history}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
          <YAxis
            domain={[-2.5, 2.5]}
            ticks={[-2, -1, 0, 1, 2]}
            tickFormatter={(v) => SENTIMENT_LABEL_MAP[v] || ''}
            tick={{ fontSize: 9 }}
            stroke="hsl(var(--muted-foreground))"
            width={50}
          />
          <Tooltip
            formatter={(value: number) => [SENTIMENT_LABEL_MAP[value] || value, 'Sentiment']}
            labelFormatter={formatDate}
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
          <Area
            type="stepAfter"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary) / 0.15)"
            strokeWidth={2}
            dot={{ r: 4, fill: 'hsl(var(--primary))' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
