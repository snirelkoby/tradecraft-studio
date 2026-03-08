import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/KpiCard';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Indicator {
  name: string;
  label: string;
  value: string;
  direction: string;
}

interface CotSymbolData {
  name: string;
  reportDate: string;
  openInterest: number;
  nonCommercial: {
    long: number;
    short: number;
    net: number;
    longChange: number;
    shortChange: number;
    netChange: number;
  };
  sentiment: string;
  weeklyShift: string;
}

const DEFAULT_INDICATORS: Indicator[] = [
  { name: 'CPI YoY', label: 'CPI (שנתי)', value: '', direction: '' },
  { name: 'Core CPI', label: 'Core CPI', value: '', direction: '' },
  { name: 'PPI YoY', label: 'PPI (שנתי)', value: '', direction: '' },
  { name: 'NFP', label: 'Non-Farm Payrolls', value: '', direction: '' },
  { name: 'Unemployment', label: 'Unemployment Rate', value: '', direction: '' },
  { name: 'Fed Rate', label: 'Fed Funds Rate', value: '', direction: '' },
  { name: 'GDP QoQ', label: 'GDP (רבעוני)', value: '', direction: '' },
  { name: 'Retail Sales', label: 'Retail Sales MoM', value: '', direction: '' },
  { name: 'ISM Mfg', label: 'ISM Manufacturing', value: '', direction: '' },
  { name: 'ISM Services', label: 'ISM Services', value: '', direction: '' },
  { name: 'Consumer Confidence', label: 'Consumer Confidence', value: '', direction: '' },
  { name: '10Y Yield', label: '10Y Treasury Yield', value: '', direction: '' },
];

const DIRECTIONS = [
  { value: 'higher', label: '↑ עלה' },
  { value: 'lower', label: '↓ ירד' },
  { value: 'inline', label: '= כצפוי' },
  { value: 'beat', label: '✓ גבוה מהצפי' },
  { value: 'miss', label: '✗ נמוך מהצפי' },
];

