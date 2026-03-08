import { useState, useEffect } from 'react';
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
  data: DataPoint[];
}

export function IndicatorCharts() {
  const [data, setData] = useState<Record<string, IndicatorData> | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('economic-data', {
        body: { indicators: ['CPI YoY', 'Core CPI', 'PPI YoY', 'NFP', 'Unemployment', 'Retail Sales', 'ISM Mfg'] },
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
    return value.toLocaleString();
  };

  const getChartColor = (name: string, format: string) => {
    if (name.includes('CPI') || name.includes('PPI')) return 'hsl(var(--chart-red))';
    if (name === 'NFP') return 'hsl(var(--chart-green))';
    if (name === 'Unemployment') return 'hsl(var(--chart-red))';
    return 'hsl(var(--primary))';
  };

  const renderChart = (name: string, indicator: IndicatorData) => {
    const color = getChartColor(name, indicator.format);
    const isBarChart = name === 'NFP';
    const chartData = indicator.data.slice(-24); // last 24 months

    return (
      <div key={name} className="rounded-lg border border-border bg-secondary/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-sm">{name}</h4>
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
                tickFormatter={v => indicator.format.includes('percent') ? `${v}%` : v.toLocaleString()}
                tick={{ fontSize: 10 }}
                stroke="hsl(var(--muted-foreground))"
              />
              <Tooltip
                formatter={(value: number) => [formatValue(value, indicator.format), name]}
                labelFormatter={formatDate}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="value" stroke={color} fill={`${color.replace(')', ' / 0.15)')}`} strokeWidth={2} dot={false} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Historical Economic Data — נתונים היסטוריים</h3>
          <p className="text-xs text-muted-foreground">מקור: U.S. Bureau of Labor Statistics (BLS)</p>
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
          {Object.entries(data).map(([name, indicator]) => renderChart(name, indicator))}
        </div>
      )}

      {!data && !loading && (
        <p className="text-sm text-muted-foreground text-center py-4">
          לחץ "טען נתונים" כדי להציג גרפים היסטוריים של אינדיקטורים כלכליים
        </p>
      )}
    </div>
  );
}
