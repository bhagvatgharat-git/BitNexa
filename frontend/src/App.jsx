import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import marketApi from './services/marketApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

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
  const [tradeCoinId, setTradeCoinId] = useState('bitcoin');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(7);
  const [sortBy, setSortBy] = useState('market_cap');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedNav, setSelectedNav] = useState('Dashboard');
  const [searchOpen, setSearchOpen] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [] });
  const [candleChartData, setCandleChartData] = useState({ labels: [], datasets: [] });
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderSide, setOrderSide] = useState('buy');
  const [orderType, setOrderType] = useState('market');
  const [amount, setAmount] = useState('0.5');
  const [theme, setTheme] = useState('dark');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trending, setTrending] = useState([]);
  const [toasts, setToasts] = useState([
    { id: 1, type: 'success', text: 'Market feed connected successfully.' },
  ]);
  const [watchlist, setWatchlist] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('bitnexa-watchlist') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitnexa-watchlist', JSON.stringify(watchlist));
    }
  }, [watchlist]);

  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timer = setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 2500);
    return () => clearTimeout(timer);
  }, [toasts]);

  const setToast = (value) => {
    setToasts((current) => [...current, value]);
  };

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setLoading(true);
        const data = await marketApi.getMarket(DEFAULT_IDS);
        setCoins(data);
        setError('');

        if (data.length && !data.some((coin) => coin.id === selectedId)) {
          setSelectedId(data[0].id);
        }
      } catch (err) {
        setError(err.message || 'Unable to fetch market data.');
      } finally {
        setLoading(false);
      }
    };

    const loadOverview = async () => {
      try {
        const data = await marketApi.getOverview(DEFAULT_IDS);
        setOverview(data);
      } catch (err) {
        console.error('Overview fetch error:', err);
      }
    };

    const loadTrending = async () => {
      try {
        const data = await marketApi.getTrending();
        setTrending(data.coins || []);
      } catch (err) {
        console.error('Trending feed error:', err);
      }
    };

    const refreshDashboard = async () => {
      await Promise.all([loadMarket(), loadOverview(), loadTrending()]);
    };

    refreshDashboard();

    if (!autoRefresh) {
      return undefined;
    }

    const interval = setInterval(() => {
      refreshDashboard();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, selectedId]);

  useEffect(() => {
    const loadChart = async () => {
      if (!selectedId) return;

      try {
        const data = await marketApi.getChart(selectedId, range);
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
        setError(err.message || 'Unable to load chart data.');
      }
    };

    const loadCandles = async () => {
      if (!selectedId) return;

      try {
        const data = await marketApi.getOhlc(selectedId, range);
        const candles = data.candles || [];

        setCandleChartData({
          labels: candles.map((item) => item.label),
          datasets: [
            {
              label: 'Candles',
              data: candles.map((item) => item.range),
              backgroundColor: candles.map((item) => (
                item.direction === 'up' ? 'rgba(54, 211, 153, 0.8)' : 'rgba(255, 100, 124, 0.78)'
              )),
              borderRadius: 4,
              borderSkipped: false,
            },
          ],
        });
      } catch (err) {
        setError(err.message || 'Unable to load candle data.');
      }
    };

    loadChart();
    loadCandles();
  }, [selectedId, range]);

  const searchSuggestions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];

    return coins
      .filter(
        (coin) =>
          coin.name.toLowerCase().includes(term) ||
          coin.symbol.toLowerCase().includes(term)
      )
      .slice(0, 6);
  }, [coins, query]);

  const filteredCoins = useMemo(() => {
    const baseList = coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
    );

    if (quickFilter === 'gainers') {
      return baseList.filter((coin) => coin.price_change_percentage_24h >= 0);
    }

    if (quickFilter === 'losers') {
      return baseList.filter((coin) => coin.price_change_percentage_24h < 0);
    }

    if (quickFilter === 'watchlist') {
      return baseList.filter((coin) => watchlist.includes(coin.id));
    }

    return baseList;
  }, [coins, query, quickFilter, watchlist]);

  const sortedCoins = useMemo(() => {
    const list = [...filteredCoins];

    switch (sortBy) {
      case 'price':
        return list.sort((a, b) => b.current_price - a.current_price);
      case 'change':
        return list.sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);
      case 'symbol':
        return list.sort((a, b) => a.symbol.localeCompare(b.symbol));
      case 'market_cap':
      default:
        return list.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    }
  }, [filteredCoins, sortBy]);

  const selectedCoin = coins.find((coin) => coin.id === selectedId) || coins[0];
  const tradeCoin = coins.find((coin) => coin.id === tradeCoinId) || selectedCoin || coins[0];
  const watchlistCoins = coins.filter((coin) => watchlist.includes(coin.id));

  const gainers = useMemo(
    () => [...coins].filter((coin) => coin.price_change_percentage_24h >= 0).sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h).slice(0, 4),
    [coins]
  );

  const losers = useMemo(
    () => [...coins].filter((coin) => coin.price_change_percentage_24h < 0).sort((a, b) => a.price_change_percentage_24h - b.price_change_percentage_24h).slice(0, 4),
    [coins]
  );

  const marketCapLeaders = useMemo(
    () => [...coins].sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0)).slice(0, 5),
    [coins]
  );

  const globalStats = useMemo(() => {
    const totalMarketCap = coins.reduce((sum, coin) => sum + (coin.market_cap || 0), 0);
    const totalVolume = coins.reduce((sum, coin) => sum + (coin.total_volume || 0), 0);
    const avgMove = coins.reduce((sum, coin) => sum + (Number(coin.price_change_percentage_24h) || 0), 0) / (coins.length || 1);

    return {
      totalMarketCap,
      totalVolume,
      avgMove,
      btcDominance: overview?.dominance || coins.find((coin) => coin.id === 'bitcoin')?.market_cap_percentage || 0,
    };
  }, [coins, overview]);

  useEffect(() => {
    if (selectedCoin && selectedCoin.id !== tradeCoinId) {
      setTradeCoinId(selectedCoin.id);
    }
  }, [selectedCoin, tradeCoinId]);
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

  const signal = useMemo(() => {
    if (!selectedCoin) {
      return { label: 'Monitoring', className: 'neutral' };
    }

    if (selectedCoin.price_change_percentage_24h >= 0) {
      return { label: 'Bullish Momentum', className: 'positive' };
    }

    return { label: 'Pullback Watch', className: 'negative' };
  }, [selectedCoin]);

  const portfolioBreakdown = useMemo(() => {
    const weights = [
      { label: 'BTC', weight: 42, value: '$52.7K', color: 'var(--primary)' },
      { label: 'ETH', weight: 31, value: '$39.1K', color: 'var(--primary-strong)' },
      { label: 'SOL', weight: 18, value: '$22.6K', color: 'var(--success)' },
      { label: 'Stable', weight: 9, value: '$11.3K', color: 'var(--warning)' },
    ];

    return weights;
  }, []);

  const alertFeed = useMemo(() => [
    { title: 'BTC breakout', detail: 'Above 20-day trend line with rising volume.', tone: 'positive' },
    { title: 'ETH watch', detail: 'Range squeeze building near key resistance.', tone: 'neutral' },
    { title: 'SOL risk', detail: 'Pullback signal needs confirmation before entry.', tone: 'negative' },
  ], []);

  const quickActions = useMemo(() => [
    { label: 'Rebalance', value: 'Portfolio rebalanced successfully.' },
    { label: 'Set Alert', value: 'Alert created for the selected market.' },
    { label: 'Export', value: 'Trade report exported.' },
  ], []);

  const portfolioPerformance = useMemo(() => ({
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
    datasets: [
      {
        label: 'Portfolio',
        data: [52, 58, 64, 61, 73, 81, 89],
        borderColor: '#5ec4ff',
        backgroundColor: 'rgba(94, 196, 255, 0.18)',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  }), []);

  const strategyCards = useMemo(() => [
    { tag: 'Momentum', title: 'Trend Follow', description: 'Stay long while BTC remains above short-term trend support.', signal: 'Bullish', tone: 'positive' },
    { tag: 'Protection', title: 'Risk Fence', description: 'Scale partial exits when volatility expands beyond the latest band.', signal: 'Balanced', tone: 'neutral' },
    { tag: 'Rebalance', title: 'Portfolio Tilt', description: 'Rotate a portion into ETH and SOL during strong market breadth.', signal: 'Active', tone: 'positive' },
  ], []);

  const marketNews = useMemo(() => [
    { title: 'ETF inflows continue', detail: 'Digital asset flows remain positive as spot demand holds firm.', time: '12 min ago' },
    { title: 'Macro risk softens', detail: 'Treasury yields ease, supporting risk appetite across crypto pairs.', time: '31 min ago' },
    { title: 'Layer-1 rotation', detail: 'Large-cap chains outperform as volume broadens beyond the majors.', time: '1 hr ago' },
  ], []);

  const orderTotal = tradeCoin ? (Number(amount) || 0) * tradeCoin.current_price : 0;

  const toggleWatchlist = (coinId) => {
    setWatchlist((current) =>
      current.includes(coinId)
        ? current.filter((id) => id !== coinId)
        : [...current, coinId]
    );
  };

  const navItems = ['Dashboard', 'Markets', 'Watchlist', 'Portfolio', 'Alerts'];
  const navTitles = {
    Dashboard: 'Market Overview',
    Markets: 'Live Markets',
    Watchlist: 'Watchlist',
    Portfolio: 'Portfolio Health',
    Alerts: 'Signal Alerts',
  };

  return (
    <div className="app-shell">
      <div className="dashboard-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <span className="brand-mark">B</span>
            <div>
              <span className="brand">BITNEXA</span>
              <span className="brand-subtitle">Trading Desk</span>
            </div>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item, index) => (
              <button
                key={item}
                type="button"
                className={`nav-item ${selectedNav === item ? 'active' : ''}`}
                onClick={() => setSelectedNav(item)}
              >
                <span>{index === 0 ? '◈' : index === 1 ? '◎' : index === 2 ? '★' : index === 3 ? '▣' : '⚑'}</span>
                {item}
              </button>
            ))}
          </nav>

          <div className="sidebar-card">
            <span className="eyebrow">Portfolio</span>
            <strong>{formatCompact((selectedCoin?.current_price || 0) * 4200)}</strong>
            <small>Updated 2 min ago</small>
          </div>
        </aside>

        <main className="content-area">
          <header className="topbar">
            <div className="topbar-left">
              <button type="button" className="icon-button" aria-label="Toggle menu">☰</button>
              <div>
                <p className="topbar-kicker">Welcome back</p>
                <h2>{navTitles[selectedNav] || 'Market Overview'}</h2>
              </div>
            </div>

            <div className="topbar-actions">
              <div className="search-wrapper">
                <label className="search-box" aria-label="Search crypto">
                  <span>🔎</span>
                  <input
                    type="text"
                    placeholder="Search cryptocurrency..."
                    value={query}
                    onFocus={() => setSearchOpen(true)}
                    onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSearchOpen(true);
                    }}
                  />
                </label>

                {searchOpen && query.trim() && searchSuggestions.length > 0 && (
                  <div className="search-suggestions">
                    {searchSuggestions.map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        className="search-suggestion"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          setSelectedId(coin.id);
                          setTradeCoinId(coin.id);
                          setQuery('');
                          setSearchOpen(false);
                        }}
                      >
                        <div className="coin-meta">
                          <img src={coin.image} alt={coin.name} />
                          <div>
                            <strong>{coin.name}</strong>
                            <span>{coin.symbol.toUpperCase()}</span>
                          </div>
                        </div>
                        <span className="suggestion-price">{formatCurrency(coin.current_price)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className={`status-pill ${autoRefresh ? 'live' : 'paused'}`}
                onClick={() => setAutoRefresh((current) => !current)}
              >
                <span className="status-indicator" aria-hidden="true" />
                <span>{autoRefresh ? 'Auto-refresh on' : 'Auto-refresh off'}</span>
              </button>
              <button type="button" className="theme-toggle" onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}>
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>
              <button
                type="button"
                className="primary-btn"
                onClick={() => {
                  setSelectedNav('Markets');
                  setToast({
                    id: Date.now(),
                    type: 'success',
                    text: `Quick buy flow ready for ${tradeCoin?.symbol?.toUpperCase() || 'BTC'}.`,
                  });
                }}
              >
                Quick Buy
              </button>
            </div>
          </header>

          {error && (
            <div className="error-banner">
              <strong>Connection issue:</strong> {error}
            </div>
          )}

          <section className={`dashboard-section ${selectedNav === 'Dashboard' ? 'section-active' : 'section-hidden'}`}>
            <section className="hero-banner">
              <div className="hero-copy">
                <p className="hero-tag">Welcome to BitNexa</p>
                <h1>Trade smarter with real-time crypto signals.</h1>
                <p className="hero-text">
                  Track momentum, compare top assets, and place entries and exits with a professional-grade market view.
                </p>
                <div className="hero-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setSelectedNav('Markets');
                      setToast({ id: Date.now(), type: 'success', text: 'Market desk opened.' });
                    }}
                  >
                    Explore Markets
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => {
                    setSelectedNav('Portfolio');
                    setToast({ id: Date.now(), type: 'success', text: 'Portfolio view opened.' });
                  }}>View Portfolio</button>
                </div>

                <div className="quick-action-strip">
                  {quickActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      className="quick-action"
                      onClick={() => setToast({ id: Date.now(), type: 'info', text: action.value })}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hero-panel">
                <div className="mini-stat">
                  <span>Portfolio Value</span>
                  <strong>{formatCompact((selectedCoin?.current_price || 0) * 4200)}</strong>
                </div>
                <div className="mini-stat accent">
                  <span>24h Trend</span>
                  <strong className={selectedCoin && selectedCoin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                    {selectedCoin ? formatPercent(selectedCoin.price_change_percentage_24h) : '+0.00%'}
                  </strong>
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
                <strong>{overview ? formatCompact(overview.marketCap) : '--'}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">24h Volume</span>
                <strong>{overview ? formatCompact(overview.volume) : '--'}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-label">BTC Dominance</span>
                <strong>{overview ? formatPercent(overview.dominance) : '--'}</strong>
              </div>
              <div className="metric-card accent">
                <span className="metric-label">Market Signal</span>
                <strong>{overview ? overview.signal : 'Positive'}</strong>
              </div>
            </section>

            <section className="live-market-grid">
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Trending Coins</h3>
                  <span>Live</span>
                </div>

                <div className="rank-list">
                  {(trending.length ? trending : coins.slice(0, 4)).map((coin, index) => (
                    <div key={coin.id || index} className="mini-rank-item">
                      <div className="coin-meta">
                        <span className="market-rank">#{index + 1}</span>
                        <img src={coin.image || selectedCoin?.image} alt={coin.name || 'coin'} />
                        <div>
                          <strong>{coin.name || coin.symbol?.toUpperCase() || 'BTC'}</strong>
                          <span>{(coin.symbol || '').toUpperCase() || 'BTC'}</span>
                        </div>
                      </div>
                      <span className={coin.percent_change_24h >= 0 || coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(coin.percent_change_24h ?? coin.price_change_percentage_24h ?? 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Top Gainers</h3>
                  <span>24h</span>
                </div>

                <div className="rank-list">
                  {gainers.map((coin) => (
                    <div key={coin.id} className="mini-rank-item">
                      <div className="coin-meta">
                        <img src={coin.image} alt={coin.name} />
                        <div>
                          <strong>{coin.name}</strong>
                          <span>{coin.symbol.toUpperCase()}</span>
                        </div>
                      </div>
                      <span className="positive">{formatPercent(coin.price_change_percentage_24h)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Top Losers</h3>
                  <span>24h</span>
                </div>

                <div className="rank-list">
                  {losers.map((coin) => (
                    <div key={coin.id} className="mini-rank-item">
                      <div className="coin-meta">
                        <img src={coin.image} alt={coin.name} />
                        <div>
                          <strong>{coin.name}</strong>
                          <span>{coin.symbol.toUpperCase()}</span>
                        </div>
                      </div>
                      <span className="negative">{formatPercent(coin.price_change_percentage_24h)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Market Cap Ranking</h3>
                  <span>Top 5</span>
                </div>

                <div className="rank-list">
                  {marketCapLeaders.map((coin, index) => (
                    <div key={coin.id} className="mini-rank-item">
                      <div className="coin-meta">
                        <span className="market-rank">#{index + 1}</span>
                        <img src={coin.image} alt={coin.name} />
                        <div>
                          <strong>{coin.name}</strong>
                          <span>{coin.symbol.toUpperCase()}</span>
                        </div>
                      </div>
                      <strong>{formatCompact(coin.market_cap)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="movers-grid">
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Top Movers</h3>
                  <span>24h</span>
                </div>

                {loading ? (
                  <div className="skeleton-stack">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="skeleton-row" />
                    ))}
                  </div>
                ) : (
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
                )}
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Market Pulse</h3>
                  <span>Live</span>
                </div>

                <div className="pulse-stack">
                  <div className="pulse-row">
                    <span>Sentiment</span>
                    <strong>{overview ? overview.sentiment : 'Risk-On'}</strong>
                  </div>
                  <div className="pulse-row">
                    <span>Fear & Greed</span>
                    <strong>{overview ? `${overview.fearGreed}/100` : '68/100'}</strong>
                  </div>
                  <div className="pulse-row">
                    <span>Signal</span>
                    <strong className={signal.className}>{signal.label}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="insights-grid">
              <div className="insight-card">
                <span className="insight-label">Market Sentiment</span>
                <strong>{overview ? overview.sentiment : 'Risk-On'}</strong>
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

            <section className="portfolio-grid">
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Portfolio Allocation</h3>
                  <span>Live</span>
                </div>

                <div className="allocation-list">
                  {portfolioBreakdown.map((item) => (
                    <div key={item.label} className="allocation-row">
                      <div className="allocation-header">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                      <div className="allocation-bar">
                        <span style={{ width: `${item.weight}%`, background: item.color }} />
                      </div>
                      <small>{item.weight}% allocation</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Signal Alerts</h3>
                  <span>3 new</span>
                </div>

                <div className="alert-list">
                  {alertFeed.map((alert) => (
                    <div key={alert.title} className={`alert-item ${alert.tone}`}>
                      <div className="alert-dot" />
                      <div>
                        <strong>{alert.title}</strong>
                        <small>{alert.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="terminal-grid">
              <div className="panel-card performance-panel">
                <div className="panel-header">
                  <h3>Portfolio Performance</h3>
                  <span>YTD</span>
                </div>

                <div className="mini-chart">
                  <Line
                    data={portfolioPerformance}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                      scales: {
                        x: { display: false },
                        y: { display: false },
                      },
                      interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    }}
                  />
                </div>
              </div>

              <div className="panel-card risk-panel">
                <div className="panel-header">
                  <h3>Risk Meter</h3>
                  <span>Balanced</span>
                </div>

                <div className="risk-layout">
                  <div className="risk-ring">
                    <span>62%</span>
                  </div>

                  <div className="risk-breakdown">
                    <div>
                      <span>Volatility</span>
                      <strong>Moderate</strong>
                    </div>
                    <div>
                      <span>Drawdown</span>
                      <strong>8.4%</strong>
                    </div>
                    <div>
                      <span>Sharpe</span>
                      <strong>1.72</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="strategy-grid">
              {strategyCards.map((card) => (
                <div key={card.title} className={`panel-card strategy-card ${card.tone}`}>
                  <span className="eyebrow strategy-tag">{card.tag}</span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <div className="strategy-footer">
                    <span>{card.signal}</span>
                    <button type="button" className="tiny-btn">Apply</button>
                  </div>
                </div>
              ))}
            </section>

            <section className="news-panel panel-card">
              <div className="panel-header">
                <h3>Market Brief</h3>
                <span>Updated</span>
              </div>

              <div className="news-list">
                {marketNews.map((item) => (
                  <div key={item.title} className="news-item">
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span>{item.time}</span>
                  </div>
                ))}
              </div>
            </section>
          </section>

          <section className={`markets-section ${selectedNav === 'Markets' ? 'section-active' : 'section-hidden'}`}>
            <section className="market-grid">
              <div className="coin-list-panel">
                <div className="panel-header">
                  <div>
                    <h3>Market Overview</h3>
                    <span>{sortedCoins.length} coins</span>
                  </div>

                  <div className="sort-wrap">
                    <label htmlFor="sortSelect">Sort</label>
                    <select id="sortSelect" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                      <option value="market_cap">Market Cap</option>
                      <option value="price">Price</option>
                      <option value="change">24h Change</option>
                      <option value="symbol">Symbol</option>
                    </select>
                  </div>

                  <div className="mini-toggle-group" aria-label="Market filter shortcuts">
                    {['all', 'gainers', 'losers', 'watchlist'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={quickFilter === filter ? 'active' : ''}
                        onClick={() => setQuickFilter(filter)}
                      >
                        {filter === 'all' ? 'All' : filter === 'gainers' ? 'Gainers' : filter === 'losers' ? 'Losers' : 'Watchlist'}
                      </button>
                    ))}
                  </div>
                </div>

                {loading ? (
                  <div className="skeleton-stack">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="skeleton-card" />
                    ))}
                  </div>
                ) : error ? (
                  <div className="empty-state error-state">
                    <div className="empty-icon">!</div>
                    <h4>Unable to load market data</h4>
                    <p>{error}</p>
                  </div>
                ) : sortedCoins.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">⌕</div>
                    <h4>No crypto found</h4>
                    <p>Try a different search term or reset the filter.</p>
                  </div>
                ) : (
                  sortedCoins.map((coin) => (
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
                  <div className="empty-state">
                    <div className="empty-icon">◎</div>
                    <h4>Select a coin</h4>
                    <p>Choose a market to view detailed stats and price history.</p>
                  </div>
                )}
              </div>
            </section>

            <section className="trading-grid">
              <div className="panel-card order-panel">
                <div className="panel-header">
                  <h3>Trade Ticket</h3>
                  <span>{selectedCoin?.symbol?.toUpperCase() || 'BTC'}</span>
                </div>

                <div className="segmented-control">
                  <button type="button" className={orderSide === 'buy' ? 'active' : ''} onClick={() => setOrderSide('buy')}>
                    Buy
                  </button>
                  <button type="button" className={orderSide === 'sell' ? 'active' : ''} onClick={() => setOrderSide('sell')}>
                    Sell
                  </button>
                </div>

                <div className="ticket-form">
                  <label>
                    Order type
                    <select value={orderType} onChange={(event) => setOrderType(event.target.value)}>
                      <option value="market">Market</option>
                      <option value="limit">Limit</option>
                      <option value="stop">Stop</option>
                    </select>
                  </label>

                  <label>
                    Amount
                    <div className="amount-row">
                      <input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
                      <span>{selectedCoin?.symbol?.toUpperCase() || 'BTC'}</span>
                    </div>
                  </label>
                </div>

                <div className="order-summary">
                  <div>
                    <span>Market price</span>
                    <strong>{selectedCoin ? formatCurrency(selectedCoin.current_price) : '--'}</strong>
                  </div>
                  <div>
                    <span>Est. total</span>
                    <strong>{selectedCoin ? formatCurrency(orderTotal) : '--'}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={`place-order ${orderSide}`}
                  onClick={() => {
                    setSelectedNav('Markets');
                    setToast({
                      id: Date.now(),
                      type: orderSide === 'buy' ? 'success' : 'info',
                      text: `${orderSide === 'buy' ? 'Buy' : 'Sell'} order queued for ${selectedCoin?.symbol?.toUpperCase() || 'BTC'}.`,
                    });
                  }}
                >
                  {orderSide === 'buy' ? 'Buy' : 'Sell'} {selectedCoin?.symbol?.toUpperCase() || 'BTC'}
                </button>
              </div>

              <div className="panel-card candle-panel">
                <div className="panel-header">
                  <h3>Candlestick Pattern</h3>
                  <span>{range === 1 ? '1D' : `${range}D`}</span>
                </div>

                <div className="candle-chart-wrap">
                  <Bar
                    data={candleChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                      scales: {
                        x: { display: false },
                        y: { display: false },
                      },
                      borderSkipped: false,
                    }}
                  />
                </div>

                <div className="pattern-list">
                  <div className="pattern-item positive">
                    <span>Trend</span>
                    <strong>{selectedCoin && selectedCoin.price_change_percentage_24h >= 0 ? 'Bullish' : 'Cooling'}</strong>
                  </div>
                  <div className="pattern-item neutral">
                    <span>Setup</span>
                    <strong>{selectedCoin ? (selectedCoin.price_change_percentage_24h >= 0 ? 'Breakout retest' : 'Support test') : 'Watching'}</strong>
                  </div>
                  <div className="pattern-item neutral">
                    <span>Volume</span>
                    <strong>{selectedCoin ? formatCompact(selectedCoin.total_volume) : '--'}</strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="panel-card table-panel">
              <div className="panel-header">
                <h3>Market Table</h3>
                <span>Top assets</span>
              </div>

              {sortedCoins.length ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Asset</th>
                      <th>Price</th>
                      <th>Market Cap</th>
                      <th>24h</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCoins.slice(0, 5).map((coin) => (
                      <tr key={coin.id}>
                        <td>
                          <div className="table-coin">
                            <img src={coin.image} alt={coin.name} />
                            <div>
                              <strong>{coin.name}</strong>
                              <span>{coin.symbol.toUpperCase()}</span>
                            </div>
                          </div>
                        </td>
                        <td>{formatCurrency(coin.current_price)}</td>
                        <td>{formatCompact(coin.market_cap)}</td>
                        <td className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                          {formatPercent(coin.price_change_percentage_24h)}
                        </td>
                        <td><button className="link-btn" type="button" onClick={() => setSelectedId(coin.id)}>View</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">∎</div>
                  <h4>No rows to display</h4>
                  <p>Adjust your market filter to show available assets.</p>
                </div>
              )}
            </section>
          </section>

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
                <div className="empty-state">
                  <div className="empty-icon">☆</div>
                  <h4>Your watchlist is empty</h4>
                  <p>Add your favorite coins to track them here.</p>
                </div>
              )}
            </section>
          </section>

          <section className={`portfolio-section ${selectedNav === 'Portfolio' ? 'section-active' : 'section-hidden'}`}>
            <section className="portfolio-grid">
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Portfolio Allocation</h3>
                  <span>Live</span>
                </div>

                <div className="allocation-list">
                  {portfolioBreakdown.map((item) => (
                    <div key={item.label} className="allocation-row">
                      <div className="allocation-header">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                      <div className="allocation-bar">
                        <span style={{ width: `${item.weight}%`, background: item.color }} />
                      </div>
                      <small>{item.weight}% allocation</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel-card">
                <div className="panel-header">
                  <h3>Signal Alerts</h3>
                  <span>3 new</span>
                </div>

                <div className="alert-list">
                  {alertFeed.map((alert) => (
                    <div key={alert.title} className={`alert-item ${alert.tone}`}>
                      <div className="alert-dot" />
                      <div>
                        <strong>{alert.title}</strong>
                        <small>{alert.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="terminal-grid">
              <div className="panel-card performance-panel">
                <div className="panel-header">
                  <h3>Portfolio Performance</h3>
                  <span>YTD</span>
                </div>

                <div className="mini-chart">
                  <Line
                    data={portfolioPerformance}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { enabled: true } },
                      scales: {
                        x: { display: false },
                        y: { display: false },
                      },
                      interaction: { mode: 'nearest', axis: 'x', intersect: false },
                    }}
                  />
                </div>
              </div>

              <div className="panel-card risk-panel">
                <div className="panel-header">
                  <h3>Risk Meter</h3>
                  <span>Balanced</span>
                </div>

                <div className="risk-layout">
                  <div className="risk-ring">
                    <span>62%</span>
                  </div>

                  <div className="risk-breakdown">
                    <div>
                      <span>Volatility</span>
                      <strong>Moderate</strong>
                    </div>
                    <div>
                      <span>Drawdown</span>
                      <strong>8.4%</strong>
                    </div>
                    <div>
                      <span>Sharpe</span>
                      <strong>1.72</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="strategy-grid">
              {strategyCards.map((card) => (
                <div key={card.title} className={`panel-card strategy-card ${card.tone}`}>
                  <span className="eyebrow strategy-tag">{card.tag}</span>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <div className="strategy-footer">
                    <span>{card.signal}</span>
                    <button type="button" className="tiny-btn">Apply</button>
                  </div>
                </div>
              ))}
            </section>
          </section>

        </main>
      </div>

      <div className="toast-stack">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.text}
          </div>
        ))}
      </div>

    </div>
  );
}

export default App;
