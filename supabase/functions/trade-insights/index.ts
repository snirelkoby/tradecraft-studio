import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { trades } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!trades || trades.length === 0) {
      return new Response(JSON.stringify({ insights: "No trades to analyze." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build a summary for the AI
    const closed = trades.filter((t: any) => t.status === 'closed' && t.pnl !== null);
    const totalPnl = closed.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter((t: any) => (t.pnl ?? 0) > 0);
    const losses = closed.filter((t: any) => (t.pnl ?? 0) < 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length * 100).toFixed(1) : '0';
    const avgWin = wins.length > 0 ? (wins.reduce((s: number, t: any) => s + t.pnl, 0) / wins.length).toFixed(2) : '0';
    const avgLoss = losses.length > 0 ? (losses.reduce((s: number, t: any) => s + Math.abs(t.pnl), 0) / losses.length).toFixed(2) : '0';

    // Top symbols
    const symbolMap: Record<string, { count: number; pnl: number }> = {};
    closed.forEach((t: any) => {
      if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { count: 0, pnl: 0 };
      symbolMap[t.symbol].count++;
      symbolMap[t.symbol].pnl += t.pnl ?? 0;
    });

    const symbolSummary = Object.entries(symbolMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([sym, d]) => `${sym}: ${d.count} trades, P&L $${d.pnl.toFixed(2)}`)
      .join('\n');

    // Direction breakdown
    const longs = closed.filter((t: any) => t.direction === 'long');
    const shorts = closed.filter((t: any) => t.direction === 'short');
    const longPnl = longs.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const shortPnl = shorts.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);

    // Strategy breakdown
    const stratMap: Record<string, { count: number; pnl: number }> = {};
    closed.forEach((t: any) => {
      const strat = t.strategy || 'No Strategy';
      if (!stratMap[strat]) stratMap[strat] = { count: 0, pnl: 0 };
      stratMap[strat].count++;
      stratMap[strat].pnl += t.pnl ?? 0;
    });
    const stratSummary = Object.entries(stratMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([s, d]) => `${s}: ${d.count} trades, P&L $${d.pnl.toFixed(2)}`)
      .join('\n');

    // Recent trades sample
    const recentSample = closed.slice(-15).map((t: any) =>
      `${t.symbol} ${t.direction} entry:${t.entry_price} exit:${t.exit_price} pnl:$${(t.pnl ?? 0).toFixed(2)} ${t.entry_date?.slice(0, 10)}`
    ).join('\n');

    const prompt = `You are a professional trading coach analyzing a trader's journal. Provide actionable insights in Hebrew. Be direct, specific, and data-driven.

Here is the trader's data:
- Total closed trades: ${closed.length}
- Total P&L: $${totalPnl.toFixed(2)}
- Win rate: ${winRate}%
- Average win: $${avgWin}
- Average loss: $${avgLoss}
- Longs: ${longs.length} trades, P&L $${longPnl.toFixed(2)}
- Shorts: ${shorts.length} trades, P&L $${shortPnl.toFixed(2)}

Top symbols:
${symbolSummary}

Strategies:
${stratSummary}

Recent trades sample:
${recentSample}

Give 4-6 specific insights covering:
1. Overall performance assessment
2. Best/worst patterns (symbols, direction, strategy)
3. Risk management observations
4. Specific actionable improvements

Format with bullet points and bold headers. Keep it concise but insightful.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional trading analyst. Respond in Hebrew." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const insights = aiData.choices?.[0]?.message?.content || "No insights generated.";

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trade-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
