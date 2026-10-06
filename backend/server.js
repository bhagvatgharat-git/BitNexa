const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const mongoose = require('mongoose');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { v4: uuidv4 } = require('uuid');
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
const JWT_SECRET = process.env.JWT_SECRET || 'bitnexa-demo-secret';
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'bitnexa';

let mongoReady = false;
let BitNexaUser = null;

if (MONGODB_URI) {
  const connectMongo = async () => {
    try {
      await mongoose.connect(MONGODB_URI, {
        dbName: MONGODB_DB_NAME,
        serverSelectionTimeoutMS: 5000,
      });
      mongoReady = true;
      console.log('MongoDB connected successfully.');
    } catch (error) {
      console.warn('MongoDB connection failed, falling back to in-memory storage:', error.message);
      mongoReady = false;
    }
  };

  connectMongo();

  const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: String, default: () => new Date().toISOString() },
    watchlist: { type: [String], default: [] },
    portfolio: {
      type: {
        positions: { type: Array, default: [] },
        totalValue: { type: Number, default: 0 },
      },
      default: { positions: [], totalValue: 0 },
    },
    transactions: { type: Array, default: [] },
    alerts: { type: Array, default: [] },
  }, { timestamps: true });

  BitNexaUser = mongoose.models.BitNexaUser || mongoose.model('BitNexaUser', userSchema);
}

const users = new Map();
const watchlists = new Map();
const portfolios = new Map();
const transactions = new Map();
const alerts = new Map();

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and retry later.' },
});

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BitNexa API',
      version: '1.0.0',
      description: 'BitNexa market data, auth, watchlist, portfolio, and alerts API.',
    },
    servers: [
      { url: 'http://localhost:5001', description: 'Local development server' },
    ],
  },
  apis: ['./server.js'],
});

const hashPassword = (password) => crypto.createHash('sha256').update(String(password)).digest('hex');

const createToken = (user) => jwt.sign({ sub: user.id, email: user.email, name: user.name }, JWT_SECRET, {
  expiresIn: '7d',
});

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }
};

const ensureMemoryUserState = (userId) => {
  if (!watchlists.has(userId)) watchlists.set(userId, []);
  if (!portfolios.has(userId)) portfolios.set(userId, { positions: [], totalValue: 0 });
  if (!transactions.has(userId)) transactions.set(userId, []);
  if (!alerts.has(userId)) alerts.set(userId, []);
};

const normalizeMongoUserState = (userDoc = {}) => ({
  watchlist: Array.isArray(userDoc.watchlist) ? userDoc.watchlist : [],
  portfolio: {
    positions: Array.isArray(userDoc.portfolio?.positions) ? userDoc.portfolio.positions : [],
    totalValue: Number(userDoc.portfolio?.totalValue || 0),
  },
  transactions: Array.isArray(userDoc.transactions) ? userDoc.transactions : [],
  alerts: Array.isArray(userDoc.alerts) ? userDoc.alerts : [],
});

const ensureUserState = async (userId) => {
  if (!userId) return null;

  if (!mongoReady || !BitNexaUser) {
    ensureMemoryUserState(userId);
    return {
      id: userId,
      watchlist: watchlists.get(userId) || [],
      portfolio: portfolios.get(userId) || { positions: [], totalValue: 0 },
      transactions: transactions.get(userId) || [],
      alerts: alerts.get(userId) || [],
    };
  }

  let userDoc = await BitNexaUser.findOne({ id: userId });
  if (!userDoc) {
    userDoc = new BitNexaUser({
      id: userId,
      name: 'User',
      email: `${userId}@local.bitnexa`,
      passwordHash: 'placeholder',
      watchlist: [],
      portfolio: { positions: [], totalValue: 0 },
      transactions: [],
      alerts: [],
    });
  }

  if (!Array.isArray(userDoc.watchlist)) userDoc.watchlist = [];
  if (!userDoc.portfolio || !Array.isArray(userDoc.portfolio.positions)) {
    userDoc.portfolio = { positions: [], totalValue: 0 };
  }
  if (!Array.isArray(userDoc.transactions)) userDoc.transactions = [];
  if (!Array.isArray(userDoc.alerts)) userDoc.alerts = [];

  await userDoc.save();
  return userDoc;
};

const findUserByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();

  if (mongoReady && BitNexaUser) {
    return BitNexaUser.findOne({ email: normalizedEmail });
  }

  return Array.from(users.values()).find((entry) => entry.email === normalizedEmail);
};

const findUserById = async (userId) => {
  if (mongoReady && BitNexaUser) {
    return BitNexaUser.findOne({ id: userId });
  }

  return users.get(userId) || null;
};

const evaluatePortfolioInsights = (positions, marketMap = new Map()) => {
  if (!Array.isArray(positions) || !positions.length) {
    return {
      diversificationScore: 0,
      concentrationRisk: 100,
      topPerformer: 'No positions',
      largestPosition: 'N/A',
      rebalancingNote: 'Add positions to unlock portfolio insights.',
      allocations: [],
    };
  }

  const normalizedPositions = positions.map((position) => {
    const amount = Number(position.amount || 0);
    const averagePrice = Number(position.averagePrice || 0);
    const currentPrice = Number(marketMap.get(String(position.coinId)) ?? averagePrice ?? 0);
    const value = amount * currentPrice;
    const returnPercent = averagePrice ? ((currentPrice - averagePrice) / averagePrice) * 100 : 0;

    return {
      ...position,
      amount,
      averagePrice,
      currentPrice,
      value,
      returnPercent,
    };
  });

  const totalValue = normalizedPositions.reduce((sum, position) => sum + position.value, 0) || 1;
  const allocations = normalizedPositions
    .map((position) => ({
      ...position,
      weight: totalValue ? (position.value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const concentrationRisk = allocations.length ? allocations[0].weight : 0;
  const diversificationScore = Math.max(0, Math.min(100, 100 - concentrationRisk));
  const topPerformer = allocations.length
    ? allocations.reduce((best, current) => (current.returnPercent > best.returnPercent ? current : best), allocations[0])
    : null;

  return {
    diversificationScore: Number(diversificationScore.toFixed(1)),
    concentrationRisk: Number(concentrationRisk.toFixed(1)),
    topPerformer: topPerformer ? String(topPerformer.symbol || topPerformer.coinId || 'N/A') : 'N/A',
    largestPosition: allocations[0] ? String(allocations[0].symbol || allocations[0].coinId || 'N/A') : 'N/A',
    rebalancingNote: concentrationRisk > 60
      ? 'Concentration risk is elevated. Consider rebalancing into lower-weight coins.'
      : 'Portfolio diversification remains stable for the current allocation.',
    allocations: allocations.map((item) => ({
      label: String(item.symbol || item.coinId || 'Asset'),
      weight: Number((item.weight || 0).toFixed(1)),
      value: Number(item.value || 0),
    })),
  };
};

const evaluateAlertStatus = (alert, currentPrice) => {
  const targetPrice = Number(alert.targetPrice || 0);
  const direction = String(alert.direction || 'above').toLowerCase();
  const price = Number(currentPrice || 0);
  const isTriggered = direction === 'above' ? price >= targetPrice : price <= targetPrice;

  return {
    ...alert,
    currentPrice: price,
    status: isTriggered ? 'triggered' : 'active',
    isTriggered,
    triggeredAt: isTriggered ? (alert.triggeredAt || new Date().toISOString()) : null,
  };
};

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use('/api/', apiLimiter);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Service is healthy
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'BitNexa backend is running',
    timestamp: new Date().toISOString(),
  });
});

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Register a user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (mongoReady && BitNexaUser) {
    const existingUser = await findUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(409).json({ error: 'This email is already registered.' });
    }

    const user = {
      id: uuidv4(),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    };

    const savedUser = await BitNexaUser.create({
      ...user,
      watchlist: [],
      portfolio: { positions: [], totalValue: 0 },
      transactions: [],
      alerts: [],
    });

    users.set(user.id, user);
    await ensureUserState(user.id);

    return res.status(201).json({
      message: 'User registered successfully.',
      token: createToken(savedUser.toObject ? savedUser.toObject() : user),
      user: {
        id: savedUser.id,
        name: savedUser.name,
        email: savedUser.email,
      },
    });
  }

  const existingUser = Array.from(users.values()).find((user) => user.email === normalizedEmail);
  if (existingUser) {
    return res.status(409).json({ error: 'This email is already registered.' });
  }

  const user = {
    id: uuidv4(),
    name: String(name).trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  };

  users.set(user.id, user);
  ensureMemoryUserState(user.id);

  return res.status(201).json({
    message: 'User registered successfully.',
    token: createToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login a user
 */
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = mongoReady && BitNexaUser
    ? await findUserByEmail(normalizedEmail)
    : Array.from(users.values()).find((entry) => entry.email === normalizedEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (mongoReady && BitNexaUser && !users.has(user.id)) {
    users.set(user.id, {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt,
    });
  }

  return res.json({
    message: 'Login successful.',
    token: createToken(user),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

app.get('/api/profile', authenticate, async (req, res) => {
  const user = mongoReady && BitNexaUser ? await findUserById(req.user.id) : users.get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  return res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

app.get('/api/watchlist', authenticate, async (req, res) => {
  await ensureUserState(req.user.id);

  if (mongoReady && BitNexaUser) {
    const userDoc = await findUserById(req.user.id);
    return res.json({ coinIds: Array.isArray(userDoc?.watchlist) ? userDoc.watchlist : [] });
  }

  return res.json({ coinIds: watchlists.get(req.user.id) || [] });
});

app.post('/api/watchlist', authenticate, async (req, res) => {
  const coinIds = Array.isArray(req.body?.coinIds) ? req.body.coinIds.map(String) : [];
  const uniqueIds = [...new Set(coinIds.filter(Boolean))].slice(0, 50);

  if (mongoReady && BitNexaUser) {
    const userDoc = await ensureUserState(req.user.id);
    userDoc.watchlist = uniqueIds;
    await userDoc.save();
    return res.json({ coinIds: uniqueIds, message: 'Watchlist updated.' });
  }

  ensureMemoryUserState(req.user.id);
  watchlists.set(req.user.id, uniqueIds);

  return res.json({ coinIds: uniqueIds, message: 'Watchlist updated.' });
});

app.get('/api/portfolio', authenticate, async (req, res) => {
  await ensureUserState(req.user.id);

  if (mongoReady && BitNexaUser) {
    const userDoc = await findUserById(req.user.id);
    return res.json(userDoc?.portfolio || { positions: [], totalValue: 0 });
  }

  return res.json(portfolios.get(req.user.id) || { positions: [], totalValue: 0 });
});

app.get('/api/portfolio/summary', authenticate, async (req, res) => {
  try {
    let userPortfolio = { positions: [], totalValue: 0 };

    if (mongoReady && BitNexaUser) {
      const userDoc = await ensureUserState(req.user.id);
      userPortfolio = userDoc?.portfolio || { positions: [], totalValue: 0 };
    } else {
      ensureMemoryUserState(req.user.id);
      userPortfolio = portfolios.get(req.user.id) || { positions: [], totalValue: 0 };
    }

    const positions = Array.isArray(userPortfolio.positions) ? userPortfolio.positions : [];

    if (!positions.length) {
      return res.json({
        totalValue: 0,
        totalInvested: 0,
        change: 0,
        changePercent: 0,
        positions: [],
      });
    }

    const ids = [...new Set(positions.map((position) => String(position.coinId || '').trim()).filter(Boolean))];
    const marketData = ids.length ? await getMarketData(ids) : [];
    const marketMap = new Map((marketData || []).map((coin) => [String(coin.id), coin]));

    const mappedPositions = positions.map((position) => {
      const amount = Number(position.amount || 0);
      const averagePrice = Number(position.averagePrice || 0);
      const marketCoin = marketMap.get(String(position.coinId));
      const currentPrice = Number(marketCoin?.current_price ?? averagePrice ?? 0);
      const invested = amount * averagePrice;
      const marketValue = amount * currentPrice;
      const pnl = marketValue - invested;

      return {
        ...position,
        amount,
        averagePrice,
        currentPrice,
        invested,
        marketValue,
        pnl,
        changePercent: invested ? (pnl / invested) * 100 : 0,
      };
    });

    const totalInvested = mappedPositions.reduce((sum, position) => sum + position.invested, 0);
    const totalValue = mappedPositions.reduce((sum, position) => sum + position.marketValue, 0);
    const change = totalValue - totalInvested;

    return res.json({
      totalValue,
      totalInvested,
      change,
      changePercent: totalInvested ? (change / totalInvested) * 100 : 0,
      positions: mappedPositions,
    });
  } catch (error) {
    console.error('Portfolio summary failed:', error.message);
    return res.status(500).json({ error: 'Unable to calculate portfolio summary.' });
  }
});

app.get('/api/portfolio/insights', authenticate, async (req, res) => {
  try {
    let userPortfolio = { positions: [], totalValue: 0 };

    if (mongoReady && BitNexaUser) {
      const userDoc = await ensureUserState(req.user.id);
      userPortfolio = userDoc?.portfolio || { positions: [], totalValue: 0 };
    } else {
      ensureMemoryUserState(req.user.id);
      userPortfolio = portfolios.get(req.user.id) || { positions: [], totalValue: 0 };
    }

    const positions = Array.isArray(userPortfolio.positions) ? userPortfolio.positions : [];
    const ids = [...new Set(positions.map((position) => String(position.coinId || '').trim()).filter(Boolean))];
    const marketData = ids.length ? await getMarketData(ids) : [];
    const marketMap = new Map((marketData || []).map((coin) => [String(coin.id), Number(coin.current_price || 0)]));

    return res.json(evaluatePortfolioInsights(positions, marketMap));
  } catch (error) {
    console.error('Portfolio insights failed:', error.message);
    return res.status(500).json({ error: 'Unable to calculate portfolio insights.' });
  }
});

app.post('/api/portfolio', authenticate, async (req, res) => {
  const { coinId, symbol, amount, averagePrice, allocation } = req.body || {};

  if (!coinId || !symbol || !Number.isFinite(Number(amount)) || !Number.isFinite(Number(averagePrice))) {
    return res.status(400).json({ error: 'coinId, symbol, amount, and averagePrice are required.' });
  }

  if (mongoReady && BitNexaUser) {
    const userDoc = await ensureUserState(req.user.id);
    const existingPortfolio = userDoc?.portfolio || { positions: [], totalValue: 0 };
    const existingPosition = existingPortfolio.positions.find((position) => position.coinId === coinId);
    const normalizedAmount = Number(amount);
    const normalizedAveragePrice = Number(averagePrice);

    if (existingPosition) {
      existingPosition.amount = Number(existingPosition.amount) + normalizedAmount;
      existingPosition.averagePrice = Number(((existingPosition.averagePrice * (existingPosition.amount - normalizedAmount)) + (normalizedAveragePrice * normalizedAmount)) / existingPosition.amount).toFixed(2);
    } else {
      existingPortfolio.positions.push({
        coinId,
        symbol: String(symbol).toUpperCase(),
        amount: normalizedAmount,
        averagePrice: normalizedAveragePrice,
        allocation: Number(allocation || 0),
      });
    }

    existingPortfolio.totalValue = existingPortfolio.positions.reduce((sum, position) => sum + (position.amount * position.averagePrice), 0);
    userDoc.portfolio = existingPortfolio;
    await userDoc.save();

    return res.status(201).json({ message: 'Portfolio updated.', portfolio: existingPortfolio });
  }

  ensureMemoryUserState(req.user.id);
  const existingPortfolio = portfolios.get(req.user.id) || { positions: [], totalValue: 0 };
  const existingPosition = existingPortfolio.positions.find((position) => position.coinId === coinId);
  const normalizedAmount = Number(amount);
  const normalizedAveragePrice = Number(averagePrice);

  if (existingPosition) {
    existingPosition.amount = Number(existingPosition.amount) + normalizedAmount;
    existingPosition.averagePrice = Number(((existingPosition.averagePrice * (existingPosition.amount - normalizedAmount)) + (normalizedAveragePrice * normalizedAmount)) / existingPosition.amount).toFixed(2);
  } else {
    existingPortfolio.positions.push({
      coinId,
      symbol: String(symbol).toUpperCase(),
      amount: normalizedAmount,
      averagePrice: normalizedAveragePrice,
      allocation: Number(allocation || 0),
    });
  }

  existingPortfolio.totalValue = existingPortfolio.positions.reduce((sum, position) => sum + (position.amount * position.averagePrice), 0);
  portfolios.set(req.user.id, existingPortfolio);

  return res.status(201).json({
    message: 'Portfolio updated.',
    portfolio: existingPortfolio,
  });
});

app.get('/api/alerts', authenticate, async (req, res) => {
  try {
    if (mongoReady && BitNexaUser) {
      const userDoc = await ensureUserState(req.user.id);
      const userAlerts = Array.isArray(userDoc?.alerts) ? userDoc.alerts : [];
      const ids = [...new Set(userAlerts.map((alert) => String(alert.coinId || '').trim()).filter(Boolean))];
      const marketData = ids.length ? await getMarketData(ids) : [];
      const marketMap = new Map((marketData || []).map((coin) => [String(coin.id), Number(coin.current_price || 0)]));
      const evaluatedAlerts = userAlerts.map((alert) => {
        const currentPrice = marketMap.get(String(alert.coinId)) ?? Number(alert.currentPrice || 0);
        return evaluateAlertStatus(alert, currentPrice);
      });
      userDoc.alerts = evaluatedAlerts;
      await userDoc.save();
      return res.json({ alerts: evaluatedAlerts });
    }

    ensureMemoryUserState(req.user.id);
    const userAlerts = alerts.get(req.user.id) || [];
    const ids = [...new Set(userAlerts.map((alert) => String(alert.coinId || '').trim()).filter(Boolean))];
    const marketData = ids.length ? await getMarketData(ids) : [];
    const marketMap = new Map((marketData || []).map((coin) => [String(coin.id), Number(coin.current_price || 0)]));

    const evaluatedAlerts = userAlerts.map((alert) => {
      const currentPrice = marketMap.get(String(alert.coinId)) ?? Number(alert.currentPrice || 0);
      return evaluateAlertStatus(alert, currentPrice);
    });

    alerts.set(req.user.id, evaluatedAlerts);
    return res.json({ alerts: evaluatedAlerts });
  } catch (error) {
    console.error('Alert evaluation failed:', error.message);
    return res.status(500).json({ error: 'Unable to evaluate market alerts.' });
  }
});

app.post('/api/alerts', authenticate, async (req, res) => {
  const { coinId, targetPrice, direction } = req.body || {};

  if (!coinId || !Number.isFinite(Number(targetPrice)) || !direction) {
    return res.status(400).json({ error: 'coinId, targetPrice, and direction are required.' });
  }

  let currentPrice = 0;
  try {
    const marketCoin = await getCoinById(String(coinId));
    currentPrice = Number(marketCoin?.current_price || 0);
  } catch (error) {
    currentPrice = 0;
  }

  const alert = evaluateAlertStatus({
    id: uuidv4(),
    coinId: String(coinId),
    targetPrice: Number(targetPrice),
    direction: String(direction).toLowerCase(),
    createdAt: new Date().toISOString(),
  }, currentPrice);

  if (mongoReady && BitNexaUser) {
    const userDoc = await ensureUserState(req.user.id);
    const userAlerts = Array.isArray(userDoc.alerts) ? userDoc.alerts : [];
    userAlerts.push(alert);
    userDoc.alerts = userAlerts;
    await userDoc.save();
    return res.status(201).json({ message: 'Alert created.', alert });
  }

  ensureMemoryUserState(req.user.id);

  const userAlerts = alerts.get(req.user.id) || [];
  userAlerts.push(alert);
  alerts.set(req.user.id, userAlerts);

  return res.status(201).json({ message: 'Alert created.', alert });
});

app.get('/api/transactions', authenticate, async (req, res) => {
  if (mongoReady && BitNexaUser) {
    const userDoc = await ensureUserState(req.user.id);
    return res.json({ transactions: userDoc?.transactions || [] });
  }

  ensureMemoryUserState(req.user.id);
  return res.json({ transactions: transactions.get(req.user.id) || [] });
});

app.post('/api/transactions', authenticate, async (req, res) => {
  const { symbol, side = 'buy', amount, quote, type = 'market', status = 'filled', price } = req.body || {};
  const symbolKey = String(symbol || '').trim();
  const amountValue = Number(amount);

  if (!symbolKey) {
    return res.status(400).json({ error: 'Symbol is required.' });
  }

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return res.status(400).json({ error: 'Trade amount must be greater than zero.' });
  }

  const transaction = {
    id: `txn_${Date.now()}`,
    symbol: symbolKey.toUpperCase(),
    side: String(side || 'buy').toLowerCase(),
    type: String(type || 'market').toLowerCase(),
    amount: Number(amountValue.toFixed(6)),
    quote: Number(Number(quote || 0).toFixed(2)),
    price: Number(Number(price || quote / amountValue || 0).toFixed(4)),
    status: String(status || 'filled').toLowerCase(),
    timestamp: new Date().toISOString(),
  };

  if (mongoReady && BitNexaUser) {
    const userDoc = await ensureUserState(req.user.id);
    const userTransactions = Array.isArray(userDoc.transactions) ? userDoc.transactions : [];
    userTransactions.unshift(transaction);
    userDoc.transactions = userTransactions.slice(0, 50);
    await userDoc.save();
    return res.status(201).json({ message: 'Transaction recorded.', transaction });
  }

  ensureMemoryUserState(req.user.id);
  const userTransactions = transactions.get(req.user.id) || [];
  userTransactions.unshift(transaction);
  transactions.set(req.user.id, userTransactions.slice(0, 50));

  return res.status(201).json({ message: 'Transaction recorded.', transaction });
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

app.post('/api/trade', async (req, res) => {
  try {
    const { symbol, side = 'buy', amount, type = 'market', price } = req.body || {};
    const symbolKey = String(symbol || '').trim();
    const amountValue = Number(amount);

    if (!symbolKey) {
      return res.status(400).json({ error: 'Trading symbol is required.' });
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return res.status(400).json({ error: 'Trade amount must be greater than zero.' });
    }

    const quoteCoin = await getCoinById(symbolKey.toLowerCase());
    const marketPrice = Number(price) || Number(quoteCoin?.current_price || 0);
    const quoteAmount = marketPrice * amountValue;
    const fee = quoteAmount * 0.001;

    const order = {
      id: `ord_${Date.now()}`,
      symbol: symbolKey.toUpperCase(),
      side: String(side || 'buy').toLowerCase(),
      type: String(type || 'market').toLowerCase(),
      amount: Number(amountValue.toFixed(6)),
      price: Number(marketPrice.toFixed(4)),
      quote: Number(quoteAmount.toFixed(2)),
      fee: Number(fee.toFixed(2)),
      status: 'filled',
      timestamp: new Date().toISOString(),
    };

    return res.json({ success: true, order });
  } catch (error) {
    console.error('Trade execution failed:', error.message);
    return res.status(500).json({ error: 'Trade execution failed.' });
  }
});

app.get('/', (req, res) => {
  res.json({
    app: 'BitNexa',
    status: 'running',
  });
});

let serverInstance = null;

const startServer = (port) => {
  serverInstance = app.listen(port, () => {
    console.log(`BitNexa backend listening on http://localhost:${port}`);
  });

  serverInstance.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`Port ${port} is busy, retrying on ${nextPort}.`);
      startServer(nextPort);
      return;
    }

    throw error;
  });
};

const closeServer = () => new Promise((resolve, reject) => {
  if (!serverInstance) {
    resolve();
    return;
  }

  serverInstance.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

if (require.main === module) {
  startServer(DEFAULT_PORT);
}

module.exports = { app, closeServer };
