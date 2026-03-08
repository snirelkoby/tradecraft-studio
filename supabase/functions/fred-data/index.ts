import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FRED public API (no key needed for small requests, but we use the demo key)
const FRED_BASE = "https://api.stlouisfed.org/fred/series/observations";

const SERIES: Record<string, { id: string; label: string; format: string }> = {
  "10Y Yield": { id: "DGS10", label: "10-Year Treasury Yield", format: "percent" },
  "Fed Funds Rate": { id: "FEDFUNDS", label: "Effective Federal Funds Rate", format: "percent" },
  "2Y Yield": { id: "DGS2", label: "2-Year Treasury Yield", format: "percent" },
  "DXY": { id: "DTWEXBGS", label: "Trade Weighted U.S. Dollar Index", format: "index" },
  "10Y-2Y Spread": { id: "T10Y2Y", label: "10Y-2Y Treasury Spread", format: "percent" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicators } = await req.json();
    const requestedNames: string[] = indicators || Object.keys(SERIES);

    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    const results: Record<string, any> = {};

    // Fetch all series in parallel
    const fetches = requestedNames
      .filter((name) => SERIES[name])
      .map(async (name) => {
        const cfg = SERIES[name];
        const url = `${FRED_BASE}?series_id=${cfg.id}&observation_start=${startDate}&observation_end=${endDate}&file_type=json&api_key=DEMO_KEY`;

        try {
          const resp = await fetch(url);
          if (!resp.ok) {
            console.error(`FRED error for ${cfg.id}:`, resp.status);
            return;
          }
          const data = await resp.json();
          const points = (data.observations || [])
            .filter((o: any) => o.value !== ".")
            .map((o: any) => ({
              date: o.date,
              value: parseFloat(o.value),
            }))
            .filter((p: any) => !isNaN(p.value));

          // For daily data, sample to weekly to reduce noise
          const sampled = cfg.id.startsWith("DGS") || cfg.id === "DTWEXBGS" || cfg.id === "T10Y2Y"
            ? sampleWeekly(points)
            : points;

          results[name] = {
            label: cfg.label,
            format: cfg.format,
            frequency: cfg.id === "FEDFUNDS" ? "monthly" : "daily",
            data: sampled,
          };
        } catch (e) {
          console.error(`Failed to fetch ${name}:`, e);
        }
      });

    await Promise.all(fetches);

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("FRED data error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function sampleWeekly(points: { date: string; value: number }[]) {
  if (points.length <= 104) return points; // already small enough
  const result: { date: string; value: number }[] = [];
  for (let i = 0; i < points.length; i += 5) {
    result.push(points[Math.min(i, points.length - 1)]);
  }
  // Always include the last point
  if (result[result.length - 1]?.date !== points[points.length - 1]?.date) {
    result.push(points[points.length - 1]);
  }
  return result;
}
