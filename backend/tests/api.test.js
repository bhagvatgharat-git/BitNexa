const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { app, closeServer } = require('../server');

test('GET /api/health returns ok', async () => {
  const response = await request(app).get('/api/health');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('POST /api/auth/register creates a user and returns a token', async () => {
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'Password123!'
    });

  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.equal(response.body.user.email, 'demo@example.com');
});

test('GET /api/watchlist requires auth', async () => {
  const response = await request(app).get('/api/watchlist');
  assert.equal(response.status, 401);
});

test('POST /api/watchlist stores tracked coins for authenticated user', async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'demo@example.com',
      password: 'Password123!'
    });

  const response = await request(app)
    .post('/api/watchlist')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({ coinIds: ['bitcoin', 'ethereum', 'solana'] });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.coinIds, ['bitcoin', 'ethereum', 'solana']);
});

test('POST /api/portfolio stores a position for an authenticated user', async () => {
  const email = 'portfolio-demo@example.com';
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Portfolio User',
      email,
      password: 'Password123!'
    });

  const response = await request(app)
    .post('/api/portfolio')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      coinId: 'bitcoin',
      symbol: 'BTC',
      amount: 0.42,
      averagePrice: 62000,
      allocation: 40,
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.portfolio.positions[0].coinId, 'bitcoin');
  assert.equal(response.body.portfolio.positions[0].amount, 0.42);
});

test('POST /api/alerts creates an alert for an authenticated user', async () => {
  const email = 'alerts-demo@example.com';
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Alerts User',
      email,
      password: 'Password123!'
    });

  const response = await request(app)
    .post('/api/alerts')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      coinId: 'ethereum',
      targetPrice: 3500,
      direction: 'above',
    });

  assert.equal(response.status, 201);
  assert.equal(response.body.alert.coinId, 'ethereum');
  assert.equal(response.body.alert.direction, 'above');

  const listResponse = await request(app)
    .get('/api/alerts')
    .set('Authorization', `Bearer ${register.body.token}`);

  assert.equal(listResponse.status, 200);
  assert.ok(listResponse.body.alerts[0].status); 
  assert.ok(typeof listResponse.body.alerts[0].currentPrice === 'number');
  assert.ok(listResponse.body.alerts[0].currentPrice > 0);
});

test('POST /api/transactions stores and returns order history for an authenticated user', async () => {
  const email = 'trading-demo@example.com';
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Trade User',
      email,
      password: 'Password123!'
    });

  const createResponse = await request(app)
    .post('/api/transactions')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      symbol: 'btc',
      side: 'buy',
      amount: 0.25,
      quote: 15500,
      status: 'filled',
    });

  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.transaction.symbol, 'BTC');

  const listResponse = await request(app)
    .get('/api/transactions')
    .set('Authorization', `Bearer ${register.body.token}`);

  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.transactions.length >= 1, true);
});

test('GET /api/portfolio/summary returns live portfolio metrics for an authenticated user', async () => {
  const email = 'portfolio-summary-demo@example.com';
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Portfolio Summary User',
      email,
      password: 'Password123!'
    });

  await request(app)
    .post('/api/portfolio')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      coinId: 'bitcoin',
      symbol: 'BTC',
      amount: 0.5,
      averagePrice: 60000,
      allocation: 100,
    });

  const response = await request(app)
    .get('/api/portfolio/summary')
    .set('Authorization', `Bearer ${register.body.token}`);

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.totalValue === 'number');
  assert.ok(typeof response.body.totalInvested === 'number');
  assert.ok(typeof response.body.change === 'number');
});

test('GET /api/portfolio/insights returns diversification and risk metrics', async () => {
  const email = 'portfolio-insights-demo@example.com';
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Portfolio Insights User',
      email,
      password: 'Password123!'
    });

  await request(app)
    .post('/api/portfolio')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      coinId: 'bitcoin',
      symbol: 'BTC',
      amount: 0.5,
      averagePrice: 60000,
      allocation: 50,
    });

  await request(app)
    .post('/api/portfolio')
    .set('Authorization', `Bearer ${register.body.token}`)
    .send({
      coinId: 'ethereum',
      symbol: 'ETH',
      amount: 1.5,
      averagePrice: 3000,
      allocation: 50,
    });

  const response = await request(app)
    .get('/api/portfolio/insights')
    .set('Authorization', `Bearer ${register.body.token}`);

  assert.equal(response.status, 200);
  assert.ok(typeof response.body.diversificationScore === 'number');
  assert.ok(typeof response.body.concentrationRisk === 'number');
  assert.ok(typeof response.body.topPerformer === 'string');
});

test.after(async () => {
  await closeServer();
});
