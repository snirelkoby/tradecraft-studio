import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// CFTC codes for the combined report
const COT_CODES: Record<string, { code: string; name: string }> = {
  ES: { code: "13874A", name: "S&P 500 (E-MINI)" },
  NQ: { code: "209742A", name: "NASDAQ MINI" },
};

const CFTC_API = "https://publicreporting.cftc.gov/resource/jun7-fc8e.json";

interface CftcRecord {
  report_date_as_yyyy_mm_dd: string;
  noncomm_positions_long_all: string;
  noncomm_positions_short_all: string;
  open_interest_all: string;
  change_in_noncomm_long_all: string;
  change_in_noncomm_short_all: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id || null;
    }

    // Calculate date one year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateFrom = oneYearAgo.toISOString().split("T")[0];

    const results: Record<string, any> = {};
    const allHistoryRows: any[] = [];

    for (const [symbol, cfg] of Object.entries(COT_CODES)) {
      // Fetch ~52 weeks from CFTC API
      const url = `${CFTC_API}?$where=cftc_contract_market_code='${cfg.code}' AND report_date_as_yyyy_mm_dd>='${dateFrom}T00:00:00.000'&$order=report_date_as_yyyy_mm_dd ASC&$limit=60`;
      
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`CFTC API error for ${symbol}: ${resp.status}`);
        continue;
      }

      const records: CftcRecord[] = await resp.json();
      if (!records.length) continue;

      // Process all records for history
      for (const rec of records) {
        const reportDate = rec.report_date_as_yyyy_mm_dd.split("T")[0];
        const ncLong = parseInt(rec.noncomm_positions_long_all) || 0;
        const ncShort = parseInt(rec.noncomm_positions_short_all) || 0;
        const ncNet = ncLong - ncShort;
        const openInterest = parseInt(rec.open_interest_all) || 0;
        const ncLongChange = parseInt(rec.change_in_noncomm_long_all) || 0;
        const ncShortChange = parseInt(rec.change_in_noncomm_short_all) || 0;

        if (userId) {
          allHistoryRows.push({
            user_id: userId,
            symbol,
            report_date: reportDate,
            nc_long: ncLong,
            nc_short: ncShort,
            nc_net: ncNet,
            nc_long_change: ncLongChange,
            nc_short_change: ncShortChange,
            open_interest: openInterest,
          });
        }
      }

      // Use latest record for current display
      const latest = records[records.length - 1];
      const ncLong = parseInt(latest.noncomm_positions_long_all) || 0;
      const ncShort = parseInt(latest.noncomm_positions_short_all) || 0;
      const ncLongChange = parseInt(latest.change_in_noncomm_long_all) || 0;
      const ncShortChange = parseInt(latest.change_in_noncomm_short_all) || 0;
      const netPosition = ncLong - ncShort;
      const netChange = ncLongChange - ncShortChange;
      const openInterest = parseInt(latest.open_interest_all) || 0;
      const reportDate = latest.report_date_as_yyyy_mm_dd.split("T")[0];

      let sentiment: string;
      let weeklyShift: string;

      if (netChange > 0) {
        weeklyShift = "more_bullish";
      } else if (netChange < 0) {
        weeklyShift = "more_bearish";
      } else {
        weeklyShift = "unchanged";
      }

      if (netPosition > 0) {
        sentiment = netChange < 0 ? "weakening_bullish" : "bullish";
      } else if (netPosition < 0) {
        sentiment = netChange > 0 ? "weakening_bearish" : "bearish";
      } else {
        sentiment = "neutral";
      }

      results[symbol] = {
        name: cfg.name,
        reportDate,
        openInterest,
        nonCommercial: {
          long: ncLong,
          short: ncShort,
          net: netPosition,
          longChange: ncLongChange,
          shortChange: ncShortChange,
          netChange,
        },
        sentiment,
        weeklyShift,
      };
    }

    // Bulk save history
    if (userId && allHistoryRows.length > 0) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(supabaseUrl, serviceKey);

      // Upsert in batches of 50
      for (let i = 0; i < allHistoryRows.length; i += 50) {
        const batch = allHistoryRows.slice(i, i + 50);
        await adminClient.from("cot_history").upsert(batch, {
          onConflict: "user_id,symbol,report_date",
        });
      }
    }

    return new Response(JSON.stringify({ success: true, data: results, historyCount: allHistoryRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("COT error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
