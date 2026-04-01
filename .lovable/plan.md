

# Implementation Plan

## Summary
This plan addresses 8 distinct issues: Cumulative PnL chart coloring, unrealized PnL for open trades, TradingView zoom to entry, strategy editing in trade detail, scale in/out PnL calculation, data sync across devices, and a calendar-based Daily Journal with weekly summaries.

---

## 1. Cumulative PnL — Green above 0, Purple below 0

**Problem**: The chart uses a single green Area regardless of whether PnL is positive or negative.

**Fix** in `src/pages/Dashboard.tsx`:
- Split the cumulative data into two area series: `pnlPositive` (value when >= 0, else 0) and `pnlNegative` (value when < 0, else 0).
- Render two `<Area>` components — one green with green gradient, one purple with purple gradient.
- Use a single `pnl` line for the stroke so it looks continuous, colored dynamically via a `<linearGradient>` based on the reference line at y=0, or simpler: keep both areas and set the stroke on each.

---

## 2. Unrealized PnL for Open Trades

**Problem**: Open trades show no P&L because there's no exit price.

**Fix**:
- Create a backend function `yahoo-finance` (already exists) or use the existing `stock-data` edge function to fetch current prices.
- In `TradeDetail.tsx`, when `trade.status === 'open'`, fetch the current market price via the edge function and calculate unrealized PnL.
- Display it as "Unrealized P&L" with a distinct label in the stats panel.
- In the trades list (`Trades.tsx`), show unrealized PnL for open trades in the PnL column with a different styling (e.g., italic or a "~" prefix).

---

## 3. TradingView — Zoom to Trade Entry

**Problem**: The chart loads at the default zoom level, not focused on the trade's entry time.

**Fix** in `src/components/trades/TradingViewWidget.tsx`:
- The TradingView embed widget doesn't support programmatic zoom via the embed URL. However, we can set the `range` parameter to focus on the trade period.
- Calculate appropriate `from` and `to` timestamps based on `entryDate` and `exitDate` (or current date for open trades), with some padding.
- Unfortunately, the embed widget has limited control. The best approach is to switch the interval based on trade duration (e.g., 1min for intraday, 15min for multi-day) to naturally show the trade period.

---

## 4. Strategy Editing in Trade Detail

**Problem**: The Strategy field in TradeDetail shows text but isn't editable — no dropdown to select a blueprint.

**Fix** in `src/components/trades/TradeDetail.tsx`:
- Import and query blueprints from the database when in edit mode.
- Replace the static `StatRow label="Strategy"` with a `<Select>` dropdown populated with the user's blueprints (name + tier).
- Update `form.strategy` on selection.

---

## 5. Scale In/Out PnL Calculation

**Problem**: Executions (scale in/out) are logged but don't affect the trade's P&L calculation.

**Fix** in `src/components/trades/TradeDetail.tsx` (`handleSave`):
- When saving, fetch all executions for this trade.
- Calculate weighted average entry price from all entry executions (including the main trade entry).
- Calculate weighted average exit price from all exit executions.
- Use these averages plus total quantity to compute the correct P&L.
- For futures, use `calculateFuturesPnl` with the averaged prices.

---

## 6. Data Not Syncing Across Devices

**Problem**: The user reports data doesn't appear on another computer with the same account. This is likely a client-side caching or localStorage issue, NOT a database issue (RLS policies look correct).

**Investigation**: The `useTrades` hook uses `react-query` which caches in memory. Dashboard widget preferences use `localStorage`. The actual trade data should sync fine since it's fetched from the database.

**Fix**:
- Verify that the `useTrades` query doesn't have `staleTime: Infinity` or similar aggressive caching.
- The issue might be that `selectedAccount` defaults to a specific account name stored in localStorage that doesn't exist on the other device. Check `useSelectedAccount` hook — if it defaults to a specific account name that was set on device A, device B might show nothing.
- Fix `useSelectedAccount` to default to `'all'` if the stored account doesn't exist in the user's accounts list.

---

## 7. Daily Journal — Calendar View with Weekly Summary

**Problem**: Current journal is a single-day view with arrow navigation. User wants a calendar grid.

**Redesign** `src/pages/Journal.tsx`:
- Add a monthly calendar grid at the top showing Sunday–Saturday.
- Each day cell is color-coded:
  - **Green**: journal entry exists (traded or not)
  - **Red**: trades exist for that day but no journal entry
  - **No color**: no trades and no journal entry
- Clicking a day opens/expands the day's journal form below the calendar.
- Add a "Weekly Summary" text area at the end of each week row (or as a separate section).
- Store weekly summaries — either in `journal_entries` with a special flag, or in a new field. Simplest: add a `weekly_summary` column to `journal_entries` on the Sunday entry, or create a small section that saves to the Sunday's `lessons` field. Better: use a convention where the Sunday entry's `lessons` field doubles as the weekly summary, or add a dedicated section that writes to `journal_entries` with a date = week start.

**Database**: Add a new table `weekly_summaries` with columns: `id`, `user_id`, `week_start` (date), `summary` (text), `created_at`, `updated_at`. Or simpler: store in journal_entries for the Sunday of that week.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Fix Cumulative PnL dual-color chart |
| `src/components/trades/TradeDetail.tsx` | Add strategy dropdown, unrealized PnL, scale in/out calculation |
| `src/components/trades/TradingViewWidget.tsx` | Auto-select interval based on trade duration |
| `src/pages/Journal.tsx` | Full rewrite to calendar-based layout with weekly summaries |
| `src/hooks/useSelectedAccount.tsx` | Fix default account to prevent empty data on new devices |
| Database migration | Add `weekly_summaries` table |

---

## Implementation Order
1. Cumulative PnL chart fix (quick)
2. Strategy editing in TradeDetail (quick)
3. Scale in/out PnL calculation
4. Fix cross-device data sync
5. Unrealized PnL for open trades
6. TradingView interval adjustment
7. Journal calendar redesign + weekly summaries (largest task)

