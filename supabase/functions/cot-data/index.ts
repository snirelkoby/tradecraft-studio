import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ES first — higher weight
const COT_CODES: Record<string, { code: string; name: string }> = {
  ES: { code: "13874", name: "S&P 500" },
  NQ: { code: "209742", name: "NASDAQ MINI" },
};

function parseNumber(s: string): number {
  return parseInt(s.replace(/,/g, "").replace(/\+/g, ""), 10) || 0;
}

function parseSignedNumber(s: string): number {
  const clean = s.replace(/,/g, "").trim();
  return parseInt(clean, 10) || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Get auth token for saving history
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

    const results: Record<string, any> = {};

    for (const [symbol, cfg] of Object.entries(COT_CODES)) {
      const url = `https://www.tradingster.com/cot/legacy-futures/${cfg.code}`;
      const resp = await fetch(url);
      const html = await resp.text();

      let ncLong = 0, ncShort = 0, ncLongChange = 0, ncShortChange = 0;
      let openInterest = 0;
      let reportDate = "";

      // Extract report date
      const dateMatch = html.match(/AS OF:\s*(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) reportDate = dateMatch[1];

      // Extract Open Interest
      const oiMatch = html.match(/Open Interest:\s*<span class="number">([\d,]+)<\/span>/);
      if (oiMatch) openInterest = parseNumber(oiMatch[1]);

      // Parse the main data table - find Non-Commercial long/short (first data row after header)
      const dataRowMatch = html.match(/<tr>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<td class="number">([\d,]+)<\/td>\s*<\/tr>/);
      
      if (dataRowMatch) {
        ncLong = parseNumber(dataRowMatch[1]);
        ncShort = parseNumber(dataRowMatch[2]);
      }

      // Parse changes row - look for positive-num/negative-num spans
      const changesMatch = html.match(/Changes[\s\S]*?<tr>\s*<td class="number"><span class="(?:positive|negative)-num">([^<]+)<\/span><\/td>\s*<td class="number"><span class="(?:positive|negative)-num">([^<]+)<\/span><\/td>/);
      
      if (changesMatch) {
        ncLongChange = parseSignedNumber(changesMatch[1]);
        ncShortChange = parseSignedNumber(changesMatch[2]);
      }

      const netPosition = ncLong - ncShort;
      const netChange = ncLongChange - ncShortChange;

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
        if (ncLongChange < 0 && ncShortChange > 0) {
          sentiment = "weakening_bullish";
        } else if (netChange < 0) {
          sentiment = "weakening_bullish";
        } else {
          sentiment = "bullish";
        }
      } else if (netPosition < 0) {
        if (ncLongChange > 0 && ncShortChange < 0) {
          sentiment = "weakening_bearish";
        } else if (netChange > 0) {
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

      // Save to history if we have a user
      if (userId && reportDate) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceKey);
        
        await adminClient.from("cot_history").upsert({
          user_id: userId,
          symbol,
          report_date: reportDate,
          nc_long: ncLong,
          nc_short: ncShort,
          nc_net: netPosition,
          nc_long_change: ncLongChange,
          nc_short_change: ncShortChange,
          open_interest: openInterest,
        }, { onConflict: "user_id,symbol,report_date" });
      }
    }

    return new Response(JSON.stringify({ success: true, data: results }), {
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
