import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Correct CFTC codes (verified from API)
const COT_CODES: Record<string, { code: string; name: string }> = {
  ES: { code: "13874A", name: "S&P 500 (E-MINI)" },
  NQ: { code: "209742", name: "NASDAQ MINI" },
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

    // One year ago
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const dateFrom = oneYearAgo.toISOString().split("T")[0];

    const results: Record<string, any> = {};
    const allHistoryRows: any[] = [];

    for (const [symbol, cfg] of Object.entries(COT_CODES)) {
      const url = `${CFTC_API}?$where=cftc_contract_market_code='${cfg.code}' AND report_date_as_yyyy_mm_dd>='${dateFrom}T00:00:00.000'&$order=report_date_as_yyyy_mm_dd ASC&$limit=60`;
      
      console.log(`Fetching ${symbol} with code ${cfg.code}: ${url}`);
      
      const resp = await fetch(url);
      if (!resp.ok) {
        console.error(`CFTC API error for ${symbol}: ${resp.status}`);
        continue;
      }

      const records: CftcRecord[] = await resp.json();
      console.log(`${symbol}: got ${records.length} records`);
      if (!records.length) continue;

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

      const latest = records[records.length - 1];
      const ncLong = parseInt(latest.noncomm_positions_long_all) || 0;
      const ncShort = parseInt(latest.noncomm_positions_short_all) || 0;
      const ncLongChange = parseInt(latest.change_in_noncomm_long_all) || 0;
      const ncShortChange = parseInt(latest.change_in_noncomm_short_all) || 0;
      const netPosition = ncLong - ncShort;
      const netChange = ncLongChange - ncShortChange;
      const openInterest = parseInt(latest.open_interest_all) || 0;
      const reportDate = latest.report_date_as_yyyy_mm_dd.split("T")[0];

      // Sentiment logic based on FLOW (weekly changes), not just net position
      // Opening longs = bullish | Closing longs = bearish
      // Opening shorts = bearish | Closing shorts = bullish
      // Key insight: if lots of longs opened + shorts closed = BULLISH regardless of net
      let sentiment: string;
      let weeklyShift: string;

      const bullishPressure = Math.max(ncLongChange, 0) + Math.abs(Math.min(ncShortChange, 0));
      const bearishPressure = Math.abs(Math.min(ncLongChange, 0)) + Math.max(ncShortChange, 0);
      
      if (bullishPressure > bearishPressure * 1.1) weeklyShift = "more_bullish";
      else if (bearishPressure > bullishPressure * 1.1) weeklyShift = "more_bearish";
      else weeklyShift = "unchanged";

      // Sentiment is determined by combining net position AND weekly flow
      // Flow dominates when it's strong enough to signal a shift
      const flowRatio = bullishPressure > 0 || bearishPressure > 0
        ? bullishPressure / (bullishPressure + bearishPressure)
        : 0.5; // 0=all bearish, 0.5=neutral, 1=all bullish

      const strongBullishFlow = flowRatio > 0.65; // strong bullish weekly change
      const strongBearishFlow = flowRatio < 0.35; // strong bearish weekly change

      if (netPosition > 0) {
        // Net long position
        if (strongBearishFlow) {
          sentiment = "weakening_bullish"; // net long but closing longs / opening shorts
        } else {
          sentiment = "bullish";
        }
      } else if (netPosition < 0) {
        // Net short position
        if (strongBullishFlow) {
          // Net short BUT opening longs and closing shorts = shifting bullish
          sentiment = "shifting_bullish";
        } else if (flowRatio > 0.5) {
          sentiment = "weakening_bearish";
        } else {
          sentiment = "bearish";
        }
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

      for (let i = 0; i < allHistoryRows.length; i += 50) {
        const batch = allHistoryRows.slice(i, i + 50);
        const { error } = await adminClient.from("cot_history").upsert(batch, {
          onConflict: "user_id,symbol,report_date",
        });
        if (error) console.error("Upsert error:", error);
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
