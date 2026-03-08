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
    </div>
  );
}
