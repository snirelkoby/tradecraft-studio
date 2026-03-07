import { useTrades } from '@/hooks/useTrades';
import { computeFullAnalytics, downloadAnalyticsZip } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function RiskEngine() {
  const { data: trades } = useTrades();
  const analytics = computeFullAnalytics(trades ?? []);
  const totalMetrics = analytics.reduce((s, c) => s + c.metrics.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quantitative Risk Engine</h1>
          <p className="text-muted-foreground text-sm">{totalMetrics} analytics metrics</p>
        </div>
        <Button variant="secondary" onClick={() => downloadAnalyticsZip(analytics)}>
          <Download className="h-4 w-4 mr-2" />
          Export Analytics
        </Button>
      </div>

      {analytics.map(cat => (
        <div key={cat.category} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">{cat.category}</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {cat.metrics.map((m, i) => (
              <div key={i} className="bg-secondary rounded-lg p-3 group relative">
                <p className="text-[10px] text-muted-foreground uppercase truncate">{m.name}</p>
                <p className="font-mono font-bold text-sm truncate">{m.value}</p>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border">
                  {m.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
