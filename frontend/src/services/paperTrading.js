export const DEMO_WALLET_STORAGE_KEY = 'bitnexa-paper-wallet';
export const STARTING_DEMO_CASH = 10000;

export const createDemoWallet = () => ({
  cash: STARTING_DEMO_CASH,
  positions: [],
  trades: [],
});

const roundCash = (value) => Number(value.toFixed(2));
const roundQuantity = (value) => Number(value.toFixed(8));

export function executePaperTrade(wallet, order) {
  const cash = Number(wallet?.cash);
  const positions = Array.isArray(wallet?.positions) ? wallet.positions : [];
  const trades = Array.isArray(wallet?.trades) ? wallet.trades : [];
  const amount = Number(order?.amount);
  const price = Number(order?.price);
  const side = String(order?.side || '').toLowerCase();
  const coinId = String(order?.coinId || '').trim();
  const symbol = String(order?.symbol || '').trim().toUpperCase();

  if (!Number.isFinite(cash) || cash < 0) throw new Error('Demo wallet balance is invalid.');
  if (!coinId || !symbol) throw new Error('Select a valid market before trading.');
  if (!['buy', 'sell'].includes(side)) throw new Error('Choose buy or sell.');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a quantity greater than zero.');
  if (!Number.isFinite(price) || price <= 0) throw new Error('A live market price is not available yet.');

  const quote = roundCash(amount * price);
  const fee = roundCash(quote * 0.001);
  let nextCash = cash;
  let nextPositions = positions.map((position) => ({ ...position }));

  let realizedPnL = undefined;
  let realizedPnLPercent = undefined;

  if (side === 'buy') {
    const totalCost = quote + fee;
    if (totalCost > cash) throw new Error('Not enough demo cash for this order, including the 0.1% fee.');

    const existingPosition = nextPositions.find((position) => position.coinId === coinId);
    const previousAmount = Number(existingPosition?.amount || 0);
    const nextAmount = roundQuantity(previousAmount + amount);
    const previousCost = previousAmount * Number(existingPosition?.averagePrice || 0);
    const averagePrice = (previousCost + totalCost) / nextAmount;

    if (existingPosition) {
      nextPositions = nextPositions.map((position) => position.coinId === coinId
        ? { ...position, amount: nextAmount, averagePrice }
        : position);
    } else {
      nextPositions.push({ coinId, symbol, amount: nextAmount, averagePrice });
    }
    nextCash = roundCash(cash - totalCost);
  } else {
    const existingPosition = nextPositions.find((position) => position.coinId === coinId);
    const heldAmount = Number(existingPosition?.amount || 0);
    if (!existingPosition || amount > heldAmount + 1e-8) {
      throw new Error(`Not enough ${symbol} in demo holdings to sell.`);
    }

    const avgPrice = Number(existingPosition?.averagePrice || price);
    const costBasis = roundCash(amount * avgPrice);
    const netProceeds = quote - fee;
    realizedPnL = roundCash(netProceeds - costBasis);
    realizedPnLPercent = costBasis > 0 ? Number(((realizedPnL / costBasis) * 100).toFixed(2)) : 0;

    const remainingAmount = roundQuantity(heldAmount - amount);
    nextPositions = remainingAmount <= 1e-8
      ? nextPositions.filter((position) => position.coinId !== coinId)
      : nextPositions.map((position) => position.coinId === coinId
        ? { ...position, amount: remainingAmount }
        : position);
    nextCash = roundCash(cash + quote - fee);
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
    ...(realizedPnL !== undefined ? { pnl: realizedPnL, pnlPercent: realizedPnLPercent } : {}),
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

export function closePaperPosition(wallet, { coinId, price, percent = 100 }) {
  const positions = Array.isArray(wallet?.positions) ? wallet.positions : [];
  const existingPosition = positions.find((position) => position.coinId === coinId);
  if (!existingPosition) {
    throw new Error('Position not found in demo portfolio.');
  }

  const fraction = Math.max(0.01, Math.min(100, Number(percent) || 100)) / 100;
  const closeAmount = roundQuantity(Number(existingPosition.amount) * fraction);

  return executePaperTrade(wallet, {
    coinId: existingPosition.coinId,
    symbol: existingPosition.symbol,
    side: 'sell',
    amount: closeAmount,
    price,
  });
}