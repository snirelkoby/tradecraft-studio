import { useState, useMemo } from 'react';
import { useTrades } from '@/hooks/useTrades';
import { useSelectedAccount } from '@/hooks/useSelectedAccount';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { Heart, TrendingUp, Brain, Save } from 'lucide-react';
import { toast } from 'sonner';

const EMOTIONS = ['😤 Frustrated', '😰 Anxious', '😐 Neutral', '🤔 Focused', '😊 Confident', '🔥 Euphoric', '😴 Tired', '😡 Revenge'];

export default function EmotionTracker() {
  const { data: allTrades } = useTrades();
  const { selectedAccount } = useSelectedAccount();

  // Local emotion log (stored in localStorage)
  const [emotionLog, setEmotionLog] = useState<Record<string, { before: string; after: string; confidence: number; stress: number; note: string }>>(() => {
    try { return JSON.parse(localStorage.getItem('emotion-log') || '{}'); } catch { return {}; }
  });

  const [selectedTrade, setSelectedTrade] = useState<string>('');
  const [before, setBefore] = useState('😐 Neutral');
  const [after, setAfter] = useState('😐 Neutral');
  const [confidence, setConfidence] = useState([5]);
  const [stress, setStress] = useState([3]);
  const [note, setNote] = useState('');

  const trades = useMemo(() => {
    if (!allTrades) return [];
    const filtered = selectedAccount === 'all' ? allTrades : allTrades.filter(t => t.account_name === selectedAccount);
    return filtered.filter(t => t.status === 'closed').sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  }, [allTrades, selectedAccount]);

  const saveEmotion = () => {
    if (!selectedTrade) { toast.error('Select a trade first'); return; }
    const updated = { ...emotionLog, [selectedTrade]: { before, after, confidence: confidence[0], stress: stress[0], note } };
    setEmotionLog(updated);
    localStorage.setItem('emotion-log', JSON.stringify(updated));
    toast.success('Emotion saved!');
    setSelectedTrade('');
    setNote('');
  };

  // Correlation analysis
  const correlationData = useMemo(() => {
    return trades
      .filter(t => emotionLog[t.id])
      .map(t => ({
        symbol: t.symbol,
        pnl: t.pnl ?? 0,
        confidence: emotionLog[t.id].confidence,
        stress: emotionLog[t.id].stress,
        before: emotionLog[t.id].before,
        after: emotionLog[t.id].after,
      }));
  }, [trades, emotionLog]);

  // Emotion → P&L breakdown
  const emotionPnl = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {};
    correlationData.forEach(d => {
      const e = d.before;
      if (!map[e]) map[e] = { pnl: 0, count: 0, wins: 0 };
      map[e].pnl += d.pnl;
      map[e].count++;
      if (d.pnl > 0) map[e].wins++;
    });
    return Object.entries(map).map(([emotion, data]) => ({
      emotion: emotion.slice(2),
      pnl: data.pnl,
      count: data.count,
      winRate: data.count > 0 ? (data.wins / data.count * 100) : 0,
    })).sort((a, b) => b.pnl - a.pnl);
  }, [correlationData]);

  const loggedCount = Object.keys(emotionLog).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Heart className="h-6 w-6 text-primary" /> Emotion Tracker
        </h1>
        <p className="text-muted-foreground text-sm">קישור בין רגשות לביצועים — מעקב אחרי איך ההרגשה משפיעה על המסחר</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Log Form */}
        <Card className="bg-card border-border lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Log Emotion</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Trade</label>
              <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                <SelectTrigger><SelectValue placeholder="Select trade..." /></SelectTrigger>
                <SelectContent>
                  {trades.slice(0, 30).map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.symbol} {t.direction} {(t.pnl ?? 0) >= 0 ? '+' : ''}{(t.pnl ?? 0).toFixed(0)}$ — {t.entry_date?.slice(0, 10)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Before Trade</label>
              <Select value={before} onValueChange={setBefore}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMOTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">After Trade</label>
              <Select value={after} onValueChange={setAfter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMOTIONS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Confidence ({confidence[0]}/10)</label>
              <Slider value={confidence} onValueChange={setConfidence} min={1} max={10} step={1} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Stress ({stress[0]}/10)</label>
              <Slider value={stress} onValueChange={setStress} min={1} max={10} step={1} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">Notes</label>
              <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="How did you feel?" className="h-16" />
            </div>
            <Button onClick={saveEmotion} className="w-full"><Save className="h-4 w-4 mr-2" /> Save</Button>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="bg-card border-border p-4 text-center">
              <p className="text-2xl font-bold font-mono text-primary">{loggedCount}</p>
              <p className="text-xs text-muted-foreground">Logged</p>
            </Card>
            <Card className="bg-card border-border p-4 text-center">
              <p className="text-2xl font-bold font-mono">{trades.length}</p>
              <p className="text-xs text-muted-foreground">Total Trades</p>
            </Card>
            <Card className="bg-card border-border p-4 text-center">
              <p className="text-2xl font-bold font-mono">{loggedCount > 0 ? `${(loggedCount / trades.length * 100).toFixed(0)}%` : '0%'}</p>
              <p className="text-xs text-muted-foreground">Coverage</p>
            </Card>
          </div>

          {/* Confidence vs P&L Scatter */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4" /> Confidence vs P&L</CardTitle></CardHeader>
            <CardContent>
              {correlationData.length < 3 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Log at least 3 trades to see correlation</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="confidence" name="Confidence" type="number" domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis dataKey="pnl" name="P&L" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip formatter={(v: number, name: string) => name === 'P&L' ? `$${v.toFixed(2)}` : v} />
                    <Scatter data={correlationData} fill="hsl(var(--primary))" />
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Emotion → P&L Bar */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> P&L by Pre-Trade Emotion</CardTitle></CardHeader>
            <CardContent>
              {emotionPnl.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">No data yet — start logging emotions</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={emotionPnl}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="emotion" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                    <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                      {emotionPnl.map((entry, i) => (
                        <Cell key={i} fill={entry.pnl >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
