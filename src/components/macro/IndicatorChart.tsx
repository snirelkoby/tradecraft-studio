import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DataPoint {
  date: string;
  value: number;
}

interface IndicatorData {
  label: string;
  format: string;
  frequency: string;
  data: DataPoint[];
}

// Display order for indicators
const INDICATOR_ORDER = [
  'CPI YoY', 'Core CPI', 'PPI YoY', 'NFP', 'Unemployment',
  'Initial Claims', 'JOLTS', 'Retail Sales', 'ISM Mfg',
  'Industrial Production', 'GDP QoQ',
];

export function IndicatorCharts() {
  const [data, setData] = useState<Record<string, IndicatorData> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('economic-data', {
        body: { indicators: INDICATOR_ORDER },
      });
      if (error) throw error;
      if (result?.success) {
        setData(result.data);
        toast.success('נתונים כלכליים נטענו מ-BLS');
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast.error('Failed to load economic data: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
  };

  const formatValue = (value: number, format: string) => {
    if (format === 'percent_yoy' || format === 'percent') return `${value}%`;
    if (format === 'jobs_change') return `${value > 0 ? '+' : ''}${(value / 1000).toFixed(0)}K`;
    if (format === 'millions') return `$${(value / 1000).toFixed(0)}B`;
    if (format === 'thousands') return `${value.toLocaleString()}K`;
    if (format === 'index_50') return value.toFixed(1);
    return value.toLocaleString();
  };

  const getChartColor = (name: string) => {
    if (name.includes('CPI') || name.includes('PPI')) return 'hsl(var(--chart-red))';
    if (name === 'NFP' || name === 'JOLTS') return 'hsl(var(--chart-green))';
    if (name === 'Unemployment' || name === 'Initial Claims') return 'hsl(var(--chart-red))';
    if (name === 'ISM Mfg') return 'hsl(var(--primary))';
    return 'hsl(var(--primary))';
  };

  const renderChart = (name: string, indicator: IndicatorData) => {
    const color = getChartColor(name);
    const isBarChart = name === 'NFP';
    const chartData = indicator.data.slice(-24);
    const isQuarterly = indicator.frequency === 'quarterly';
    const badge = isQuarterly ? 'רבעוני' : 'חודשי';

    if (chartData.length === 0) return null;

    return (
      <div key={name} className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">{name}</h4>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {badge}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{indicator.label}</p>
          </div>
          {chartData.length > 0 && (
            <div className="text-right">
              <span className="text-lg font-bold">
                {formatValue(chartData[chartData.length - 1].value, indicator.format)}
              </span>
              <p className="text-xs text-muted-foreground">
                {formatDate(chartData[chartData.length - 1].date)}
              </p>
            </div>
          )}
        </div>

        <ResponsiveContainer width="100%" height={160}>
          {isBarChart ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                formatter={(value: number) => [`${value.toLocaleString()} jobs`, 'Change']}
                labelFormatter={formatDate}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Bar dataKey="value" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tickFormatter={v => {
                  if (indicator.format.includes('percent')) return `${v}%`;
                  if (indicator.format === 'index_50') return v.toFixed(0);
                  return v.toLocaleString();
                }}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(value: number) => [formatValue(value, indicator.format), name]}
                labelFormatter={formatDate}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              />
              {name === 'ISM Mfg' && <ReferenceLine y={50} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" label={{ value: '50', fontSize: 10 }} />}
              <Area type="monotone" dataKey="value" stroke={color} fill={`${color.replace(')', ' / 0.15)')}`} strokeWidth={2} dot={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  // Order indicators according to INDICATOR_ORDER
  const orderedEntries = data
    ? INDICATOR_ORDER.filter(name => data[name]).map(name => [name, data[name]] as [string, IndicatorData])
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Historical Economic Data — נתונים היסטוריים</h3>
          <p className="text-xs text-muted-foreground">מקור: U.S. Bureau of Labor Statistics (BLS) · חודשי ורבעוני</p>
        </div>
        <Button onClick={fetchData} disabled={loading} variant="secondary" size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {loading ? 'טוען...' : 'טען נתונים'}
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orderedEntries.map(([name, indicator]) => renderChart(name, indicator))}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-muted-foreground text-center py-4">
          לחץ "טען נתונים" כדי להציג גרפים היסטוריים של אינדיקטורים כלכליים (CPI, NFP, JOLTS, Initial Claims ועוד)
        </p>
      )}
    </div>
  );
}
