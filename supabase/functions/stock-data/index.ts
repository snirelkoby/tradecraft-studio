import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { symbols } = await req.json();
    if (!symbols?.length) throw new Error("No symbols provided");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const symbolList = symbols.slice(0, 10).join(", ");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a financial data assistant. For each stock symbol, provide current market data and recent news.

Return ONLY a JSON object with a "stocks" array. Each stock should have:
- symbol: The ticker symbol
- price: Current/latest price as a number
- change_percent: Today's percentage change as a number (positive or negative)
- company_name: Full company name
- news: Array of up to 3 recent news headlines, each with "title" and "time_ago" (e.g. "2h ago", "1d ago")

If you don't have exact real-time data, provide the most recent data you know of. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `Get current stock data and recent news for: ${symbolList}. Today is ${new Date().toISOString().split("T")[0]}.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let stocks = [];
    try {
      const parsed = JSON.parse(content);
      stocks = parsed.stocks || parsed;
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        stocks = parsed.stocks || parsed;
      }
    }

    return new Response(JSON.stringify({ success: true, stocks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("stock-data error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
