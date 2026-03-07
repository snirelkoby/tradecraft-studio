import { useEffect, useRef } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
  assetType?: string;
}

export function TradingViewWidget({ symbol, assetType }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const tvSymbol = assetType === 'Crypto' ? `BINANCE:${symbol}USDT` :
      assetType === 'Forex' ? `FX:${symbol.replace('/', '')}` :
      assetType === 'Futures' ? `CME_MINI:${symbol}1!` :
      symbol;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: 'D',
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
    <div className="rounded-xl border border-border overflow-hidden" style={{ height: 400 }}>
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: '100%', width: '100%' }}>
        <div className="tradingview-widget-container__widget" style={{ height: '100%', width: '100%' }} />
      </div>
    </div>
  );
}
