const axios = require('axios');

const TRADING_VIEW_TOP_COINS = [
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'dogecoin', 'cardano', 'avalanche-2',
  'polygon', 'chainlink', 'tron', 'litecoin', 'near', 'toncoin', 'stellar', 'algorand', 'cosmos',
  'sui', 'aptos', 'optimism', 'arbitrum', 'injective-protocol', 'mantle', 'render-token', 'pepe',
  'dai', 'internet-computer', 'filecoin', 'uniswap', 'monero', 'aave', 'maker', 'tezos', 'theta-token',
  'neo', 'flow', 'eos', 'lido-dao', 'gmx', 'celestia', 'sei-network', 'fetch-ai', 'fantom', 'kaspa',
  'pancakeswap-token', 'rocket-pool', 'the-graph', '1inch', 'jito', 'ethena', 'ondo-finance', 'safe',
  'blast', 'base', 'zksync', 'berachain', 'coredao', 'hyperliquid', 'multiversx'
];

const DEFAULT_IDS = Array.from(new Set(TRADING_VIEW_TOP_COINS)).slice(0, 100);

const createCoinAvatarImage = (id, symbol = 'C') => {
  const safeId = (id || 'coin').toString().trim();
  const safeSymbol = (symbol || 'C').toString().trim().slice(0, 3).toUpperCase() || 'C';
  const gradientA = '#1dbf73';
  const gradientB = '#0f172a';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${gradientA}"/>
          <stop offset="100%" stop-color="${gradientB}"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#g)"/>
      <text x="50" y="58" text-anchor="middle" font-size="42" fill="#ffffff" font-family="Arial, sans-serif" font-weight="700">${safeSymbol.charAt(0) || 'C'}</text>
      <text x="50" y="86" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.8)" font-family="Arial, sans-serif">${safeId.slice(0, 6).toUpperCase()}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const MOCK_COINS = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1696501400',
    current_price: 67102.13,
    price_change_percentage_24h: 2.84,
    market_cap: 1320000000000,
    total_volume: 42000000000,
    market_cap_rank: 1,
    high_24h: 68250,
    low_24h: 64200,
    circulating_supply: 19400000,
    total_supply: 21000000,
    ath: 73738.4,
    atl: 67.81,
    market_cap_percentage: 52.4,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png?1696501628',
    current_price: 3421.18,
    price_change_percentage_24h: 1.72,
    market_cap: 411000000000,
    total_volume: 18400000000,
    market_cap_rank: 2,
    high_24h: 3499,
    low_24h: 3310,
    circulating_supply: 120000000,
    total_supply: 120000000,
    ath: 4878.26,
    atl: 0.432,
    market_cap_percentage: 18.6,
  },
  {
    id: 'solana',
    symbol: 'sol',
    name: 'Solana',
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png?1696504756',
    current_price: 152.4,
    price_change_percentage_24h: -0.84,
    market_cap: 69000000000,
    total_volume: 3600000000,
    market_cap_rank: 5,
    high_24h: 158.5,
    low_24h: 146.3,
    circulating_supply: 450000000,
    total_supply: 480000000,
    ath: 259.96,
    atl: 0.5,
    market_cap_percentage: 7.4,
  },
  {
    id: 'bnb',
    symbol: 'bnb',
    name: 'BNB',
    image: 'https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png?1696501970',
    current_price: 593.17,
    price_change_percentage_24h: 1.06,
    market_cap: 88000000000,
    total_volume: 1650000000,
    market_cap_rank: 4,
    high_24h: 602.2,
    low_24h: 580.1,
    circulating_supply: 148000000,
    total_supply: 148000000,
    ath: 720.22,
    atl: 0.1,
    market_cap_percentage: 9.1,
  },
  {
    id: 'xrp',
    symbol: 'xrp',
    name: 'XRP',
    image: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png?1696501442',
    current_price: 0.68,
    price_change_percentage_24h: 2.15,
    market_cap: 38000000000,
    total_volume: 1800000000,
    market_cap_rank: 7,
    high_24h: 0.71,
    low_24h: 0.65,
    circulating_supply: 56000000000,
    total_supply: 99999000000,
    ath: 3.4,
    atl: 0.0027,
    market_cap_percentage: 2.8,
  },
  {
    id: 'dogecoin',
    symbol: 'doge',
    name: 'Dogecoin',
    image: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png?1696501409',
    current_price: 0.17,
    price_change_percentage_24h: 4.11,
    market_cap: 26000000000,
    total_volume: 1420000000,
    market_cap_rank: 8,
    high_24h: 0.18,
    low_24h: 0.16,
    circulating_supply: 144000000000,
    total_supply: 146000000000,
    ath: 0.7376,
    atl: 0.0000869,
    market_cap_percentage: 2.2,
  },
  {
    id: 'cardano',
    symbol: 'ada',
    name: 'Cardano',
    image: 'https://assets.coingecko.com/coins/images/975/large/cardano.png?1696502090',
    current_price: 0.74,
    price_change_percentage_24h: -1.24,
    market_cap: 26000000000,
    total_volume: 980000000,
    market_cap_rank: 9,
    high_24h: 0.79,
    low_24h: 0.7,
    circulating_supply: 35000000000,
    total_supply: 45000000000,
    ath: 3.09,
    atl: 0.019,
    market_cap_percentage: 1.9,
  },
  {
    id: 'polygon',
    symbol: 'matic',
    name: 'Polygon',
    image: 'https://assets.coingecko.com/coins/images/4713/large/polygon.png?1698233745',
    current_price: 0.82,
    price_change_percentage_24h: 1.31,
    market_cap: 7600000000,
    total_volume: 520000000,
    market_cap_rank: 12,
    high_24h: 0.85,
    low_24h: 0.79,
    circulating_supply: 9200000000,
    total_supply: 10000000000,
    ath: 2.92,
    atl: 0.003,
    market_cap_percentage: 1.1,
  },
];

