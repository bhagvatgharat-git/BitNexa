const axios = require('axios');
const crypto = require('crypto');

const DEFAULT_BINANCE_BASE_URL = 'https://testnet.binance.vision';
const PRODUCTION_BINANCE_BASE_URL = 'https://api.binance.com';
const CHART_INTERVALS = {
  '15s': { interval: '1s', aggregateSeconds: 15 },
  '20s': { interval: '1s', aggregateSeconds: 20 },
  '1m': { interval: '1m', aggregateSeconds: 60 },
  '2m': { interval: '1m', aggregateSeconds: 120 },
  '3m': { interval: '3m', aggregateSeconds: 180 },
  '5m': { interval: '5m', aggregateSeconds: 300 },
};

const getConfig = () => {
  const baseUrl = String(process.env.BINANCE_BASE_URL || DEFAULT_BINANCE_BASE_URL).replace(/\/$/, '');
  const apiKey = String(process.env.BINANCE_API_KEY || '').trim();
  const apiSecret = String(process.env.BINANCE_API_SECRET || '').trim();
  const credentialsConfigured = Boolean(apiKey && apiSecret);
  const productionUrl = baseUrl === PRODUCTION_BINANCE_BASE_URL;

  return {
    baseUrl,
    apiKey,
    apiSecret,
    credentialsConfigured,
    environment: productionUrl ? 'live' : 'testnet',
    liveOrdersEnabled: credentialsConfigured
      && productionUrl
      && String(process.env.BINANCE_LIVE_TRADING_ENABLED || '').toLowerCase() === 'true',
  };
};

const getBinanceStatus = () => {
  const config = getConfig();
  return {
    exchange: 'Binance Spot',
    environment: config.environment,
    credentialsConfigured: config.credentialsConfigured,
    liveOrdersEnabled: config.liveOrdersEnabled,
  };
};

const getKlineData = async (symbol, requestedInterval) => {
  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  const intervalConfig = CHART_INTERVALS[requestedInterval];
  if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol)) {
    throwServiceError('A valid Binance trading pair is required.', 400);
  }
  if (!intervalConfig) {
    throwServiceError('Interval must be one of 15s, 20s, 1m, 2m, 3m, or 5m.', 400);
  }

  try {
    const { data } = await axios.get(`${PRODUCTION_BINANCE_BASE_URL}/api/v3/klines`, {
      params: { symbol: normalizedSymbol, interval: intervalConfig.interval, limit: 1000 },
      timeout: 10000,
    });
    const bucketSize = intervalConfig.aggregateSeconds * 1000;
    const grouped = new Map();

    for (const row of data) {
      const bucketTime = Math.floor(Number(row[0]) / bucketSize) * bucketSize;
      const candle = grouped.get(bucketTime);
      if (candle) {
        candle.high = Math.max(candle.high, Number(row[2]));
        candle.low = Math.min(candle.low, Number(row[3]));
        candle.close = Number(row[4]);
        candle.volume += Number(row[5]);
      } else {
        grouped.set(bucketTime, {
          time: new Date(bucketTime).toISOString(),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        });
      }
    }

    const candles = Array.from(grouped.values()).map((candle) => ({
      ...candle,
      label: new Date(candle.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      range: Number(Math.abs(candle.high - candle.low).toFixed(8)),
      direction: candle.close >= candle.open ? 'up' : 'down',
    }));

    return { candles, source: 'binance', interval: requestedInterval };
  } catch (error) {
    if (error.statusCode) throw error;
    throwServiceError(error.response?.data?.msg || 'Unable to load Binance chart candles.', error.response?.status || 502);
  }
};

const createSignedQuery = (params, secret) => {
  const query = new URLSearchParams(params).toString();
  const signature = crypto.createHmac('sha256', secret).update(query).digest('hex');
  return `${query}&signature=${signature}`;
};

const throwServiceError = (message, statusCode = 503) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
};

const getAccountBalances = async () => {
  const config = getConfig();
  if (!config.credentialsConfigured) throwServiceError('Binance API credentials are not configured on the backend.');

  const query = createSignedQuery({ timestamp: Date.now(), recvWindow: 5000 }, config.apiSecret);
  try {
    const { data } = await axios.get(`${config.baseUrl}/api/v3/account?${query}`, {
      headers: { 'X-MBX-APIKEY': config.apiKey },
      timeout: 10000,
    });
    return (data.balances || [])
      .filter((balance) => Number(balance.free) > 0 || Number(balance.locked) > 0)
      .map((balance) => ({
        asset: balance.asset,
        free: Number(balance.free),
        locked: Number(balance.locked),
      }));
  } catch (error) {
    throwServiceError(error.response?.data?.msg || 'Unable to read Binance account balances.', error.response?.status || 502);
  }
};

const placeMarketOrder = async ({ symbol, side, quantity }) => {
  const config = getConfig();
  if (!config.liveOrdersEnabled) {
    throwServiceError('Live Binance orders are disabled. Configure credentials and explicitly enable production trading.');
  }

  const normalizedSymbol = String(symbol || '').trim().toUpperCase();
  const normalizedSide = String(side || '').trim().toUpperCase();
  const quantityValue = Number(quantity);

  if (!/^[A-Z0-9]{5,20}$/.test(normalizedSymbol) || !normalizedSymbol.endsWith('USDT')) {
    throwServiceError('Only supported Binance USDT Spot pairs can be traded.', 400);
  }
  if (!['BUY', 'SELL'].includes(normalizedSide)) throwServiceError('Order side must be buy or sell.', 400);
  if (!Number.isFinite(quantityValue) || quantityValue <= 0) throwServiceError('Quantity must be greater than zero.', 400);

  try {
    const { data: exchangeInfo } = await axios.get(`${config.baseUrl}/api/v3/exchangeInfo`, {
      params: { symbol: normalizedSymbol },
      timeout: 10000,
    });
    const pair = exchangeInfo.symbols?.find((entry) => entry.symbol === normalizedSymbol);
    if (!pair || pair.status !== 'TRADING' || pair.quoteAsset !== 'USDT') {
      throwServiceError(`${normalizedSymbol} is not an active Binance USDT Spot pair.`, 400);
    }

    const query = createSignedQuery({
      symbol: normalizedSymbol,
      side: normalizedSide,
      type: 'MARKET',
      quantity: String(quantity),
      newOrderRespType: 'FULL',
      recvWindow: 5000,
      timestamp: Date.now(),
    }, config.apiSecret);
    const { data } = await axios.post(`${config.baseUrl}/api/v3/order?${query}`, null, {
      headers: { 'X-MBX-APIKEY': config.apiKey },
      timeout: 15000,
    });
    return data;
  } catch (error) {
    if (error.statusCode) throw error;
    throwServiceError(error.response?.data?.msg || 'Binance rejected the Spot market order.', error.response?.status || 502);
  }
};

module.exports = { getBinanceStatus, getKlineData, getAccountBalances, placeMarketOrder };