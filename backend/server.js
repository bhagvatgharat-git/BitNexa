const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'dogecoin', 'cardano', 'polygon'];

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
    const ids = (req.query.ids || DEFAULT_IDS.join(',')).split(',').filter(Boolean).join(',');

    const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
      params: {
        vs_currency: 'usd',
        ids,
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
    res.status(500).json({ message: 'Unable to load crypto market data.' });
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
    res.status(500).json({ message: 'Unable to load coin details.' });
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
    res.status(500).json({ message: 'Unable to load market chart.' });
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
