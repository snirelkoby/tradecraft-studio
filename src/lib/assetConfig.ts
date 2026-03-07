export const ASSET_TYPES = ['Futures', 'Stocks', 'Crypto', 'Forex'] as const;
export type AssetType = typeof ASSET_TYPES[number];

export const FUTURES_CONFIG = [
  { symbol: 'ES', name: 'E-mini S&P 500', tickSize: 0.25, tickValue: 12.50, exchange: 'CME' },
  { symbol: 'NQ', name: 'E-mini Nasdaq 100', tickSize: 0.25, tickValue: 5.00, exchange: 'CME' },
  { symbol: 'YM', name: 'E-mini Dow', tickSize: 1, tickValue: 5.00, exchange: 'CBOT' },
  { symbol: 'RTY', name: 'E-mini Russell 2000', tickSize: 0.10, tickValue: 5.00, exchange: 'CME' },
  { symbol: 'MES', name: 'Micro E-mini S&P 500', tickSize: 0.25, tickValue: 1.25, exchange: 'CME' },
  { symbol: 'MNQ', name: 'Micro E-mini Nasdaq', tickSize: 0.25, tickValue: 0.50, exchange: 'CME' },
  { symbol: 'MYM', name: 'Micro E-mini Dow', tickSize: 1, tickValue: 0.50, exchange: 'CBOT' },
  { symbol: 'M2K', name: 'Micro E-mini Russell', tickSize: 0.10, tickValue: 0.50, exchange: 'CME' },
  { symbol: 'CL', name: 'Crude Oil', tickSize: 0.01, tickValue: 10.00, exchange: 'NYMEX' },
  { symbol: 'MCL', name: 'Micro Crude Oil', tickSize: 0.01, tickValue: 1.00, exchange: 'NYMEX' },
  { symbol: 'GC', name: 'Gold', tickSize: 0.10, tickValue: 10.00, exchange: 'COMEX' },
  { symbol: 'MGC', name: 'Micro Gold', tickSize: 0.10, tickValue: 1.00, exchange: 'COMEX' },
  { symbol: 'SI', name: 'Silver', tickSize: 0.005, tickValue: 25.00, exchange: 'COMEX' },
  { symbol: 'NG', name: 'Natural Gas', tickSize: 0.001, tickValue: 10.00, exchange: 'NYMEX' },
  { symbol: '6E', name: 'Euro FX', tickSize: 0.00005, tickValue: 6.25, exchange: 'CME' },
  { symbol: '6J', name: 'Japanese Yen', tickSize: 0.0000005, tickValue: 6.25, exchange: 'CME' },
  { symbol: '6B', name: 'British Pound', tickSize: 0.0001, tickValue: 6.25, exchange: 'CME' },
  { symbol: 'ZB', name: '30-Year T-Bond', tickSize: 1/32, tickValue: 31.25, exchange: 'CBOT' },
  { symbol: 'ZN', name: '10-Year T-Note', tickSize: 1/64, tickValue: 15.625, exchange: 'CBOT' },
  { symbol: 'ZC', name: 'Corn', tickSize: 0.25, tickValue: 12.50, exchange: 'CBOT' },
  { symbol: 'ZS', name: 'Soybeans', tickSize: 0.25, tickValue: 12.50, exchange: 'CBOT' },
  { symbol: 'ZW', name: 'Wheat', tickSize: 0.25, tickValue: 12.50, exchange: 'CBOT' },
  { symbol: 'HE', name: 'Lean Hogs', tickSize: 0.025, tickValue: 10.00, exchange: 'CME' },
  { symbol: 'LE', name: 'Live Cattle', tickSize: 0.025, tickValue: 10.00, exchange: 'CME' },
] as const;

export const FOREX_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD', 'EUR/CHF', 'GBP/CHF',
];

export const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'MATIC',
  'LINK', 'UNI', 'ATOM', 'LTC', 'APT', 'ARB', 'OP', 'SUI', 'SEI', 'INJ',
];