export default function MacroAnalysis() {
  const [indicators, setIndicators] = useState<Indicator[]>(DEFAULT_INDICATORS);
  const [cotData, setCotData] = useState<Record<string, CotSymbolData> | null>(null);
  const [cotLoading, setCotLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const updateIndicator = (index: number, field: 'value' | 'direction', val: string) => {
    setIndicators(prev => prev.map((ind, i) => i === index ? { ...ind, [field]: val } : ind));
  };

  const fetchCotData = async () => {
    setCotLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('cot-data');
      if (error) throw error;
      if (data?.success) {
        setCotData(data.data);
        toast.success('COT data loaded');
      } else {
        throw new Error(data?.error || 'Failed');
      }
    } catch (e: any) {
      toast.error('Failed to load COT data: ' + (e.message || ''));
    } finally {
      setCotLoading(false);
    }
  };

  const runAnalysis = async () => {
    const filledIndicators = indicators.filter(i => i.value !== '');
    if (filledIndicators.length === 0 && !cotData) {
      toast.error('הזן לפחות נתון כלכלי אחד או טען נתוני COT');
      return;
    }

    setAiLoading(true);
    setAiAnalysis('');

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/macro-analysis`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ indicators, cotData }),
        }
      );

      if (resp.status === 429) { toast.error('Rate limit - נסה שוב בעוד דקה'); setAiLoading(false); return; }
      if (resp.status === 402) { toast.error('Payment required'); setAiLoading(false); return; }
      if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { full += content; setAiAnalysis(full); }
          } catch { }
        }
      }
    } catch (e: any) {
      toast.error('AI analysis failed: ' + (e.message || ''));
    } finally {
      setAiLoading(false);
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === 'bullish') return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (sentiment === 'bearish') return <TrendingDown className="h-5 w-5 text-red-500" />;
    return <Minus className="h-5 w-5 text-muted-foreground" />;
  };

  const getShiftLabel = (shift: string) => {
    if (shift === 'more_bullish') return 'יותר Bullish';
    if (shift === 'more_bearish') return 'יותר Bearish';
    return 'ללא שינוי';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Macro Analysis</h1>
        <p className="text-muted-foreground text-sm">ניתוח כלכלי מאקרו, נתוני COT וכיוון שוק מבוסס AI</p>
      </div>

      {/* COT Section */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">COT Report — Non-Commercial Positions</h2>
          <Button onClick={fetchCotData} disabled={cotLoading} variant="secondary" size="sm">
            {cotLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {cotLoading ? 'Loading...' : 'Load COT Data'}
          </Button>
        </div>

        {cotData && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(cotData).map(([symbol, data]) => (
              <div key={symbol} className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{symbol} <span className="text-sm text-muted-foreground font-normal">({data.name})</span></h3>
                    <p className="text-xs text-muted-foreground">Report Date: {data.reportDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getSentimentIcon(data.sentiment)}
                    <span className={`text-sm font-medium ${data.sentiment === 'bullish' ? 'text-primary' : data.sentiment === 'bearish' ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {data.sentiment.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <KpiCard title="Longs" value={data.nonCommercial.long.toLocaleString()} variant="green" />
                  <KpiCard title="Shorts" value={data.nonCommercial.short.toLocaleString()} variant="red" />
                  <KpiCard title="Net" value={data.nonCommercial.net.toLocaleString()} variant={data.nonCommercial.net > 0 ? 'green' : 'red'} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <KpiCard title="Long Δ" value={`${data.nonCommercial.longChange > 0 ? '+' : ''}${data.nonCommercial.longChange.toLocaleString()}`} variant={data.nonCommercial.longChange > 0 ? 'green' : 'red'} />
                  <KpiCard title="Short Δ" value={`${data.nonCommercial.shortChange > 0 ? '+' : ''}${data.nonCommercial.shortChange.toLocaleString()}`} variant={data.nonCommercial.shortChange > 0 ? 'red' : 'green'} />
                  <KpiCard title="Weekly Shift" value={getShiftLabel(data.weeklyShift)} variant={data.weeklyShift === 'more_bullish' ? 'green' : data.weeklyShift === 'more_bearish' ? 'red' : 'blue'} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!cotData && !cotLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">לחץ על "Load COT Data" כדי לטעון נתוני COT עדכניים מ-Tradingster</p>
        )}
      </div>

      {/* Economic Indicators */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">Economic Indicators — נתונים כלכליים</h2>
        <p className="text-xs text-muted-foreground">הזן את הערכים האחרונים של הנתונים הכלכליים ובחר את הכיוון</p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {indicators.map((ind, i) => (
            <div key={ind.name} className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground uppercase mb-1 block">{ind.label}</label>
                <Input
                  type="text"
                  value={ind.value}
                  onChange={e => updateIndicator(i, 'value', e.target.value)}
                  placeholder="e.g. 3.2%"
                  className="bg-secondary"
                />
              </div>
              <Select value={ind.direction} onValueChange={v => updateIndicator(i, 'direction', v)}>
                <SelectTrigger className="w-[120px] bg-secondary">
                  <SelectValue placeholder="כיוון" />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      {/* AI Analysis */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">AI Market Direction Analysis</h2>
          <Button onClick={runAnalysis} disabled={aiLoading}>
            {aiLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {aiLoading ? 'מנתח...' : 'הפעל ניתוח AI'}
          </Button>
        </div>

        {aiAnalysis && (
          <div className="prose prose-sm dark:prose-invert max-w-none rounded-lg bg-secondary/50 p-4">
            <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
          </div>
        )}

        {!aiAnalysis && !aiLoading && (
          <p className="text-sm text-muted-foreground text-center py-4">הזן נתונים כלכליים ו/או טען COT ולחץ "הפעל ניתוח AI" לקבלת ניתוח כיוון שוק</p>
        )}
      </div>
    </div>
  );
}
