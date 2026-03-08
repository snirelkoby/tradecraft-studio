import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CotRecord {
  report_date: string;
  nc_long: number;
  nc_short: number;
  nc_net: number;
  open_interest: number;
  symbol: string;
}

export function CotHistoryChart() {
  const { user } = useAuth();
  const [data, setData] = useState<CotRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSymbol, setSelectedSymbol] = useState('ES');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from('cot_history')
      .select('*')
      .eq('user_id', user.id)
      .order('report_date', { ascending: true })
      .then(({ data: records }) => {
        setData((records as any as CotRecord[]) || []);
        setLoading(false);
      });
  }, [user]);

  const filtered = data.filter(r => r.symbol === selectedSymbol);
  const symbols = [...new Set(data.map(r => r.symbol))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        טען נתוני COT כדי להתחיל לבנות היסטוריה. כל טעינה שומרת את הנתונים לגרף.
      </p>
    );
  }

  const formatDate = (date: string) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">היסטוריית פוזיציות Non-Commercial</h3>
        {symbols.length > 1 && (
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[100px] bg-secondary">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {symbols.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Net Position Chart */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Net Position (Long - Short)</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="report_date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'K'} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: number) => value.toLocaleString()}
              labelFormatter={formatDate}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            />
            <Area
              type="monotone"
              dataKey="nc_net"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary) / 0.2)"
              name="Net Position"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Long vs Short Chart */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Long vs Short</p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={filtered}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="report_date" tickFormatter={formatDate} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={v => (v / 1000).toFixed(0) + 'K'} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: number) => value.toLocaleString()}
              labelFormatter={formatDate}
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            />
            <Legend />
            <Line type="monotone" dataKey="nc_long" stroke="hsl(var(--chart-green))" name="Longs" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="nc_short" stroke="hsl(var(--chart-red))" name="Shorts" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
