import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTrades } from '@/hooks/useTrades';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Fingerprint } from 'lucide-react';

export default function TradeDna() {
  const { data: trades } = useTrades();

  const dna = useMemo(() => {
    if (!trades) return null;
    const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null);
    const wins = closed.filter(t => (t.pnl ?? 0) > 0);
    if (wins.length < 3) return null;

    // Best hour
    const hourMap: Record<number, { sum: number; count: number }> = {};
    wins.forEach(t => {
      const h = new Date(t.entry_date).getHours();
      if (!hourMap[h]) hourMap[h] = { sum: 0, count: 0 };
      hourMap[h].sum += t.pnl ?? 0;
      hourMap[h].count++;
    });
    const bestHour = Object.entries(hourMap).sort((a, b) => b[1].sum - a[1].sum)[0];

    // Best symbol
    const symMap: Record<string, { sum: number; count: number; winCount: number }> = {};
    closed.forEach(t => {
      if (!symMap[t.symbol]) symMap[t.symbol] = { sum: 0, count: 0, winCount: 0 };
      symMap[t.symbol].sum += t.pnl ?? 0;
      symMap[t.symbol].count++;
      if ((t.pnl ?? 0) > 0) symMap[t.symbol].winCount++;
    });
    const bestSymbol = Object.entries(symMap).sort((a, b) => b[1].sum - a[1].sum)[0];

    // Best strategy
    const stratMap: Record<string, { sum: number; count: number; winCount: number }> = {};
    closed.forEach(t => {
      const s = t.strategy || 'No Strategy';
      if (!stratMap[s]) stratMap[s] = { sum: 0, count: 0, winCount: 0 };
      stratMap[s].sum += t.pnl ?? 0;
      stratMap[s].count++;
      if ((t.pnl ?? 0) > 0) stratMap[s].winCount++;
    });
    const bestStrategy = Object.entries(stratMap).sort((a, b) => b[1].sum - a[1].sum)[0];

    // Best duration bucket
    const durBuckets = [
      { label: 'Scalp (<15m)', min: 0, max: 15 },
      { label: 'Quick (15m-1h)', min: 15, max: 60 },
      { label: 'Medium (1h-4h)', min: 60, max: 240 },
      { label: 'Swing (4h+)', min: 240, max: Infinity },
    ];
    const durData = durBuckets.map(b => {
      const bucket = wins.filter(t => {
        if (!t.exit_date) return false;
        const mins = (new Date(t.exit_date).getTime() - new Date(t.entry_date).getTime()) / 60000;
        return mins >= b.min && mins < b.max;
      });
      return { ...b, pnl: bucket.reduce((s, t) => s + (t.pnl ?? 0), 0), count: bucket.length };
    });
    const bestDuration = durData.sort((a, b) => b.pnl - a.pnl)[0];

    // Best day
    const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const dayMap: Record<number, { sum: number; count: number }> = {};
    wins.forEach(t => {
      const d = new Date(t.entry_date).getDay();
      if (!dayMap[d]) dayMap[d] = { sum: 0, count: 0 };
      dayMap[d].sum += t.pnl ?? 0;
      dayMap[d].count++;
    });
    const bestDay = Object.entries(dayMap).sort((a, b) => b[1].sum - a[1].sum)[0];

    // Radar data
    const maxPnl = Math.max(...Object.values(symMap).map(v => v.sum), 1);
    const radarData = [
      { trait: 'Win Rate', value: Math.round((wins.length / closed.length) * 100) },
      { trait: 'Consistency', value: Math.min(100, Math.round((wins.length / Math.max(closed.length, 1)) * 120)) },
      { trait: 'Avg Win Size', value: Math.min(100, Math.round((wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length) / (Math.abs(closed.reduce((s, t) => s + (t.pnl ?? 0), 0) / closed.length) || 1) * 50)) },
      { trait: 'Symbol Focus', value: Math.min(100, Math.round((bestSymbol?.[1]?.sum / maxPnl) * 100)) },
      { trait: 'Time Discipline', value: bestHour ? Math.min(100, Math.round((bestHour[1].count / wins.length) * 200)) : 50 },
      { trait: 'Strategy Edge', value: bestStrategy ? Math.min(100, Math.round((bestStrategy[1].winCount / bestStrategy[1].count) * 100)) : 50 },
    ];

    // Hour distribution chart
    const hourChart = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      pnl: hourMap[i]?.sum ?? 0,
      count: hourMap[i]?.count ?? 0,
    })).filter(h => h.count > 0);

    return {
      bestHour: bestHour ? `${bestHour[0]}:00` : 'N/A',
      bestHourPnl: bestHour?.[1]?.sum ?? 0,
      bestSymbol: bestSymbol?.[0] ?? 'N/A',
      bestSymbolPnl: bestSymbol?.[1]?.sum ?? 0,
      bestSymbolWR: bestSymbol ? Math.round((bestSymbol[1].winCount / bestSymbol[1].count) * 100) : 0,
      bestStrategy: bestStrategy?.[0] ?? 'N/A',
      bestStrategyPnl: bestStrategy?.[1]?.sum ?? 0,
      bestStrategyWR: bestStrategy ? Math.round((bestStrategy[1].winCount / bestStrategy[1].count) * 100) : 0,
      bestDuration: bestDuration?.label ?? 'N/A',
      bestDurationPnl: bestDuration?.pnl ?? 0,
      bestDay: bestDay ? dayNames[parseInt(bestDay[0])] : 'N/A',
      bestDayPnl: bestDay?.[1]?.sum ?? 0,
      radarData,
      hourChart,
      totalWins: wins.length,
      totalClosed: closed.length,
    };
  }, [trades]);

  if (!dna) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Trade DNA Fingerprint</h1>
        <p className="text-muted-foreground">צריך לפחות 3 עסקאות מנצחות סגורות כדי ליצור את הפרופיל.</p>
      </div>
    );
  }

  const fingerprint = [
    { label: '🕐 שעה מנצחת', value: dna.bestHour, pnl: dna.bestHourPnl },
    { label: '📈 נכס מנצח', value: dna.bestSymbol, pnl: dna.bestSymbolPnl, extra: `WR: ${dna.bestSymbolWR}%` },
    { label: '🎯 אסטרטגיה מנצחת', value: dna.bestStrategy, pnl: dna.bestStrategyPnl, extra: `WR: ${dna.bestStrategyWR}%` },
    { label: '⏱ משך אופטימלי', value: dna.bestDuration, pnl: dna.bestDurationPnl },
    { label: '📅 יום מנצח', value: dna.bestDay, pnl: dna.bestDayPnl },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Fingerprint className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Trade DNA Fingerprint</h1>
          <p className="text-muted-foreground text-sm">טביעת האצבע המנצחת שלך — מבוסס {dna.totalWins} ניצחונות מתוך {dna.totalClosed} עסקאות</p>
        </div>
      </div>

      {/* Winning Profile Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {fingerprint.map(f => (
          <Card key={f.label} className="bg-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{f.label}</p>
              <p className="text-lg font-bold font-mono">{f.value}</p>
              <p className="text-sm font-mono" style={{ color: `hsl(var(--chart-green))` }}>+${f.pnl.toFixed(0)}</p>
              {f.extra && <p className="text-xs text-muted-foreground">{f.extra}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">פרופיל סוחר — רדאר</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={dna.radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="trait" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Hour Distribution */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-base">רווחים לפי שעה (ניצחונות)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dna.hourChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Bar dataKey="pnl" fill="hsl(var(--chart-green))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
