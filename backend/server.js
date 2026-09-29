const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'dogecoin', 'cardano', 'polygon'];

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
    market_cap_percentage: 1.1,
  },
];

const getMockMarketData = (ids = DEFAULT_IDS) => {
  const requested = ids.filter(Boolean);
  return MOCK_COINS.filter((coin) => requested.includes(coin.id));
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

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'BitNexa backend is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/market', async (req, res) => {
  try {
    const ids = (req.query.ids || DEFAULT_IDS.join(',')).split(',').filter(Boolean);

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
    });

    res.json(data);
  } catch (error) {
    console.error('Market fetch failed:', error.message);
    res.json(getMockMarketData((req.query.ids || DEFAULT_IDS.join(','))
      .split(',')
      .filter(Boolean)));
  }
});

app.get('/api/coin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}`, {
      params: {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false,
        sparkline: false,
      },
    });

    res.json(data);
  } catch (error) {
    console.error('Coin fetch failed:', error.message);
    const fallback = getMockMarketData([req.params.id])[0] || getMockMarketData(DEFAULT_IDS)[0];
    res.json(fallback);
  }
});

app.get('/api/chart/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const days = Number(req.query.days) || 7;

    const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/${id}/market_chart`, {
      params: {
        vs_currency: 'usd',
        days,
        interval: 'daily',
      },
    });

    const labels = data.prices.map(([timestamp]) =>
      new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const prices = data.prices.map(([, price]) => Number(price));

    res.json({ labels, prices });
  } catch (error) {
    console.error('Chart fetch failed:', error.message);
    res.json(getMockChartData(req.params.id, Number(req.query.days) || 7));
  }
});

app.get('/', (req, res) => {
  res.json({
    app: 'BitNexa',
    status: 'running',
  });
});

app.listen(PORT, () => {
  console.log(`BitNexa backend listening on http://localhost:${PORT}`);
});
