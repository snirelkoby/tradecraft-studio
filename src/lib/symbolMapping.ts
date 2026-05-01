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

/** Map symbols to Yahoo Finance ticker format */
const FUTURES_TO_YAHOO: Record<string, string> = {
  NQ: 'NQ=F', MNQ: 'NQ=F',
  ES: 'ES=F', MES: 'ES=F',
  YM: 'YM=F', MYM: 'YM=F',
  RTY: 'RTY=F', M2K: 'RTY=F',
  CL: 'CL=F', MCL: 'CL=F',
  GC: 'GC=F', MGC: 'GC=F',
  SI: 'SI=F', NG: 'NG=F',
  '6E': 'EURUSD=X', '6J': 'JPY=X', '6B': 'GBPUSD=X',
  ZB: 'ZB=F', ZN: 'ZN=F',
};

export function getYahooSymbol(symbol: string, assetType?: string): string {
  const s = symbol.toUpperCase();
  if (assetType === 'Futures') {
    return FUTURES_TO_YAHOO[s] ?? `${s}=F`;
  }
  if (assetType === 'Crypto') {
    // Common crypto: BTC -> BTC-USD
    if (/USD$|USDT$/.test(s)) return s.replace(/USDT?$/, '') + '-USD';
    return `${s}-USD`;
  }
  if (assetType === 'Forex') {
    const clean = s.replace('/', '');
    return clean.endsWith('=X') ? clean : `${clean}=X`;
  }
  return s;
}
