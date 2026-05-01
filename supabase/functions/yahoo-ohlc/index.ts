// Yahoo Finance OHLC fetcher - returns candlestick data for a symbol/range/interval
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch {}
    }
    const symbol = (body.symbol ?? url.searchParams.get("symbol") ?? "").toString();
    const interval = (body.interval ?? url.searchParams.get("interval") ?? "5m").toString();
    const period1 = Number(body.period1 ?? url.searchParams.get("period1") ?? 0);
    const period2 = Number(body.period2 ?? url.searchParams.get("period2") ?? Math.floor(Date.now() / 1000));

    if (!symbol) {
      return new Response(JSON.stringify({ error: "symbol required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const params = new URLSearchParams({
      interval,
      period1: String(period1),
      period2: String(period2),
      includePrePost: "true",
      events: "div,splits",
    });

    const yfUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;

    const resp = await fetch(yfUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LovableTradingJournal/1.0)",
        "Accept": "application/json",
      },
    });

    if (!resp.ok) {
      const text = await resp.text();
      return new Response(JSON.stringify({ error: `Yahoo error ${resp.status}`, detail: text.slice(0, 300) }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const result = data?.chart?.result?.[0];
    if (!result) {
      return new Response(JSON.stringify({ error: "No data", candles: [] }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const timestamps: number[] = result.timestamp ?? [];
    const q = result.indicators?.quote?.[0] ?? {};
    const opens: (number | null)[] = q.open ?? [];
    const highs: (number | null)[] = q.high ?? [];
    const lows: (number | null)[] = q.low ?? [];
    const closes: (number | null)[] = q.close ?? [];
    const volumes: (number | null)[] = q.volume ?? [];

    const candles = timestamps
      .map((t, i) => ({
        time: t,
        open: opens[i],
        high: highs[i],
        low: lows[i],
        close: closes[i],
        volume: volumes[i] ?? 0,
      }))
      .filter(c => c.open != null && c.high != null && c.low != null && c.close != null);

    return new Response(JSON.stringify({
      symbol: result.meta?.symbol ?? symbol,
      currency: result.meta?.currency,
      interval,
      candles,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
