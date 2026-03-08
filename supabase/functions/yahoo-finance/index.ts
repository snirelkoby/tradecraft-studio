import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map common trading symbols to Yahoo Finance tickers
const SYMBOL_MAP: Record<string, string> = {
  'NQ': 'NQ=F',
  'ES': 'ES=F',
  'YM': 'YM=F',
  'RTY': 'RTY=F',
  'CL': 'CL=F',
  'GC': 'GC=F',
  'SI': 'SI=F',
  'ZB': 'ZB=F',
  'ZN': 'ZN=F',
  'ZC': 'ZC=F',
  'ZS': 'ZS=F',
  'ZW': 'ZW=F',
  'NG': 'NG=F',
  'HG': 'HG=F',
  'MNQ': 'MNQ=F',
  'MES': 'MES=F',
  'MYM': 'MYM=F',
  'M2K': 'M2K=F',
  'MCL': 'MCL=F',
  'MGC': 'MGC=F',
  '6E': '6E=F',
  '6J': '6J=F',
  '6B': '6B=F',
  'BTC': 'BTC-USD',
  'ETH': 'ETH-USD',
  'BTCUSD': 'BTC-USD',
  'ETHUSD': 'ETH-USD',
};

function getYahooSymbol(symbol: string): string[] {
  const upper = symbol.toUpperCase().trim();
  // Return possible tickers to try
  if (SYMBOL_MAP[upper]) {
    return [SYMBOL_MAP[upper], upper];
  }
  // Try as-is, then with =F suffix for futures
  return [upper, `${upper}=F`];
}

async function fetchYahooData(symbol: string, startDate: string, endDate: string): Promise<{ high: number; low: number } | null> {
  const startMs = new Date(startDate).getTime();
  const endMs = endDate ? new Date(endDate).getTime() : startMs;
  const period1 = Math.floor(startMs / 1000);
  // Add buffer
  const period2 = Math.floor((endMs + 86400000) / 1000);
  
  // Determine interval: if same day, use 5m for more precise intraday data
  const sameDay = new Date(startDate).toDateString() === new Date(endDate || startDate).toDateString();
  const daysDiff = Math.ceil((endMs - startMs) / 86400000);
  // Yahoo limits: 5m data available for last ~60 days, 1h for ~730 days
  const interval = sameDay ? '5m' : daysDiff <= 5 ? '15m' : '1d';

  const tickers = getYahooSymbol(symbol);

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=${interval}`;

      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const result = data?.chart?.result?.[0];
      const quotes = result?.indicators?.quote?.[0];
      const timestamps = result?.timestamp;

      if (!quotes || !quotes.high || !quotes.low) continue;

      // If using intraday data, filter to only the timestamps within the trade period
      let highs: number[] = [];
      let lows: number[] = [];
      
      if (timestamps && interval !== '1d') {
        const tradeStart = period1;
        const tradeEnd = Math.floor(endMs / 1000) + 3600; // 1h buffer after exit
        
        for (let i = 0; i < timestamps.length; i++) {
          if (timestamps[i] >= tradeStart && timestamps[i] <= tradeEnd) {
            if (quotes.high[i] != null) highs.push(quotes.high[i]);
            if (quotes.low[i] != null) lows.push(quotes.low[i]);
          }
        }
      }
      
      // Fallback to all data if no filtered results
      if (highs.length === 0) {
        highs = quotes.high.filter((v: number | null) => v !== null) as number[];
      }
      if (lows.length === 0) {
        lows = quotes.low.filter((v: number | null) => v !== null) as number[];
      }

      if (highs.length === 0 || lows.length === 0) continue;

      return {
        high: Math.max(...highs),
        low: Math.min(...lows),
      };
    } catch {
      continue;
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: "symbols array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Record<string, { high: number; low: number } | null> = {};

    await Promise.all(
      symbols.map(async (item: { key: string; symbol: string; startDate: string; endDate: string }) => {
        results[item.key] = await fetchYahooData(item.symbol, item.startDate, item.endDate);
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
