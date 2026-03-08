import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTrades } from '@/hooks/useTrades';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Trash2, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TradeStep {
  id: string;
  trade_id: string;
  step_number: number;
  step_type: string;
  title: string;
  description: string | null;
  screenshot_url: string | null;
  created_at: string;
}

const STEP_TYPES = [
  { value: 'entry_trigger', label: '🎯 Entry Trigger' },
  { value: 'position_size', label: '📊 Position Sizing' },
  { value: 'management', label: '⚙️ Trade Management' },
  { value: 'exit_trigger', label: '🚪 Exit Trigger' },
  { value: 'note', label: '📝 Note' },
  { value: 'mistake', label: '⚠️ Mistake' },
];

export default function TradeReplay() {
  const { user } = useAuth();
  const { data: trades } = useTrades();
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');
  const [steps, setSteps] = useState<TradeStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({ step_type: 'entry_trigger', title: '', description: '' });

  const closedTrades = (trades ?? []).filter(t => t.status === 'closed').sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());
  const selectedTrade = closedTrades.find(t => t.id === selectedTradeId);

  useEffect(() => {
    if (!selectedTradeId || !user) return;
    loadSteps();
  }, [selectedTradeId, user]);

  const loadSteps = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('trade_steps')
      .select('*')
      .eq('trade_id', selectedTradeId)
      .order('step_number', { ascending: true });
    setSteps((data as any as TradeStep[]) || []);
    setReplayIndex(0);
    setLoading(false);
  };

  const addStep = async () => {
    if (!user || !form.title || !selectedTradeId) return;
    const nextNum = steps.length > 0 ? Math.max(...steps.map(s => s.step_number)) + 1 : 1;
    const { error } = await supabase.from('trade_steps').insert({
      user_id: user.id,
      trade_id: selectedTradeId,
      step_number: nextNum,
      step_type: form.step_type,
      title: form.title,
      description: form.description || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('צעד נוסף');
    setForm({ step_type: 'entry_trigger', title: '', description: '' });
    setShowAddForm(false);
    loadSteps();
  };

  const deleteStep = async (id: string) => {
    await supabase.from('trade_steps').delete().eq('id', id);
    loadSteps();
  };

  const startReplay = () => {
    if (steps.length === 0) return;
    setIsReplaying(true);
    setReplayIndex(0);
  };

  const getStepIcon = (type: string) => STEP_TYPES.find(s => s.value === type)?.label.split(' ')[0] || '📝';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Replay</h1>
        <p className="text-muted-foreground text-sm">תעד צעדים בעסקה והפעל מחדש ויזואלית</p>
      </div>

      {/* Trade Selector */}
      <div className="rounded-xl border border-border bg-card p-5">
        <label className="text-sm font-medium block mb-2">בחר עסקה</label>
        <Select value={selectedTradeId} onValueChange={setSelectedTradeId}>
          <SelectTrigger className="bg-background max-w-md">
            <SelectValue placeholder="בחר עסקה..." />
          </SelectTrigger>
          <SelectContent>
            {closedTrades.map(t => (
              <SelectItem key={t.id} value={t.id}>
                {t.symbol} {t.direction} — {format(parseISO(t.entry_date), 'MMM dd')} — ${(t.pnl ?? 0).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTrade && (
        <>
          {/* Trade Summary */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{selectedTrade.symbol}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${selectedTrade.direction === 'long' ? 'bg-[hsl(var(--chart-green))]/20 text-[hsl(var(--chart-green))]' : 'bg-[hsl(var(--chart-red))]/20 text-[hsl(var(--chart-red))]'}`}>
                  {selectedTrade.direction.toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">Entry: ${selectedTrade.entry_price}</span>
              <span className="text-sm text-muted-foreground">Exit: ${selectedTrade.exit_price}</span>
              <span className={`font-mono font-bold ${(selectedTrade.pnl ?? 0) >= 0 ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
                ${(selectedTrade.pnl ?? 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={startReplay} disabled={steps.length === 0}>
              <Play className="h-4 w-4 mr-1" /> הפעל Replay
            </Button>
            <Button size="sm" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-4 w-4 mr-1" /> הוסף צעד
            </Button>
          </div>

          {/* Add Step Form */}
          {showAddForm && (
            <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">סוג צעד</label>
                  <Select value={form.step_type} onValueChange={v => setForm({ ...form, step_type: v })}>
                    <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STEP_TYPES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">כותרת</label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Breakout above resistance" className="bg-background" />
                </div>
              </div>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="תיאור מפורט..." className="bg-background" />
              <Button onClick={addStep} size="sm">שמור צעד</Button>
            </div>
          )}

          {/* Replay View */}
          {isReplaying && steps.length > 0 && (
            <div className="rounded-xl border-2 border-primary/50 bg-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-primary">Replay Mode — Step {replayIndex + 1}/{steps.length}</h3>
                <Button size="sm" variant="ghost" onClick={() => setIsReplaying(false)}>סגור</Button>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={() => setReplayIndex(Math.max(0, replayIndex - 1))} disabled={replayIndex === 0}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1 bg-secondary rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{getStepIcon(steps[replayIndex].step_type)}</span>
                    <span className="font-bold">{steps[replayIndex].title}</span>
                    <span className="text-xs text-muted-foreground bg-background px-2 py-0.5 rounded">{steps[replayIndex].step_type}</span>
                  </div>
                  {steps[replayIndex].description && (
                    <p className="text-sm text-muted-foreground">{steps[replayIndex].description}</p>
                  )}
                </div>
                <Button variant="outline" size="icon" onClick={() => setReplayIndex(Math.min(steps.length - 1, replayIndex + 1))} disabled={replayIndex === steps.length - 1}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {/* Progress dots */}
              <div className="flex items-center justify-center gap-1.5">
                {steps.map((_, i) => (
                  <button key={i} onClick={() => setReplayIndex(i)} className={`w-2 h-2 rounded-full transition-colors ${i === replayIndex ? 'bg-primary' : i < replayIndex ? 'bg-primary/40' : 'bg-muted'}`} />
                ))}
              </div>
            </div>
          )}

          {/* Steps Timeline */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Timeline</h3>
            {loading ? (
              <p className="text-sm text-muted-foreground">טוען...</p>
            ) : steps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">אין צעדים עדיין — הוסף צעד ראשון</p>
            ) : (
              <div className="space-y-3">
                {steps.map((step, i) => (
                  <div key={step.id} className="flex items-start gap-3 group">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm">{getStepIcon(step.step_type)}</div>
                      {i < steps.length - 1 && <div className="w-px h-6 bg-border" />}
                    </div>
                    <div className="flex-1 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{step.title}</span>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">{step.step_type}</span>
                      </div>
                      {step.description && <p className="text-xs text-muted-foreground mt-1">{step.description}</p>}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteStep(step.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
