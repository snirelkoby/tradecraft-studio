import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Calculator } from 'lucide-react';

export function PositionSizerWidget() {
  const [account, setAccount] = useState('10000');
  const [riskPct, setRiskPct] = useState('1');
  const [entry, setEntry] = useState('100');
  const [stop, setStop] = useState('95');

  const accountVal = parseFloat(account) || 0;
  const riskVal = accountVal * ((parseFloat(riskPct) || 0) / 100);
  const stopDist = Math.abs((parseFloat(entry) || 0) - (parseFloat(stop) || 0));
  const size = stopDist > 0 ? Math.floor(riskVal / stopDist) : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Position Sizer</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Account ($)</label>
          <Input type="number" value={account} onChange={e => setAccount(e.target.value)} className="bg-secondary h-8 text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Risk (%)</label>
          <Input type="number" value={riskPct} onChange={e => setRiskPct(e.target.value)} className="bg-secondary h-8 text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Entry</label>
          <Input type="number" value={entry} onChange={e => setEntry(e.target.value)} className="bg-secondary h-8 text-sm" />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase block mb-1">Stop Loss</label>
          <Input type="number" value={stop} onChange={e => setStop(e.target.value)} className="bg-secondary h-8 text-sm" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">Risk: <span className="font-mono font-bold text-foreground">${riskVal.toFixed(2)}</span></span>
        <span className="text-muted-foreground">Size: <span className="font-mono font-bold text-primary text-lg">{size} shares</span></span>
      </div>
    </div>
  );
}
