import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FRED CSV endpoint - free, no API key required
const FRED_CSV_BASE = "https://fred.stlouisfed.org/graph/fredgraph.csv";

const FRED_SERIES: Record<string, { id: string; label: string }> = {
  "10Y Yield": { id: "DGS10", label: "10-Year Treasury Yield" },
  "2Y Yield": { id: "DGS2", label: "2-Year Treasury Yield" },
  "Fed Funds Rate": { id: "DFF", label: "Effective Federal Funds Rate" },
  "10Y-2Y Spread": { id: "T10Y2Y", label: "10Y-2Y Treasury Spread" },
};

async function fetchFredCsv(seriesId: string, startDate: string, endDate: string): Promise<{ date: string; value: number }[]> {
  const url = `${FRED_CSV_BASE}?id=${seriesId}&cosd=${startDate}&coed=${endDate}`;
  console.log(`Fetching FRED CSV: ${seriesId}`);
  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) {
    const body = await resp.text();
    console.error(`FRED CSV error for ${seriesId}: ${resp.status} - ${body.slice(0, 200)}`);
    return [];
  }
  const text = await resp.text();
  const lines = text.trim().split("\n");
  // First line is header: DATE,VALUE
  const points: { date: string; value: number }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const [date, val] = lines[i].split(",");
    if (!date || val === "." || val === "") continue;
    const value = parseFloat(val);
    if (!isNaN(value)) {
      points.push({ date: date.trim(), value });
    }
  }
  console.log(`${seriesId}: got ${points.length} data points`);
  return points;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, any> = {};
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = twoYearsAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    // Fetch all FRED series in parallel
    const fredFetches = Object.entries(FRED_SERIES).map(async ([name, { id, label }]) => {
      try {
        const points = await fetchFredCsv(id, startDate, endDate);
        if (points.length > 0) {
          results[name] = {
            label,
            format: "percent",
            frequency: "daily",
            data: sampleWeekly(points),
          };
        }
      } catch (e) {
        console.error(`Error fetching ${name}:`, e);
      }
    });

    // DXY from Yahoo Finance
    const dxyFetch = (async () => {
      try {
        const twoYearsAgoTs = Math.floor(twoYearsAgo.getTime() / 1000);
        const nowTs = Math.floor(now.getTime() / 1000);
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB?period1=${twoYearsAgoTs}&period2=${nowTs}&interval=1wk`;
        const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (!resp.ok) {
          console.error(`DXY error: ${resp.status}`);
          await resp.text();
          return;
        }
        const dxyJson = await resp.json();
        const dxyResult = dxyJson?.chart?.result?.[0];
        const timestamps = dxyResult?.timestamp || [];
        const closes = dxyResult?.indicators?.quote?.[0]?.close || [];
        const dxyPoints: { date: string; value: number }[] = [];
        for (let i = 0; i < timestamps.length; i++) {
          if (closes[i] != null) {
            const d = new Date(timestamps[i] * 1000);
            dxyPoints.push({ date: d.toISOString().split("T")[0], value: parseFloat(closes[i].toFixed(2)) });
          }
        }
        if (dxyPoints.length > 0) {
          results["DXY"] = { label: "US Dollar Index", format: "index", frequency: "weekly", data: dxyPoints };
        }
      } catch (e) {
        console.error("DXY fetch error:", e);
      }
    })();

    await Promise.all([...fredFetches, dxyFetch]);

    console.log(`Returning ${Object.keys(results).length} indicators: ${Object.keys(results).join(", ")}`);

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
  if (points.length <= 104) return points;
  const result: { date: string; value: number }[] = [];
  for (let i = 0; i < points.length; i += 5) {
    result.push(points[Math.min(i, points.length - 1)]);
  }
  if (result[result.length - 1]?.date !== points[points.length - 1]?.date) {
    result.push(points[points.length - 1]);
  }
  return result;
}
