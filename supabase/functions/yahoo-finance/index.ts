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
  const period1 = Math.floor(new Date(startDate).getTime() / 1000);
  const endMs = endDate
    ? new Date(endDate).getTime() + 86400000
    : new Date(startDate).getTime() + 86400000;
  const period2 = Math.floor(endMs / 1000);

  const tickers = getYahooSymbol(symbol);

  for (const ticker of tickers) {
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d`;

      const resp = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];

      if (!quotes || !quotes.high || !quotes.low) continue;

      const highs = quotes.high.filter((v: number | null) => v !== null) as number[];
      const lows = quotes.low.filter((v: number | null) => v !== null) as number[];

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
