const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const {
  DEFAULT_IDS,
  getMarketData,
  getOverview,
  getTrending,
  getCoinById,
  getChartData,
  getOhlcData,
} = require('./services/coingeckoService');

dotenv.config();

const app = express();
const DEFAULT_PORT = Number(process.env.PORT || 5001);

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
  const ids = (req.query.ids || DEFAULT_IDS.join(',')).split(',').filter(Boolean);
  const data = await getMarketData(ids);
  res.json(data);
});

app.get('/api/overview', async (req, res) => {
  const ids = (req.query.ids || DEFAULT_IDS.join(',')).split(',').filter(Boolean);
  const data = await getOverview(ids);
  res.json(data);
});

app.get('/api/trending', async (req, res) => {
  const data = await getTrending();
  res.json(data);
});

app.get('/api/coin/:id', async (req, res) => {
  const data = await getCoinById(req.params.id);
  res.json(data);
});

app.get('/api/chart/:id', async (req, res) => {
  const { id } = req.params;
  const days = Number(req.query.days) || 7;
  const data = await getChartData(id, days);
  res.json(data);
});

app.get('/api/ohlc/:id', async (req, res) => {
  const { id } = req.params;
  const days = Number(req.query.days) || 7;
  const data = await getOhlcData(id, days);
  res.json(data);
});

app.get('/', (req, res) => {
  res.json({
    app: 'BitNexa',
    status: 'running',
  });
});

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`BitNexa backend listening on http://localhost:${port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy, retrying on ${nextPort}.`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
};

startServer(DEFAULT_PORT);
