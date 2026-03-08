import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// BLS Series IDs — monthly and quarterly indicators
const SERIES_MAP: Record<string, { seriesId: string; label: string; format: string; frequency: string }> = {
  // Monthly
  "CPI YoY": { seriesId: "CUSR0000SA0", label: "CPI (All Urban Consumers)", format: "index", frequency: "monthly" },
  "Core CPI": { seriesId: "CUSR0000SA0L1E", label: "Core CPI (Less Food & Energy)", format: "index", frequency: "monthly" },
  "PPI YoY": { seriesId: "WPSFD4", label: "PPI (Final Demand)", format: "index", frequency: "monthly" },
  "NFP": { seriesId: "CES0000000001", label: "Total Non-Farm Payrolls", format: "thousands", frequency: "monthly" },
  "Unemployment": { seriesId: "LNS14000000", label: "Unemployment Rate", format: "percent", frequency: "monthly" },
  "Initial Claims": { seriesId: "LNS13023621", label: "Initial Unemployment Claims", format: "thousands", frequency: "monthly" },
  "JOLTS": { seriesId: "JTS000000000000000JOL", label: "Job Openings (JOLTS)", format: "thousands", frequency: "monthly" },
  "Retail Sales": { seriesId: "MRTSSM44000USS", label: "Retail Sales", format: "millions", frequency: "monthly" },
  "ISM Mfg": { seriesId: "NAPM", label: "ISM Manufacturing PMI", format: "index_50", frequency: "monthly" },
  "Industrial Production": { seriesId: "IPN50001S", label: "Industrial Production", format: "index", frequency: "monthly" },
  // Quarterly
  "GDP QoQ": { seriesId: "PRS85006092", label: "GDP (Productivity proxy)", format: "index", frequency: "quarterly" },
};

const BLS_BASE = "https://api.bls.gov/publicAPI/v1/timeseries/data/";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { indicators } = await req.json();
    const requestedNames = indicators || Object.keys(SERIES_MAP);

    const now = new Date();
    const startYear = now.getFullYear() - 2;
    const endYear = now.getFullYear();

    const seriesIds = requestedNames
      .filter((name: string) => SERIES_MAP[name])
      .map((name: string) => SERIES_MAP[name].seriesId);

    if (seriesIds.length === 0) {
      return new Response(JSON.stringify({ success: true, data: {} }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // BLS v1 supports up to 25 series
    const blsPayload = {
      seriesid: seriesIds,
      startyear: String(startYear),
      endyear: String(endYear),
    };

    const resp = await fetch(BLS_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blsPayload),
    });

    if (!resp.ok) {
      console.error("BLS API error:", resp.status);
      throw new Error(`BLS API returned ${resp.status}`);
    }

    const blsData = await resp.json();
    const results: Record<string, any> = {};

    if (blsData.status === "REQUEST_SUCCEEDED" && blsData.Results?.series) {
      for (const series of blsData.Results.series) {
        const indicatorEntry = Object.entries(SERIES_MAP).find(
          ([, cfg]) => cfg.seriesId === series.seriesID
        );
        if (!indicatorEntry) continue;

        const [name, cfg] = indicatorEntry;
        const dataPoints = (series.data || [])
          .map((d: any) => {
            // Monthly: M01-M12, Quarterly: Q01-Q04
            if (d.period.startsWith("M")) {
              const month = d.period.replace("M", "").padStart(2, "0");
              if (parseInt(month) <= 12) {
                return { date: `${d.year}-${month}-01`, value: parseFloat(d.value) };
              }
            } else if (d.period.startsWith("Q")) {
              const q = parseInt(d.period.replace("Q0", "").replace("Q", ""));
              const month = String((q - 1) * 3 + 1).padStart(2, "0");
              return { date: `${d.year}-${month}-01`, value: parseFloat(d.value) };
            }
            return null;
          })
          .filter(Boolean)
          .sort((a: any, b: any) => a.date.localeCompare(b.date));

        // YoY calculation for index types
        if (cfg.format === "index" && dataPoints.length > 12) {
          const yoyPoints = [];
          for (let i = 12; i < dataPoints.length; i++) {
            const current = dataPoints[i].value;
            const yearAgo = dataPoints[i - 12].value;
            if (yearAgo > 0) {
              yoyPoints.push({
                date: dataPoints[i].date,
                value: parseFloat((((current - yearAgo) / yearAgo) * 100).toFixed(2)),
              });
            }
          }
          results[name] = { label: cfg.label, format: "percent_yoy", frequency: cfg.frequency, data: yoyPoints };
        } else if (name === "NFP") {
          // MoM change for NFP
          const momPoints = [];
          for (let i = 1; i < dataPoints.length; i++) {
            momPoints.push({
              date: dataPoints[i].date,
              value: parseFloat(((dataPoints[i].value - dataPoints[i - 1].value) * 1000).toFixed(0)),
            });
          }
          results[name] = { label: cfg.label, format: "jobs_change", frequency: cfg.frequency, data: momPoints };
        } else {
          results[name] = { label: cfg.label, format: cfg.format, frequency: cfg.frequency, data: dataPoints };
        }
      }
    }

    return new Response(JSON.stringify({ success: true, data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Economic data error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
