import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, any> = {};
    const now = new Date();
    const twoYearsAgo = new Date(now);
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // 1) Treasury yields from data.treasury.gov OData API
    const treasuryFetch = (async () => {
      try {
        const startYear = twoYearsAgo.getFullYear();
        const url = `https://data.treasury.gov/feed.svc/DailyTreasuryYieldCurveRateData?$filter=year(NEW_DATE) ge ${startYear}&$orderby=NEW_DATE asc&$format=json`;
        console.log("Fetching Treasury:", url);
        const resp = await fetch(url);
        if (!resp.ok) {
          console.error(`Treasury API error: ${resp.status}`);
          const body = await resp.text();
          console.error("Treasury body:", body.slice(0, 500));
          return;
        }
        const data = await resp.json();
        const entries = data?.d?.results || data?.value || [];
        console.log(`Treasury: got ${entries.length} entries`);

        const y10Points: { date: string; value: number }[] = [];
        const y2Points: { date: string; value: number }[] = [];
        const spreadPoints: { date: string; value: number }[] = [];

        for (const entry of entries) {
          // OData format: NEW_DATE is like "/Date(1234567890000)/" or ISO string
          let dateStr: string;
          const rawDate = entry.NEW_DATE;
          if (typeof rawDate === "string" && rawDate.includes("/Date(")) {
            const ms = parseInt(rawDate.match(/\d+/)?.[0] || "0");
            dateStr = new Date(ms).toISOString().split("T")[0];
          } else if (typeof rawDate === "string") {
            dateStr = new Date(rawDate).toISOString().split("T")[0];
          } else {
            continue;
          }

          const y2 = parseFloat(entry.BC_2YEAR);
          const y10 = parseFloat(entry.BC_10YEAR);

          if (!isNaN(y10)) y10Points.push({ date: dateStr, value: y10 });
          if (!isNaN(y2)) y2Points.push({ date: dateStr, value: y2 });
          if (!isNaN(y10) && !isNaN(y2)) {
            spreadPoints.push({ date: dateStr, value: parseFloat((y10 - y2).toFixed(3)) });
          }
        }

        if (y10Points.length > 0) {
          results["10Y Yield"] = { label: "10-Year Treasury Yield", format: "percent", frequency: "daily", data: sampleWeekly(y10Points) };
        }
        if (y2Points.length > 0) {
          results["2Y Yield"] = { label: "2-Year Treasury Yield", format: "percent", frequency: "daily", data: sampleWeekly(y2Points) };
        }
        if (spreadPoints.length > 0) {
          results["10Y-2Y Spread"] = { label: "10Y-2Y Treasury Spread", format: "percent", frequency: "daily", data: sampleWeekly(spreadPoints) };
        }
      } catch (e) {
        console.error("Treasury fetch error:", e);
      }
    })();

    // 2) Fed Funds Rate from NY Fed API
    const fedFetch = (async () => {
      try {
        const startDate = twoYearsAgo.toISOString().split("T")[0];
        const endDate = now.toISOString().split("T")[0];
        // NY Fed API uses YYYY-MM-DD
        const url = `https://markets.newyorkfed.org/api/rates/effr/search.json?startDate=${startDate}&endDate=${endDate}`;
        console.log("Fetching Fed Funds:", url);
        const resp = await fetch(url, {
          headers: { "Accept": "application/json" },
        });
        if (!resp.ok) {
          console.error(`NY Fed error: ${resp.status}`);
          // Try alternative: use text and parse
          const body = await resp.text();
          console.error("NY Fed body:", body.slice(0, 300));
          return;
        }
        const data = await resp.json();
        const rates = data?.refRates || [];
        console.log(`Fed Funds: got ${rates.length} rates`);
        const points = rates
          .map((r: any) => ({ date: r.effectiveDate, value: parseFloat(r.percentRate) }))
          .filter((p: any) => !isNaN(p.value));
        if (points.length > 0) {
          results["Fed Funds Rate"] = { label: "Effective Federal Funds Rate", format: "percent", frequency: "daily", data: sampleWeekly(points) };
        }
      } catch (e) {
        console.error("Fed Funds fetch error:", e);
      }
    })();

    // 3) DXY from Yahoo Finance
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

    await Promise.all([treasuryFetch, fedFetch, dxyFetch]);

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