const sanitizeCoinIds = (ids = []) => {
  const rawIds = Array.isArray(ids) ? ids : typeof ids === 'string' ? ids.split(',') : DEFAULT_IDS;

  return Array.from(new Set(
    rawIds
      .map((id) => String(id || '').trim())
      .filter(Boolean)
      .filter((id) => !id.startsWith('http'))
  )).slice(0, 100);
};

const parseIds = (ids) => sanitizeCoinIds(ids);

const getMockMarketData = (ids = DEFAULT_IDS) => {
  const requested = ids.filter(Boolean);
  const requestedSet = new Set(requested);
  const knownCoins = MOCK_COINS.filter((coin) => requestedSet.has(coin.id));
  const knownIds = new Set(knownCoins.map((coin) => coin.id));

  const syntheticCoins = requested
    .filter((id) => !knownIds.has(id))
    .map((id, index) => {
      const symbol = id
        .replace(/[-_]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 5) || `C${index + 1}`;

      const basePrice = 1 + (index * 0.73);
      const marketCapBase = 1000000000 * (index + 1) * (1.3 + (index % 5) * 0.25);

      return {
        id,
        symbol: symbol.toLowerCase(),
        name: id
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase()),
        image: createCoinAvatarImage(id, symbol),
        current_price: Number((basePrice * (1 + (index % 7) * 0.11)).toFixed(4)),
        price_change_percentage_24h: Number(((-8 + ((index * 3.4) % 12))).toFixed(2)),
        market_cap: Number(marketCapBase.toFixed(2)),
        total_volume: Number((marketCapBase * 0.17).toFixed(2)),
        market_cap_rank: index + 9,
        high_24h: Number((basePrice * 1.12).toFixed(4)),
        low_24h: Number((basePrice * 0.9).toFixed(4)),
        circulating_supply: Number((1000000 * (index + 1) * (0.9 + ((index % 8) * 0.12))).toFixed(2)),
        total_supply: Number((1200000 * (index + 1) * (1.2 + ((index % 6) * 0.15))).toFixed(2)),
        ath: Number((basePrice * 1.8).toFixed(4)),
        atl: Number((basePrice * 0.25).toFixed(4)),
        market_cap_percentage: Number((0.3 + (index % 8) * 0.27).toFixed(2)),
      };
    });

  return [...knownCoins, ...syntheticCoins];
};

const getMockChartData = (id, days) => {
  const baseCoin = MOCK_COINS.find((coin) => coin.id === id) || MOCK_COINS[0];
  const totalPoints = Math.max(days, 7);
  const basePrice = baseCoin.current_price;
  const labels = [];
  const prices = [];

  for (let i = totalPoints; i >= 1; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    const wave = Math.sin(i / 2.1) * (basePrice * 0.08);
    const drift = (basePrice * 0.04) * (totalPoints - i) / totalPoints;
    prices.push(Number((basePrice + wave - drift).toFixed(2)));
  }

  return { labels, prices };
};

