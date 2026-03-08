import { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/KpiCard';
import { useTrades, useTradeStats } from '@/hooks/useTrades';
import { useAccounts } from '@/hooks/useAccounts';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

function useCalc<T>(defaultVals: T) {
  const [vals, setVals] = useState(defaultVals);
  const set = (k: keyof T, v: string) => setVals(prev => ({ ...prev, [k]: v }));
  const n = (k: keyof T) => parseFloat(vals[k] as string) || 0;
  return { vals, set, n };
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground uppercase mb-1 block">{label}</label>
      <Input type="number" step="any" value={value} onChange={e => onChange(e.target.value)} className="bg-secondary" />
    </div>
  );
}

function CalcCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-lg">{title}</h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-sm">
            <p>{description}</p>
          </TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  );
}

function PositionSizeCalc({ accountSize }: { accountSize: string }) {
  const { vals, set, n } = useCalc({ account: accountSize, risk: '1', entry: '100', stop: '95' });
  const riskAmt = n('account') * (n('risk') / 100);
  const stopDist = Math.abs(n('entry') - n('stop'));
  const size = stopDist > 0 ? Math.floor(riskAmt / stopDist) : 0;
  return (
    <CalcCard title="Position Size" description="מחשב כמה יחידות/חוזים לקנות על בסיס גודל החשבון, אחוז הסיכון ומרחק הסטופ. עוזר לשמור על ניהול סיכונים עקבי.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account Size ($)" value={vals.account} onChange={v => set('account', v)} />
        <Field label="Risk %" value={vals.risk} onChange={v => set('risk', v)} />
        <Field label="Entry Price" value={vals.entry} onChange={v => set('entry', v)} />
        <Field label="Stop Loss" value={vals.stop} onChange={v => set('stop', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <KpiCard title="Position Size" value={size.toString()} variant="blue" />
        <KpiCard title="Risk Amount" value={`$${riskAmt.toFixed(2)}`} variant="red" />
        <KpiCard title="Stop Distance" value={`$${stopDist.toFixed(2)}`} variant="blue" />
      </div>
    </CalcCard>
  );
}

function RiskRewardCalc() {
  const { vals, set, n } = useCalc({ entry: '100', stop: '95', target: '115' });
  const risk = Math.abs(n('entry') - n('stop'));
  const reward = Math.abs(n('target') - n('entry'));
  const rr = risk > 0 ? reward / risk : 0;
  return (
    <CalcCard title="Risk/Reward" description="מחשב את יחס הסיכוי/סיכון של עסקה. יחס מעל 1:2 נחשב טוב - כלומר הרווח הפוטנציאלי גדול פי 2 מההפסד.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Entry" value={vals.entry} onChange={v => set('entry', v)} />
        <Field label="Stop Loss" value={vals.stop} onChange={v => set('stop', v)} />
        <Field label="Target" value={vals.target} onChange={v => set('target', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <KpiCard title="Risk" value={`$${risk.toFixed(2)}`} variant="red" />
        <KpiCard title="Reward" value={`$${reward.toFixed(2)}`} variant="green" />
        <KpiCard title="R:R" value={`1:${rr.toFixed(2)}`} variant={rr >= 2 ? 'green' : 'red'} />
      </div>
    </CalcCard>
  );
}

function ProfitCalc() {
  const { vals, set, n } = useCalc({ entry: '100', exit: '110', qty: '10', fees: '0' });
  const raw = (n('exit') - n('entry')) * n('qty');
  const net = raw - n('fees');
  const pct = n('entry') > 0 ? ((n('exit') - n('entry')) / n('entry')) * 100 : 0;
  return (
    <CalcCard title="Profit" description="מחשב רווח/הפסד גולמי ונקי של עסקה כולל עמלות, ואת אחוז התשואה.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Entry" value={vals.entry} onChange={v => set('entry', v)} />
        <Field label="Exit" value={vals.exit} onChange={v => set('exit', v)} />
        <Field label="Quantity" value={vals.qty} onChange={v => set('qty', v)} />
        <Field label="Fees" value={vals.fees} onChange={v => set('fees', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <KpiCard title="Gross P&L" value={`$${raw.toFixed(2)}`} variant={raw >= 0 ? 'green' : 'red'} />
        <KpiCard title="Net P&L" value={`$${net.toFixed(2)}`} variant={net >= 0 ? 'green' : 'red'} />
        <KpiCard title="Return %" value={`${pct.toFixed(2)}%`} variant={pct >= 0 ? 'green' : 'red'} />
      </div>
    </CalcCard>
  );
}

function PipValueCalc() {
  const { vals, set, n } = useCalc({ lotSize: '100000', pipSize: '0.0001', price: '1.1000' });
  const pipValue = (n('pipSize') / n('price')) * n('lotSize');
  return (
    <CalcCard title="Pip Value" description="מחשב את הערך הכספי של כל פיפ בזוג מטבעות. חיוני לסוחרי פורקס לחישוב סיכון מדויק.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Lot Size" value={vals.lotSize} onChange={v => set('lotSize', v)} />
        <Field label="Pip Size" value={vals.pipSize} onChange={v => set('pipSize', v)} />
        <Field label="Price" value={vals.price} onChange={v => set('price', v)} />
      </div>
      <KpiCard title="Pip Value" value={`$${pipValue.toFixed(4)}`} variant="blue" />
    </CalcCard>
  );
}

function MarginCalc() {
  const { vals, set, n } = useCalc({ price: '100', qty: '100', leverage: '10' });
  const margin = (n('price') * n('qty')) / n('leverage');
  return (
    <CalcCard title="Margin" description="מחשב כמה מרג'ין (ביטחונות) נדרש לפתיחת פוזיציה בהתאם למחיר, כמות ומינוף.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Price" value={vals.price} onChange={v => set('price', v)} />
        <Field label="Quantity" value={vals.qty} onChange={v => set('qty', v)} />
        <Field label="Leverage" value={vals.leverage} onChange={v => set('leverage', v)} />
      </div>
      <KpiCard title="Required Margin" value={`$${margin.toFixed(2)}`} variant="blue" />
    </CalcCard>
  );
}

function DrawdownCalc() {
  const { vals, set, n } = useCalc({ drawdown: '20' });
  const recovery = n('drawdown') > 0 ? (n('drawdown') / (100 - n('drawdown'))) * 100 : 0;
  return (
    <CalcCard title="Drawdown Recovery" description="מראה כמה אחוז רווח צריך כדי לחזור לנקודת ההתחלה אחרי דראודאון. לדוגמה: הפסד של 50% דורש רווח של 100%.">
      <Field label="Drawdown %" value={vals.drawdown} onChange={v => set('drawdown', v)} />
      <KpiCard title="Recovery Needed" value={`${recovery.toFixed(2)}%`} variant="red" />
    </CalcCard>
  );
}

function ExpectancyCalc({ winRate, avgWin, avgLoss }: { winRate: string; avgWin: string; avgLoss: string }) {
  const { vals, set, n } = useCalc({ winRate, avgWin, avgLoss });
  const wr = n('winRate') / 100;
  const exp = (wr * n('avgWin')) - ((1 - wr) * n('avgLoss'));
  return (
    <CalcCard title="Expectancy" description="מחשב את הרווח הממוצע הצפוי לכל עסקה. מספר חיובי אומר שהאסטרטגיה רווחית בטווח הארוך. מבוסס על אחוז הצלחה וגודל ממוצע של רווח/הפסד.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Win Rate %" value={vals.winRate} onChange={v => set('winRate', v)} />
        <Field label="Avg Win ($)" value={vals.avgWin} onChange={v => set('avgWin', v)} />
        <Field label="Avg Loss ($)" value={vals.avgLoss} onChange={v => set('avgLoss', v)} />
      </div>
      <KpiCard title="Expectancy per Trade" value={`$${exp.toFixed(2)}`} variant={exp >= 0 ? 'green' : 'red'} />
    </CalcCard>
  );
}

function WinRateCalc({ avgWin, avgLoss }: { avgWin: string; avgLoss: string }) {
  const { vals, set, n } = useCalc({ avgWin, avgLoss, targetExp: '0' });
  const breakeven = n('avgLoss') / (n('avgWin') + n('avgLoss')) * 100;
  const forTarget = n('avgWin') > 0 ? ((n('targetExp') + n('avgLoss')) / (n('avgWin') + n('avgLoss'))) * 100 : 0;
  return (
    <CalcCard title="Win Rate Needed" description="מחשב מה אחוז ההצלחה המינימלי הנדרש כדי להיות ברווח (Breakeven) ומה נדרש כדי להגיע ליעד רווח מסוים.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Avg Win ($)" value={vals.avgWin} onChange={v => set('avgWin', v)} />
        <Field label="Avg Loss ($)" value={vals.avgLoss} onChange={v => set('avgLoss', v)} />
        <Field label="Target Expectancy ($)" value={vals.targetExp} onChange={v => set('targetExp', v)} />
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <KpiCard title="Breakeven WR" value={`${breakeven.toFixed(1)}%`} variant="blue" />
        <KpiCard title="Target WR" value={`${forTarget.toFixed(1)}%`} variant="green" />
      </div>
    </CalcCard>
  );
}

function RiskOfRuinCalc({ winRate }: { winRate: string }) {
  const { vals, set, n } = useCalc({ winRate, riskPerTrade: '2' });
  const wr = n('winRate') / 100;
  const lr = 1 - wr;
  const rr = lr > 0 && wr > 0 ? Math.pow(lr / wr, 100 / n('riskPerTrade')) : 0;
  return (
    <CalcCard title="Risk of Ruin" description="מחשב את ההסתברות לאבד את כל החשבון. מבוסס על אחוז ההצלחה והסיכון לכל עסקה. אחוז נמוך מ-1% נחשב בטוח.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Win Rate %" value={vals.winRate} onChange={v => set('winRate', v)} />
        <Field label="Risk per Trade %" value={vals.riskPerTrade} onChange={v => set('riskPerTrade', v)} />
      </div>
      <KpiCard title="Probability of Ruin" value={`${(rr * 100).toFixed(4)}%`} variant={rr < 0.01 ? 'green' : 'red'} />
    </CalcCard>
  );
}

function KellyCalc({ winRate, avgWin, avgLoss }: { winRate: string; avgWin: string; avgLoss: string }) {
  const { vals, set, n } = useCalc({ winRate, avgWin, avgLoss });
  const wr = n('winRate') / 100;
  const payoff = n('avgLoss') > 0 ? n('avgWin') / n('avgLoss') : 0;
  const kelly = payoff > 0 ? (wr - (1 - wr) / payoff) * 100 : 0;
  return (
    <CalcCard title="Kelly Criterion" description="קובע את גודל הפוזיציה האופטימלי מתמטית. Full Kelly אגרסיבי מדי בפועל - מומלץ Half או Quarter Kelly לניהול סיכונים שמרני יותר.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Win Rate %" value={vals.winRate} onChange={v => set('winRate', v)} />
        <Field label="Avg Win ($)" value={vals.avgWin} onChange={v => set('avgWin', v)} />
        <Field label="Avg Loss ($)" value={vals.avgLoss} onChange={v => set('avgLoss', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <KpiCard title="Full Kelly" value={`${kelly.toFixed(2)}%`} variant="blue" />
        <KpiCard title="Half Kelly" value={`${(kelly / 2).toFixed(2)}%`} variant="green" />
        <KpiCard title="Quarter Kelly" value={`${(kelly / 4).toFixed(2)}%`} variant="green" />
      </div>
    </CalcCard>
  );
}

function AtrSizeCalc({ accountSize }: { accountSize: string }) {
  const { vals, set, n } = useCalc({ account: accountSize, risk: '1', atr: '2.5', multiplier: '1.5' });
  const riskAmt = n('account') * (n('risk') / 100);
  const stopDist = n('atr') * n('multiplier');
  const size = stopDist > 0 ? Math.floor(riskAmt / stopDist) : 0;
  return (
    <CalcCard title="ATR Position Size" description="מחשב גודל פוזיציה על בסיס ATR (טווח תנודתיות ממוצע). מתאים את גודל הסטופ לתנודתיות הנוכחית של הנכס.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Account ($)" value={vals.account} onChange={v => set('account', v)} />
        <Field label="Risk %" value={vals.risk} onChange={v => set('risk', v)} />
        <Field label="ATR Value" value={vals.atr} onChange={v => set('atr', v)} />
        <Field label="ATR Multiplier" value={vals.multiplier} onChange={v => set('multiplier', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        <KpiCard title="Position Size" value={size.toString()} variant="blue" />
        <KpiCard title="Stop Distance" value={`$${stopDist.toFixed(2)}`} variant="red" />
        <KpiCard title="Risk Amount" value={`$${riskAmt.toFixed(2)}`} variant="red" />
      </div>
    </CalcCard>
  );
}

function PortfolioRiskCalc({ accountSize }: { accountSize: string }) {
  const [positions, setPositions] = useState([
    { symbol: 'ES', size: '2', riskPer: '500' },
    { symbol: 'NQ', size: '1', riskPer: '800' },
    { symbol: 'CL', size: '3', riskPer: '300' },
  ]);
  const { vals, set, n } = useCalc({ account: accountSize });

  const totalRisk = positions.reduce((s, p) => s + (parseFloat(p.size) || 0) * (parseFloat(p.riskPer) || 0), 0);
  const pctOfAccount = n('account') > 0 ? (totalRisk / n('account')) * 100 : 0;

  return (
    <CalcCard title="Portfolio Risk" description="מחשב את הסיכון הכולל של כל הפוזיציות הפתוחות ביחד. עוזר לוודא שלא חושפים יותר מדי מהחשבון בו-זמנית.">
      <Field label="Account Size ($)" value={vals.account} onChange={v => set('account', v)} />
      <div className="space-y-2 mt-3">
        {positions.map((p, i) => (
          <div key={i} className="grid grid-cols-3 gap-2">
            <Input value={p.symbol} onChange={e => { const np = [...positions]; np[i].symbol = e.target.value; setPositions(np); }} placeholder="Symbol" className="bg-secondary" />
            <Input type="number" value={p.size} onChange={e => { const np = [...positions]; np[i].size = e.target.value; setPositions(np); }} placeholder="Contracts" className="bg-secondary" />
            <Input type="number" value={p.riskPer} onChange={e => { const np = [...positions]; np[i].riskPer = e.target.value; setPositions(np); }} placeholder="Risk/unit $" className="bg-secondary" />
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setPositions([...positions, { symbol: '', size: '1', riskPer: '0' }])}>+ Add Position</Button>
      </div>
      <div className="grid grid-cols-2 gap-3 pt-2">
        <KpiCard title="Total Risk" value={`$${totalRisk.toFixed(2)}`} variant="red" />
        <KpiCard title="% of Account" value={`${pctOfAccount.toFixed(2)}%`} variant={pctOfAccount <= 5 ? 'green' : 'red'} />
      </div>
    </CalcCard>
  );
}

function MonteCarloCalc({ winRate, avgWin, avgLoss, accountSize }: { winRate: string; avgWin: string; avgLoss: string; accountSize: string }) {
  const { vals, set, n } = useCalc({ winRate, avgWin, avgLoss, trades: '100', sims: '1000', account: accountSize });
  const [results, setResults] = useState<{ median: number; p5: number; p95: number; ruinPct: number } | null>(null);

  const runSim = () => {
    const wr = n('winRate') / 100;
    const numTrades = Math.min(n('trades'), 500);
    const numSims = Math.min(n('sims'), 5000);
    const finals: number[] = [];
    let ruins = 0;

    for (let s = 0; s < numSims; s++) {
      let bal = n('account');
      for (let t = 0; t < numTrades; t++) {
        bal += Math.random() < wr ? n('avgWin') : -n('avgLoss');
        if (bal <= 0) { ruins++; break; }
      }
      finals.push(bal);
    }

    finals.sort((a, b) => a - b);
    setResults({
      median: finals[Math.floor(finals.length * 0.5)],
      p5: finals[Math.floor(finals.length * 0.05)],
      p95: finals[Math.floor(finals.length * 0.95)],
      ruinPct: (ruins / numSims) * 100,
    });
  };

  return (
    <CalcCard title="Monte Carlo Simulation" description="מריץ אלפי סימולציות אקראיות של ביצועי המסחר שלך כדי להעריך תוצאות אפשריות. מראה מהו התרחיש הטוב ביותר, הגרוע ביותר והסביר ביותר.">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Win Rate %" value={vals.winRate} onChange={v => set('winRate', v)} />
        <Field label="Avg Win ($)" value={vals.avgWin} onChange={v => set('avgWin', v)} />
        <Field label="Avg Loss ($)" value={vals.avgLoss} onChange={v => set('avgLoss', v)} />
        <Field label="# Trades" value={vals.trades} onChange={v => set('trades', v)} />
        <Field label="# Simulations" value={vals.sims} onChange={v => set('sims', v)} />
        <Field label="Starting Account ($)" value={vals.account} onChange={v => set('account', v)} />
      </div>
      <Button onClick={runSim} className="font-bold w-full">RUN SIMULATION</Button>
      {results && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard title="Median Result" value={`$${results.median.toFixed(0)}`} variant={results.median > n('account') ? 'green' : 'red'} />
          <KpiCard title="5th Percentile" value={`$${results.p5.toFixed(0)}`} variant="red" />
          <KpiCard title="95th Percentile" value={`$${results.p95.toFixed(0)}`} variant="green" />
          <KpiCard title="Ruin Probability" value={`${results.ruinPct.toFixed(2)}%`} variant={results.ruinPct < 5 ? 'green' : 'red'} />
        </div>
      )}
    </CalcCard>
  );
}

export default function Calculators() {
  const { data: trades } = useTrades();
  const { data: accounts } = useAccounts();
  const stats = useTradeStats(trades);

  const accountSize = useMemo(() => {
    if (!accounts || accounts.length === 0) return '10000';
    const totalBalance = accounts.reduce((s, a) => s + (a.starting_balance || 0), 0);
    const closedPnl = trades?.filter(t => t.status === 'closed').reduce((s, t) => s + (t.pnl ?? 0), 0) ?? 0;
    return (totalBalance + closedPnl).toFixed(0);
  }, [accounts, trades]);

  const winRate = stats.winRate > 0 ? stats.winRate.toFixed(1) : '55';
  const avgWin = stats.avgWin > 0 ? stats.avgWin.toFixed(0) : '200';
  const avgLoss = stats.avgLoss > 0 ? stats.avgLoss.toFixed(0) : '100';

  const CALCS = [
    { id: 'monte', label: 'Monte Carlo', component: () => <MonteCarloCalc winRate={winRate} avgWin={avgWin} avgLoss={avgLoss} accountSize={accountSize} /> },
    { id: 'position', label: 'Position Size', component: () => <PositionSizeCalc accountSize={accountSize} /> },
    { id: 'rr', label: 'Risk/Reward', component: RiskRewardCalc },
    { id: 'profit', label: 'Profit', component: ProfitCalc },
    { id: 'pip', label: 'Pip Value', component: PipValueCalc },
    { id: 'margin', label: 'Margin', component: MarginCalc },
    { id: 'drawdown', label: 'Drawdown', component: DrawdownCalc },
    { id: 'expectancy', label: 'Expectancy', component: () => <ExpectancyCalc winRate={winRate} avgWin={avgWin} avgLoss={avgLoss} /> },
    { id: 'winrate', label: 'Win Rate', component: () => <WinRateCalc avgWin={avgWin} avgLoss={avgLoss} /> },
    { id: 'ruin', label: 'Risk of Ruin', component: () => <RiskOfRuinCalc winRate={winRate} /> },
    { id: 'kelly', label: 'Kelly', component: () => <KellyCalc winRate={winRate} avgWin={avgWin} avgLoss={avgLoss} /> },
    { id: 'atr', label: 'ATR Size', component: () => <AtrSizeCalc accountSize={accountSize} /> },
    { id: 'portfolio', label: 'Portfolio Risk', component: () => <PortfolioRiskCalc accountSize={accountSize} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Quantitative Calculators</h1>
        <p className="text-muted-foreground text-sm">Risk management and position sizing tools — pre-filled from your trading data</p>
      </div>

      {stats.totalTrades > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard title="Your Win Rate" value={`${stats.winRate.toFixed(1)}%`} variant={stats.winRate >= 50 ? 'green' : 'red'} />
          <KpiCard title="Avg Win" value={`$${stats.avgWin.toFixed(0)}`} variant="green" />
          <KpiCard title="Avg Loss" value={`$${stats.avgLoss.toFixed(0)}`} variant="red" />
          <KpiCard title="Account Balance" value={`$${parseFloat(accountSize).toLocaleString()}`} variant="blue" />
        </div>
      )}

      <Tabs defaultValue="monte">
        <TabsList className="bg-secondary border border-border flex flex-wrap h-auto gap-1 p-1">
          {CALCS.map(c => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {CALCS.map(c => (
          <TabsContent key={c.id} value={c.id} className="mt-4">
            <c.component />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
