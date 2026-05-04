import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { trade, mode, tone = 'encouraging', scope = 'written', qa = [] } = body;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!trade) {
      return new Response(JSON.stringify({ error: "No trade provided." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const holdTimeMin = trade.exit_date && trade.entry_date
      ? ((new Date(trade.exit_date).getTime() - new Date(trade.entry_date).getTime()) / 60000).toFixed(1)
      : 'N/A';

    const pnlStr = trade.pnl !== null && trade.pnl !== undefined ? `$${Number(trade.pnl).toFixed(2)}` : 'Open';
    const rrRatio = trade.stop_loss && trade.take_profit && trade.entry_price
      ? (Math.abs(trade.take_profit - trade.entry_price) / Math.abs(trade.entry_price - trade.stop_loss)).toFixed(2)
      : 'N/A';

    const toneInstruction = tone === 'strict'
      ? 'הטון שלך הוא מחמיר, ישיר, ללא ריפוד. אל תרכך — הצבע על דפוסים בעייתיים בבירור. עדיין מקצועי, לא משפיל.'
      : 'הטון שלך הוא מעודד, אמפתי, מחזק. הדגש את החוזקות. הצע שיפור בעדינות. בנה מוטיבציה.';

    const writtenContent = `יומן פסיכולוגי: ${trade.psych_notes || '— ריק —'}
הערות עסקה: ${trade.notes || '— ריק —'}
אסטרטגיה: ${trade.strategy || '— לא צוינה —'}
תגיות: ${trade.tags?.join(', ') || '— ריק —'}`;

    // --- MODE 1: generate follow-up questions ---
    if (mode === 'psych-questions') {
      const qPrompt = `אתה מאמן פסיכולוגי לסוחרים. ${toneInstruction}

קרא את מה שהסוחר רשם על העסקה הזו:
${writtenContent}

${scope === 'all' ? `הקשר עסקה: ${trade.symbol} ${trade.direction}, PnL ${pnlStr}, משך ${holdTimeMin} דק'.` : ''}

המשימה: צור 3-5 שאלות המשך **ממוקדות** שיעזרו לחשוף את המצב הפסיכולוגי האמיתי לפני שתסכם. השאלות צריכות להיות:
- ספציפיות למה שהוא כתב (לא גנריות)
- חושפות מניעים אמיתיים, רגשות חבויים, דפוסי חשיבה
- קצרות וברורות
- בעברית

החזר JSON בלבד בפורמט: {"questions": ["שאלה 1?", "שאלה 2?", ...]}`;

      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "You are a trading psychology coach. Always reply in Hebrew. Output strictly valid JSON when asked." },
            { role: "user", content: qPrompt },
          ],
          response_format: { type: "json_object" },
          stream: false,
        }),
      });

      if (!r.ok) {
        if (r.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (r.status === 402) return new Response(JSON.stringify({ error: "Payment required." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI gateway error");
      }
      const j = await r.json();
      let questions: string[] = [];
      try {
        const parsed = JSON.parse(j.choices?.[0]?.message?.content || '{}');
        questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 5) : [];
      } catch {
        questions = [];
      }
      if (!questions.length) {
        questions = [
          'מה היה הרגש הדומיננטי שהוביל אותך לכניסה לעסקה הזו?',
          'האם היססת לפני הלחיצה על הכפתור? אם כן, למה?',
          'איך הרגשת ברגע שהעסקה זזה נגדך/לטובתך?',
          'האם פעלת לפי תוכנית, או שינית כללים תוך כדי?',
          'מה הלקח הרגשי המרכזי שאתה לוקח מכאן?',
        ];
      }
      return new Response(JSON.stringify({ questions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPsych = mode === 'psych';

    const qaSection = qa && qa.length
      ? `\n\nתשובות הסוחר לשאלות המשך:\n${qa.map((x: any, i: number) => `שאלה ${i + 1}: ${x.q}\nתשובה: ${x.a || '(לא ענה)'}`).join('\n\n')}`
      : '';

    const prompt = isPsych ? `אתה מאמן פסיכולוגי לסוחרים. ${toneInstruction}

${scope === 'written'
  ? 'נתח אך ורק את מה שהסוחר רשם — אל תשפוט לפי PnL או תוצאה.'
  : 'נתח גם את מה שרשם וגם את הביצועים בפועל.'} כתוב בעברית.

מה שהסוחר רשם:
${writtenContent}
${qaSection}

${scope === 'all' ? `\nנתוני עסקה: ${trade.symbol} ${trade.direction}, PnL ${pnlStr}, R:R ${rrRatio}, משך ${holdTimeMin} דק'.` : `הקשר מינימלי (אל תשפוט לפי זה): ${trade.symbol} ${trade.direction}, משך ${holdTimeMin} דק'.`}

בנה ניתוח פסיכולוגי עם הסעיפים (אימוג'י):
1. **🧠 דפוסי חשיבה שזוהו** — FOMO, נקמה, היסוס, יוהרה, ביטחון בריא וכו'
2. **❤️ מצב רגשי** — איזה מצב רגשי נחשף בכתיבה ובתשובות
3. **⚠️ דגלים אדומים** — סימני אזהרה התנהגותיים (אם יש)
4. **✨ חוזקות שזוהו** — מה הסוחר עשה נכון מנטלית
5. **🎯 משימה אחת לפעם הבאה** — תרגיל מנטלי קונקרטי אחד

עד 250 מילים.`
    : `You are a professional trading coach writing a journal summary for a single trade. Write in Hebrew. Be specific and actionable.

Trade Details:
- Symbol: ${trade.symbol}
- Direction: ${trade.direction}
- Entry: $${trade.entry_price} on ${trade.entry_date?.slice(0, 16)}
- Exit: ${trade.exit_price ? `$${trade.exit_price}` : 'Still open'} ${trade.exit_date ? `on ${trade.exit_date.slice(0, 16)}` : ''}
- P&L: ${pnlStr} ${trade.pnl_percent ? `(${trade.pnl_percent.toFixed(2)}%)` : ''}
- Quantity: ${trade.quantity}
- Fees: $${trade.fees ?? 0}
- Stop Loss: ${trade.stop_loss ? `$${trade.stop_loss}` : 'None'}
- Take Profit: ${trade.take_profit ? `$${trade.take_profit}` : 'None'}
- R:R Ratio: ${rrRatio}
- Hold Time: ${holdTimeMin} minutes
- Strategy: ${trade.strategy || 'None'}
- Asset Type: ${trade.asset_type || 'Unknown'}
- Tags: ${trade.tags?.join(', ') || 'None'}
- Notes: ${trade.notes || 'None'}

Provide a concise journal entry with these sections (use emojis for headers):
1. **📝 סיכום העסקה** - One-line summary of what happened
2. **✅ מה הלך טוב** - What was done well (entry timing, risk management, etc.)
3. **⚠️ מה לשפר** - What could be improved
4. **🎯 ציון העסקה** - Grade A-F with brief justification
5. **💡 לקח מרכזי** - One key takeaway for future trades

Keep it focused and under 200 words total.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a professional trading journal AI. Always respond in Hebrew. Be concise and actionable." },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const aiData = await response.json();
    const summary = aiData.choices?.[0]?.message?.content || "No summary generated.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("trade-journal-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
