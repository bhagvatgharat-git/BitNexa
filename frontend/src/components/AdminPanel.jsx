export default function AdminPanel({
  adminStats,
  adminUsers,
  adminLoading,
  adminSelectedUser,
  setAdminSelectedUser,
  handleAdminRefresh,
  handleAdminLogout,
}) {
  return (
    <div className="admin-panel-overlay">
      <div className="admin-panel">
        <div className="admin-panel-header">
          <div className="admin-panel-title">
            <span className="admin-badge">⚙️ ADMIN</span>
            <h2>BitNexa Control Center</h2>
            <span className="admin-subtitle">Platform Overview · Real-time Data</span>
          </div>
          <div className="admin-panel-actions">
            <button type="button" className="admin-refresh-btn" onClick={handleAdminRefresh} disabled={adminLoading}>
              {adminLoading ? '⟳ Loading…' : '⟳ Refresh'}
            </button>
            <button type="button" className="admin-logout-btn" onClick={handleAdminLogout}>✕ Exit</button>
          </div>
        </div>

        {adminStats && (
          <div className="admin-stats-grid">
            <div className="admin-stat-card">
              <span className="admin-stat-icon">👥</span>
              <div>
                <div className="admin-stat-value">{adminStats.totalUsers}</div>
                <div className="admin-stat-label">Registered Users</div>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-icon">📊</span>
              <div>
                <div className="admin-stat-value">{adminStats.totalTrades}</div>
                <div className="admin-stat-label">Total Trades</div>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-icon">💰</span>
              <div>
                <div className="admin-stat-value">${Number(adminStats.totalVolume || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                <div className="admin-stat-label">Total Volume (USD)</div>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="admin-stat-icon">{Number(adminStats.totalPnL || 0) >= 0 ? '📈' : '📉'}</span>
              <div>
                <div className={`admin-stat-value ${Number(adminStats.totalPnL || 0) >= 0 ? 'positive' : 'negative'}`}>
                  {Number(adminStats.totalPnL || 0) >= 0 ? '+' : ''}${Number(adminStats.totalPnL || 0).toFixed(2)}
                </div>
                <div className="admin-stat-label">Platform P&amp;L</div>
              </div>
            </div>
          </div>
        )}

        <div className="admin-panel-body">
          <div className="admin-users-section">
            <h3 className="admin-section-title">Registered Users ({adminUsers.length})</h3>
            {adminUsers.length === 0 && !adminLoading && (
              <div className="admin-empty">No registered users yet. Users will appear here after they sign up.</div>
            )}
            {adminLoading && adminUsers.length === 0 && (
              <div className="admin-empty">Loading users…</div>
            )}
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Joined</th>
                    <th>Trades</th>
                    <th>Buy Vol</th>
                    <th>Sell Vol</th>
                    <th>P&amp;L</th>
                    <th>Positions</th>
                    <th>Watchlist</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {adminUsers.map((u) => (
                    <tr key={u.id} className={adminSelectedUser?.id === u.id ? 'admin-row-selected' : ''}>
                      <td>
                        <div className="admin-user-cell">
                          <span className="admin-user-avatar">{(u.name || 'U').charAt(0).toUpperCase()}</span>
                          <div>
                            <div className="admin-user-name">{u.name}</div>
                            <div className="admin-user-email">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="admin-td-muted">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</td>
                      <td className="admin-td-center">
                        <span className="admin-badge-count">{u.tradeCount}</span>
                      </td>
                      <td className="positive">${Number(u.totalBuyVolume || 0).toFixed(2)}</td>
                      <td className="admin-td-muted">${Number(u.totalSellVolume || 0).toFixed(2)}</td>
                      <td className={Number(u.realizedPnL || 0) >= 0 ? 'positive' : 'negative'}>
                        {Number(u.realizedPnL || 0) >= 0 ? '+' : ''}${Number(u.realizedPnL || 0).toFixed(2)}
                      </td>
                      <td className="admin-td-center">{u.openPositions}</td>
                      <td className="admin-td-center">{u.watchlistCount}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-detail-btn"
                          onClick={() => setAdminSelectedUser(adminSelectedUser?.id === u.id ? null : u)}
                        >
                          {adminSelectedUser?.id === u.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {adminSelectedUser && (
            <div className="admin-user-detail">
              <div className="admin-detail-header">
                <span className="admin-user-avatar large">{(adminSelectedUser.name || 'U').charAt(0).toUpperCase()}</span>
                <div>
                  <h4>{adminSelectedUser.name}</h4>
                  <span className="admin-user-email">{adminSelectedUser.email}</span>
                </div>
                <button type="button" className="admin-logout-btn" style={{ marginLeft: 'auto' }} onClick={() => setAdminSelectedUser(null)}>✕ Close</button>
              </div>
              <div className="admin-detail-stats">
                <div className="admin-detail-stat"><span>Total Trades</span><strong>{adminSelectedUser.tradeCount}</strong></div>
                <div className="admin-detail-stat"><span>Buys</span><strong className="positive">{adminSelectedUser.buyCount}</strong></div>
                <div className="admin-detail-stat"><span>Sells</span><strong>{adminSelectedUser.sellCount}</strong></div>
                <div className="admin-detail-stat"><span>Buy Volume</span><strong className="positive">${Number(adminSelectedUser.totalBuyVolume).toFixed(2)}</strong></div>
                <div className="admin-detail-stat"><span>Sell Volume</span><strong>${Number(adminSelectedUser.totalSellVolume).toFixed(2)}</strong></div>
                <div className="admin-detail-stat"><span>Realized P&amp;L</span><strong className={Number(adminSelectedUser.realizedPnL) >= 0 ? 'positive' : 'negative'}>{Number(adminSelectedUser.realizedPnL) >= 0 ? '+' : ''}${Number(adminSelectedUser.realizedPnL).toFixed(2)}</strong></div>
                <div className="admin-detail-stat"><span>Open Positions</span><strong>{adminSelectedUser.openPositions}</strong></div>
                <div className="admin-detail-stat"><span>Watchlist Coins</span><strong>{adminSelectedUser.watchlistCount}</strong></div>
                <div className="admin-detail-stat"><span>Alerts Set</span><strong>{adminSelectedUser.alertCount}</strong></div>
              </div>
              {adminSelectedUser.recentTrades && adminSelectedUser.recentTrades.length > 0 && (
                <div className="admin-recent-trades">
                  <h5>Recent Trades</h5>
                  <table className="admin-users-table">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminSelectedUser.recentTrades.slice(0, 5).map((t) => (
                        <tr key={t.id || t.timestamp}>
                          <td><strong>{(t.symbol || t.coinId || '').toUpperCase()}</strong></td>
                          <td>
                            <span className={`admin-trade-side ${(t.side || t.orderType || '').toLowerCase().includes('buy') ? 'buy' : 'sell'}`}>
                              {(t.side || t.orderType || 'TRADE').toUpperCase()}
                            </span>
                          </td>
                          <td>{Number(t.amount || 0).toFixed(4)}</td>
                          <td>${Number(t.price || 0).toLocaleString()}</td>
                          <td>${Number(t.quote || (t.amount * t.price) || 0).toFixed(2)}</td>
                          <td className="admin-td-muted">{t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
