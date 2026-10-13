import test from 'node:test';
import assert from 'node:assert/strict';
import { closePaperPosition, createDemoWallet, executePaperTrade } from './paperTrading.js';

test('a demo buy deducts quote and fee and adds a position', () => {
  const result = executePaperTrade(createDemoWallet(), {
    coinId: 'bitcoin',
    symbol: 'btc',
    side: 'buy',
    amount: 0.1,
    price: 50000,
  });

  assert.equal(result.wallet.cash, 4995);
  assert.equal(result.wallet.positions[0].amount, 0.1);
  assert.equal(result.trade.fee, 5);
  assert.equal(result.trade.status, 'filled');
});

test('a demo sell returns proceeds and removes a fully sold position', () => {
  const bought = executePaperTrade(createDemoWallet(), {
    coinId: 'bitcoin', symbol: 'BTC', side: 'buy', amount: 0.1, price: 50000,
  }).wallet;
  const sold = executePaperTrade(bought, {
    coinId: 'bitcoin', symbol: 'BTC', side: 'sell', amount: 0.1, price: 60000,
  });

  assert.equal(sold.wallet.cash, 10989);
  assert.deepEqual(sold.wallet.positions, []);
});

test('demo orders reject insufficient cash and unsold holdings', () => {
  const wallet = createDemoWallet();

  assert.throws(() => executePaperTrade(wallet, {
    coinId: 'bitcoin', symbol: 'BTC', side: 'buy', amount: 1, price: 50000,
  }), /Not enough demo cash/);
  assert.throws(() => executePaperTrade(wallet, {
    coinId: 'bitcoin', symbol: 'BTC', side: 'sell', amount: 0.1, price: 50000,
  }), /Not enough BTC/);
  assert.equal(wallet.cash, 10000);
  assert.deepEqual(wallet.positions, []);
});

test('closePaperPosition closes open position and records realized profit/loss', () => {
  const bought = executePaperTrade(createDemoWallet(), {
    coinId: 'bitcoin', symbol: 'BTC', side: 'buy', amount: 0.1, price: 50000,
  }).wallet;

  const closed = closePaperPosition(bought, {
    coinId: 'bitcoin', price: 55000,
  });

  assert.equal(closed.wallet.positions.length, 0);
  assert.equal(closed.trade.side, 'sell');
  assert.equal(closed.trade.pnl > 0, true);
  assert.equal(closed.wallet.cash > 10000, true);
});