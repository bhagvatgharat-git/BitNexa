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

test.after(async () => {
  await closeServer();
});
