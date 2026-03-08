import { useEffect, useRef } from 'react';
import { getTradingViewSymbol } from '@/lib/symbolMapping';

interface TradingViewWidgetProps {
  symbol: string;
  assetType?: string;
  entryPrice?: number;
  exitPrice?: number | null;
  entryDate?: string;
  exitDate?: string | null;
  direction?: string;
}

export function TradingViewWidget({ symbol, assetType, entryPrice, exitPrice, entryDate, exitDate, direction }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const tvSymbol = getTradingViewSymbol(symbol, assetType);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: '1',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      backgroundColor: 'rgba(10, 12, 20, 1)',
      gridColor: 'rgba(30, 41, 59, 0.5)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      support_host: 'https://www.tradingview.com',
    });

    containerRef.current.appendChild(script);
  }, [symbol, assetType]);

  return (
    <div className="space-y-0">
      {/* Entry/Exit markers overlay */}
      {entryPrice != null && (
        <div className="flex items-center gap-4 px-3 py-2 rounded-t-xl border border-b-0 border-border bg-secondary/50 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-[hsl(var(--chart-green))] text-base">▲</span>
            <span className="text-muted-foreground">Entry:</span>
            <span className="font-mono font-bold">${entryPrice}</span>
            {entryDate && <span className="text-muted-foreground ml-1">({new Date(entryDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})</span>}
          </div>
          {exitPrice != null && (
            <div className="flex items-center gap-1.5">
              <span className="text-[hsl(var(--chart-red))] text-base">▼</span>
              <span className="text-muted-foreground">Exit:</span>
              <span className="font-mono font-bold">${exitPrice}</span>
              {exitDate && <span className="text-muted-foreground ml-1">({new Date(exitDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})</span>}
            </div>
          )}
          {direction && (
            <div className={`ml-auto font-bold uppercase ${direction === 'long' ? 'text-[hsl(var(--chart-green))]' : 'text-[hsl(var(--chart-red))]'}`}>
              {direction}
            </div>
          )}
        </div>
      )}
      <div className={`border border-border overflow-hidden ${entryPrice != null ? 'rounded-b-xl' : 'rounded-xl'}`} style={{ height: 400 }}>
        <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
          <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
