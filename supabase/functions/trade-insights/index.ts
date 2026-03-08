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

    const closed = trades.filter((t: any) => t.status === 'closed' && t.pnl !== null);
    const totalPnl = closed.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const wins = closed.filter((t: any) => (t.pnl ?? 0) > 0);
    const losses = closed.filter((t: any) => (t.pnl ?? 0) < 0);
    const winRate = closed.length > 0 ? (wins.length / closed.length * 100).toFixed(1) : '0';
    const avgWin = wins.length > 0 ? (wins.reduce((s: number, t: any) => s + t.pnl, 0) / wins.length).toFixed(2) : '0';
    const avgLoss = losses.length > 0 ? (losses.reduce((s: number, t: any) => s + Math.abs(t.pnl), 0) / losses.length).toFixed(2) : '0';

    // Top symbols
    const symbolMap: Record<string, { count: number; pnl: number; wins: number }> = {};
    closed.forEach((t: any) => {
      if (!symbolMap[t.symbol]) symbolMap[t.symbol] = { count: 0, pnl: 0, wins: 0 };
      symbolMap[t.symbol].count++;
      symbolMap[t.symbol].pnl += t.pnl ?? 0;
      if ((t.pnl ?? 0) > 0) symbolMap[t.symbol].wins++;
    });
    const symbolSummary = Object.entries(symbolMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([sym, d]) => `${sym}: ${d.count} trades, WR ${(d.wins/d.count*100).toFixed(0)}%, P&L $${d.pnl.toFixed(2)}`)
      .join('\n');

    // Direction breakdown
    const longs = closed.filter((t: any) => t.direction === 'long');
    const shorts = closed.filter((t: any) => t.direction === 'short');
    const longPnl = longs.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const shortPnl = shorts.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
    const longWins = longs.filter((t: any) => (t.pnl ?? 0) > 0).length;
    const shortWins = shorts.filter((t: any) => (t.pnl ?? 0) > 0).length;

    // Strategy breakdown
    const stratMap: Record<string, { count: number; pnl: number; wins: number }> = {};
    closed.forEach((t: any) => {
      const strat = t.strategy || 'No Strategy';
      if (!stratMap[strat]) stratMap[strat] = { count: 0, pnl: 0, wins: 0 };
      stratMap[strat].count++;
      stratMap[strat].pnl += t.pnl ?? 0;
      if ((t.pnl ?? 0) > 0) stratMap[strat].wins++;
    });
    const stratSummary = Object.entries(stratMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([s, d]) => `${s}: ${d.count} trades, WR ${(d.wins/d.count*100).toFixed(0)}%, P&L $${d.pnl.toFixed(2)}`)
      .join('\n');

    // Hourly breakdown (key analytics)
    const hourMap: Record<number, { count: number; pnl: number; wins: number }> = {};
    closed.forEach((t: any) => {
      try {
        const hour = new Date(t.entry_date).getUTCHours();
        if (!hourMap[hour]) hourMap[hour] = { count: 0, pnl: 0, wins: 0 };
        hourMap[hour].count++;
        hourMap[hour].pnl += t.pnl ?? 0;
        if ((t.pnl ?? 0) > 0) hourMap[hour].wins++;
      } catch {}
    });
    const hourSummary = Object.entries(hourMap)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([h, d]) => `${h}:00 UTC: ${d.count} trades, WR ${(d.wins/d.count*100).toFixed(0)}%, P&L $${d.pnl.toFixed(2)}`)
      .join('\n');

    // Day of week breakdown
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayMap: Record<number, { count: number; pnl: number; wins: number }> = {};
    closed.forEach((t: any) => {
      try {
        const day = new Date(t.entry_date).getDay();
        if (!dayMap[day]) dayMap[day] = { count: 0, pnl: 0, wins: 0 };
        dayMap[day].count++;
        dayMap[day].pnl += t.pnl ?? 0;
        if ((t.pnl ?? 0) > 0) dayMap[day].wins++;
      } catch {}
    });
    const daySummary = Object.entries(dayMap)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([d, data]) => `${dayNames[parseInt(d)]}: ${data.count} trades, WR ${(data.wins/data.count*100).toFixed(0)}%, P&L $${data.pnl.toFixed(2)}`)
      .join('\n');

    // Consecutive wins/losses streaks
    let maxWinStreak = 0, maxLossStreak = 0, curWin = 0, curLoss = 0;
    closed.forEach((t: any) => {
      if ((t.pnl ?? 0) > 0) { curWin++; curLoss = 0; maxWinStreak = Math.max(maxWinStreak, curWin); }
      else { curLoss++; curWin = 0; maxLossStreak = Math.max(maxLossStreak, curLoss); }
    });

    // Best and worst trades
    const sorted = [...closed].sort((a: any, b: any) => (b.pnl ?? 0) - (a.pnl ?? 0));
    const best3 = sorted.slice(0, 3).map((t: any) => `${t.symbol} ${t.direction}: $${(t.pnl ?? 0).toFixed(2)} (${t.entry_date?.slice(0, 10)})`).join('\n');
    const worst3 = sorted.slice(-3).reverse().map((t: any) => `${t.symbol} ${t.direction}: $${(t.pnl ?? 0).toFixed(2)} (${t.entry_date?.slice(0, 10)})`).join('\n');

    // Average hold time
    const holdTimes = closed.filter((t: any) => t.exit_date).map((t: any) => {
      return (new Date(t.exit_date).getTime() - new Date(t.entry_date).getTime()) / 60000;
    });
    const avgHoldMin = holdTimes.length > 0 ? (holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length).toFixed(1) : 'N/A';

    const prompt = `You are a professional trading coach analyzing a trader's journal. Provide deep, actionable insights in Hebrew. Be direct, specific, and data-driven.

Here is the trader's full data:

📊 Overall Performance:
- Total closed trades: ${closed.length}
- Total P&L: $${totalPnl.toFixed(2)}
- Win rate: ${winRate}%
- Average win: $${avgWin}
- Average loss: $${avgLoss}
- Max win streak: ${maxWinStreak}
- Max loss streak: ${maxLossStreak}
- Average hold time: ${avgHoldMin} minutes

📈 Direction Analysis:
- Longs: ${longs.length} trades, WR ${longs.length > 0 ? (longWins/longs.length*100).toFixed(0) : 0}%, P&L $${longPnl.toFixed(2)}
- Shorts: ${shorts.length} trades, WR ${shorts.length > 0 ? (shortWins/shorts.length*100).toFixed(0) : 0}%, P&L $${shortPnl.toFixed(2)}

🏷️ Top Symbols:
${symbolSummary}

📋 Strategies:
${stratSummary}

⏰ Hourly Performance:
${hourSummary}

📅 Day of Week Performance:
${daySummary}

🏆 Best 3 Trades:
${best3}

💀 Worst 3 Trades:
${worst3}

Provide 6-8 specific insights covering ALL of these:
1. **סיכום ביצועים כללי** - Overall performance assessment with profit factor
2. **ניתוח שעות מסחר** - Which hours are most profitable and which to AVOID, be specific
3. **ניתוח ימים** - Which days of the week perform best/worst
4. **ניתוח כיוון** - Long vs Short performance comparison, recommendation
5. **סימבולים ואסטרטגיות** - Best/worst symbols and strategies, what to focus on
6. **ניהול סיכונים** - Risk management observations (avg win vs avg loss ratio, streaks)
7. **דפוסים חיוביים** - Positive patterns found - when do wins cluster?
8. **המלצות לשיפור** - 3 specific, actionable improvements

Use emojis for headers. Format with bold headers and bullet points. Be concise but thorough.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a professional trading analyst and coach. Always respond in Hebrew. Be data-driven and actionable." },
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
