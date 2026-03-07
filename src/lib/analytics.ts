import type { Database } from '@/integrations/supabase/types';
import { format, parseISO, differenceInMinutes, differenceInCalendarDays, getDay, getHours } from 'date-fns';

type Trade = Database['public']['Tables']['trades']['Row'];

export interface AnalyticsResult {
  category: string;
  metrics: { name: string; value: string | number; description: string }[];
}

export function computeFullAnalytics(trades: Trade[]): AnalyticsResult[] {
  const closed = trades.filter(t => t.status === 'closed' && t.pnl !== null);
  const open = trades.filter(t => t.status === 'open');
  const wins = closed.filter(t => (t.pnl ?? 0) > 0);
  const losses = closed.filter(t => (t.pnl ?? 0) < 0);
  const breakeven = closed.filter(t => (t.pnl ?? 0) === 0);
  const longs = closed.filter(t => t.direction === 'long');
  const shorts = closed.filter(t => t.direction === 'short');
  const longWins = longs.filter(t => (t.pnl ?? 0) > 0);
  const shortWins = shorts.filter(t => (t.pnl ?? 0) > 0);

  const pnls = closed.map(t => t.pnl ?? 0);
  const totalPnl = pnls.reduce((s, v) => s + v, 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl ?? 0), 0));
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const lossRate = closed.length > 0 ? (losses.length / closed.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
  const expectancy = closed.length > 0 ? totalPnl / closed.length : 0;
  const expectancyR = avgLoss > 0 ? expectancy / avgLoss : 0;

  // Consecutive
  let maxConsecWins = 0, maxConsecLosses = 0, curW = 0, curL = 0;
  let maxConsecWinAmt = 0, maxConsecLossAmt = 0, curWAmt = 0, curLAmt = 0;
  closed.forEach(t => {
    const p = t.pnl ?? 0;
    if (p > 0) { curW++; curWAmt += p; curL = 0; curLAmt = 0; maxConsecWins = Math.max(maxConsecWins, curW); maxConsecWinAmt = Math.max(maxConsecWinAmt, curWAmt); }
    else if (p < 0) { curL++; curLAmt += Math.abs(p); curW = 0; curWAmt = 0; maxConsecLosses = Math.max(maxConsecLosses, curL); maxConsecLossAmt = Math.max(maxConsecLossAmt, curLAmt); }
    else { curW = 0; curL = 0; curWAmt = 0; curLAmt = 0; }
  });

  // Drawdown
  let peak = 0, maxDD = 0, cumPnl = 0, maxDDPct = 0;
  const equityCurve: number[] = [];
  closed.forEach(t => {
    cumPnl += t.pnl ?? 0;
    equityCurve.push(cumPnl);
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
    if (peak > 0) { const ddPct = (dd / peak) * 100; maxDDPct = Math.max(maxDDPct, ddPct); }
  });

  // Recovery factor
  const recoveryFactor = maxDD > 0 ? totalPnl / maxDD : 0;

  // Sharpe-like ratio (simplified)
  const mean = closed.length > 0 ? totalPnl / closed.length : 0;
  const variance = closed.length > 1 ? pnls.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (closed.length - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(252) : 0;

  // Sortino (downside deviation)
  const downsideReturns = pnls.filter(v => v < 0);
  const downsideVariance = downsideReturns.length > 0 ? downsideReturns.reduce((s, v) => s + v * v, 0) / downsideReturns.length : 0;
  const downsideDev = Math.sqrt(downsideVariance);
  const sortino = downsideDev > 0 ? (mean / downsideDev) * Math.sqrt(252) : 0;

  // Calmar
  const calmar = maxDD > 0 ? (totalPnl / maxDD) : 0;

  // Holding period
  const holdingPeriods = closed.filter(t => t.exit_date).map(t =>
    differenceInMinutes(parseISO(t.exit_date!), parseISO(t.entry_date))
  );
  const avgHoldMinutes = holdingPeriods.length > 0 ? holdingPeriods.reduce((s, v) => s + v, 0) / holdingPeriods.length : 0;

  // By day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const byDay = dayNames.map((name, i) => {
    const dayTrades = closed.filter(t => getDay(parseISO(t.entry_date)) === i);
    const dayPnl = dayTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const dayWins = dayTrades.filter(t => (t.pnl ?? 0) > 0).length;
    return { name, trades: dayTrades.length, pnl: dayPnl, winRate: dayTrades.length > 0 ? (dayWins / dayTrades.length) * 100 : 0 };
  });

  // By hour
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const hourTrades = closed.filter(t => getHours(parseISO(t.entry_date)) === h);
    const hourPnl = hourTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    return { hour: `${h.toString().padStart(2, '0')}:00`, trades: hourTrades.length, pnl: hourPnl };
  }).filter(h => h.trades > 0);

  // By strategy
  const strategies = [...new Set(closed.map(t => t.strategy).filter(Boolean))];
  const byStrategy = strategies.map(s => {
    const st = closed.filter(t => t.strategy === s);
    const stWins = st.filter(t => (t.pnl ?? 0) > 0);
    const stPnl = st.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    return { strategy: s!, trades: st.length, pnl: stPnl, winRate: st.length > 0 ? (stWins.length / st.length) * 100 : 0 };
  });

  // By symbol
  const symbols = [...new Set(closed.map(t => t.symbol))];
  const bySymbol = symbols.map(sym => {
    const st = closed.filter(t => t.symbol === sym);
    const stPnl = st.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const stWins = st.filter(t => (t.pnl ?? 0) > 0);
    return { symbol: sym, trades: st.length, pnl: stPnl, winRate: st.length > 0 ? (stWins.length / st.length) * 100 : 0 };
  });

  // Largest win/loss
  const largestWin = pnls.length > 0 ? Math.max(...pnls) : 0;
  const largestLoss = pnls.length > 0 ? Math.min(...pnls) : 0;

  // Median
  const sorted = [...pnls].sort((a, b) => a - b);
  const median = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  // Z-score (streak analysis)
  const N = closed.length;
  const W = wins.length;
  const L = losses.length;
  let runs = 0;
  if (N > 0) {
    runs = 1;
    for (let i = 1; i < closed.length; i++) {
      if (((closed[i].pnl ?? 0) > 0) !== ((closed[i - 1].pnl ?? 0) > 0)) runs++;
    }
  }
  const zScore = N > 1 && W > 0 && L > 0 ? (runs - ((2 * W * L) / N + 1)) / Math.sqrt((2 * W * L * (2 * W * L - N)) / (N * N * (N - 1))) : 0;

  // Risk of ruin
  const rorWR = winRate / 100;
  const riskOfRuin = rorWR > 0 && rorWR < 1 ? Math.pow((1 - rorWR) / rorWR, 50) * 100 : 0;

  // Kelly
  const kelly = payoffRatio > 0 ? ((rorWR * (payoffRatio + 1) - 1) / payoffRatio) * 100 : 0;

  // CPC Index (Compounding Profit Criteria)
  const cpc = profitFactor !== Infinity ? profitFactor * (winRate / 100) * payoffRatio : 0;

  // Tail ratio
  const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
  const p5 = sorted[Math.floor(sorted.length * 0.05)] ?? 0;
  const tailRatio = Math.abs(p5) > 0 ? Math.abs(p95) / Math.abs(p5) : 0;

  // Outlier-adjusted metrics
  const q1 = sorted[Math.floor(sorted.length * 0.25)] ?? 0;
  const q3 = sorted[Math.floor(sorted.length * 0.75)] ?? 0;
  const iqr = q3 - q1;
  const noOutliers = pnls.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
  const adjMean = noOutliers.length > 0 ? noOutliers.reduce((s, v) => s + v, 0) / noOutliers.length : 0;

  // APPT (Average Profitability Per Trade)
  const appt = (rorWR * avgWin) - ((1 - rorWR) * avgLoss);

  // Ulcer Index
  const ulcerSquares = equityCurve.map((v, i) => {
    const runningPeak = Math.max(...equityCurve.slice(0, i + 1));
    const pctDD = runningPeak > 0 ? ((runningPeak - v) / runningPeak) * 100 : 0;
    return pctDD * pctDD;
  });
  const ulcerIndex = ulcerSquares.length > 0 ? Math.sqrt(ulcerSquares.reduce((s, v) => s + v, 0) / ulcerSquares.length) : 0;

  // Monthly PnL
  const monthlyMap = new Map<string, number>();
  closed.forEach(t => {
    const m = format(parseISO(t.entry_date), 'yyyy-MM');
    monthlyMap.set(m, (monthlyMap.get(m) ?? 0) + (t.pnl ?? 0));
  });
  const monthlyPnls = Array.from(monthlyMap.values());
  const profitableMonths = monthlyPnls.filter(v => v > 0).length;
  const totalMonths = monthlyPnls.length;

  // Weekly PnL
  const weeklyMap = new Map<string, number>();
  closed.forEach(t => {
    const w = format(parseISO(t.entry_date), 'yyyy-ww');
    weeklyMap.set(w, (weeklyMap.get(w) ?? 0) + (t.pnl ?? 0));
  });
  const weeklyPnls = Array.from(weeklyMap.values());
  const profitableWeeks = weeklyPnls.filter(v => v > 0).length;

  // Daily PnL
  const dailyMap = new Map<string, number>();
  closed.forEach(t => {
    const d = format(parseISO(t.entry_date), 'yyyy-MM-dd');
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + (t.pnl ?? 0));
  });
  const dailyPnls = Array.from(dailyMap.values());
  const profitableDays = dailyPnls.filter(v => v > 0).length;
  const tradingDays = dailyPnls.length;

  // Avg trades per day
  const avgTradesPerDay = tradingDays > 0 ? closed.length / tradingDays : 0;

  // Commission stats
  const totalFees = closed.reduce((s, t) => s + (t.fees ?? 0), 0);
  const avgFees = closed.length > 0 ? totalFees / closed.length : 0;
  const feePct = grossProfit > 0 ? (totalFees / grossProfit) * 100 : 0;

  // R-multiple stats
  const rMultiples = closed.filter(t => t.stop_loss && t.entry_price).map(t => {
    const riskPerUnit = Math.abs(t.entry_price - (t.stop_loss ?? t.entry_price));
    return riskPerUnit > 0 ? (t.pnl ?? 0) / (riskPerUnit * t.quantity) : 0;
  });
  const avgR = rMultiples.length > 0 ? rMultiples.reduce((s, v) => s + v, 0) / rMultiples.length : 0;
  const maxR = rMultiples.length > 0 ? Math.max(...rMultiples) : 0;
  const minR = rMultiples.length > 0 ? Math.min(...rMultiples) : 0;

  // Skewness & Kurtosis
  const skewness = stdDev > 0 && closed.length > 2 ? (closed.length / ((closed.length - 1) * (closed.length - 2))) * pnls.reduce((s, v) => s + Math.pow((v - mean) / stdDev, 3), 0) : 0;
  const kurtosis = stdDev > 0 && closed.length > 3 ? ((closed.length * (closed.length + 1)) / ((closed.length - 1) * (closed.length - 2) * (closed.length - 3))) * pnls.reduce((s, v) => s + Math.pow((v - mean) / stdDev, 4), 0) - (3 * (closed.length - 1) * (closed.length - 1)) / ((closed.length - 2) * (closed.length - 3)) : 0;

  const f = (v: number, d = 2) => isFinite(v) ? v.toFixed(d) : '0';
  const f0 = (v: number) => isFinite(v) ? v.toFixed(0) : '0';
  const pf = (v: number) => isFinite(v) && v !== Infinity ? v.toFixed(2) : '∞';

  return [
    {
      category: 'Overview',
      metrics: [
        { name: 'Total Trades', value: trades.length, description: 'Total number of trades' },
        { name: 'Closed Trades', value: closed.length, description: 'Number of closed trades' },
        { name: 'Open Trades', value: open.length, description: 'Currently open positions' },
        { name: 'Winners', value: wins.length, description: 'Number of winning trades' },
        { name: 'Losers', value: losses.length, description: 'Number of losing trades' },
        { name: 'Breakeven', value: breakeven.length, description: 'Trades with zero P&L' },
        { name: 'Long Trades', value: longs.length, description: 'Total long trades' },
        { name: 'Short Trades', value: shorts.length, description: 'Total short trades' },
        { name: 'Unique Symbols', value: symbols.length, description: 'Number of different symbols traded' },
        { name: 'Trading Days', value: tradingDays, description: 'Days with at least one trade' },
        { name: 'Avg Trades/Day', value: f(avgTradesPerDay, 1), description: 'Average trades per trading day' },
      ],
    },
    {
      category: 'Profitability',
      metrics: [
        { name: 'Net P&L', value: `$${f(totalPnl)}`, description: 'Total net profit/loss' },
        { name: 'Gross Profit', value: `$${f(grossProfit)}`, description: 'Sum of all winning trades' },
        { name: 'Gross Loss', value: `-$${f(grossLoss)}`, description: 'Sum of all losing trades' },
        { name: 'Profit Factor', value: pf(profitFactor), description: 'Gross profit / gross loss' },
        { name: 'CPC Index', value: f(cpc), description: 'Compounding Profit Criteria' },
        { name: 'APPT', value: `$${f(appt)}`, description: 'Average Profitability Per Trade' },
        { name: 'Expectancy', value: `$${f(expectancy)}`, description: 'Expected value per trade' },
        { name: 'Expectancy (R)', value: `${f(expectancyR)}R`, description: 'Expectancy in R-multiples' },
        { name: 'Average Win', value: `$${f(avgWin)}`, description: 'Average winning trade' },
        { name: 'Average Loss', value: `-$${f(avgLoss)}`, description: 'Average losing trade' },
        { name: 'Largest Win', value: `$${f(largestWin)}`, description: 'Single best trade' },
        { name: 'Largest Loss', value: `$${f(largestLoss)}`, description: 'Single worst trade' },
        { name: 'Median P&L', value: `$${f(median)}`, description: 'Median trade P&L' },
        { name: 'Adjusted Mean', value: `$${f(adjMean)}`, description: 'Mean P&L excluding outliers' },
        { name: 'Payoff Ratio', value: f(payoffRatio), description: 'Avg win / avg loss' },
      ],
    },
    {
      category: 'Win/Loss Rates',
      metrics: [
        { name: 'Win Rate', value: `${f(winRate, 1)}%`, description: 'Percentage of winning trades' },
        { name: 'Loss Rate', value: `${f(lossRate, 1)}%`, description: 'Percentage of losing trades' },
        { name: 'Long Win Rate', value: `${f(longs.length > 0 ? (longWins.length / longs.length) * 100 : 0, 1)}%`, description: 'Win rate for long trades' },
        { name: 'Short Win Rate', value: `${f(shorts.length > 0 ? (shortWins.length / shorts.length) * 100 : 0, 1)}%`, description: 'Win rate for short trades' },
        { name: 'Profitable Days', value: `${profitableDays}/${tradingDays}`, description: 'Days with positive P&L' },
        { name: 'Profitable Weeks', value: `${profitableWeeks}/${weeklyPnls.length}`, description: 'Weeks with positive P&L' },
        { name: 'Profitable Months', value: `${profitableMonths}/${totalMonths}`, description: 'Months with positive P&L' },
        { name: 'Daily Win %', value: `${f(tradingDays > 0 ? (profitableDays / tradingDays) * 100 : 0, 1)}%`, description: '% of profitable days' },
        { name: 'Weekly Win %', value: `${f(weeklyPnls.length > 0 ? (profitableWeeks / weeklyPnls.length) * 100 : 0, 1)}%`, description: '% of profitable weeks' },
        { name: 'Monthly Win %', value: `${f(totalMonths > 0 ? (profitableMonths / totalMonths) * 100 : 0, 1)}%`, description: '% of profitable months' },
      ],
    },
    {
      category: 'Risk Metrics',
      metrics: [
        { name: 'Max Drawdown', value: `-$${f(maxDD)}`, description: 'Maximum peak-to-trough decline' },
        { name: 'Max Drawdown %', value: `${f(maxDDPct, 1)}%`, description: 'Maximum drawdown as percentage' },
        { name: 'Recovery Factor', value: f(recoveryFactor), description: 'Net profit / max drawdown' },
        { name: 'Sharpe Ratio', value: f(sharpe), description: 'Risk-adjusted return (annualized)' },
        { name: 'Sortino Ratio', value: f(sortino), description: 'Downside risk-adjusted return' },
        { name: 'Calmar Ratio', value: f(calmar), description: 'Return / max drawdown' },
        { name: 'Ulcer Index', value: f(ulcerIndex), description: 'Depth and duration of drawdowns' },
        { name: 'Standard Deviation', value: `$${f(stdDev)}`, description: 'Volatility of trade returns' },
        { name: 'Downside Deviation', value: `$${f(downsideDev)}`, description: 'Volatility of negative returns' },
        { name: 'Risk of Ruin', value: `${f(riskOfRuin, 4)}%`, description: 'Probability of total account ruin' },
        { name: 'Kelly Criterion', value: `${f(kelly, 1)}%`, description: 'Optimal bet size' },
        { name: 'Half Kelly', value: `${f(kelly / 2, 1)}%`, description: 'Conservative Kelly sizing' },
        { name: 'Tail Ratio', value: f(tailRatio), description: '95th percentile / 5th percentile' },
        { name: 'Skewness', value: f(skewness), description: 'Distribution asymmetry' },
        { name: 'Kurtosis', value: f(kurtosis), description: 'Distribution tail heaviness' },
        { name: 'Z-Score', value: f(zScore), description: 'Streak dependency analysis' },
      ],
    },
    {
      category: 'Streak Analysis',
      metrics: [
        { name: 'Max Consecutive Wins', value: maxConsecWins, description: 'Longest winning streak' },
        { name: 'Max Consecutive Losses', value: maxConsecLosses, description: 'Longest losing streak' },
        { name: 'Max Consec. Win Amount', value: `$${f(maxConsecWinAmt)}`, description: 'Most $ in a winning streak' },
        { name: 'Max Consec. Loss Amount', value: `-$${f(maxConsecLossAmt)}`, description: 'Most $ lost in a losing streak' },
        { name: 'Total Runs', value: runs, description: 'Number of win/loss streaks' },
      ],
    },
    {
      category: 'R-Multiple Analysis',
      metrics: [
        { name: 'Average R', value: `${f(avgR)}R`, description: 'Average R-multiple per trade' },
        { name: 'Max R', value: `${f(maxR)}R`, description: 'Best R-multiple' },
        { name: 'Min R', value: `${f(minR)}R`, description: 'Worst R-multiple' },
        { name: 'Trades with SL Data', value: rMultiples.length, description: 'Trades with stop loss defined' },
      ],
    },
    {
      category: 'Long vs Short',
      metrics: [
        { name: 'Long Net P&L', value: `$${f(longs.reduce((s, t) => s + (t.pnl ?? 0), 0))}`, description: 'Total P&L from longs' },
        { name: 'Short Net P&L', value: `$${f(shorts.reduce((s, t) => s + (t.pnl ?? 0), 0))}`, description: 'Total P&L from shorts' },
        { name: 'Long Avg P&L', value: `$${f(longs.length > 0 ? longs.reduce((s, t) => s + (t.pnl ?? 0), 0) / longs.length : 0)}`, description: 'Avg P&L per long' },
        { name: 'Short Avg P&L', value: `$${f(shorts.length > 0 ? shorts.reduce((s, t) => s + (t.pnl ?? 0), 0) / shorts.length : 0)}`, description: 'Avg P&L per short' },
        { name: 'Long Largest Win', value: `$${f(longs.length > 0 ? Math.max(...longs.map(t => t.pnl ?? 0)) : 0)}`, description: 'Best long trade' },
        { name: 'Short Largest Win', value: `$${f(shorts.length > 0 ? Math.max(...shorts.map(t => t.pnl ?? 0)) : 0)}`, description: 'Best short trade' },
        { name: 'Long Largest Loss', value: `$${f(longs.length > 0 ? Math.min(...longs.map(t => t.pnl ?? 0)) : 0)}`, description: 'Worst long trade' },
        { name: 'Short Largest Loss', value: `$${f(shorts.length > 0 ? Math.min(...shorts.map(t => t.pnl ?? 0)) : 0)}`, description: 'Worst short trade' },
      ],
    },
    {
      category: 'Commission & Fees',
      metrics: [
        { name: 'Total Fees', value: `$${f(totalFees)}`, description: 'Total commissions paid' },
        { name: 'Avg Fees/Trade', value: `$${f(avgFees)}`, description: 'Average commission per trade' },
        { name: 'Fees as % of Profit', value: `${f(feePct, 1)}%`, description: 'Commissions / gross profit' },
        { name: 'Net After Fees', value: `$${f(totalPnl)}`, description: 'P&L after all fees' },
      ],
    },
    {
      category: 'Time Analysis',
      metrics: [
        { name: 'Avg Hold Time', value: `${f0(avgHoldMinutes)} min`, description: 'Average trade duration' },
        { name: 'Avg Hold (Wins)', value: `${f0(wins.filter(t => t.exit_date).length > 0 ? wins.filter(t => t.exit_date).reduce((s, t) => s + differenceInMinutes(parseISO(t.exit_date!), parseISO(t.entry_date)), 0) / wins.filter(t => t.exit_date).length : 0)} min`, description: 'Avg duration of winners' },
        { name: 'Avg Hold (Losses)', value: `${f0(losses.filter(t => t.exit_date).length > 0 ? losses.filter(t => t.exit_date).reduce((s, t) => s + differenceInMinutes(parseISO(t.exit_date!), parseISO(t.entry_date)), 0) / losses.filter(t => t.exit_date).length : 0)} min`, description: 'Avg duration of losers' },
        ...byDay.filter(d => d.trades > 0).map(d => ({ name: `${d.name} P&L`, value: `$${f(d.pnl)}`, description: `${d.trades} trades, ${f(d.winRate, 0)}% WR` })),
        ...byHour.map(h => ({ name: `${h.hour} P&L`, value: `$${f(h.pnl)}`, description: `${h.trades} trades` })),
      ],
    },
    {
      category: 'By Strategy',
      metrics: byStrategy.length > 0 ? byStrategy.flatMap(s => [
        { name: `${s.strategy} Trades`, value: s.trades, description: `Total trades for ${s.strategy}` },
        { name: `${s.strategy} P&L`, value: `$${f(s.pnl)}`, description: `Net P&L for ${s.strategy}` },
        { name: `${s.strategy} WR`, value: `${f(s.winRate, 1)}%`, description: `Win rate for ${s.strategy}` },
      ]) : [{ name: 'No strategies', value: '—', description: 'No strategy data' }],
    },
    {
      category: 'By Symbol',
      metrics: bySymbol.length > 0 ? bySymbol.flatMap(s => [
        { name: `${s.symbol} Trades`, value: s.trades, description: `Total trades for ${s.symbol}` },
        { name: `${s.symbol} P&L`, value: `$${f(s.pnl)}`, description: `Net P&L for ${s.symbol}` },
        { name: `${s.symbol} WR`, value: `${f(s.winRate, 1)}%`, description: `Win rate for ${s.symbol}` },
      ]) : [{ name: 'No symbols', value: '—', description: 'No symbol data' }],
    },
    {
      category: 'Percentiles',
      metrics: [
        { name: '5th Percentile', value: `$${f(p5)}`, description: 'Bottom 5% of trades' },
        { name: '25th Percentile (Q1)', value: `$${f(q1)}`, description: '25th percentile' },
        { name: '50th Percentile (Median)', value: `$${f(median)}`, description: 'Median trade' },
        { name: '75th Percentile (Q3)', value: `$${f(q3)}`, description: '75th percentile' },
        { name: '95th Percentile', value: `$${f(p95)}`, description: 'Top 5% of trades' },
        { name: 'IQR', value: `$${f(iqr)}`, description: 'Interquartile Range' },
      ],
    },
  ];
}

export function analyticsToCSV(analytics: AnalyticsResult[]): string {
  const lines = ['Category,Metric,Value,Description'];
  analytics.forEach(cat => {
    cat.metrics.forEach(m => {
      lines.push(`"${cat.category}","${m.name}","${m.value}","${m.description}"`);
    });
  });
  return lines.join('\n');
}

export function downloadAnalyticsZip(analytics: AnalyticsResult[]) {
  // Create CSV content
  const csv = analyticsToCSV(analytics);
  
  // Create JSON content
  const json = JSON.stringify(analytics, null, 2);
  
  // Download CSV
  const csvBlob = new Blob([csv], { type: 'text/csv' });
  const csvUrl = URL.createObjectURL(csvBlob);
  const csvLink = document.createElement('a');
  csvLink.href = csvUrl;
  csvLink.download = 'trading_analytics.csv';
  csvLink.click();
  URL.revokeObjectURL(csvUrl);

  // Download JSON
  setTimeout(() => {
    const jsonBlob = new Blob([json], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = 'trading_analytics.json';
    jsonLink.click();
    URL.revokeObjectURL(jsonUrl);
  }, 500);
}
