import { useState } from 'react';
import JSZip from 'jszip';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, Loader2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfYear, subDays, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Trade = Database['public']['Tables']['trades']['Row'];
type JournalEntry = Database['public']['Tables']['journal_entries']['Row'];

interface JournalExportProps {
  trades: Trade[];
  defaultMonth: Date;
}

type ExportFormat = 'html' | 'zip' | 'tradezella';
type RangePreset = 'currentMonth' | 'last30' | 'last90' | 'ytd' | 'all' | 'custom';

// Fetch image URL and convert to base64
async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function imageUrlToBlob(url: string): Promise<{ blob: Blob; ext: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const ext = blob.type.split('/')[1]?.split('+')[0] || 'png';
    return { blob, ext };
  } catch {
    return null;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const csvEscape = (v: any) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// TradeZella CSV columns (compatible with their importer).
// Reference: TradeZella import expects ISO datetime in Entry/Exit Date columns,
// "Long"/"Short" side, "Future"/"Stock"/"Crypto"/"Forex" asset type, and signed PnL.
function tradesToTradeZellaCsv(trades: Trade[]): string {
  const headers = [
    'Symbol',
    'Asset Type',
    'Side',
    'Quantity',
    'Entry Price',
    'Exit Price',
    'Entry Date',
    'Exit Date',
    'Stop Loss',
    'Take Profit',
    'Commission',
    'Fees',
    'PnL',
    'Strategy',
    'Tags',
    'Notes',
    'Status',
  ];

  // TradeZella asset-type normalization
  const assetTypeMap: Record<string, string> = {
    'Futures': 'Future',
    'Future': 'Future',
    'Stocks': 'Stock',
    'Stock': 'Stock',
    'Crypto': 'Crypto',
    'Forex': 'Forex',
  };

  // YYYY-MM-DD HH:mm:ss in local-ish ISO (TradeZella accepts ISO 8601 too)
  const fmtDate = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const rows = trades.map(t => {
    const assetType = assetTypeMap[t.asset_type ?? ''] ?? (t.asset_type ?? 'Stock');
    const side = t.direction?.toLowerCase() === 'short' ? 'Short' : 'Long';
    const qty = Math.abs(Number(t.quantity ?? 0)) || '';
    const status = t.status === 'closed' ? 'Closed' : 'Open';
    return [
      t.symbol?.toUpperCase() ?? '',
      assetType,
      side,
      qty,
      t.entry_price ?? '',
      t.exit_price ?? '',
      fmtDate(t.entry_date),
      fmtDate(t.exit_date),
      t.stop_loss ?? '',
      t.take_profit ?? '',
      t.fees ?? 0,
      t.fees ?? 0,
      t.pnl ?? '',
      t.strategy ?? '',
      (t.tags ?? []).join('|'),
      (t.notes ?? '').replace(/\r?\n/g, ' '),
      status,
    ];
  });
  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
}

function buildHtmlReport(opts: {
  title: string;
  fromStr: string;
  toStr: string;
  journals: JournalEntry[];
  trades: Trade[];
  weeklySummaries: Record<string, string>;
  imageMap: Record<string, string>; // url -> dataUrl OR relative path
}): string {
  const { title, fromStr, toStr, journals, trades, weeklySummaries, imageMap } = opts;
  const tradesByDate: Record<string, Trade[]> = {};
  trades.forEach(t => {
    const d = t.entry_date?.slice(0, 10);
    if (!d) return;
    if (!tradesByDate[d]) tradesByDate[d] = [];
    tradesByDate[d].push(t);
  });
  const journalDates = new Set(journals.map(j => j.date));
  const allDates = Array.from(new Set([...journalDates, ...Object.keys(tradesByDate)])).sort();

  const totalPnl = trades
    .filter(t => t.status === 'closed' && t.pnl != null)
    .reduce((s, t) => s + (t.pnl ?? 0), 0);
  const winners = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const losers = trades.filter(t => (t.pnl ?? 0) < 0).length;

  let html = `<!DOCTYPE html><html lang="he" dir="auto"><head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 960px; margin: 0 auto; padding: 24px; color: #1a1a2e; background: #fafafa; }
  h1 { text-align: center; border-bottom: 3px solid #4f46e5; padding-bottom: 12px; margin-bottom: 8px; }
  .subtitle { text-align: center; color: #666; margin-bottom: 24px; font-size: 14px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 32px; }
  .stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px; text-align: center; }
  .stat-label { font-size: 11px; text-transform: uppercase; color: #888; letter-spacing: 0.5px; }
  .stat-value { font-size: 22px; font-weight: bold; font-family: monospace; margin-top: 4px; }
  .pnl-pos { color: #16a34a; }
  .pnl-neg { color: #dc2626; }
  .entry { page-break-inside: avoid; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; margin-bottom: 18px; }
  .entry-date { font-size: 18px; font-weight: bold; margin-bottom: 10px; color: #1e1b4b; display: flex; align-items: center; gap: 10px; }
  .mood-badge { display: inline-block; background: #ede9fe; color: #5b21b6; padding: 3px 12px; border-radius: 14px; font-size: 12px; font-weight: 500; }
  .day-pnl { margin-left: auto; font-family: monospace; font-size: 16px; }
  .section { margin: 12px 0; }
  .section-title { font-size: 11px; text-transform: uppercase; color: #4f46e5; margin-bottom: 4px; font-weight: bold; letter-spacing: 0.5px; }
  .section-content { white-space: pre-wrap; line-height: 1.6; font-size: 14px; color: #374151; }
  .trades-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
  .trades-table th, .trades-table td { border: 1px solid #e5e7eb; padding: 6px 9px; text-align: left; }
  .trades-table th { background: #f3f4f6; font-weight: 600; }
  .screenshots { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin-top: 10px; }
  .screenshot { width: 100%; border-radius: 6px; border: 1px solid #e5e7eb; }
  .weekly-summary { background: #eef2ff; border-left: 4px solid #4f46e5; padding: 14px; margin-bottom: 20px; border-radius: 6px; }
  .weekly-summary strong { color: #3730a3; }
  @media print {
    body { background: #fff; padding: 0; }
    .entry, .stat-card { break-inside: avoid; }
  }
</style>
</head><body>
<h1>📓 ${escapeHtml(title)}</h1>
<div class="subtitle">${escapeHtml(fromStr)} — ${escapeHtml(toStr)}</div>

<div class="summary">
  <div class="stat-card"><div class="stat-label">Total Trades</div><div class="stat-value">${trades.length}</div></div>
  <div class="stat-card"><div class="stat-label">Net P&L</div><div class="stat-value ${totalPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(2)}</div></div>
  <div class="stat-card"><div class="stat-label">Winners</div><div class="stat-value pnl-pos">${winners}</div></div>
  <div class="stat-card"><div class="stat-label">Losers</div><div class="stat-value pnl-neg">${losers}</div></div>
</div>
`;

  // Weekly summaries section
  const weeklyEntries = Object.entries(weeklySummaries).filter(([_, v]) => v).sort();
  if (weeklyEntries.length > 0) {
    html += `<h2 style="font-size:18px;color:#3730a3;margin-top:24px;">📅 Weekly Summaries</h2>`;
    weeklyEntries.forEach(([weekStart, summary]) => {
      html += `<div class="weekly-summary"><strong>Week of ${escapeHtml(weekStart)}:</strong><br>${escapeHtml(summary)}</div>`;
    });
  }

  html += `<h2 style="font-size:18px;color:#3730a3;margin-top:24px;">📝 Daily Entries</h2>`;

  allDates.forEach(date => {
    const j = journals.find(x => x.date === date);
    const dayTrades = tradesByDate[date] ?? [];
    const dayPnl = dayTrades
      .filter(t => t.status === 'closed' && t.pnl != null)
      .reduce((s, t) => s + (t.pnl ?? 0), 0);

    html += `<div class="entry"><div class="entry-date">${escapeHtml(date)}`;
    if (j?.mood) html += `<span class="mood-badge">${escapeHtml(j.mood)}</span>`;
    if (dayTrades.length > 0) {
      html += `<span class="day-pnl ${dayPnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${dayPnl >= 0 ? '+' : ''}$${dayPnl.toFixed(2)}</span>`;
    }
    html += `</div>`;

    if (j?.pre_market_notes) html += `<div class="section"><div class="section-title">Pre-Market Notes</div><div class="section-content">${escapeHtml(j.pre_market_notes)}</div></div>`;
    if (j?.post_market_notes) html += `<div class="section"><div class="section-title">Post-Market Review</div><div class="section-content">${escapeHtml(j.post_market_notes)}</div></div>`;
    if (j?.lessons) html += `<div class="section"><div class="section-title">Lessons Learned</div><div class="section-content">${escapeHtml(j.lessons)}</div></div>`;

    if (dayTrades.length > 0) {
      html += `<div class="section"><div class="section-title">Trades (${dayTrades.length})</div>`;
      html += `<table class="trades-table"><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>SL</th><th>TP</th><th>P&L</th><th>Strategy</th></tr>`;
      dayTrades.forEach(t => {
        const cls = (t.pnl ?? 0) >= 0 ? 'pnl-pos' : 'pnl-neg';
        html += `<tr>
          <td><b>${escapeHtml(t.symbol)}</b></td>
          <td>${escapeHtml(t.direction.toUpperCase())}</td>
          <td>${t.quantity}</td>
          <td>$${t.entry_price}</td>
          <td>${t.exit_price != null ? '$' + t.exit_price : '<i>open</i>'}</td>
          <td>${t.stop_loss != null ? '$' + t.stop_loss : '—'}</td>
          <td>${t.take_profit != null ? '$' + t.take_profit : '—'}</td>
          <td class="${cls}">${t.pnl != null ? (t.pnl >= 0 ? '+' : '') + '$' + t.pnl.toFixed(2) : '—'}</td>
          <td>${escapeHtml(t.strategy ?? '—')}</td>
        </tr>`;
        if (t.notes) {
          html += `<tr><td colspan="9" style="background:#fafafa;font-size:11px;color:#666;"><b>Notes:</b> ${escapeHtml(t.notes)}</td></tr>`;
        }
      });
      html += `</table>`;

      const screenshots = dayTrades.filter(t => t.screenshot_url);
      if (screenshots.length > 0) {
        html += `<div class="screenshots">`;
        screenshots.forEach(t => {
          const src = imageMap[t.screenshot_url!] ?? t.screenshot_url;
          html += `<img class="screenshot" src="${escapeHtml(src!)}" alt="${escapeHtml(t.symbol)} screenshot" />`;
        });
        html += `</div>`;
      }
      html += `</div>`;
    }

    html += `</div>`;
  });

  html += `</body></html>`;
  return html;
}

export function JournalExport({ trades, defaultMonth }: JournalExportProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [format_, setFormat] = useState<ExportFormat>('html');
  const [preset, setPreset] = useState<RangePreset>('currentMonth');
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(defaultMonth), 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(endOfMonth(defaultMonth), 'yyyy-MM-dd'));

  const computeRange = (): { from: string; to: string } => {
    const today = new Date();
    switch (preset) {
      case 'currentMonth':
        return { from: format(startOfMonth(defaultMonth), 'yyyy-MM-dd'), to: format(endOfMonth(defaultMonth), 'yyyy-MM-dd') };
      case 'last30':
        return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'last90':
        return { from: format(subDays(today, 90), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'ytd':
        return { from: format(startOfYear(today), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') };
      case 'all':
        return { from: '1970-01-01', to: format(today, 'yyyy-MM-dd') };
      case 'custom':
        return { from: customFrom, to: customTo };
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const { from, to } = computeRange();
      setProgress('Fetching journal entries...');

      const [journalsRes, weeklyRes] = await Promise.all([
        supabase.from('journal_entries').select('*').gte('date', from).lte('date', to).order('date'),
        supabase.from('weekly_summaries').select('*').gte('week_start', from).lte('week_start', to),
      ]);
      const journals = (journalsRes.data ?? []) as JournalEntry[];
      const weeklySummaries: Record<string, string> = {};
      ((weeklyRes.data ?? []) as any[]).forEach((w: any) => {
        weeklySummaries[w.week_start] = w.summary;
      });

      const fromTs = parseISO(from + 'T00:00:00').getTime();
      const toTs = parseISO(to + 'T23:59:59').getTime();
      const rangeTrades = trades.filter(t => {
        const tt = new Date(t.entry_date).getTime();
        return tt >= fromTs && tt <= toTs;
      });

      const title = `Trading Journal — ${from} to ${to}`;

      if (format_ === 'tradezella') {
        const csv = tradesToTradeZellaCsv(rangeTrades);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tradezella-export-${from}-to-${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('TradeZella CSV exported');
      } else if (format_ === 'html') {
        // Embed images as base64
        const imageMap: Record<string, string> = {};
        const urls = Array.from(new Set(rangeTrades.filter(t => t.screenshot_url).map(t => t.screenshot_url!)));
        for (let i = 0; i < urls.length; i++) {
          setProgress(`Embedding image ${i + 1}/${urls.length}...`);
          const dataUrl = await imageUrlToDataUrl(urls[i]);
          if (dataUrl) imageMap[urls[i]] = dataUrl;
        }
        setProgress('Building HTML...');
        const html = buildHtmlReport({
          title, fromStr: from, toStr: to, journals, trades: rangeTrades, weeklySummaries, imageMap,
        });
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-${from}-to-${to}.html`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Journal HTML exported');
      } else {
        // ZIP: html with relative img paths + images folder + tradezella csv
        const zip = new JSZip();
        const imgFolder = zip.folder('images')!;
        const imageMap: Record<string, string> = {};
        const urls = Array.from(new Set(rangeTrades.filter(t => t.screenshot_url).map(t => t.screenshot_url!)));
        for (let i = 0; i < urls.length; i++) {
          setProgress(`Downloading image ${i + 1}/${urls.length}...`);
          const res = await imageUrlToBlob(urls[i]);
          if (res) {
            const tradeForUrl = rangeTrades.find(t => t.screenshot_url === urls[i]);
            const safeName = `${tradeForUrl?.symbol ?? 'img'}-${i + 1}.${res.ext}`;
            imgFolder.file(safeName, res.blob);
            imageMap[urls[i]] = `images/${safeName}`;
          }
        }
        setProgress('Building report...');
        const html = buildHtmlReport({
          title, fromStr: from, toStr: to, journals, trades: rangeTrades, weeklySummaries, imageMap,
        });
        zip.file('journal.html', html);
        zip.file('tradezella-export.csv', tradesToTradeZellaCsv(rangeTrades));
        zip.file('README.txt',
`Trading Journal Export
Range: ${from} to ${to}
Generated: ${new Date().toISOString()}

Files:
  journal.html              - Full visual report (open in any browser)
  tradezella-export.csv     - TradeZella-compatible CSV import
  images/                   - All trade screenshots

To save journal.html as PDF: open in browser → Print → Save as PDF.
`);
        setProgress('Compressing...');
        const blob = await zip.generateAsync({ type: 'blob' }, (m) => {
          setProgress(`Compressing... ${Math.floor(m.percent)}%`);
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journal-${from}-to-${to}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Journal ZIP exported with all data');
      }

      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Export failed');
    } finally {
      setExporting(false);
      setProgress('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-1" />Export Journal
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Export Journal</DialogTitle>
          <DialogDescription>Save your journal with all entries, trades, and screenshots.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Format</Label>
            <RadioGroup value={format_} onValueChange={(v) => setFormat(v as ExportFormat)}>
              <div className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-accent/50">
                <RadioGroupItem value="html" id="fmt-html" className="mt-0.5" />
                <Label htmlFor="fmt-html" className="cursor-pointer flex-1 font-normal">
                  <div className="font-semibold text-sm">Standalone HTML</div>
                  <div className="text-xs text-muted-foreground">Single file with embedded images. Open in any browser, print to PDF.</div>
                </Label>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-accent/50">
                <RadioGroupItem value="zip" id="fmt-zip" className="mt-0.5" />
                <Label htmlFor="fmt-zip" className="cursor-pointer flex-1 font-normal">
                  <div className="font-semibold text-sm">Full Backup (ZIP)</div>
                  <div className="text-xs text-muted-foreground">HTML + images folder + TradeZella CSV. Best for backup & migration.</div>
                </Label>
              </div>
              <div className="flex items-start gap-2 p-2 rounded-lg border border-border hover:bg-accent/50">
                <RadioGroupItem value="tradezella" id="fmt-tz" className="mt-0.5" />
                <Label htmlFor="fmt-tz" className="cursor-pointer flex-1 font-normal">
                  <div className="font-semibold text-sm">TradeZella CSV</div>
                  <div className="text-xs text-muted-foreground">Trades only, ready to import into TradeZella.</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Date Range</Label>
            <RadioGroup value={preset} onValueChange={(v) => setPreset(v as RangePreset)} className="grid grid-cols-2 gap-2">
              {[
                { v: 'currentMonth', l: 'Current Month' },
                { v: 'last30', l: 'Last 30 Days' },
                { v: 'last90', l: 'Last 90 Days' },
                { v: 'ytd', l: 'Year to Date' },
                { v: 'all', l: 'All Time' },
                { v: 'custom', l: 'Custom Range' },
              ].map(o => (
                <div key={o.v} className="flex items-center gap-2">
                  <RadioGroupItem value={o.v} id={`range-${o.v}`} />
                  <Label htmlFor={`range-${o.v}`} className="cursor-pointer text-sm font-normal">{o.l}</Label>
                </div>
              ))}
            </RadioGroup>

            {preset === 'custom' && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">From</Label>
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">To</Label>
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {progress && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> {progress}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={exporting}>Cancel</Button>
          <Button onClick={handleExport} disabled={exporting}>
            {exporting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Exporting...</> : <><Download className="h-4 w-4 mr-1" />Export</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
