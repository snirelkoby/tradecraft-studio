import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getTradingViewSymbol } from '@/lib/symbolMapping';


interface Execution {
  id: string;
  execution_type: string;
  price: number;
  quantity: number;
  executed_at: string;
}

interface TradingViewWidgetProps {
  symbol: string;
  assetType?: string;
  entryPrice?: number;
  exitPrice?: number | null;
  entryDate?: string;
  exitDate?: string | null;
  direction?: string;
  tradeId?: string;
}

export function TradingViewWidget({ symbol, assetType, entryPrice, exitPrice, entryDate, exitDate, direction, tradeId }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: executions } = useQuery({
    queryKey: ['trade-executions', tradeId],
    queryFn: async () => {
      if (!tradeId) return [];
      const { data, error } = await supabase
        .from('trade_executions')
        .select('*')
        .eq('trade_id', tradeId)
        .order('executed_at', { ascending: true });
      if (error) throw error;
      return data as Execution[];
    },
    enabled: !!tradeId,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const tvSymbol = getTradingViewSymbol(symbol, assetType);

    // Calculate interval based on trade duration
    let interval = '15';
    let range = '5D';
    let fromTs: number | undefined;
    let toTs: number | undefined;

    if (entryDate) {
      const entry = new Date(entryDate);
      const exit = exitDate ? new Date(exitDate) : new Date();
      const durationMs = exit.getTime() - entry.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      
      // Pick interval and range based on trade duration
      if (durationHours <= 1) { interval = '1'; range = '1D'; }
      else if (durationHours <= 4) { interval = '3'; range = '1D'; }
      else if (durationHours <= 8) { interval = '5'; range = '1D'; }
      else if (durationHours <= 24) { interval = '15'; range = '5D'; }
      else if (durationHours <= 72) { interval = '60'; range = '1M'; }
      else if (durationHours <= 168) { interval = '60'; range = '1M'; }
      else if (durationHours <= 720) { interval = 'D'; range = '3M'; }
      else { interval = 'D'; range = '6M'; }

      // Calculate exact from/to with padding for zoom
      const padding = Math.max(durationMs * 0.3, 30 * 60 * 1000); // at least 30min padding
      fromTs = Math.floor((entry.getTime() - padding) / 1000);
      toTs = Math.floor((exit.getTime() + padding) / 1000);
    }

    // Try using TradingView.widget() constructor which supports better time control
    const containerId = `tv_chart_${Date.now()}`;
    const innerDiv = document.createElement('div');
    innerDiv.id = containerId;
    innerDiv.style.height = '100%';
    innerDiv.style.width = '100%';
    containerRef.current.appendChild(innerDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    script.onload = () => {
      if (!(window as any).TradingView) return;
      const widget = new (window as any).TradingView.widget({
        container_id: containerId,
        autosize: true,
        symbol: tvSymbol,
        interval,
        timezone: 'Asia/Jerusalem',
        theme: 'dark',
        style: '1',
        locale: 'en',
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: true,
        calendar: false,
        backgroundColor: 'rgba(10, 12, 20, 1)',
        gridColor: 'rgba(30, 41, 59, 0.5)',
        range,
      });

      // After chart is ready, try to zoom to exact trade range
      if (fromTs && toTs) {
        try {
          widget.onChartReady?.(() => {
            try {
              widget.chart().setVisibleRange({
                from: fromTs,
                to: toTs,
              });
            } catch (e) {
              // setVisibleRange not available on free widget — range fallback is used
            }
          });
        } catch (e) {
          // onChartReady not available — range fallback is used
        }
      }
    };

    // Fallback: if tv.js fails, use embed widget
    script.onerror = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const embedScript = document.createElement('script');
      embedScript.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      embedScript.async = true;
      embedScript.innerHTML = JSON.stringify({
        autosize: true, symbol: tvSymbol, interval, timezone: 'Asia/Jerusalem',
        theme: 'dark', style: '1', locale: 'en', range,
        backgroundColor: 'rgba(10, 12, 20, 1)', gridColor: 'rgba(30, 41, 59, 0.5)',
        hide_top_toolbar: false, hide_legend: false, save_image: true, calendar: false,
        support_host: 'https://www.tradingview.com',
      });
      containerRef.current.appendChild(embedScript);
    };

    document.head.appendChild(script);
    return () => {
      try { document.head.removeChild(script); } catch {}
    };
  }, [symbol, assetType, entryDate, exitDate]);

  const isLong = direction === 'long';
  const entryColor = isLong ? 'hsl(var(--chart-green))' : 'hsl(var(--primary))';
  const exitColor = isLong ? 'hsl(var(--primary))' : 'hsl(var(--chart-green))';
  const entryArrow = isLong ? '▲' : '▼';
  const exitArrow = isLong ? '▼' : '▲';

  // Build markers list: main entry/exit + executions
  const markers: { type: 'entry' | 'exit'; price: number; time: string; qty?: number }[] = [];

  if (entryPrice != null && entryDate) {
    markers.push({ type: 'entry', price: entryPrice, time: entryDate });
  }
  if (exitPrice != null && exitDate) {
    markers.push({ type: 'exit', price: exitPrice, time: exitDate });
  }

  // Add executions
  (executions ?? []).forEach(ex => {
    markers.push({
      type: ex.execution_type === 'entry' ? 'entry' : 'exit',
      price: ex.price,
      time: ex.executed_at,
      qty: ex.quantity,
    });
  });

  // Sort by time
  markers.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return (
    <div className="space-y-0">
      {/* Entry/Exit/Execution markers overlay */}
      {markers.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 px-3 py-2 rounded-t-xl border border-b-0 border-border bg-secondary/50 text-xs">
          {markers.map((m, i) => {
            const isEntry = m.type === 'entry';
            const color = isEntry ? entryColor : exitColor;
            const arrow = isEntry ? entryArrow : exitArrow;
            const label = isEntry ? (m.qty ? 'Scale In' : 'Entry') : (m.qty ? 'Scale Out' : 'Exit');
            return (
              <div key={i} className="flex items-center gap-1.5">
                <span style={{ color }} className="text-base">{arrow}</span>
                <span className="text-muted-foreground">{label}:</span>
                <span className="font-mono font-bold">${m.price}</span>
                {m.qty && <span className="text-muted-foreground">×{m.qty}</span>}
                <span className="text-muted-foreground">
                  ({new Date(m.time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })} IST)
                </span>
              </div>
            );
          })}
          {direction && (
            <div className={`ml-auto font-bold uppercase`} style={{ color: isLong ? 'hsl(var(--chart-green))' : 'hsl(var(--primary))' }}>
              {direction}
            </div>
          )}
        </div>
      )}
      <div className={`border border-border overflow-hidden ${markers.length > 0 ? 'rounded-b-xl' : 'rounded-xl'}`} style={{ height: 400 }}>
        <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
          <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
        </div>
      </div>
    </div>
  );
}