const buildMarketOverview = (coins = []) => {
  if (!coins.length) {
    return {
      marketCap: 0,
      volume: 0,
      dominance: 0,
      sentiment: 'Neutral',
      signal: 'Watching setup',
      fearGreed: 58,
    };
  }

  const marketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
  const volume = coins.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
  const dominance = coins.find((coin) => coin.id === 'bitcoin')?.market_cap_percentage || 0;
  const avgMomentum = coins.reduce((sum, coin) => sum + (coin.price_change_percentage_24h || 0), 0) / coins.length;

  return {
    marketCap,
    volume,
    dominance,
    sentiment: avgMomentum >= 0 ? 'Risk-On' : 'Risk-Off',
    signal: avgMomentum >= 0 ? 'Bullish continuation' : 'Guarded correction',
    fearGreed: Math.min(100, Math.max(0, Math.round(55 + avgMomentum * 4))),
  };
};

const buildFallbackTrending = () =>
  MOCK_COINS.slice(0, 5).map((coin) => ({
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,
    price: coin.current_price,
    percent_change_24h: coin.price_change_percentage_24h,
    market_cap: coin.market_cap,
  }));

const buildFallbackOHLC = (id, days = 7) => {
  const baseCoin = MOCK_COINS.find((coin) => coin.id === id) || MOCK_COINS[0];
  const basePrice = baseCoin.current_price;
  const total = Math.max(days, 7);
  const candles = [];

  for (let i = total; i >= 1; i -= 1) {
    const signal = Math.sin((total - i + 1) / 2.2) * (basePrice * 0.03);
    const open = basePrice + signal;
    const close = open * (1 + Math.cos((total - i + 1) / 1.9) * 0.025);
    const high = Math.max(open, close) * (1 + 0.014 + (i * 0.0008));
    const low = Math.min(open, close) * (1 - 0.012 - (i * 0.0007));
    const date = new Date();
    date.setDate(date.getDate() - i);

    candles.push({
      time: date.toISOString(),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      range: Number((Math.abs(high - low)).toFixed(2)),
      direction: close >= open ? 'up' : 'down',
    });
  }

  return candles;
};

async function getMarketData(idsParam) {
  const ids = parseIds(idsParam);

  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        ids: ids.join(','),
        order: 'market_cap_desc',
        per_page: 100,
        page: 1,
        sparkline: true,
        price_change_percentage: '24h,7d,30d',
      },
      timeout: 12000,
    });

    return data;
  } catch (error) {
    console.error('CoinGecko market fetch failed:', error.message);
    return getMockMarketData(ids);
  }
}

async function getOverview(idsParam) {
  const ids = parseIds(idsParam);

  try {
    const data = await getMarketData(ids);
    return buildMarketOverview(data);
  } catch (error) {
    console.error('CoinGecko overview fetch failed:', error.message);
    return buildMarketOverview(getMockMarketData(ids));
  }
}

async function getTrending() {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/search/trending', { timeout: 12000 });
    return { coins: (data.coins || []).slice(0, 5).map((entry) => {
      const item = entry?.item || {};
      return {
        id: item.id,
        symbol: item.symbol,
        name: item.name,
        image: item.large || item.thumb || item.small || item.image || null,
        price: item.price_btc || 0,
        percent_change_24h: item.data?.price_change_percentage_24h?.usd || 0,
        market_cap: item.market_cap_rank || 0,
      };
    }) };
  } catch (error) {
    console.error('CoinGecko trending fetch failed:', error.message);
    return { coins: buildFallbackTrending() };
  }
}

async function getCoinById(id) {
  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false,
      },
      timeout: 12000,
    });

    return data;
  } catch (error) {
    console.error('CoinGecko coin fetch failed:', error.message);
    return getMockMarketData([id])[0] || getMockMarketData(DEFAULT_IDS)[0];
  }
}

async function getChartData(id, days = 7) {
  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
        interval: 'daily',
      },
      timeout: 12000,
    });

    const labels = data.prices.map(([timestamp]) =>
      new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const prices = data.prices.map(([, price]) => Number(price));

    return { labels, prices };
  } catch (error) {
    console.error('CoinGecko chart fetch failed:', error.message);
    return getMockChartData(id, Number(days) || 7);
  }
}

async function getOhlcData(id, days = 7) {
  try {
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/ohlc`, {
      params: {
        vs_currency: 'usd',
        days,
      },
      timeout: 12000,
    });

    const candles = (Array.isArray(data) ? data : []).map(([timestamp, open, high, low, close]) => {
      const date = new Date(timestamp);
      return {
        time: date.toISOString(),
        label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        range: Number((Math.abs(high - low)).toFixed(2)),
        direction: close >= open ? 'up' : 'down',
      };
    });

    return { candles };
  } catch (error) {
    console.error('CoinGecko OHLC fetch failed:', error.message);
    return { candles: buildFallbackOHLC(id, Number(days) || 7) };
  }
}

module.exports = {
  DEFAULT_IDS,
  getMarketData,
  getOverview,
  getTrending,
  getCoinById,
  getChartData,
  getOhlcData,
};
