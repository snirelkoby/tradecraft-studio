import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronLeft, ChevronRight, Loader2, Download } from 'lucide-react';
import { format, startOfWeek, addWeeks, subWeeks, addDays } from 'date-fns';

interface EconomicEvent {
  id: string;
  event_date: string;
  event_time: string | null;
  title: string;
  currency: string;
  impact: string;
  forecast: string | null;
  actual: string | null;
  previous: string | null;
  notes: string | null;
}

const IMPACTS = [
  { value: 'high', label: '🔴 High', color: 'bg-[hsl(var(--chart-red))]' },
  { value: 'medium', label: '🟠 Medium', color: 'bg-orange-500' },
  { value: 'low', label: '🟡 Low', color: 'bg-yellow-500' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CNY', 'AUD', 'CAD', 'CHF'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Pre-defined key economic events for auto-import
const KEY_EVENTS_TEMPLATE = [
  { title: 'CPI YoY', currency: 'USD', impact: 'high' },
  { title: 'Core CPI MoM', currency: 'USD', impact: 'high' },
  { title: 'PPI YoY', currency: 'USD', impact: 'high' },
  { title: 'Non-Farm Payrolls', currency: 'USD', impact: 'high' },
  { title: 'Unemployment Rate', currency: 'USD', impact: 'high' },
  { title: 'FOMC Interest Rate Decision', currency: 'USD', impact: 'high' },
  { title: 'FOMC Press Conference', currency: 'USD', impact: 'high' },
  { title: 'Fed Chair Powell Speech', currency: 'USD', impact: 'high' },
  { title: 'GDP QoQ', currency: 'USD', impact: 'high' },
  { title: 'Retail Sales MoM', currency: 'USD', impact: 'high' },
  { title: 'ISM Manufacturing PMI', currency: 'USD', impact: 'medium' },
  { title: 'ISM Services PMI', currency: 'USD', impact: 'medium' },
  { title: 'Initial Jobless Claims', currency: 'USD', impact: 'medium' },
  { title: 'Consumer Confidence', currency: 'USD', impact: 'medium' },
  { title: 'PCE Price Index YoY', currency: 'USD', impact: 'high' },
  { title: 'Core PCE MoM', currency: 'USD', impact: 'high' },
  { title: 'Existing Home Sales', currency: 'USD', impact: 'medium' },
  { title: 'New Home Sales', currency: 'USD', impact: 'medium' },
  { title: 'Durable Goods Orders', currency: 'USD', impact: 'medium' },
  { title: 'ECB Interest Rate Decision', currency: 'EUR', impact: 'high' },
  { title: 'BOJ Interest Rate Decision', currency: 'JPY', impact: 'high' },
  { title: 'BOE Interest Rate Decision', currency: 'GBP', impact: 'high' },
];

export default function EconomicCalendar() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [fetchingNews, setFetchingNews] = useState(false);
  const [form, setForm] = useState({ event_date: format(new Date(), 'yyyy-MM-dd'), event_time: '', title: '', currency: 'USD', impact: 'high', forecast: '', actual: '', previous: '', notes: '' });
  const tvRef = useRef<HTMLDivElement>(null);
  const wbRef = useRef<HTMLDivElement>(null);

  const weekEnd = addDays(weekStart, 6);

  useEffect(() => {
    if (!user) return;
    loadEvents();
  }, [user, weekStart]);

  // TradingView Economic Calendar Widget
  useEffect(() => {
    if (!tvRef.current) return;
    tvRef.current.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'tradingview-widget-container';
    container.style.height = '500px';
    container.style.width = '100%';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-events.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      colorTheme: 'dark',
      isTransparent: true,
      width: '100%',
      height: '100%',
      locale: 'en',
      importanceFilter: '-1,0,1',
      countryFilter: 'us',
    });
    container.appendChild(script);
    tvRef.current.appendChild(container);
  }, []);

  // Walter Bloomberg Twitter Embed
  useEffect(() => {
    if (!wbRef.current) return;
    wbRef.current.innerHTML = '';
    
    const anchor = document.createElement('a');
    anchor.className = 'twitter-timeline';
    anchor.setAttribute('data-theme', 'dark');
    anchor.setAttribute('data-height', '600');
    anchor.setAttribute('data-chrome', 'noheader nofooter noborders transparent');
    anchor.href = 'https://twitter.com/DeItaone';
    anchor.textContent = 'Tweets by Walter Bloomberg';
    wbRef.current.appendChild(anchor);

    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    wbRef.current.appendChild(script);
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('economic_events')
      .select('*')
      .gte('event_date', format(weekStart, 'yyyy-MM-dd'))
      .lte('event_date', format(weekEnd, 'yyyy-MM-dd'))
      .order('event_date', { ascending: true })
      .order('event_time', { ascending: true });
    setEvents((data as any as EconomicEvent[]) || []);
    setLoading(false);
  };

  const addEvent = async () => {
    if (!user || !form.title) return;
    const { error } = await supabase.from('economic_events').insert({
      user_id: user.id,
      event_date: form.event_date,
      event_time: form.event_time || null,
      title: form.title,
      currency: form.currency,
      impact: form.impact,
      forecast: form.forecast || null,
      actual: form.actual || null,
      previous: form.previous || null,
      notes: form.notes || null,
    } as any);
    if (error) return toast.error(error.message);
    toast.success('אירוע נוסף');
    setShowForm(false);
    setForm({ event_date: format(new Date(), 'yyyy-MM-dd'), event_time: '', title: '', currency: 'USD', impact: 'high', forecast: '', actual: '', previous: '', notes: '' });
    loadEvents();
  };

  const addFromTemplate = async (tmpl: typeof KEY_EVENTS_TEMPLATE[0]) => {
    if (!user) return;
    const { error } = await supabase.from('economic_events').insert({
      user_id: user.id,
      event_date: form.event_date,
      title: tmpl.title,
      currency: tmpl.currency,
      impact: tmpl.impact,
    } as any);
    if (error) return toast.error(error.message);
    toast.success(`${tmpl.title} נוסף`);
    loadEvents();
  };

  const fetchAiEconomicEvents = async () => {
    if (!user) return;
    setFetchingNews(true);
    try {
      const { data, error } = await supabase.functions.invoke('economic-events-ai', {
        body: {
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        },
      });
      if (error) throw error;
      if (data?.events?.length) {
        for (const evt of data.events) {
          await supabase.from('economic_events').insert({
            user_id: user.id,
            event_date: evt.event_date,
            event_time: evt.event_time || null,
            title: evt.title,
            currency: evt.currency || 'USD',
            impact: evt.impact || 'medium',
            forecast: evt.forecast || null,
            previous: evt.previous || null,
            notes: 'ייובא אוטומטית ע״י AI',
          } as any);
        }
        toast.success(`${data.events.length} אירועים יובאו`);
        loadEvents();
      } else {
        toast.info('לא נמצאו אירועים חדשים לשבוע זה');
      }
    } catch (e: any) {
      if (e?.message?.includes('429')) toast.error('Rate limit - נסה שוב בעוד דקה');
      else if (e?.message?.includes('402')) toast.error('Payment required');
      else toast.error('ייבוא נכשל: ' + (e.message || ''));
    } finally {
      setFetchingNews(false);
    }
  };

  const deleteEvent = async (id: string) => {
    await supabase.from('economic_events').delete().eq('id', id);
    loadEvents();
  };

  const updateActual = async (id: string, actual: string) => {
    await supabase.from('economic_events').update({ actual } as any).eq('id', id);
    setEvents(prev => prev.map(e => e.id === id ? { ...e, actual } : e));
  };

  const getImpactDot = (impact: string) => {
    const cfg = IMPACTS.find(i => i.value === impact);
    return <span className={`inline-block w-2 h-2 rounded-full ${cfg?.color || 'bg-muted'}`} />;
  };

  // Group events by date
  const grouped: Record<string, EconomicEvent[]> = {};
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(weekStart, i), 'yyyy-MM-dd');
    grouped[d] = events.filter(e => e.event_date === d);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Economic Calendar</h1>
        <p className="text-muted-foreground text-sm">יומן כלכלי — אירועים, חדשות ונתונים חשובים לשוק</p>
      </div>

      {/* Walter Bloomberg Feed */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[hsl(var(--chart-blue))] animate-pulse" />
          Walter Bloomberg — חדשות בזמן אמת
        </h2>
        <p className="text-xs text-muted-foreground mb-3">@DeItaone — Breaking market news & headlines</p>
        <div ref={wbRef} className="min-h-[200px] rounded-lg overflow-hidden" />
      </div>

      {/* TradingView Widget */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-lg font-semibold mb-3">Global Economic Events</h2>
        <div ref={tvRef} className="min-h-[500px] rounded-lg overflow-hidden" />
      </div>

      {/* Personal Events */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-semibold">האירועים שלי</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-mono">{format(weekStart, 'MMM dd')} – {format(weekEnd, 'MMM dd')}</span>
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(addWeeks(weekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={fetchAiEconomicEvents} disabled={fetchingNews}>
              {fetchingNews ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Download className="h-4 w-4 mr-1" />}
              ייבוא אוטומטי
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowTemplates(!showTemplates)}>
              תבניות
            </Button>
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-4 w-4 mr-1" /> הוסף אירוע
            </Button>
          </div>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">הוסף אירוע מתבנית — בחר תאריך:</p>
              <Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="w-40 bg-background" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {KEY_EVENTS_TEMPLATE.map((tmpl, i) => (
                <button
                  key={i}
                  onClick={() => addFromTemplate(tmpl)}
                  className="text-xs text-right p-2 rounded-lg border border-border bg-background hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tmpl.impact === 'high' ? 'bg-[hsl(var(--chart-red))]' : 'bg-orange-500'}`} />
                  <span className="flex-1">{tmpl.title}</span>
                  <span className="text-muted-foreground">{tmpl.currency}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add Event Form */}
        {showForm && (
          <div className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">תאריך</label>
                <Input type="date" value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })} className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">שעה (אופציונלי)</label>
                <Input type="time" value={form.event_time} onChange={e => setForm({ ...form, event_time: e.target.value })} className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">מטבע</label>
                <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">השפעה</label>
                <Select value={form.impact} onValueChange={v => setForm({ ...form, impact: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent>{IMPACTS.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">שם האירוע</label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. CPI YoY, FOMC Meeting" className="bg-background" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">צפי (Forecast)</label>
                <Input value={form.forecast} onChange={e => setForm({ ...form, forecast: e.target.value })} placeholder="3.2%" className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">קודם (Previous)</label>
                <Input value={form.previous} onChange={e => setForm({ ...form, previous: e.target.value })} placeholder="3.4%" className="bg-background" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">בפועל (Actual)</label>
                <Input value={form.actual} onChange={e => setForm({ ...form, actual: e.target.value })} placeholder="—" className="bg-background" />
              </div>
            </div>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="הערות..." className="bg-background" />
            <Button onClick={addEvent}>שמור אירוע</Button>
          </div>
        )}

        {/* Weekly View */}
        <div className="space-y-2">
          {Object.entries(grouped).map(([dateStr, dayEvents]) => {
            const d = new Date(dateStr + 'T00:00:00');
            const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
            return (
              <div key={dateStr} className={`rounded-lg border p-3 ${isToday ? 'border-primary/50 bg-primary/5' : 'border-border bg-secondary/30'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold uppercase ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                    {WEEKDAYS[d.getDay()]}
                  </span>
                  <span className="text-sm font-mono">{format(d, 'MMM dd')}</span>
                  {isToday && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold">TODAY</span>}
                </div>
                {dayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground">—</p>
                ) : (
                  <div className="space-y-1">
                    {dayEvents.map(ev => (
                      <div key={ev.id} className="flex items-center gap-3 text-sm group">
                        {getImpactDot(ev.impact)}
                        {ev.event_time && <span className="text-xs text-muted-foreground font-mono w-12">{ev.event_time.slice(0, 5)}</span>}
                        <span className="text-xs text-muted-foreground w-8">{ev.currency}</span>
                        <span className="font-medium flex-1">{ev.title}</span>
                        <span className="text-xs text-muted-foreground">F: {ev.forecast || '—'}</span>
                        <span className="text-xs text-muted-foreground">P: {ev.previous || '—'}</span>
                        <Input
                          className="w-16 h-6 text-xs bg-background"
                          value={ev.actual || ''}
                          onChange={e => updateActual(ev.id, e.target.value)}
                          placeholder="Actual"
                        />
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteEvent(ev.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
