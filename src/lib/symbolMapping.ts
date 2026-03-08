/** Map futures symbols to TradingView CFD symbols */
export const FUTURES_TO_CFD: Record<string, string> = {
  NQ: 'PEPPERSTONE:NAS100',
  MNQ: 'PEPPERSTONE:NAS100',
  ES: 'PEPPERSTONE:US500',
  MES: 'PEPPERSTONE:US500',
  YM: 'PEPPERSTONE:US30',
  MYM: 'PEPPERSTONE:US30',
  RTY: 'PEPPERSTONE:US2000',
  M2K: 'PEPPERSTONE:US2000',
  CL: 'PEPPERSTONE:XTIUSD',
  MCL: 'PEPPERSTONE:XTIUSD',
  GC: 'PEPPERSTONE:XAUUSD',
  MGC: 'PEPPERSTONE:XAUUSD',
  SI: 'PEPPERSTONE:XAGUSD',
  NG: 'PEPPERSTONE:NATGAS',
  '6E': 'FX:EURUSD',
  '6J': 'FX:USDJPY',
  '6B': 'FX:GBPUSD',
};

export function getTradingViewSymbol(symbol: string, assetType?: string): string {
  if (assetType === 'Futures') {
    return FUTURES_TO_CFD[symbol] ?? `CME_MINI:${symbol}1!`;
  }
  if (assetType === 'Crypto') return `BINANCE:${symbol}USDT`;
  if (assetType === 'Forex') return `FX:${symbol.replace('/', '')}`;
  return symbol;
}
