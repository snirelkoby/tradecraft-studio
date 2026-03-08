import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { useAccounts } from '@/hooks/useAccounts';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp } from 'lucide-react';

export default function CompoundingSim() {
  const { data: trades } = useTrades();
  const { data: accounts } = useAccounts();
  const stats = useTradeStats(trades);

  const defaultBalance = accounts?.[0]?.starting_balance ?? 10000;
  const [balance, setBalance] = useState(String(defaultBalance));
  const [months, setMonths] = useState('12');
  const [riskPct, setRiskPct] = useState('2');
  const [tradesPerMonth, setTradesPerMonth] = useState('20');

  const sim = useMemo(() => {
    const b = parseFloat(balance) || 10000;
    const m = parseInt(months) || 12;
    const risk = (parseFloat(riskPct) || 2) / 100;
    const tpm = parseInt(tradesPerMonth) || 20;
    const wr = stats.winRate / 100 || 0.5;
    const avgWin = stats.avgWin || 100;
    const avgLoss = stats.avgLoss || 50;
    const rr = avgLoss > 0 ? avgWin / avgLoss : 2;

    // Expected return per trade as % of risked amount
    const expectedR = wr * rr - (1 - wr); // in R multiples

    const compoundData: { month: number; compound: number; linear: number; conservative: number }[] = [];
    let compoundBal = b;
    let linearBal = b;
    let conservativeBal = b;

    for (let i = 0; i <= m; i++) {
      compoundData.push({
        month: i,
        compound: Math.round(compoundBal),
        linear: Math.round(linearBal),
        conservative: Math.round(conservativeBal),
      });
      if (i < m) {
        const monthlyR = expectedR * risk * tpm;
        compoundBal *= (1 + monthlyR);
        linearBal += b * monthlyR;
        conservativeBal *= (1 + monthlyR * 0.6); // 60% of expected (conservative)
      }
    }

    const finalCompound = compoundData[compoundData.length - 1].compound;
    const totalReturn = ((finalCompound - b) / b) * 100;
    const monthlyReturn = m > 0 ? ((finalCompound / b) ** (1 / m) - 1) * 100 : 0;

    return { compoundData, finalCompound, totalReturn, monthlyReturn, expectedR, wr, rr };
  }, [balance, months, riskPct, tradesPerMonth, stats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Compounding Simulator</h1>
          <p className="text-muted-foreground text-sm">סימולציה של צמיחת חשבון מבוססת ביצועים בפועל</p>
        </div>
      </div>

      {/* Parameters */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">פרמטרים</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">הון התחלתי ($)</label>
              <Input type="number" value={balance} onChange={e => setBalance(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">חודשים</label>
              <Input type="number" value={months} onChange={e => setMonths(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">סיכון לעסקה (%)</label>
              <Input type="number" step="0.5" value={riskPct} onChange={e => setRiskPct(e.target.value)} className="bg-secondary" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase mb-1 block">עסקאות בחודש</label>
              <Input type="number" value={tradesPerMonth} onChange={e => setTradesPerMonth(e.target.value)} className="bg-secondary" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Win Rate: <strong className="text-foreground">{sim.wr.toFixed(0)}%</strong> (מהעסקאות)</span>
            <span>R:R: <strong className="text-foreground">{sim.rr.toFixed(2)}</strong></span>
            <span>Expected R: <strong className="text-foreground" style={{ color: sim.expectedR > 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>{sim.expectedR.toFixed(2)}R</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">הון צפוי (Compound)</p>
            <p className="text-2xl font-bold font-mono" style={{ color: 'hsl(var(--chart-green))' }}>
              ${sim.finalCompound.toLocaleString()}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">תשואה כוללת</p>
            <p className="text-2xl font-bold font-mono" style={{ color: sim.totalReturn >= 0 ? 'hsl(var(--chart-green))' : 'hsl(var(--chart-red))' }}>
              {sim.totalReturn.toFixed(1)}%
            </p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">תשואה חודשית ממוצעת</p>
            <p className="text-2xl font-bold font-mono">{sim.monthlyReturn.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="bg-card border-border">
        <CardHeader><CardTitle className="text-base">עקומת צמיחה</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={sim.compoundData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} label={{ value: 'חודש', position: 'insideBottom', offset: -5, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} formatter={(v: number) => [`$${v.toLocaleString()}`, '']} />
              <Legend />
              <Line type="monotone" dataKey="compound" name="Compound" stroke="hsl(var(--chart-green))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="linear" name="Linear" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              <Line type="monotone" dataKey="conservative" name="Conservative (60%)" stroke="hsl(var(--chart-yellow))" strokeWidth={1.5} dot={false} strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <p>💡 <strong>Compound</strong> — צמיחה עם ריבית דריבית מלאה. <strong>Linear</strong> — גודל פוזיציה קבוע. <strong>Conservative</strong> — 60% מהתשואה הצפויה (יותר מציאותי).</p>
          <p className="mt-1">הסימולציה מבוססת על Win Rate ו-R:R מהעסקאות שלך בפועל.</p>
        </CardContent>
      </Card>
    </div>
  );
}
