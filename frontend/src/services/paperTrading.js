export const DEMO_WALLET_STORAGE_KEY = 'bitnexa-paper-wallet';
export const STARTING_DEMO_CASH = 10000;

export const createDemoWallet = () => ({
  cash: STARTING_DEMO_CASH,
  positions: [],
  trades: [],
});

export const getUserWalletKey = (user) => {
  if (!user) return 'bitnexa-paper-wallet-guest';
  const id = user.id || user.email;
  return id ? `bitnexa-paper-wallet-${String(id).toLowerCase().replace(/[^a-z0-9_-]/g, '_')}` : 'bitnexa-paper-wallet-guest';
};

export const loadUserWallet = (user) => {
  if (typeof window === 'undefined') return createDemoWallet();
  try {
    const key = getUserWalletKey(user);
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (saved && Number.isFinite(Number(saved.cash)) && Array.isArray(saved.positions) && Array.isArray(saved.trades)) {
      return saved;
    }
  } catch {}
  return createDemoWallet();
};

export const saveUserWallet = (user, wallet) => {
  if (typeof window === 'undefined' || !wallet) return;
  try {
    const key = getUserWalletKey(user);
    localStorage.setItem(key, JSON.stringify(wallet));
    localStorage.removeItem(DEMO_WALLET_STORAGE_KEY);
  } catch {}
};

const roundCash = (value) => Number(value.toFixed(2));
const roundQuantity = (value) => Number(value.toFixed(8));

export function executePaperTrade(wallet, order) {
  const cash = Number(wallet?.cash);
  const positions = Array.isArray(wallet?.positions) ? wallet.positions : [];
  const trades = Array.isArray(wallet?.trades) ? wallet.trades : [];
  const amount = Number(order?.amount);
  const price = Number(order?.price);
  const side = String(order?.side || '').toLowerCase(); // 'buy' (Long/Uptrend) or 'sell' (Short/Downtrend)
  const coinId = String(order?.coinId || '').trim();
  const symbol = String(order?.symbol || '').trim().toUpperCase();

  if (!Number.isFinite(cash) || cash < 0) throw new Error('Demo wallet balance is invalid.');
  if (!coinId || !symbol) throw new Error('Select a valid market before trading.');
  if (!['buy', 'sell'].includes(side)) throw new Error('Choose buy (Long) or sell (Short).');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a quantity greater than zero.');
  if (!Number.isFinite(price) || price <= 0) throw new Error('A live market price is not available yet.');

  const quote = roundCash(amount * price);
  const fee = roundCash(quote * 0.001);
  const totalMarginRequired = quote + fee;

  if (totalMarginRequired > cash) {
    throw new Error(`Not enough demo cash (${cash}) for this order ($${totalMarginRequired} required incl. 0.1% fee).`);
  }

  let nextCash = roundCash(cash - totalMarginRequired);
  let nextPositions = positions.map((position) => ({ ...position }));

  // Find if an existing position with the SAME side exists
  const existingPosition = nextPositions.find((p) => p.coinId === coinId && (p.side || 'buy') === side);

  if (existingPosition) {
    const prevAmount = Number(existingPosition.amount || 0);
    const nextAmount = roundQuantity(prevAmount + amount);
    const prevCost = prevAmount * Number(existingPosition.averagePrice || 0);
    const averagePrice = (prevCost + quote) / nextAmount;

    nextPositions = nextPositions.map((p) => (p === existingPosition
      ? { ...p, amount: nextAmount, averagePrice, margin: roundCash((p.margin || 0) + quote) }
      : p));
  } else {
    nextPositions.push({
      coinId,
      symbol,
      side, // 'buy' (Long) or 'sell' (Short)
      amount: roundQuantity(amount),
      averagePrice: price,
      margin: quote,
    });
  }

  const trade = {
    id: `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    coinId,
    symbol,
    side,
    amount: roundQuantity(amount),
    price,
    quote,
    fee,
    status: 'filled',
    timestamp: new Date().toISOString(),
  };

  return {
    trade,
    wallet: {
      cash: nextCash,
      positions: nextPositions,
      trades: [trade, ...trades].slice(0, 50),
    },
  };
}

export function closePaperPosition(wallet, { coinId, price, percent = 100, side }) {
  const positions = Array.isArray(wallet?.positions) ? wallet.positions : [];
  const existingPosition = positions.find((p) => p.coinId === coinId && (!side || (p.side || 'buy') === side));
  if (!existingPosition) {
    throw new Error('Position not found in demo portfolio.');
  }

  const cash = Number(wallet?.cash || 0);
  const trades = Array.isArray(wallet?.trades) ? wallet.trades : [];
  const posSide = existingPosition.side || 'buy';
  const posAmount = Number(existingPosition.amount || 0);
  const fraction = Math.max(0.01, Math.min(100, Number(percent) || 100)) / 100;
  const closeAmount = roundQuantity(posAmount * fraction);
  const entryPrice = Number(existingPosition.averagePrice || price);
  const closeQuote = roundCash(closeAmount * price);
  const closeFee = roundCash(closeQuote * 0.001);

  // PnL Calculation:
  // Long (buy): Price rose -> profit: (price - entryPrice) * closeAmount
  // Short (sell): Price dropped -> profit: (entryPrice - price) * closeAmount
  let pnl = 0;
  if (posSide === 'buy') {
    pnl = roundCash(((price - entryPrice) * closeAmount) - closeFee);
  } else {
    pnl = roundCash(((entryPrice - price) * closeAmount) - closeFee);
  }

  const initialMarginForClosedShare = roundCash(closeAmount * entryPrice);
  // Cash returned is the margin freed up + profit (or - loss)
  const cashReturned = roundCash(Math.max(0, initialMarginForClosedShare + pnl));
  const nextCash = roundCash(cash + cashReturned);

  const remainingAmount = roundQuantity(posAmount - closeAmount);
  let nextPositions = [];
  if (remainingAmount <= 1e-8) {
    nextPositions = positions.filter((p) => p !== existingPosition);
  } else {
    nextPositions = positions.map((p) => (p === existingPosition
      ? { ...p, amount: remainingAmount, margin: roundCash(p.margin * (1 - fraction)) }
      : p));
  }

  const costBasis = roundCash(closeAmount * entryPrice);
  const pnlPercent = costBasis > 0 ? Number(((pnl / costBasis) * 100).toFixed(2)) : 0;

  const closeTradeSide = posSide === 'buy' ? 'sell' : 'buy'; // closing a long is selling; closing a short is buying back
  const trade = {
    id: `demo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    coinId: existingPosition.coinId,
    symbol: existingPosition.symbol,
    side: closeTradeSide,
    orderType: `close-${posSide}`,
    amount: closeAmount,
    price,
    quote: closeQuote,
    fee: closeFee,
    pnl,
    pnlPercent,
    status: 'filled',
    timestamp: new Date().toISOString(),
  };

  return {
    trade,
    wallet: {
      cash: nextCash,
      positions: nextPositions,
      trades: [trade, ...trades].slice(0, 50),
    },
  };
}