import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Dice5 } from 'lucide-react';

function bootstrapAnalysis(pnls: number[], iterations: number = 5000) {
  const n = pnls.length;
  const actualTotal = pnls.reduce((s, v) => s + v, 0);
  const actualWinRate = pnls.filter(p => p > 0).length / n;

  const simTotals: number[] = [];
  const simWinRates: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let simTotal = 0;
    let simWins = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(Math.random() * n);
      simTotal += pnls[idx];
      if (pnls[idx] > 0) simWins++;
    }
    simTotals.push(simTotal);
    simWinRates.push(simWins / n);
  }

  simTotals.sort((a, b) => a - b);
  simWinRates.sort((a, b) => a - b);

  const pnlP5 = simTotals[Math.floor(iterations * 0.05)];
  const pnlP50 = simTotals[Math.floor(iterations * 0.5)];
  const pnlP95 = simTotals[Math.floor(iterations * 0.95)];

  const wrP5 = simWinRates[Math.floor(iterations * 0.05)];
  const wrP50 = simWinRates[Math.floor(iterations * 0.5)];
  const wrP95 = simWinRates[Math.floor(iterations * 0.95)];

  // Skill score: how tight is the distribution around actual?
  const pnlRange = pnlP95 - pnlP5;
  const deviation = Math.abs(actualTotal - pnlP50);
  const consistencyScore = pnlRange > 0 ? Math.max(0, 100 - (deviation / pnlRange) * 100) : 50;

  // If actual > p75, likely skill; if between p25-p75, mixed; below p25, lucky streak may have ended
  const aboveMedianPct = simTotals.filter(s => s <= actualTotal).length / iterations * 100;

  // Distribution for chart
  const binCount = 50;
  const min = simTotals[0];
  const max = simTotals[simTotals.length - 1];
  const binWidth = (max - min) / binCount || 1;
  const distChart = Array.from({ length: binCount }, (_, i) => {
    const lo = min + i * binWidth;
    const hi = lo + binWidth;
    const count = simTotals.filter(v => v >= lo && v < hi).length;
    return { pnl: Math.round(lo + binWidth / 2), frequency: count };
  });

  return {
    actualTotal, actualWinRate, pnlP5, pnlP50, pnlP95, wrP5, wrP50, wrP95,
    consistencyScore, aboveMedianPct, distChart, iterations
  };
}

export default function LuckVsSkill() {
  const { data: trades } = useTrades();
  const [result, setResult] = useState<ReturnType<typeof bootstrapAnalysis> | null>(null);
  const [running, setRunning] = useState(false);

  const pnls = useMemo(() => {
    if (!trades) return [];
    return trades.filter(t => t.status === 'closed' && t.pnl !== null).map(t => t.pnl!);
  }, [trades]);

  const runAnalysis = () => {
    if (pnls.length < 10) return;
    setRunning(true);
    setTimeout(() => {
      setResult(bootstrapAnalysis(pnls));
      setRunning(false);
    }, 100);
  };

  const getVerdict = () => {
    if (!result) return { label: '', color: '', emoji: '' };
    if (result.aboveMedianPct > 75) return { label: 'כישרון ברור — הביצועים שלך עקביים ומעל הממוצע', color: 'hsl(var(--chart-green))', emoji: '🎯' };
    if (result.aboveMedianPct > 50) return { label: 'Edge קל — יש לך יתרון אבל לא מובהק סטטיסטית', color: 'hsl(var(--chart-blue))', emoji: '📊' };
    if (result.aboveMedianPct > 25) return { label: 'אזור אפור — קשה להפריד בין מזל לכישרון', color: 'hsl(var(--chart-yellow))', emoji: '🎲' };
    return { label: 'ייתכן מזל — הביצועים בטווח הנמוך של הסימולציה', color: 'hsl(var(--chart-red))', emoji: '🍀' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Dice5 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Luck vs Skill Analyzer</h1>
          <p className="text-muted-foreground text-sm">ניתוח Bootstrap — האם הביצועים שלך הם כישרון או מזל?</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground mb-4">
            הניתוח מבצע 5,000 סימולציות על בסיס העסקאות שלך (Bootstrap Resampling) כדי לבדוק אם התוצאות שלך עקביות או תלויות מזל.
          </p>
          <Button onClick={runAnalysis} disabled={running || pnls.length < 10}>
            {running ? 'מריץ סימולציה...' : `הרץ ניתוח (${pnls.length} עסקאות)`}
          </Button>
          {pnls.length < 10 && <p className="text-xs text-destructive mt-2">צריך לפחות 10 עסקאות סגורות</p>}
        </CardContent>
      </Card>

      {result && (
        <>
          {/* Verdict */}
          <Card className="bg-card border-border">
            <CardContent className="p-6 flex items-center gap-4">
              <span className="text-4xl">{getVerdict().emoji}</span>
              <div>
                <p className="text-xs text-muted-foreground">תוצאת הניתוח</p>
                <p className="text-lg font-bold" style={{ color: getVerdict().color }}>{getVerdict().label}</p>
                <p className="text-sm text-muted-foreground">
                  הביצועים שלך טובים מ-{result.aboveMedianPct.toFixed(0)}% מהסימולציות
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'P&L בפועל', value: `$${result.actualTotal.toFixed(0)}` },
              { label: 'P&L חציוני (סימולציה)', value: `$${result.pnlP50.toFixed(0)}` },
              { label: 'טווח 90%', value: `$${result.pnlP5.toFixed(0)} — $${result.pnlP95.toFixed(0)}` },
              { label: 'ציון עקביות', value: `${result.consistencyScore.toFixed(0)}%` },
            ].map(s => (
              <Card key={s.label} className="bg-card border-border">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-bold font-mono">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Distribution Chart */}
          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">התפלגות תוצאות Bootstrap ({result.iterations} סימולציות)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={result.distChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="pnl" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Area type="monotone" dataKey="frequency" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <ReferenceLine x={Math.round(result.actualTotal)} stroke="hsl(var(--chart-green))" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'בפועל', fill: 'hsl(var(--chart-green))' }} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
