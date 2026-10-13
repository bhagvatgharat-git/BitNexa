export default function WatchlistSection({
  selectedNav,
  watchlistCoins = [],
  setWatchlist,
  user,
  setAuthOpen,
  getSafeCoinImage,
  formatCurrency,
  formatPercent,
}) {
  return (
    <section className={`watchlist-section ${selectedNav === 'Watchlist' ? 'section-active' : 'section-hidden'}`}>
      <section className="watchlist-panel">
        <div className="panel-header">
          <h3>My Watchlist</h3>
          <div className="watchlist-actions">
            <span>{watchlistCoins.length} saved</span>
            {watchlistCoins.length > 0 && (
              <button type="button" className="clear-btn" onClick={() => setWatchlist([])}>
                Clear all
              </button>
            )}
          </div>
        </div>

        {!user && !watchlistCoins.length ? (
          <div className="empty-state">
            <div className="empty-icon">★</div>
            <h4>Sign in to save your watchlist</h4>
            <p>Login and sync your favorite coins across devices.</p>
            <button type="button" className="primary-btn" onClick={() => setAuthOpen(true)}>Login now</button>
          </div>
        ) : watchlistCoins.length ? (
          <div className="watchlist-list">
            {watchlistCoins.map((coin) => (
              <div key={coin.id} className="watchlist-item">
                <div className="coin-meta">
                  <img src={getSafeCoinImage(coin)} alt={coin.name} />
                  <div>
                    <strong>{coin.name}</strong>
                    <span>{coin.symbol.toUpperCase()}</span>
                  </div>
                </div>
                <div className="watch-price-group">
                  <strong>{formatCurrency(coin.current_price)}</strong>
                  <span className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                    {formatPercent(coin.price_change_percentage_24h)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">☆</div>
            <h4>Your watchlist is empty</h4>
            <p>Add your favorite coins to track them here.</p>
          </div>
        )}
      </section>
    </section>
  );
}
