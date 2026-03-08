import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { weekStart, weekEnd } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a financial calendar expert. Given a week range, return the key US and global economic events scheduled for that week.

Return ONLY a JSON object with an "events" array. Each event should have:
- event_date: YYYY-MM-DD format
- event_time: HH:MM format in ET (Eastern Time), or null if unknown
- title: Event name in English
- currency: USD, EUR, GBP, JPY, etc.
- impact: "high", "medium", or "low"
- forecast: Expected value if known, or null
- previous: Previous reading if known, or null

Focus on HIGH and MEDIUM impact events only. Include:
- Fed decisions, speeches, minutes
- CPI, PPI, PCE inflation data
- Employment data (NFP, jobless claims)
- GDP, retail sales, housing data
- ISM PMIs, consumer confidence
- ECB, BOJ, BOE decisions if in that week
- Any major geopolitical economic events

Return ONLY valid JSON, no markdown, no explanation.`;

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
          { role: "user", content: `What are the key economic events for the week of ${weekStart} to ${weekEnd}? Return JSON only.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let events = [];
    try {
      // Try direct parse
      const parsed = JSON.parse(content);
      events = parsed.events || parsed;
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        events = parsed.events || parsed;
      }
    }

    return new Response(JSON.stringify({ success: true, events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("economic-events-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
