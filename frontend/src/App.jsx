import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

const DEFAULT_IDS = ['bitcoin', 'ethereum', 'solana', 'bnb', 'xrp', 'dogecoin', 'cardano', 'polygon'];

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value ?? 0);

const formatCompact = (value) =>
  new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(value ?? 0);

const formatPercent = (value) => `${Number(value || 0).toFixed(2)}%`;

function App() {
  const [coins, setCoins] = useState([]);
  const [selectedId, setSelectedId] = useState('bitcoin');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(7);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [watchlist, setWatchlist] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('bitnexa-watchlist') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('bitnexa-watchlist', JSON.stringify(watchlist));
  }, [watchlist]);

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/market?ids=${DEFAULT_IDS.join(',')}`);

        if (!response.ok) {
          throw new Error('Unable to fetch market data.');
        }

        const data = await response.json();
        setCoins(data);

        if (data.length && !data.some((coin) => coin.id === selectedId)) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMarket();
    const interval = setInterval(loadMarket, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadChart = async () => {
      if (!selectedId) return;

      try {
        const response = await fetch(`http://localhost:5000/api/chart/${selectedId}?days=${range}`);
        if (!response.ok) throw new Error('Unable to fetch chart data.');

        const data = await response.json();
        setChartData({
          labels: data.labels,
          datasets: [
            {
              label: `${selectedId.toUpperCase()} Price`,
              data: data.prices,
              borderColor: '#5ec4ff',
              backgroundColor: 'rgba(94, 196, 255, 0.18)',
              borderWidth: 2,
              fill: true,
              tension: 0.35,
            },
          ],
        });
      } catch (err) {
        setError(err.message);
      }
    };

    loadChart();
  }, [selectedId, range]);

  const filteredCoins = useMemo(
    () =>
      coins.filter((coin) =>
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
      ),
    [coins, query]
  );

  const selectedCoin = coins.find((coin) => coin.id === selectedId) || coins[0];
  const watchlistCoins = coins.filter((coin) => watchlist.includes(coin.id));

  const toggleWatchlist = (coinId) => {
    setWatchlist((current) =>
      current.includes(coinId)
        ? current.filter((id) => id !== coinId)
        : [...current, coinId]
    );
  };

  const marketSummary = useMemo(() => {
    if (!coins.length) return null;

    const totalMarketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = coins.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
    const btcDominance = coins.find((coin) => coin.id === 'bitcoin')?.market_cap_percentage || 0;

    return {
      marketCap: totalMarketCap,
      volume: totalVolume,
      btcDominance,
    };
  }, [coins]);

  const topMovers = useMemo(
    () =>
      [...coins]
        .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
        .slice(0, 4),
    [coins]
  );

  const trendingCoins = useMemo(
    () => [...coins].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).slice(0, 3),
    [coins]
  );

  const portfolioHeat = useMemo(() => {
    if (!coins.length) return 0;

    const total = coins.slice(0, 4).reduce((sum, coin) => sum + (coin.current_price || 0), 0);
    return total / 4;
  }, [coins]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand">BITNEXA</span>
          <span className="brand-subtitle">Crypto Market Tracker</span>
        </div>

        <nav className="nav-links">
          <a href="#">Dashboard</a>
          <a href="#">Markets</a>
          <a href="#">Watchlist</a>
          <a href="#">Portfolio</a>
          <a href="#">Alerts</a>
        </nav>

        <label className="search-box" aria-label="Search crypto">
          <span>🔎</span>
          <input
            type="text"
            placeholder="Search cryptocurrency..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </header>

      <section className="hero-banner">
        <div className="hero-copy">
          <p className="hero-tag">Welcome to BitNexa</p>
          <h1>Trade smarter with real-time crypto signals.</h1>
          <p className="hero-text">
            Track market momentum, compare top assets, and keep your watchlist ready for the next move.
          </p>
          <div className="hero-actions">
            <button type="button" className="primary-btn">Explore Markets</button>
            <button type="button" className="ghost-btn">View Portfolio</button>
          </div>
        </div>

        <div className="hero-panel">
          <div className="mini-stat">
            <span>Portfolio Value</span>
            <strong>{formatCompact(portfolioHeat * 40)}</strong>
          </div>
          <div className="mini-stat accent">
            <span>24h Trend</span>
            <strong className="positive">+4.62%</strong>
          </div>
          <div className="mini-stat">
            <span>Top Coin</span>
            <strong>{selectedCoin?.symbol?.toUpperCase() || 'BTC'}</strong>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        <div className="metric-card">
          <span className="metric-label">Total Market Cap</span>
          <strong>{marketSummary ? formatCompact(marketSummary.marketCap) : '--'}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">24h Volume</span>
          <strong>{marketSummary ? formatCompact(marketSummary.volume) : '--'}</strong>
        </div>
        <div className="metric-card">
          <span className="metric-label">BTC Dominance</span>
          <strong>{marketSummary ? formatPercent(marketSummary.btcDominance) : '--'}</strong>
        </div>
        <div className="metric-card accent">
          <span className="metric-label">Market Signal</span>
          <strong>Positive</strong>
        </div>
      </section>

      <section className="movers-grid">
        <div className="panel-card">
          <div className="panel-header">
            <h3>Top Movers</h3>
            <span>24h</span>
          </div>

          <div className="mover-list">
            {topMovers.map((coin) => (
              <div key={coin.id} className="mover-item">
                <div className="coin-meta">
                  <img src={coin.image} alt={coin.name} />
                  <div>
                    <strong>{coin.name}</strong>
                    <span>{coin.symbol.toUpperCase()}</span>
                  </div>
                </div>
                <span className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(coin.price_change_percentage_24h)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-header">
            <h3>Portfolio Pulse</h3>
            <span>Live</span>
          </div>

          <div className="pulse-stack">
            <div className="pulse-row">
              <span>Active Positions</span>
              <strong>12</strong>
            </div>
            <div className="pulse-row">
              <span>Profit / Loss</span>
              <strong className="positive">+$8,240</strong>
            </div>
            <div className="pulse-row">
              <span>Exposure</span>
              <strong>{formatCompact(portfolioHeat * 1000)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="insights-grid">
        <div className="insight-card">
          <span className="insight-label">Market Sentiment</span>
          <strong>Risk-On</strong>
          <small>Momentum remains constructive across large-cap coins.</small>
        </div>
        <div className="insight-card">
          <span className="insight-label">Breakout Watch</span>
          <strong>BTC / ETH</strong>
          <small>Trend strength continues to hold above key support zones.</small>
        </div>
        <div className="insight-card">
          <span className="insight-label">Risk Meter</span>
          <strong>Moderate</strong>
          <small>Volatility is elevated but still within a healthy range.</small>
        </div>
      </section>

      <section className="trending-panel panel-card">
        <div className="panel-header">
          <h3>Trending Now</h3>
          <span>Top caps</span>
        </div>

        <div className="trending-list">
          {trendingCoins.map((coin) => (
            <div key={coin.id} className="trend-item">
              <div className="coin-meta">
                <img src={coin.image} alt={coin.name} />
                <div>
                  <strong>{coin.name}</strong>
                  <span>{coin.symbol.toUpperCase()}</span>
                </div>
              </div>
              <div className="trend-metric">
                <strong>{formatCompact(coin.market_cap)}</strong>
                <span className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(coin.price_change_percentage_24h)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="market-grid">
        <div className="coin-list-panel">
          <div className="panel-header">
            <h3>Market Overview</h3>
            <span>{filteredCoins.length} coins</span>
          </div>

          {loading ? (
            <p className="status-text">Loading market data...</p>
          ) : error ? (
            <p className="status-text error">{error}</p>
          ) : (
            filteredCoins.map((coin) => (
              <button
                key={coin.id}
                type="button"
                className={`coin-card ${selectedCoin?.id === coin.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(coin.id)}
              >
                <div className="coin-meta">
                  <img src={coin.image} alt={coin.name} />
                  <div>
                    <strong>{coin.name}</strong>
                    <span>{coin.symbol.toUpperCase()}</span>
                  </div>
                </div>

                <div className="coin-price">
                  <strong>{formatCurrency(coin.current_price)}</strong>
                  <span className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                    {formatPercent(coin.price_change_percentage_24h)}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="details-panel">
          {selectedCoin ? (
            <>
              <div className="coin-header">
                <div className="coin-meta large">
                  <img src={selectedCoin.image} alt={selectedCoin.name} />
                  <div>
                    <h2>{selectedCoin.name}</h2>
                    <span>{selectedCoin.symbol.toUpperCase()}</span>
                  </div>
                </div>

                <button
                  type="button"
                  className="watch-btn"
                  onClick={() => toggleWatchlist(selectedCoin.id)}
                >
                  {watchlist.includes(selectedCoin.id) ? '★ Saved' : '☆ Add to Watchlist'}
                </button>
              </div>

              <div className="price-row">
                <h3>{formatCurrency(selectedCoin.current_price)}</h3>
                <span className={selectedCoin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                  {formatPercent(selectedCoin.price_change_percentage_24h)}
                </span>
              </div>

              <div className="stats-grid">
                <div>
                  <span>Market Rank</span>
                  <strong>#{selectedCoin.market_cap_rank || '--'}</strong>
                </div>
                <div>
                  <span>Market Cap</span>
                  <strong>{formatCompact(selectedCoin.market_cap)}</strong>
                </div>
                <div>
                  <span>24h Volume</span>
                  <strong>{formatCompact(selectedCoin.total_volume)}</strong>
                </div>
                <div>
                  <span>24h High</span>
                  <strong>{formatCurrency(selectedCoin.high_24h)}</strong>
                </div>
                <div>
                  <span>24h Low</span>
                  <strong>{formatCurrency(selectedCoin.low_24h)}</strong>
                </div>
                <div>
                  <span>Circulating Supply</span>
                  <strong>{formatCompact(selectedCoin.circulating_supply)}</strong>
                </div>
              </div>

              <div className="chart-box">
                <div className="chart-header">
                  <h4>Price History</h4>
                  <div className="range-selector">
                    {[1, 7, 30, 90, 365].map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={range === value ? 'active' : ''}
                        onClick={() => setRange(value)}
                      >
                        {value === 1 ? '1D' : value === 7 ? '7D' : value === 30 ? '30D' : value === 90 ? '90D' : '1Y'}
                      </button>
                    ))}
                  </div>
                </div>

                <Line
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: { mode: 'index', intersect: false },
                    },
                    interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    scales: {
                      x: {
                        ticks: { color: '#9db5d1' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      },
                      y: {
                        ticks: { color: '#9db5d1', callback: (value) => '$' + value.toLocaleString() },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                      },
                    },
                  }}
                />
              </div>
            </>
          ) : (
            <p className="status-text">Select a coin to view details.</p>
          )}
        </div>
      </section>

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

        {watchlistCoins.length ? (
          <div className="watchlist-list">
            {watchlistCoins.map((coin) => (
              <div key={coin.id} className="watchlist-item">
                <div className="coin-meta">
                  <img src={coin.image} alt={coin.name} />
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
          <p className="status-text">Your watchlist is empty. Add your favorite coins to track them here.</p>
        )}
      </section>
    </div>
  );
}

export default App;
