import React, { useState, useMemo } from 'react';

const formatCurrency = (val) => {
  const num = Number(val || 0);
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumber = (val) => {
  const num = Number(val || 0);
  return num.toLocaleString('en-US');
};

export default function AdminPanel({
  adminStats,
  adminUsers = [],
  adminLoading,
  adminSelectedUser,
  setAdminSelectedUser,
  handleAdminRefresh,
  handleAdminLogout,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'active' | 'profitable' | 'positions'
  const [sortBy, setSortBy] = useState('trades'); // 'trades' | 'volume' | 'pnl' | 'cash' | 'newest'

  // Inside Selected User Inspector
  const [inspectorTab, setInspectorTab] = useState('trades'); // 'trades' | 'positions' | 'watchlist_alerts'
  const [tradeSearch, setTradeSearch] = useState('');
  const [tradeSideFilter, setTradeSideFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'

  // Filtered & Sorted Users List
  const filteredUsers = useMemo(() => {
    let list = Array.isArray(adminUsers) ? [...adminUsers] : [];

    // Search query filter (name, email, id)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.id && String(u.id).toLowerCase().includes(q))
      );
    }

    // Category filter
    if (filterType === 'active') {
      list = list.filter((u) => Number(u.tradeCount || 0) > 0);
    } else if (filterType === 'profitable') {
      list = list.filter((u) => Number(u.realizedPnL || 0) > 0);
    } else if (filterType === 'positions') {
      list = list.filter((u) => Number(u.openPositions || 0) > 0);
    }

    // Sort order
    list.sort((a, b) => {
      if (sortBy === 'trades') return Number(b.tradeCount || 0) - Number(a.tradeCount || 0);
      if (sortBy === 'volume') return Number(b.totalVolume || 0) - Number(a.totalVolume || 0);
      if (sortBy === 'pnl') return Number(b.realizedPnL || 0) - Number(a.realizedPnL || 0);
      if (sortBy === 'cash') return Number(b.cashBalance || 0) - Number(a.cashBalance || 0);
      if (sortBy === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      return 0;
    });

    return list;
  }, [adminUsers, searchQuery, filterType, sortBy]);

  // Sync selected user when adminUsers refreshes
  const activeUser = useMemo(() => {
    if (!adminSelectedUser) return null;
    return adminUsers.find((u) => u.id === adminSelectedUser.id) || adminSelectedUser;
  }, [adminUsers, adminSelectedUser]);

  // Filtered trades for active inspected user
  const inspectedTrades = useMemo(() => {
    if (!activeUser) return [];
    const trades = activeUser.allTrades || activeUser.recentTrades || [];
    return trades.filter((t) => {
      const side = String(t.side || t.orderType || '').toUpperCase();
      if (tradeSideFilter !== 'ALL' && side !== tradeSideFilter) return false;
      if (tradeSearch.trim()) {
        const q = tradeSearch.trim().toLowerCase();
        const asset = String(t.symbol || t.coinId || '').toLowerCase();
        if (!asset.includes(q)) return false;
      }
      return true;
    });
  }, [activeUser, tradeSideFilter, tradeSearch]);

  const activeTradersCount = useMemo(() => {
    return (adminUsers || []).filter((u) => Number(u.tradeCount || 0) > 0).length;
  }, [adminUsers]);

  const profitableCount = useMemo(() => {
    return (adminUsers || []).filter((u) => Number(u.realizedPnL || 0) > 0).length;
  }, [adminUsers]);

  const positionsCount = useMemo(() => {
    return (adminUsers || []).filter((u) => Number(u.openPositions || 0) > 0).length;
  }, [adminUsers]);

  return (
    <div className="admin-panel-overlay" role="dialog" aria-modal="true" aria-label="BitNexa Admin Control Center">
      <div className="admin-panel">
        {/* Top Header */}
        <div className="admin-panel-header">
          <div className="admin-panel-title">
            <span className="admin-badge">⚙️ ADMIN CONTROL</span>
            <div>
              <h2>BitNexa Intelligence &amp; User Audit</h2>
              <span className="admin-subtitle">Real-time user trade executions, balances, volume &amp; portfolio tracking</span>
            </div>
          </div>
          <div className="admin-panel-actions">
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={handleAdminRefresh}
              disabled={adminLoading}
              title="Refresh all user records and statistics"
            >
              {adminLoading ? '⟳ Refreshing…' : '⟳ Refresh Data'}
            </button>
            <button
              type="button"
              className="admin-logout-btn"
              onClick={handleAdminLogout}
              title="Close Admin Panel"
            >
              ✕ Exit Panel
            </button>
          </div>
        </div>

        {/* Global Platform KPIs */}
        {adminStats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-icon">👥</span>
              <div>
                <div className="admin-stat-value">{formatNumber(adminStats.totalUsers)}</div>
                <div className="admin-stat-label">Registered Users ({activeTradersCount} Active)</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-icon">📊</span>
              <div>
                <div className="admin-stat-value">{formatNumber(adminStats.totalTrades)}</div>
                <div className="admin-stat-label">Total Trades Executed</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-icon">🛒</span>
              <div>
                <div className="admin-stat-value positive">{formatCurrency(adminStats.totalBuyVolume)}</div>
                <div className="admin-stat-label">Total Buy Volume</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-icon">🏷️</span>
              <div>
                <div className="admin-stat-value">{formatCurrency(adminStats.totalSellVolume)}</div>
                <div className="admin-stat-label">Total Sell Volume</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-icon">{Number(adminStats.totalPnL || 0) >= 0 ? '📈' : '📉'}</span>
              <div>
                <div className={`admin-stat-value ${Number(adminStats.totalPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {Number(adminStats.totalPnL || 0) >= 0 ? '+' : ''}{formatCurrency(adminStats.totalPnL)}
                </div>
                <div className="admin-stat-label">Net Platform P&amp;L</div>
              </div>
            </div>

            <div className="admin-stat-card">
              <span className="admin-stat-icon">🪙</span>
              <div>
                <div className="admin-stat-value highlight-gold">{formatCurrency(adminStats.totalFees)}</div>
                <div className="admin-stat-label">Brokerage Fees Collected (0.1%)</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Body */}
        <div className="admin-panel-body">
          {/* User Directory Section */}
          <div className="admin-users-section">
            <div className="admin-section-header-row">
              <div className="admin-section-title-wrap">
                <h3 className="admin-section-title">
                  User Accounts Directory <span className="admin-title-counter">({filteredUsers.length} of {adminUsers.length})</span>
                </h3>
                <span className="admin-subtext">Click &quot;Inspect User&quot; to review complete trade history, open holdings, fees, and alerts for any user.</span>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="admin-controls-toolbar">
                <div className="admin-search-box">
                  <span className="admin-search-icon">🔍</span>
                  <input
                    type="text"
                    placeholder="Search by name, email, or user ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="admin-clear-search" onClick={() => setSearchQuery('')}>✕</button>
                  )}
                </div>

                <div className="admin-filter-pills">
                  <button
                    type="button"
                    className={`admin-filter-pill ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}
                  >
                    All ({adminUsers.length})
                  </button>
                  <button
                    type="button"
                    className={`admin-filter-pill ${filterType === 'active' ? 'active' : ''}`}
                    onClick={() => setFilterType('active')}
                  >
                    Active Traders ({activeTradersCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-filter-pill ${filterType === 'profitable' ? 'active' : ''}`}
                    onClick={() => setFilterType('profitable')}
                  >
                    In Profit ({profitableCount})
                  </button>
                  <button
                    type="button"
                    className={`admin-filter-pill ${filterType === 'positions' ? 'active' : ''}`}
                    onClick={() => setFilterType('positions')}
                  >
                    Open Holdings ({positionsCount})
                  </button>
                </div>

                <div className="admin-sort-wrap">
                  <span className="admin-sort-label">Sort by:</span>
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="trades">Most Trades</option>
                    <option value="volume">Highest Volume</option>
                    <option value="pnl">Top P&amp;L</option>
                    <option value="cash">Highest Cash</option>
                    <option value="newest">Newest First</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            {filteredUsers.length === 0 && !adminLoading && (
              <div className="admin-empty">
                {searchQuery || filterType !== 'all'
                  ? 'No users match your active search or filter criteria.'
                  : 'No registered users found yet. Users will appear here after they sign up.'}
              </div>
            )}

            {adminLoading && adminUsers.length === 0 && (
              <div className="admin-empty">Loading platform users…</div>
            )}

            {filteredUsers.length > 0 && (
              <div className="admin-users-table-wrap">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>User Account</th>
                      <th>Joined</th>
                      <th>Demo Cash</th>
                      <th>Total Trades</th>
                      <th>Buy Volume</th>
                      <th>Sell Volume</th>
                      <th>Net P&amp;L</th>
                      <th>Win Rate</th>
                      <th>Holdings</th>
                      <th>Watchlist</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isSelected = activeUser?.id === u.id;
                      const hasTrades = Number(u.tradeCount || 0) > 0;
                      const isProfitable = Number(u.realizedPnL || 0) >= 0;

                      return (
                        <tr key={u.id} className={isSelected ? 'admin-row-selected' : ''}>
                          <td>
                            <div className="admin-user-cell">
                              <span className="admin-user-avatar">
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <div className="admin-user-name">
                                  {u.name}
                                  {hasTrades && <span className="admin-active-dot" title="Active Trader" />}
                                </div>
                                <div className="admin-user-email">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="admin-td-muted">
                            {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                          </td>
                          <td>
                            <strong className="admin-cash-text">{formatCurrency(u.cashBalance)}</strong>
                          </td>
                          <td>
                            <div className="admin-trade-split">
                              <span className="admin-badge-count" title="Total Executions">{u.tradeCount}</span>
                              <small className="admin-trade-split-sub">
                                <span className="positive">{u.buyCount}B</span> · <span className="admin-td-muted">{u.sellCount}S</span>
                              </small>
                            </div>
                          </td>
                          <td className="positive font-mono">
                            {formatCurrency(u.totalBuyVolume)}
                          </td>
                          <td className="admin-td-muted font-mono">
                            {formatCurrency(u.totalSellVolume)}
                          </td>
                          <td>
                            <span className={`admin-pnl-chip ${isProfitable ? 'positive' : 'negative'}`}>
                              {isProfitable ? '+' : ''}{formatCurrency(u.realizedPnL)}
                            </span>
                          </td>
                          <td>
                            <span className={`admin-winrate-badge ${Number(u.winRate || 0) >= 50 ? 'high' : 'low'}`}>
                              {Number(u.winRate || 0)}%
                            </span>
                          </td>
                          <td className="admin-td-center">
                            {Number(u.openPositions || 0) > 0 ? (
                              <span className="admin-positions-badge" title={`${u.openPositions} active crypto positions`}>
                                {u.openPositions} coins
                              </span>
                            ) : (
                              <span className="admin-td-muted">0</span>
                            )}
                          </td>
                          <td className="admin-td-center">
                            <span className="admin-td-muted">{u.watchlistCount || 0}</span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`admin-detail-btn ${isSelected ? 'active' : ''}`}
                              onClick={() => setAdminSelectedUser(isSelected ? null : u)}
                              title={isSelected ? 'Close User Inspector' : 'Inspect User Trades & Holdings'}
                            >
                              {isSelected ? '✕ Close' : '👁️ Inspect'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Deep-Dive Particular User Inspector Drawer */}
          {activeUser && (
            <div className="admin-user-detail-card" id="admin-user-inspector">
              {/* Header */}
              <div className="admin-detail-header">
                <div className="admin-inspector-avatar-group">
                  <span className="admin-user-avatar large">
                    {(activeUser.name || 'U').charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="admin-inspector-name-row">
                      <h4>{activeUser.name}</h4>
                      <span className="admin-uid-tag">ID: {activeUser.id}</span>
                      <span className="admin-created-tag">
                        Joined: {activeUser.createdAt ? new Date(activeUser.createdAt).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <span className="admin-user-email">{activeUser.email}</span>
                  </div>
                </div>

                <div className="admin-inspector-top-actions">
                  <div className="admin-cash-pill">
                    <span>Demo Cash Balance:</span>
                    <strong>{formatCurrency(activeUser.cashBalance)}</strong>
                  </div>
                  <button
                    type="button"
                    className="admin-logout-btn"
                    onClick={() => setAdminSelectedUser(null)}
                    title="Close Inspector"
                  >
                    ✕ Close Inspector
                  </button>
                </div>
              </div>

              {/* 8 Metric KPI Cards for This User */}
              <div className="admin-detail-stats">
                <div className="admin-detail-stat">
                  <span>Demo Cash</span>
                  <strong className="font-mono">{formatCurrency(activeUser.cashBalance)}</strong>
                  <small>Available to trade</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Buy Volume</span>
                  <strong className="positive font-mono">{formatCurrency(activeUser.totalBuyVolume)}</strong>
                  <small>{activeUser.buyCount} Buy Orders</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Sell Volume</span>
                  <strong className="font-mono">{formatCurrency(activeUser.totalSellVolume)}</strong>
                  <small>{activeUser.sellCount} Sell Orders</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Total Volume</span>
                  <strong className="font-mono">{formatCurrency(activeUser.totalVolume)}</strong>
                  <small>{activeUser.tradeCount} Total Executions</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Realized P&amp;L</span>
                  <strong className={`${Number(activeUser.realizedPnL || 0) >= 0 ? 'positive' : 'negative'} font-mono`}>
                    {Number(activeUser.realizedPnL || 0) >= 0 ? '+' : ''}{formatCurrency(activeUser.realizedPnL)}
                  </strong>
                  <small>Net trading gain/loss</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Win Rate</span>
                  <strong className="highlight-gold">{activeUser.winRate}%</strong>
                  <small>{activeUser.profitableTrades || 0} Wins · {activeUser.lossTrades || 0} Losses</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Fees Paid (0.1%)</span>
                  <strong className="font-mono">{formatCurrency(activeUser.totalFeesPaid)}</strong>
                  <small>Platform broker revenue</small>
                </div>

                <div className="admin-detail-stat">
                  <span>Open Holdings</span>
                  <strong>{activeUser.openPositions || 0} Assets</strong>
                  <small>{activeUser.watchlistCount || 0} Watched · {activeUser.alertCount || 0} Alerts</small>
                </div>
              </div>

              {/* Inspector Tabs */}
              <div className="admin-inspector-tabs">
                <button
                  type="button"
                  className={`admin-inspector-tab ${inspectorTab === 'trades' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('trades')}
                >
                  📜 Complete Trade History ({activeUser.allTrades?.length || activeUser.recentTrades?.length || 0})
                </button>
                <button
                  type="button"
                  className={`admin-inspector-tab ${inspectorTab === 'positions' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('positions')}
                >
                  💼 Open Portfolio Holdings ({activeUser.positions?.length || activeUser.openPositions || 0})
                </button>
                <button
                  type="button"
                  className={`admin-inspector-tab ${inspectorTab === 'watchlist_alerts' ? 'active' : ''}`}
                  onClick={() => setInspectorTab('watchlist_alerts')}
                >
                  ⭐ Watchlist &amp; Alerts ({activeUser.watchlist?.length || 0} / {activeUser.alerts?.length || 0})
                </button>
              </div>

              {/* TAB 1: ALL BUY & SELL TRADES AUDIT */}
              {inspectorTab === 'trades' && (
                <div className="admin-inspector-tab-content">
                  <div className="admin-trade-filter-bar">
                    <div className="admin-trade-side-toggles">
                      <button
                        type="button"
                        className={`admin-side-toggle ${tradeSideFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTradeSideFilter('ALL')}
                      >
                        All Orders ({activeUser.allTrades?.length || activeUser.recentTrades?.length || 0})
                      </button>
                      <button
                        type="button"
                        className={`admin-side-toggle buy ${tradeSideFilter === 'BUY' ? 'active' : ''}`}
                        onClick={() => setTradeSideFilter('BUY')}
                      >
                        Buys Only ({activeUser.buyCount || 0})
                      </button>
                      <button
                        type="button"
                        className={`admin-side-toggle sell ${tradeSideFilter === 'SELL' ? 'active' : ''}`}
                        onClick={() => setTradeSideFilter('SELL')}
                      >
                        Sells Only ({activeUser.sellCount || 0})
                      </button>
                    </div>

                    <div className="admin-trade-search-wrap">
                      <span className="admin-search-icon">🔎</span>
                      <input
                        type="text"
                        placeholder="Filter by coin ticker (e.g. BTC, ETH, SOL)..."
                        value={tradeSearch}
                        onChange={(e) => setTradeSearch(e.target.value)}
                      />
                      {tradeSearch && (
                        <button type="button" className="admin-clear-search" onClick={() => setTradeSearch('')}>✕</button>
                      )}
                    </div>
                  </div>

                  {inspectedTrades.length === 0 ? (
                    <div className="admin-empty-sub">
                      {tradeSearch || tradeSideFilter !== 'ALL'
                        ? 'No trades match the selected side or coin filter.'
                        : 'No trade transactions recorded for this user yet.'}
                    </div>
                  ) : (
                    <div className="admin-users-table-wrap">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Asset / Coin</th>
                            <th>Order Type</th>
                            <th>Executed Price</th>
                            <th>Quantity</th>
                            <th>Total Quote (USD)</th>
                            <th>Fee (0.1%)</th>
                            <th>Realized P&amp;L</th>
                            <th>Date &amp; Time</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inspectedTrades.map((t, index) => {
                            const isBuy = String(t.side || t.orderType || '').toLowerCase().includes('buy');
                            const hasPnl = typeof t.pnl === 'number';
                            const pnlPositive = Number(t.pnl || 0) >= 0;

                            return (
                              <tr key={t.id || t.timestamp || index}>
                                <td>
                                  <div className="admin-coin-cell">
                                    <strong className="admin-coin-symbol">
                                      {(t.symbol || t.coinId || 'COIN').toUpperCase()}
                                    </strong>
                                    <span className="admin-coin-id-sub">{t.coinId || t.symbol}</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`admin-trade-badge ${isBuy ? 'buy' : 'sell'}`}>
                                    {isBuy ? '▲ BUY' : '▼ SELL'}
                                  </span>
                                </td>
                                <td className="font-mono">
                                  ${Number(t.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                </td>
                                <td className="font-mono font-semibold">
                                  {Number(t.amount || 0).toFixed(4)}
                                </td>
                                <td className="font-mono font-bold">
                                  ${Number(t.quote || (t.amount * t.price) || 0).toFixed(2)}
                                </td>
                                <td className="admin-td-muted font-mono">
                                  ${Number(t.fee || 0).toFixed(4)}
                                </td>
                                <td>
                                  {hasPnl && !isBuy ? (
                                    <span className={`admin-pnl-chip ${pnlPositive ? 'positive' : 'negative'}`}>
                                      {pnlPositive ? '+' : ''}${Number(t.pnl).toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="admin-td-muted">—</span>
                                  )}
                                </td>
                                <td className="admin-td-muted">
                                  {t.timestamp ? new Date(t.timestamp).toLocaleString() : '—'}
                                </td>
                                <td>
                                  <span className="admin-status-pill-filled">
                                    {t.status || 'FILLED'}
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
              )}

              {/* TAB 2: CURRENT OPEN PORTFOLIO HOLDINGS */}
              {inspectorTab === 'positions' && (
                <div className="admin-inspector-tab-content">
                  {(!activeUser.positions || activeUser.positions.length === 0) ? (
                    <div className="admin-empty-sub">
                      This user currently has 0 open holdings. Their entire demo equity is held in <strong>Demo Cash ({formatCurrency(activeUser.cashBalance)})</strong>.
                    </div>
                  ) : (
                    <div className="admin-users-table-wrap">
                      <table className="admin-users-table">
                        <thead>
                          <tr>
                            <th>Asset</th>
                            <th>Quantity Held</th>
                            <th>Average Entry Price</th>
                            <th>Total Cost Invested</th>
                            <th>Position Type</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeUser.positions.map((pos, idx) => (
                            <tr key={pos.coinId || idx}>
                              <td>
                                <div className="admin-coin-cell">
                                  <strong className="admin-coin-symbol">
                                    {(pos.symbol || pos.coinId || '').toUpperCase()}
                                  </strong>
                                  <span className="admin-coin-id-sub">{pos.coinId || pos.symbol}</span>
                                </div>
                              </td>
                              <td className="font-mono font-bold">
                                {Number(pos.amount || 0).toFixed(4)}
                              </td>
                              <td className="font-mono">
                                ${Number(pos.avgPrice || pos.buyPrice || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                              </td>
                              <td className="font-mono positive">
                                ${Number(pos.totalInvested || (pos.amount * (pos.avgPrice || 0)) || 0).toFixed(2)}
                              </td>
                              <td>
                                <span className="admin-badge-count">Spot Long</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: WATCHLIST & PRICE ALERTS */}
              {inspectorTab === 'watchlist_alerts' && (
                <div className="admin-inspector-tab-content">
                  <div className="admin-two-col-grid">
                    {/* Watchlist */}
                    <div className="admin-sub-card">
                      <h5 className="admin-sub-card-title">
                        ⭐ Tracked Watchlist Coins ({activeUser.watchlist?.length || 0})
                      </h5>
                      {(!activeUser.watchlist || activeUser.watchlist.length === 0) ? (
                        <div className="admin-empty-sub">User has not added any coins to their watchlist yet.</div>
                      ) : (
                        <div className="admin-watchlist-chips-grid">
                          {activeUser.watchlist.map((coinId) => (
                            <div key={coinId} className="admin-watchlist-chip">
                              <span className="admin-chip-star">★</span>
                              <strong>{String(coinId).toUpperCase()}</strong>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Alerts */}
                    <div className="admin-sub-card">
                      <h5 className="admin-sub-card-title">
                        🔔 Configured Price Alerts ({activeUser.alerts?.length || 0})
                      </h5>
                      {(!activeUser.alerts || activeUser.alerts.length === 0) ? (
                        <div className="admin-empty-sub">User has not set any custom price alerts yet.</div>
                      ) : (
                        <div className="admin-users-table-wrap">
                          <table className="admin-users-table">
                            <thead>
                              <tr>
                                <th>Coin</th>
                                <th>Target Price</th>
                                <th>Condition</th>
                                <th>Created</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeUser.alerts.map((al, idx) => (
                                <tr key={al.id || idx}>
                                  <td><strong>{(al.coinId || '').toUpperCase()}</strong></td>
                                  <td className="font-mono">${Number(al.targetPrice || 0).toLocaleString()}</td>
                                  <td><span className="admin-badge-count">{al.condition || 'Crosses'}</span></td>
                                  <td className="admin-td-muted">{al.createdAt ? new Date(al.createdAt).toLocaleDateString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="admin-panel-footer">
          <span>BitNexa Security &amp; Audit Engine · Admin Session Active</span>
          <span>Database: MongoDB Atlas &amp; In-Memory Sync · {adminUsers.length} Registered Accounts</span>
        </div>
      </div>
    </div>
  );
}
