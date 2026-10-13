export default function TradeHistorySection({
  selectedNav,
  transactions = [],
  paperWallet,
  tradeHistoryFilter,
  setTradeHistoryFilter,
  user,
  formatCurrency,
  setSelectedNav,
}) {
  const allTrades = [
    ...(Array.isArray(transactions) ? transactions : []),
    ...(Array.isArray(paperWallet?.trades) ? paperWallet.trades : []),
  ];

  const seen = new Set();
  const uniqueTrades = allTrades.filter((t) => {
    const key = t.id || `${t.timestamp}-${t.symbol}-${t.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const filteredTrades = uniqueTrades.filter((t) => {
    if (tradeHistoryFilter === 'buy') return t.side === 'buy';
    if (tradeHistoryFilter === 'sell') return t.side === 'sell';
    return true;
  });

  const totalTradesCount = uniqueTrades.length;
  const buyCount = uniqueTrades.filter((t) => t.side === 'buy').length;
  const sellCount = uniqueTrades.filter((t) => t.side === 'sell').length;
  const totalRealizedPnl = uniqueTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);
  const totalVolumeTraded = uniqueTrades.reduce(
    (acc, t) => acc + (Number(t.quote) || Number(t.amount) * Number(t.price) || 0),
    0
  );

  return (
    <section className={`trade-history-section ${selectedNav === 'Trade History' ? 'section-active' : 'section-hidden'}`}>
      <div className="trade-history-container">
        <div className="trade-history-stats-grid">
          <div className="panel-card th-stat-card">
            <span className="th-stat-label">Total Trades</span>
            <strong className="th-stat-val">{totalTradesCount}</strong>
            <span className="th-stat-sub">{buyCount} Buys · {sellCount} Sells</span>
          </div>

          <div className="panel-card th-stat-card">
            <span className="th-stat-label">Total Volume Traded</span>
            <strong className="th-stat-val">{formatCurrency(totalVolumeTraded)}</strong>
            <span className="th-stat-sub">Cumulative order flow</span>
          </div>

          <div className="panel-card th-stat-card">
            <span className="th-stat-label">Realized P&amp;L</span>
            <strong className={`th-stat-val ${totalRealizedPnl >= 0 ? 'positive' : 'negative'}`}>
              {totalRealizedPnl >= 0 ? '+' : ''}{formatCurrency(totalRealizedPnl)}
            </strong>
            <span className="th-stat-sub">From closed positions</span>
          </div>

          <div className="panel-card th-stat-card">
            <span className="th-stat-label">Execution Mode</span>
            <strong className="th-stat-val" style={{ color: '#38bdf8' }}>
              {user ? 'Account Synced' : 'Demo Trading'}
            </strong>
            <span className="th-stat-sub">Instant fills</span>
          </div>
        </div>

        <div className="panel-card th-table-panel" style={{ marginTop: '1.25rem' }}>
          <div className="th-panel-header">
            <div>
              <h3>Executed Fills &amp; Orders</h3>
              <p className="th-panel-sub">Complete audit log of all your buy and sell executions</p>
            </div>

            <div className="th-filters-row">
              <div className="th-pill-group">
                <button
                  type="button"
                  className={`th-pill-btn ${tradeHistoryFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setTradeHistoryFilter('all')}
                >
                  All ({totalTradesCount})
                </button>
                <button
                  type="button"
                  className={`th-pill-btn ${tradeHistoryFilter === 'buy' ? 'active' : ''}`}
                  onClick={() => setTradeHistoryFilter('buy')}
                >
                  Buys ({buyCount})
                </button>
                <button
                  type="button"
                  className={`th-pill-btn ${tradeHistoryFilter === 'sell' ? 'active' : ''}`}
                  onClick={() => setTradeHistoryFilter('sell')}
                >
                  Sells ({sellCount})
                </button>
              </div>
            </div>
          </div>

          {filteredTrades.length === 0 ? (
            <div className="th-empty-state">
              <span className="th-empty-icon">📋</span>
              <h4>No trades recorded yet</h4>
              <p>Buy or sell any asset in the market view to start tracking your trade execution history here.</p>
              <button
                type="button"
                className="primary-btn"
                style={{ marginTop: '1rem' }}
                onClick={() => setSelectedNav('Markets')}
              >
                Explore Markets &amp; Trade
              </button>
            </div>
          ) : (
            <div className="th-table-wrap">
              <table className="th-table">
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>Asset / Pair</th>
                    <th>Side</th>
                    <th>Execution Price</th>
                    <th>Filled Quantity</th>
                    <th>Total Value</th>
                    <th>Realized P&amp;L</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTrades.map((t, index) => {
                    const isBuy = t.side === 'buy';
                    const tradeSymbol = (t.symbol || 'BTC').toUpperCase();
                    const tradePrice = Number(t.price || 0);
                    const tradeAmount = Number(t.amount || 0);
                    const tradeTotal = Number(t.quote) || tradePrice * tradeAmount;
                    const hasPnl = t.pnl !== undefined && t.pnl !== null;
                    const pnlVal = Number(t.pnl || 0);
                    const dateObj = t.timestamp ? new Date(t.timestamp) : new Date();

                    return (
                      <tr key={t.id || index}>
                        <td className="th-col-time">
                          <div className="th-time-val">
                            {dateObj.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                          <div className="th-time-sub">
                            {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                        </td>
                        <td>
                          <div className="th-coin-cell">
                            <span className="th-coin-sym">{tradeSymbol}</span>
                            <span className="th-pair-sub">/ USDT</span>
                          </div>
                        </td>
                        <td>
                          <span className={`th-side-badge ${isBuy ? 'buy' : 'sell'}`}>
                            {isBuy ? '↑ BUY' : '↓ SELL'}
                          </span>
                        </td>
                        <td className="th-price-cell">{formatCurrency(tradePrice)}</td>
                        <td>{tradeAmount.toFixed(6)} {tradeSymbol}</td>
                        <td className="th-value-cell">{formatCurrency(tradeTotal)}</td>
                        <td>
                          {hasPnl ? (
                            <span className={`th-pnl-chip ${pnlVal >= 0 ? 'positive' : 'negative'}`}>
                              {pnlVal >= 0 ? '+' : ''}{formatCurrency(pnlVal)}
                            </span>
                          ) : (
                            <span className="th-dim-text">—</span>
                          )}
                        </td>
                        <td>
                          <span className="th-status-pill">
                            <span className="th-status-dot" /> FILLED
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
