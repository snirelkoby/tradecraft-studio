import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // For each symbol request: { symbol, startDate, endDate }
    // Fetch OHLC data from Yahoo Finance and return high/low for the period
    const results: Record<string, { high: number; low: number } | null> = {};

    await Promise.all(
      symbols.map(async (item: { key: string; symbol: string; startDate: string; endDate: string }) => {
        try {
          const period1 = Math.floor(new Date(item.startDate).getTime() / 1000);
          // Add 1 day buffer to endDate to ensure we capture intraday data
          const endMs = item.endDate
            ? new Date(item.endDate).getTime() + 86400000
            : new Date(item.startDate).getTime() + 86400000;
          const period2 = Math.floor(endMs / 1000);

          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(item.symbol)}?period1=${period1}&period2=${period2}&interval=1d`;

          const resp = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0",
            },
          });

          if (!resp.ok) {
            results[item.key] = null;
            return;
          }

          const data = await resp.json();
          const quotes = data?.chart?.result?.[0]?.indicators?.quote?.[0];

          if (!quotes || !quotes.high || !quotes.low) {
            results[item.key] = null;
            return;
          }

          const highs = quotes.high.filter((v: number | null) => v !== null) as number[];
          const lows = quotes.low.filter((v: number | null) => v !== null) as number[];

          if (highs.length === 0 || lows.length === 0) {
            results[item.key] = null;
            return;
          }

          results[item.key] = {
            high: Math.max(...highs),
            low: Math.min(...lows),
          };
        } catch {
          results[item.key] = null;
        }
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
