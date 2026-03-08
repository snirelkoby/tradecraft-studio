import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface DataPoint {
  date: string;
  value: number;
}

interface FredIndicator {
  label: string;
  format: string;
  frequency: string;
  data: DataPoint[];
}

const FRED_INDICATORS = ['10Y Yield', 'Fed Funds Rate', '2Y Yield', '10Y-2Y Spread', 'DXY'];

export function FredCharts() {
  const [data, setData] = useState<Record<string, FredIndicator> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('fred-data', {
        body: { indicators: FRED_INDICATORS },
      });
      if (error) throw error;
      if (result?.success) {
        setData(result.data);
        toast.success('נתוני FRED נטענו בהצלחה');
      } else {
        throw new Error(result?.error || 'Failed');
      }
    } catch (e: any) {
      toast.error('Failed to load FRED data: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[d.getMonth()]} ${d.getFullYear().toString().slice(2)}`;
  };

  const getColor = (name: string) => {
    if (name.includes('10Y') && !name.includes('Spread')) return 'hsl(var(--chart-1, var(--primary)))';
    if (name.includes('Fed')) return 'hsl(var(--chart-red, 0 84% 60%))';
    if (name.includes('2Y')) return 'hsl(var(--chart-green, 142 71% 45%))';
    if (name.includes('Spread')) return 'hsl(var(--chart-2, 220 70% 50%))';
    if (name === 'DXY') return 'hsl(var(--primary))';
    return 'hsl(var(--primary))';
  };

  const renderChart = (name: string, indicator: FredIndicator) => {
    const chartData = indicator.data.slice(-104); // ~2 years weekly
    if (chartData.length === 0) return null;
    const color = getColor(name);
    const isSpread = name.includes('Spread');

    return (
      <div key={name} className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">{name}</h4>
            <p className="text-xs text-muted-foreground">{indicator.label}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">
              {chartData[chartData.length - 1].value.toFixed(2)}%
            </span>
            <p className="text-xs text-muted-foreground">
              {formatDate(chartData[chartData.length - 1].date)}
            </p>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis
              tickFormatter={v => `${v}%`}
              tick={{ fontSize: 10 }}
              stroke="hsl(var(--muted-foreground))"
            />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)}%`, name]}
              labelFormatter={formatDate}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            />
            {isSpread && <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />}
            <Area type="monotone" dataKey="value" stroke={color} fill={`${color.replace(')', ' / 0.15)')}`} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const orderedEntries = data
    ? FRED_INDICATORS.filter(name => data[name]).map(name => [name, data[name]] as [string, FredIndicator])
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Rates & Yields — ריביות ותשואות</h3>
          <p className="text-xs text-muted-foreground">מקור: Federal Reserve Economic Data (FRED) · ~2 שנים</p>
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
          לחץ "טען נתונים" כדי להציג גרפים של 10Y Yield, Fed Funds Rate, 2Y Yield, Spread ו-DXY
        </p>
      )}
    </div>
  );
}
