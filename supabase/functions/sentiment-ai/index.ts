import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { userNotes, currentSentiment } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a professional options & market sentiment analyst. Your job is to provide a weekly sentiment assessment for S&P 500 / US equity markets.

You MUST analyze the following factors and provide your assessment:

1. **AAII Investor Sentiment Survey** — What are the latest bullish/bearish/neutral readings? How do they compare to historical averages? Extreme readings are contrarian signals.

2. **Options Put/Call Ratio** — Current CBOE equity and total P/C ratios. Below 0.7 = complacent/bullish, above 1.0 = fearful/bearish. Extreme readings are contrarian.

3. **GEX (Gamma Exposure)** — Current dealer gamma positioning. Positive GEX = dealers sell rallies/buy dips (suppresses volatility, bullish). Negative GEX = dealers amplify moves (higher volatility, can be bearish).

4. **VIX & Volatility** — Current VIX level and term structure (contango vs backwardation).

5. **Dark Pool & Flow Data** — Any notable institutional flow signals.

6. **Market Breadth** — Advance/decline, new highs vs lows, percentage of stocks above moving averages.

For each factor, state the current reading (or your best estimate based on recent data) and whether it's bullish, bearish, or neutral.

Then provide:
- **Overall Sentiment**: very_bullish, bullish, neutral, bearish, or very_bearish
- **Confidence**: high, medium, or low
- **Key Risks**: Top 2-3 risks to watch
- **Summary**: 2-3 sentence actionable summary in Hebrew

Format your response in Hebrew with English terms for financial concepts. Use markdown formatting.

IMPORTANT: At the very end, add a line exactly like this:
SENTIMENT_RESULT: <sentiment_value>
Where <sentiment_value> is one of: very_bullish, bullish, neutral, bearish, very_bearish`;

    const userMessage = `Provide your weekly options sentiment analysis for this week.
${userNotes ? `\nTrader's own notes/observations:\n${userNotes}` : ''}
${currentSentiment ? `\nTrader's current manual sentiment: ${currentSentiment}` : ''}

Analyze all the factors listed and give me your professional assessment.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit - נסה שוב בעוד דקה" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("sentiment-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
