import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicators, cotData } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const indicatorsList = indicators
      .filter((i: any) => i.value !== "")
      .map((i: any) => `${i.name}: ${i.value} (${i.direction})`)
      .join("\n");

    let cotSummary = "";
    if (cotData) {
      for (const [sym, data] of Object.entries(cotData) as any) {
        cotSummary += `\n${sym} (${data.name}): Non-Commercial Net=${data.nonCommercial.net} (Change: ${data.nonCommercial.netChange > 0 ? "+" : ""}${data.nonCommercial.netChange}), Sentiment: ${data.sentiment}, Weekly Shift: ${data.weeklyShift}`;
      }
    }

    const prompt = `אתה אנליסט מאקרו-כלכלי מומחה. נתח את הנתונים הכלכליים הבאים וספק תובנות לגבי כיוון השוק.

נתונים כלכליים:
${indicatorsList || "לא הוזנו נתונים כלכליים"}

נתוני COT (Commitment of Traders):
${cotSummary || "לא זמינים"}

ספק ניתוח מפורט ב-3-5 פסקאות הכוללות:
1. מה הנתונים אומרים על מצב הכלכלה
2. האם השוק צפוי לעלות או לרדת ולמה
3. השלכות על מסחר בחוזי NQ ו-ES
4. סיכום והמלצת כיוון כללית (Bullish / Bearish / Neutral)

כתוב בעברית. השתמש בפורמט מסודר עם כותרות.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "אתה אנליסט שוק מומחה. ספק ניתוח מקצועי ומדויק." },
          { role: "user", content: prompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
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
    console.error("macro-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
