import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const COT_CODES: Record<string, { code: string; name: string }> = {
  NQ: { code: "209742", name: "NASDAQ MINI" },
  ES: { code: "13874", name: "S&P 500" },
};

function parseNumber(s: string): number {
  return parseInt(s.replace(/,/g, "").replace(/\+/g, ""), 10) || 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const results: Record<string, any> = {};

    for (const [symbol, cfg] of Object.entries(COT_CODES)) {
      const url = `https://www.tradingster.com/cot/legacy-futures/${cfg.code}`;
      const resp = await fetch(url);
      const html = await resp.text();

      let ncLong = 0, ncShort = 0, ncLongChange = 0, ncShortChange = 0;
      let openInterest = 0;
      let reportDate = "";

      const dateMatch = html.match(/AS OF:\\s*(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) reportDate = dateMatch[1];

      const oiMatch = html.match(/Open Interest:\\s*([\d,]+)/);
      if (oiMatch) openInterest = parseNumber(oiMatch[1]);

      const tableMatch = html.match(/<table[^>]*class="[^"]*table[^"]*"[^>]*>([\s\S]*?)<\/table>/i);

      if (tableMatch) {
        const tableHtml = tableMatch[1];
        const rows = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        
        for (const row of rows) {
          const cells = (row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi) || []).map(c => 
            c.replace(/<[^>]*>/g, "").trim()
          );
          
          if (cells.length >= 9 && !cells[0].includes("Changes") && !cells[0].includes("%") && !cells[0].includes("Traders")) {
            const nums = cells.filter(c => /^[\d,]+$/.test(c.replace(/\s/g, "")));
            if (nums.length >= 2) {
              ncLong = parseNumber(nums[0]);
              ncShort = parseNumber(nums[1]);
            }
          }
          
          if (cells.some(c => c.includes("+") || c.includes("-")) && cells.length >= 7) {
            const changeNums = cells.filter(c => /^[+-]?[\d,]+$/.test(c.replace(/\s/g, "")));
            if (changeNums.length >= 2) {
              ncLongChange = parseNumber(changeNums[0]);
              ncShortChange = parseNumber(changeNums[1]);
            }
          }
        }
      }

      if (ncLong === 0) {
        const allNums = html.match(/(?:<td[^>]*>)\s*([\d,]+)\s*(?:<\/td>)/g);
        if (allNums && allNums.length >= 10) {
          const cleaned = allNums.map(m => parseNumber(m.replace(/<[^>]*>/g, "").trim()));
          if (cleaned.length >= 9) {
            ncLong = cleaned[0];
            ncShort = cleaned[1];
          }
        }
        
        const changeNums = html.match(/(?:<td[^>]*>)\s*([+-][\d,]+)\s*(?:<\/td>)/g);
        if (changeNums && changeNums.length >= 2) {
          const cleaned = changeNums.map(m => parseNumber(m.replace(/<[^>]*>/g, "").trim()));
          ncLongChange = cleaned[0];
          ncShortChange = cleaned[1];
        }
      }

      const netPosition = ncLong - ncShort;
      const netChange = ncLongChange - ncShortChange;

      // Improved sentiment logic:
      // - If net positive AND weekly shift is bullish/unchanged → bullish
      // - If net positive BUT weekly shift is bearish → weakening_bullish
      // - If net negative AND weekly shift is bearish/unchanged → bearish
      // - If net negative BUT weekly shift is bullish → weakening_bearish
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
