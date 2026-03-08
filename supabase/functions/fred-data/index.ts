import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Use Treasury.gov and alternative free APIs
const SERIES: Record<string, { label: string; format: string; source: string; url: string }> = {
  "10Y Yield": {
    label: "10-Year Treasury Yield",
    format: "percent",
    source: "treasury",
    url: "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/{YEAR}?type=daily_treasury_yield_curve&field_tdr_date_value={YEAR}&page&_format=csv",
  },
  "2Y Yield": {
    label: "2-Year Treasury Yield",
    format: "percent",
    source: "treasury",
    url: "",
  },
  "Fed Funds Rate": {
    label: "Effective Federal Funds Rate",
    format: "percent",
    source: "fed",
    url: "https://markets.newyorkfed.org/api/rates/effr/search.json",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, any> = {};

    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // Fetch Treasury yield curve data (contains 2Y and 10Y)
    const years = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];
    const uniqueYears = [...new Set(years)];
    
    const allTreasuryData: { date: string; y10: number; y2: number }[] = [];

    const treasuryFetches = uniqueYears.map(async (year) => {
      const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/${year}?type=daily_treasury_yield_curve&field_tdr_date_value=${year}&page&_format=csv`;
      try {
        const resp = await fetch(url);
        if (!resp.ok) {
          console.error(`Treasury error for ${year}: ${resp.status}`);
          return;
        }
        const text = await resp.text();
        const lines = text.trim().split("\n");
        if (lines.length < 2) return;
        
        const headers = lines[0].split(",").map(h => h.trim().replace(/"/g, ''));
        const dateIdx = headers.findIndex(h => h === "Date");
        const y2Idx = headers.findIndex(h => h === "2 Yr");
        const y10Idx = headers.findIndex(h => h === "10 Yr");
        
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map(c => c.trim().replace(/"/g, ''));
          const dateStr = cols[dateIdx];
          if (!dateStr) continue;
          
          // Parse MM/DD/YYYY format
          const parts = dateStr.split("/");
          if (parts.length !== 3) continue;
          const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
          
          const y2 = parseFloat(cols[y2Idx]);
          const y10 = parseFloat(cols[y10Idx]);
          
          if (!isNaN(y10) || !isNaN(y2)) {
            allTreasuryData.push({ date: isoDate, y10, y2 });
          }
        }
      } catch (e) {
        console.error(`Treasury fetch error for ${year}:`, e);
      }
    });

    // Fetch Fed Funds Rate from NY Fed
    const fedFetch = (async () => {
      try {
        const startDate = twoYearsAgo.toISOString().split("T")[0];
        const endDate = now.toISOString().split("T")[0];
        const url = `https://markets.newyorkfed.org/api/rates/effr/search.json?startDate=${startDate}&endDate=${endDate}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          console.error(`NY Fed error: ${resp.status}`);
          return;
        }
        const data = await resp.json();
        const rates = data?.refRates || [];
        const points = rates
          .map((r: any) => ({
            date: r.effectiveDate,
            value: parseFloat(r.percentRate),
          }))
          .filter((p: any) => !isNaN(p.value));

        // Sample to weekly
        const sampled = sampleWeekly(points);
        results["Fed Funds Rate"] = {
          label: "Effective Federal Funds Rate",
          format: "percent",
          frequency: "daily",
          data: sampled,
        };
      } catch (e) {
        console.error("Fed Funds fetch error:", e);
      }
    })();

    await Promise.all([...treasuryFetches, fedFetch]);

    // Process treasury data
    allTreasuryData.sort((a, b) => a.date.localeCompare(b.date));
    
    // Filter to 2 years
    const startStr = twoYearsAgo.toISOString().split("T")[0];
    const filtered = allTreasuryData.filter(d => d.date >= startStr);

    if (filtered.length > 0) {
      const y10Points = filtered.filter(d => !isNaN(d.y10)).map(d => ({ date: d.date, value: d.y10 }));
      const y2Points = filtered.filter(d => !isNaN(d.y2)).map(d => ({ date: d.date, value: d.y2 }));
      const spreadPoints = filtered
        .filter(d => !isNaN(d.y10) && !isNaN(d.y2))
        .map(d => ({ date: d.date, value: parseFloat((d.y10 - d.y2).toFixed(3)) }));

      results["10Y Yield"] = {
        label: "10-Year Treasury Yield",
        format: "percent",
        frequency: "daily",
        data: sampleWeekly(y10Points),
      };
      results["2Y Yield"] = {
        label: "2-Year Treasury Yield",
        format: "percent",
        frequency: "daily",
        data: sampleWeekly(y2Points),
      };
      results["10Y-2Y Spread"] = {
        label: "10Y-2Y Treasury Spread",
        format: "percent",
        frequency: "daily",
        data: sampleWeekly(spreadPoints),
      };
    }

    // DXY from a simple source - use marketstack alternative or skip
    // For now we'll calculate a simple DXY placeholder note
    console.log(`Returning ${Object.keys(results).length} FRED indicators`);

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
