import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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
            content: `You are a financial news aggregator that simulates Walter Bloomberg (@DeItaone) style breaking market headlines. 

Generate the most important and REAL market/financial news headlines from the last 24 hours. These should be REAL events that actually happened.

Return ONLY a JSON object with a "headlines" array. Each headline should have:
- text: The headline text (short, breaking-news style, ALL CAPS like Walter Bloomberg)
- timestamp: ISO 8601 timestamp of when it was published/happened
- category: One of "fed", "earnings", "macro", "geopolitical", "market", "crypto"
- impact: "high", "medium", or "low"

Include 15-25 headlines. Sort by most recent first. Return ONLY valid JSON.`,
          },
          {
            role: "user",
            content: `What are the most important financial/market news headlines from the last 24 hours? Current time: ${new Date().toISOString()}. Return real events only, JSON format.`,
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

    let headlines = [];
    try {
      const parsed = JSON.parse(content);
      headlines = parsed.headlines || parsed;
    } catch {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        headlines = parsed.headlines || parsed;
      }
    }

    return new Response(JSON.stringify({ success: true, headlines }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("walter-news error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
