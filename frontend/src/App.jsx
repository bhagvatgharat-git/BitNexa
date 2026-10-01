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
  ArcElement,
} from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import marketApi from './services/marketApi';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler, ArcElement, zoomPlugin);

const normalizeCoinIds = (ids = []) => Array.from(
  new Set(
    (Array.isArray(ids) ? ids : [ids])
      .flatMap((value) => String(value || '').split(','))
      .map((id) => String(id || '').trim())
      .filter(Boolean)
  )
).slice(0, 100);

const TRADING_VIEW_TOP_COINS = normalizeCoinIds([
  'bitcoin', 'ethereum', 'solana', 'binancecoin', 'ripple', 'dogecoin', 'cardano', 'avalanche-2',
  'polygon', 'chainlink', 'tron', 'litecoin', 'near', 'toncoin', 'stellar', 'algorand', 'cosmos',
  'sui', 'aptos', 'optimism', 'arbitrum', 'injective-protocol', 'mantle', 'render-token', 'pepe',
  'dai', 'internet-computer', 'filecoin', 'uniswap', 'monero', 'aave', 'maker', 'tezos', 'theta-token',
  'neo', 'flow', 'eos', 'lido-dao', 'gmx', 'celestia', 'sei-network', 'fetch-ai', 'fantom', 'kaspa',
  'pancakeswap-token', 'rocket-pool', 'the-graph', '1inch', 'jito', 'ethena', 'ondo-finance', 'safe',
  'blast', 'base', 'zksync', 'berachain', 'coredao', 'hyperliquid', 'multiversx'
]);

const TOP_50_IDS = TRADING_VIEW_TOP_COINS;
const DEFAULT_IDS = TRADING_VIEW_TOP_COINS;

const getSafeCoinImage = (coin) => {
  const candidates = [
    coin?.image,
    coin?.large,
    coin?.thumb,
    coin?.small,
    coin?.logo,
    coin?.icon,
  ];

  for (const raw of candidates) {
    if (typeof raw === 'string' && /^https?:\/\//i.test(raw.trim())) {
      return raw.trim();
    }
  }

  const symbol = (coin?.symbol || coin?.name || 'C').toString().trim().slice(0, 3).toUpperCase() || 'C';
  const initial = symbol.charAt(0) || 'C';
  const bg = Number(coin?.price_change_percentage_24h || 0) >= 0 ? '#1dbf73' : '#ff6b6b';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="${bg}"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="20" fill="url(#g)"/>
      <text x="50" y="58" text-anchor="middle" font-size="42" fill="#ffffff" font-family="Arial, sans-serif" font-weight="700">${initial}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

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
  const [showMoreCoins, setShowMoreCoins] = useState(8);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [chartMode, setChartMode] = useState('price');
  const [sortBy, setSortBy] = useState('market_cap');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedNav, setSelectedNav] = useState('Markets');
  const [marketTab, setMarketTab] = useState('overview');
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
  const [tradeHistory, setTradeHistory] = useState([
    { id: 'ord_1', symbol: 'BTC', side: 'buy', amount: 0.18, quote: 12000.35, timestamp: 'just now' },
    { id: 'ord_2', symbol: 'ETH', side: 'sell', amount: 1.4, quote: 4800.2, timestamp: '8 min ago' },
    { id: 'ord_3', symbol: 'SOL', side: 'buy', amount: 22, quote: 3381.88, timestamp: '22 min ago' },
  ]);
  const [watchlist, setWatchlist] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem('bitnexa-watchlist') || '[]');
    } catch {
      return [];
    }
  });
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('bitnexa-token') || '';
  });
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      return JSON.parse(localStorage.getItem('bitnexa-user') || 'null');
    } catch {
      return null;
    }
  });
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({ name: '', email: 'demo@example.com', password: 'Password123!' });
  const [authError, setAuthError] = useState('');
  const [portfolio, setPortfolio] = useState({ positions: [], totalValue: 0 });
  const [alerts, setAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [newAlert, setNewAlert] = useState({ coinId: 'bitcoin', targetPrice: '', direction: 'above' });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bitnexa-watchlist', JSON.stringify(watchlist));
    }
  }, [watchlist]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (token) localStorage.setItem('bitnexa-token', token);
    else localStorage.removeItem('bitnexa-token');
  }, [token]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) localStorage.setItem('bitnexa-user', JSON.stringify(user));
    else localStorage.removeItem('bitnexa-user');
  }, [user]);

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
        const data = await marketApi.getMarket(TOP_50_IDS);
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
        const data = await marketApi.getOverview(TOP_50_IDS);
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

      const chartDays = range === 'max' ? 3650 : Number(range);

      try {
        const data = await marketApi.getChart(selectedId, chartDays);
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
      .slice(0, 12);
  }, [coins, query]);

  const getCoinSegment = (coin) => {
    const coinId = (coin.id || '').toLowerCase();
    const symbol = (coin.symbol || '').toLowerCase();
    const name = (coin.name || '').toLowerCase();

    if (['tether', 'usd-coin', 'binance-usd', 'dai', 'true-usd', 'pax-dollar', 'ethena-usd'].includes(coinId)) {
      return 'stable';
    }

    if (['dogecoin', 'pepe', 'bonk', 'meme', 'dogwifhat', 'floki', 'book-of-meme'].includes(coinId) || ['meme', 'doge', 'pepe', 'bonk'].some((term) => name.includes(term) || symbol.includes(term))) {
      return 'meme';
    }

    if (['bitcoin', 'ethereum', 'solana', 'cardano', 'avalanche-2', 'polkadot', 'near', 'cosmos', 'algorand', 'sui', 'aptos', 'tron', 'flow', 'tezos', 'sei-network', 'mantle', 'arbitrum', 'optimism', 'injective-protocol', 'celestia', 'filecoin', 'internet-computer', 'stacks', 'kaspa'].includes(coinId) || ['bitcoin', 'ethereum', 'solana', 'cardano', 'avalanche', 'polkadot', 'near', 'cosmos', 'algorand', 'flow'].some((term) => name.includes(term) || symbol.includes(term))) {
      return 'layer1';
    }

    if (['uniswap', 'aave', 'maker', 'curve-dao-token', 'pancakeswap-token', 'synthetix-network-token', 'compound-governance-token', '1inch', 'lido-dao', 'yearn-finance', 'rocket-pool', 'convex-finance', 'gmx', 'dydx', 'injective-protocol', 'balancer', 'the-graph'].includes(coinId) || ['uniswap', 'aave', 'maker', 'curve', 'pancakeswap', 'synthetix', 'rocket pool', 'balancer', 'gmx', 'dydx'].some((term) => name.includes(term) || symbol.includes(term))) {
      return 'defi';
    }

    if (['render-token', 'fetch-ai', 'the-graph', 'ai16z', 'internet-computer', 'filecoin', 'oasis', 'bittensor', 'near'].includes(coinId) || ['render', 'ai', 'graph', 'oasis', 'bittensor'].some((term) => name.includes(term) || symbol.includes(term))) {
      return 'ai';
    }

    return 'market';
  };

  const marketSegmentOptions = [
    { key: 'all', label: 'All' },
    { key: 'gainers', label: 'Gainers' },
    { key: 'losers', label: 'Losers' },
    { key: 'layer1', label: 'Layer 1' },
    { key: 'defi', label: 'DeFi' },
    { key: 'stable', label: 'Stablecoins' },
    { key: 'meme', label: 'Meme' },
    { key: 'ai', label: 'AI & Infra' },
    { key: 'watchlist', label: 'Watchlist' },
  ];

  const filteredCoins = useMemo(() => {
    const baseList = coins.filter(
      (coin) =>
        coin.name.toLowerCase().includes(query.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(query.toLowerCase())
    );

    const topList = !query.trim() && quickFilter === 'all' ? baseList.slice(0, 50) : baseList;

    if (quickFilter === 'gainers') {
      return topList.filter((coin) => coin.price_change_percentage_24h >= 0);
    }

    if (quickFilter === 'losers') {
      return topList.filter((coin) => coin.price_change_percentage_24h < 0);
    }

    if (quickFilter === 'watchlist') {
      return topList.filter((coin) => watchlist.includes(coin.id));
    }

    if (['layer1', 'defi', 'stable', 'meme', 'ai'].includes(quickFilter)) {
      return topList.filter((coin) => getCoinSegment(coin) === quickFilter);
    }

    return topList;
  }, [coins, query, quickFilter, watchlist]);

  const marketSegmentSummary = useMemo(() => {
    const segments = ['layer1', 'defi', 'stable', 'meme', 'ai'];

    return segments.map((segment) => {
      const segmentCoins = coins.filter((coin) => getCoinSegment(coin) === segment);
      const averageChange = segmentCoins.length
        ? segmentCoins.reduce((sum, coin) => sum + (Number(coin.price_change_percentage_24h) || 0), 0) / segmentCoins.length
        : 0;

      return {
        key: segment,
        label: segment === 'layer1' ? 'Layer 1' : segment === 'defi' ? 'DeFi' : segment === 'stable' ? 'Stablecoins' : segment === 'meme' ? 'Meme' : 'AI & Infra',
        count: segmentCoins.length,
        averageChange,
      };
    });
  }, [coins]);

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

  const visibleMarketCoins = useMemo(
    () => sortedCoins.slice(0, showMoreCoins),
    [sortedCoins, showMoreCoins]
  );

  const selectedCoin = coins.find((coin) => coin.id === selectedId) || coins[0];
  const tradeCoin = coins.find((coin) => coin.id === tradeCoinId) || selectedCoin || coins[0];
  const watchlistCoins = coins.filter((coin) => watchlist.includes(coin.id));

  const rangeOptions = [
    { value: 1, label: '1D' },
    { value: 7, label: '7D' },
    { value: 30, label: '30D' },
    { value: 90, label: '90D' },
    { value: 365, label: '1Y' },
    { value: 'max', label: 'MAX' },
  ];

  const chartViewOptions = [
    { value: 'price', label: 'Price' },
    { value: 'marketCap', label: 'Market Cap' },
    { value: 'volume', label: 'Trading Volume' },
    { value: 'performance', label: 'Performance' },
    { value: 'allocation', label: 'Portfolio' },
  ];

  const chartSeries = useMemo(() => {
    const labels = chartData.labels || [];
    const series = chartData.datasets?.[0]?.data || [];

    if (!labels.length || !series.length) {
      return {
        price: { labels: [], datasets: [] },
        marketCap: { labels: [], datasets: [] },
        volume: { labels: [], datasets: [] },
        performance: { labels: [], datasets: [] },
      };
    }

    const baseMarketCap = Number(selectedCoin?.market_cap || 0);
    const baseVolume = Number(selectedCoin?.total_volume || 0);

    const marketCapData = series.map((price, index) => {
      const drift = (index / Math.max(series.length - 1, 1)) * 0.18;
      return Number((baseMarketCap * (0.82 + drift)).toFixed(2));
    });

    const volumeData = series.map((price, index) => {
      const drift = 0.7 + (index / Math.max(series.length - 1, 1)) * 0.5;
      return Number((baseVolume * drift).toFixed(2));
    });

    const performanceData = series.map((price, index) => {
      if (index === 0) return 0;
      const previous = series[index - 1] || price;
      return Number((((price - previous) / previous) * 100).toFixed(2));
    });

    return {
      price: {
        labels,
        datasets: [{
          label: `${selectedCoin?.symbol?.toUpperCase() || 'BTC'} price`,
          data: series,
          borderColor: '#5ec4ff',
          backgroundColor: 'rgba(94, 196, 255, 0.18)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
        }],
      },
      marketCap: {
        labels,
        datasets: [{
          label: 'Market Cap',
          data: marketCapData,
          borderColor: '#7c8dff',
          backgroundColor: 'rgba(124, 141, 255, 0.18)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
        }],
      },
      volume: {
        labels,
        datasets: [{
          label: 'Trading Volume',
          data: volumeData,
          borderColor: '#36d399',
          backgroundColor: 'rgba(54, 211, 153, 0.18)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
        }],
      },
      performance: {
        labels,
        datasets: [{
          label: 'Performance %',
          data: performanceData,
          borderColor: '#fbbf24',
          backgroundColor: 'rgba(251, 191, 36, 0.18)',
          borderWidth: 2,
          fill: true,
          tension: 0.35,
        }],
      },
    };
  }, [chartData, selectedCoin]);

  const allocationChartData = useMemo(() => ({
    labels: ['BTC', 'ETH', 'SOL', 'Stable'],
    datasets: [{
      data: [42, 31, 18, 9],
      backgroundColor: ['#5ec4ff', '#7c8dff', '#36d399', '#fbbf24'],
      borderColor: 'rgba(8, 17, 25, 0.88)',
      borderWidth: 2,
    }],
  }), []);

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
    setDetailExpanded(true);
    setShowMoreCoins(8);
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
    if (portfolio.positions.length) {
      const totalValue = portfolio.positions.reduce((sum, position) => {
        const currentPrice = Number(coins.find((coin) => coin.id === position.coinId)?.current_price || position.averagePrice || 0);
        return sum + (Number(position.amount || 0) * currentPrice);
      }, 0) || 1;

      return portfolio.positions.map((position, index) => {
        const currentPrice = Number(coins.find((coin) => coin.id === position.coinId)?.current_price || position.averagePrice || 0);
        const value = Number(position.amount || 0) * currentPrice;
        const weight = totalValue ? (value / totalValue) * 100 : 0;
        const palette = ['var(--primary)', 'var(--primary-strong)', 'var(--success)', 'var(--warning)', 'var(--error)'];

        return {
          label: position.symbol || position.coinId?.toUpperCase(),
          weight: Number(weight.toFixed(1)),
          value: formatCurrency(value),
          color: palette[index % palette.length],
        };
      });
    }

    const weights = [
      { label: 'BTC', weight: 42, value: '$52.7K', color: 'var(--primary)' },
      { label: 'ETH', weight: 31, value: '$39.1K', color: 'var(--primary-strong)' },
      { label: 'SOL', weight: 18, value: '$22.6K', color: 'var(--success)' },
      { label: 'Stable', weight: 9, value: '$11.3K', color: 'var(--warning)' },
    ];

    return weights;
  }, [coins, portfolio]);

  const alertFeed = useMemo(() => {
    if (alerts.length) {
      return alerts.map((alert) => ({
        title: `${alert.coinId?.toUpperCase() || 'Asset'} ${alert.direction === 'above' ? 'above' : 'below'} target`,
        detail: `Trigger at ${formatCurrency(Number(alert.targetPrice || 0))}`,
        tone: alert.direction === 'above' ? 'positive' : 'negative',
      }));
    }

    return [
      { title: 'BTC breakout', detail: 'Above 20-day trend line with rising volume.', tone: 'positive' },
      { title: 'ETH watch', detail: 'Range squeeze building near key resistance.', tone: 'neutral' },
      { title: 'SOL risk', detail: 'Pullback signal needs confirmation before entry.', tone: 'negative' },
    ];
  }, [alerts]);

  const orderBook = useMemo(() => ({
    asks: [
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 1.0018 : 0, size: 1.24, total: 2.11 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 1.0013 : 0, size: 1.86, total: 4.18 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 1.0009 : 0, size: 2.61, total: 7.44 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 1.0005 : 0, size: 3.12, total: 11.2 },
    ],
    bids: [
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 0.9994 : 0, size: 2.36, total: 3.27 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 0.9989 : 0, size: 2.71, total: 6.42 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 0.9982 : 0, size: 3.48, total: 11.19 },
      { price: selectedCoin?.current_price ? selectedCoin.current_price * 0.9978 : 0, size: 4.08, total: 16.94 },
    ],
  }), [selectedCoin]);

  const indicatorRows = useMemo(() => [
    { label: 'RSI', value: '63.4', status: 'Bullish' },
    { label: 'MACD', value: 'Positive crossover', status: 'Strong' },
    { label: 'VWAP', value: 'Above trend', status: 'Confirmed' },
    { label: 'Momentum', value: 'Accelerating', status: 'Hot' },
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

  const handlePlaceOrder = async () => {
    const currentCoin = tradeCoin || selectedCoin;
    const parsedAmount = Number(amount);

    if (!currentCoin) {
      setToast({ id: Date.now(), type: 'error', text: 'No market selected for order placement.' });
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setToast({ id: Date.now(), type: 'error', text: 'Enter a valid order amount greater than zero.' });
      return;
    }

    try {
      const response = await marketApi.placeTrade({
        symbol: currentCoin.id,
        side: orderSide,
        amount: parsedAmount,
        type: orderType,
        price: currentCoin.current_price,
      });

      const order = response?.order || {
        id: `ord_${Date.now()}`,
        symbol: currentCoin.symbol.toUpperCase(),
        side: orderSide,
        amount: parsedAmount,
        quote: orderTotal,
        timestamp: 'just now',
      };

      setTradeHistory((current) => [
        {
          ...order,
          id: order.id || `ord_${Date.now()}`,
          symbol: order.symbol || currentCoin.symbol.toUpperCase(),
          side: order.side || orderSide,
          amount: Number(order.amount || parsedAmount),
          quote: Number(order.quote || orderTotal),
          timestamp: order.timestamp || 'just now',
        },
        ...current,
      ].slice(0, 5));

      if (token && user && currentCoin) {
        try {
          const savedPortfolio = await marketApi.savePortfolio(token, {
            coinId: currentCoin.id,
            symbol: currentCoin.symbol,
            amount: Number(parsedAmount),
            averagePrice: Number(currentCoin.current_price),
            allocation: Number(((currentCoin.market_cap || 0) / Math.max(globalStats.totalMarketCap || 1, 1)) * 100) || 0,
          });
          if (savedPortfolio && savedPortfolio.portfolio) {
            setPortfolio(savedPortfolio.portfolio);
          }

          const savedTransaction = await marketApi.saveTransaction(token, {
            symbol: currentCoin.symbol,
            side: orderSide,
            amount: Number(parsedAmount),
            quote: Number(orderTotal || 0),
            type: orderType,
            price: Number(currentCoin.current_price),
            status: 'filled',
          });

          if (savedTransaction?.transaction) {
            setTransactions((current) => [savedTransaction.transaction, ...current].slice(0, 10));
            setTradeHistory((current) => [{
              id: savedTransaction.transaction.id,
              symbol: savedTransaction.transaction.symbol,
              side: savedTransaction.transaction.side,
              amount: Number(savedTransaction.transaction.amount || parsedAmount),
              quote: Number(savedTransaction.transaction.quote || orderTotal),
              timestamp: new Date(savedTransaction.transaction.timestamp || Date.now()).toLocaleString(),
            }, ...current].slice(0, 5));
          }
        } catch (portfolioError) {
          console.error('Unable to persist portfolio or transaction:', portfolioError);
        }
      }

      setToast({
        id: Date.now(),
        type: orderSide === 'buy' ? 'success' : 'info',
        text: `${orderSide === 'buy' ? 'Buy' : 'Sell'} order filled for ${currentCoin.symbol.toUpperCase()} at ${formatCurrency(currentCoin.current_price)}.`,
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        type: 'error',
        text: error?.message || 'Unable to place trade order right now.',
      });
    }
  };

  useEffect(() => {
    if (!token || !user) return;

    const syncWatchlist = async () => {
      try {
        await marketApi.saveWatchlist(token, watchlist);
      } catch (error) {
        console.error('Unable to sync watchlist:', error);
      }
    };

    syncWatchlist();
  }, [token, user, watchlist]);

  useEffect(() => {
    if (!token || !user) {
      setPortfolio({ positions: [], totalValue: 0 });
      setAlerts([]);
      return;
    }

    const loadUserData = async () => {
      try {
        const [watchlistResponse, portfolioResponse, alertsResponse, transactionsResponse] = await Promise.all([
          marketApi.getWatchlist(token),
          marketApi.getPortfolio(token),
          marketApi.getAlerts(token),
          marketApi.getTransactions(token),
        ]);

        if (Array.isArray(watchlistResponse?.coinIds)) {
          setWatchlist(watchlistResponse.coinIds);
        }

        if (portfolioResponse && typeof portfolioResponse === 'object') {
          setPortfolio({
            positions: Array.isArray(portfolioResponse.positions) ? portfolioResponse.positions : [],
            totalValue: Number(portfolioResponse.totalValue || 0),
          });
        }

        if (Array.isArray(alertsResponse?.alerts)) {
          setAlerts(alertsResponse.alerts);
        }

        if (Array.isArray(transactionsResponse?.transactions)) {
          setTransactions(transactionsResponse.transactions);
          setTradeHistory(transactionsResponse.transactions.map((trade) => ({
            id: trade.id,
            symbol: trade.symbol,
            side: trade.side,
            amount: Number(trade.amount || 0),
            quote: Number(trade.quote || 0),
            timestamp: new Date(trade.timestamp || Date.now()).toLocaleString(),
          })));
        }
      } catch (error) {
        console.error('Unable to load synced user data:', error);
      }
    };

    loadUserData();
  }, [token, user]);

  const toggleWatchlist = (coinId) => {
    setWatchlist((current) =>
      current.includes(coinId)
        ? current.filter((id) => id !== coinId)
        : [...current, coinId]
    );
  };

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthError('');

    try {
      const payload = authMode === 'login'
        ? { email: authForm.email, password: authForm.password }
        : { name: authForm.name, email: authForm.email, password: authForm.password };

      const response = await (authMode === 'login' ? marketApi.login(payload) : marketApi.register(payload));
      const nextUser = response.user || { name: authForm.name || 'BitNexa Trader', email: authForm.email };

      setUser(nextUser);
      setToken(response.token || '');
      setAuthOpen(false);
      setAuthForm({ name: '', email: 'demo@example.com', password: 'Password123!' });
      setToast({ id: Date.now(), type: 'success', text: authMode === 'login' ? 'Welcome back to BitNexa.' : 'Account created successfully.' });
    } catch (error) {
      setAuthError(error?.message || 'Authentication failed.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    setPortfolio({ positions: [], totalValue: 0 });
    setAlerts([]);
    setToast({ id: Date.now(), type: 'info', text: 'You have been logged out.' });
  };

  const handleCreateAlert = async (event) => {
    event.preventDefault();

    if (!token || !user) {
      setToast({ id: Date.now(), type: 'error', text: 'Login to create a custom alert.' });
      return;
    }

    if (!newAlert.coinId || !newAlert.targetPrice) {
      setToast({ id: Date.now(), type: 'error', text: 'Choose a coin and target price first.' });
      return;
    }

    try {
      const response = await marketApi.saveAlert(token, {
        coinId: newAlert.coinId,
        targetPrice: Number(newAlert.targetPrice),
        direction: newAlert.direction,
      });

      if (response?.alert) {
        setAlerts((current) => [response.alert, ...current]);
      }

      setNewAlert({ coinId: selectedCoin?.id || 'bitcoin', targetPrice: '', direction: 'above' });
      setToast({
        id: Date.now(),
        type: 'success',
        text: `Alert created for ${newAlert.coinId.toUpperCase()}.`,
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        type: 'error',
        text: error?.message || 'Unable to create alert.',
      });
    }
  };

  const navItems = ['Dashboard', 'Markets', 'Watchlist', 'Portfolio', 'Alerts'];
  const navTitles = {
    Dashboard: 'Market Overview',
    Markets: 'Live Markets',
    Watchlist: 'Watchlist',
    Portfolio: 'Portfolio Health',
    Alerts: 'Signal Alerts',
  };

  const marketTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'sectors', label: 'Sectors' },
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'portfolio', label: 'Portfolio' },
  ];

  const advancedWidgets = useMemo(() => [
    { label: 'Order Flow', value: '+12.4%', detail: 'Aggressive buys on BTC/ETH', tone: 'positive' },
    { label: 'Funding Rate', value: '0.008%', detail: 'Neutral across majors', tone: 'neutral' },
    { label: 'Liquidity', value: 'High', detail: 'Depth remains healthy', tone: 'positive' },
    { label: 'Volatility', value: 'Moderate', detail: 'Range expansion normal', tone: 'warning' },
  ], []);

  const segmentWidgets = useMemo(() => {
    const palette = ['#5ec4ff', '#7c8dff', '#36d399', '#fbbf24', '#ff6b6b'];

    return marketSegmentSummary.map((segment, index) => ({
      ...segment,
      color: palette[index % palette.length],
      topCoins: coins
        .filter((coin) => getCoinSegment(coin) === segment.key)
        .sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0))
        .slice(0, 4)
        .map((coin) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          change: Number(coin.price_change_percentage_24h || 0),
        })),
    }));
  }, [coins, marketSegmentSummary]);

  const trendingHeatmap = useMemo(
    () =>
      [...coins]
        .sort((a, b) => Math.abs(b.price_change_percentage_24h) - Math.abs(a.price_change_percentage_24h))
        .slice(0, 18)
        .map((coin) => ({
          ...coin,
          intensity: Math.min(Math.abs(Number(coin.price_change_percentage_24h || 0)) * 8, 100),
        })),
    [coins]
  );

  const portfolioCategoryBreakdown = useMemo(() => {
    const total = marketSegmentSummary.reduce((sum, segment) => sum + segment.count, 0) || 1;
    const palette = ['#5ec4ff', '#7c8dff', '#36d399', '#fbbf24', '#ff6b6b'];

    return marketSegmentSummary.map((segment, index) => ({
      ...segment,
      weight: Number(((segment.count / total) * 100).toFixed(1)),
      color: palette[index % palette.length],
    }));
  }, [marketSegmentSummary]);

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
                          <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
              {user ? (
                <>
                  <div className="user-pill">
                    <span className="user-dot" />
                    {user.name ? user.name.split(' ')[0] : 'Trader'}
                  </div>
                  <button type="button" className="ghost-btn" onClick={handleLogout}>Logout</button>
                </>
              ) : (
                <button type="button" className="primary-btn" onClick={() => setAuthOpen(true)}>Login</button>
              )}
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
                        <img src={getSafeCoinImage(coin || selectedCoin)} alt={coin.name || 'coin'} />
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
                        <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
                        <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
                        <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
                          <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
                  <span>{portfolio.positions.length ? 'Live' : 'Demo'}</span>
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
                  <span>{alerts.length ? `${alerts.length} saved` : '3 new'}</span>
                </div>

                <div className="alert-list">
                  {alertFeed.map((alert) => (
                    <div key={`${alert.title}-${alert.detail}`} className={`alert-item ${alert.tone}`}>
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
            <div className="market-tabs" aria-label="Market tabs">
              {marketTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={marketTab === tab.key ? 'active' : ''}
                  onClick={() => setMarketTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {marketTab === 'overview' && (
              <>
                {selectedCoin && detailExpanded && (
                  <section className="panel-card coin-detail-hero">
                    <div className="coin-header detail-header">
                      <div className="coin-meta large">
                        <img src={getSafeCoinImage(selectedCoin)} alt={selectedCoin.name} />
                        <div>
                          <h2>{selectedCoin.name}</h2>
                          <span>{selectedCoin.symbol.toUpperCase()} • {selectedCoin.market_cap_rank ? `#${selectedCoin.market_cap_rank}` : 'Market'}</span>
                        </div>
                      </div>

                      <div className="detail-actions">
                        <button type="button" className="ghost-btn" onClick={() => setDetailExpanded(false)}>
                          Collapse
                        </button>
                        <button type="button" className="primary-btn" onClick={() => setSelectedNav('Watchlist')}>
                          Add to watchlist
                        </button>
                      </div>
                    </div>

                    <div className="price-row detail-price-row">
                      <h3>{formatCurrency(selectedCoin.current_price)}</h3>
                      <span className={selectedCoin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                        {formatPercent(selectedCoin.price_change_percentage_24h)}
                      </span>
                    </div>

                    <div className="detail-metrics">
                      <div><span>Market cap</span><strong>{formatCompact(selectedCoin.market_cap)}</strong></div>
                      <div><span>24h Volume</span><strong>{formatCompact(selectedCoin.total_volume)}</strong></div>
                      <div><span>High / Low</span><strong>{formatCurrency(selectedCoin.high_24h)} / {formatCurrency(selectedCoin.low_24h)}</strong></div>
                      <div><span>Dominance</span><strong>{formatPercent((selectedCoin.market_cap / Math.max(globalStats.totalMarketCap, 1)) * 100)}</strong></div>
                    </div>
                  </section>
                )}

                {!detailExpanded && selectedCoin && (
                  <div className="detail-collapse-row">
                    <button type="button" className="ghost-btn" onClick={() => setDetailExpanded(true)}>
                      Open coin detail page
                    </button>
                  </div>
                )}

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
                        {marketSegmentOptions.map((filter) => (
                          <button
                            key={filter.key}
                            type="button"
                            className={quickFilter === filter.key ? 'active' : ''}
                            onClick={() => setQuickFilter(filter.key)}
                          >
                            {filter.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="market-segment-grid">
                      {marketSegmentSummary.map((segment) => (
                        <button
                          key={segment.key}
                          type="button"
                          className={`market-segment-card ${quickFilter === segment.key ? 'active' : ''}`}
                          onClick={() => setQuickFilter(segment.key)}
                        >
                          <span>{segment.label}</span>
                          <strong>{segment.count}</strong>
                          <small className={segment.averageChange >= 0 ? 'positive' : 'negative'}>
                            {segment.averageChange >= 0 ? '+' : ''}{segment.averageChange.toFixed(2)}%
                          </small>
                        </button>
                      ))}
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
                      <>
                        {visibleMarketCoins.map((coin) => (
                          <button
                            key={coin.id}
                            type="button"
                            className={`coin-card ${selectedCoin?.id === coin.id ? 'selected' : ''}`}
                            onClick={() => setSelectedId(coin.id)}
                          >
                            <div className="coin-meta">
                              <img src={getSafeCoinImage(coin)} alt={coin.name} />
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
                        ))}

                        {sortedCoins.length > visibleMarketCoins.length && (
                          <button type="button" className="show-more-btn" onClick={() => setShowMoreCoins((current) => current + 8)}>
                            Show more
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="details-panel">
                    {selectedCoin ? (
                      <>
                        <div className="coin-header">
                          <div className="coin-meta large">
                            <img src={getSafeCoinImage(selectedCoin)} alt={selectedCoin.name} />
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
                            <div className="chart-heading-wrap">
                              <h4>{chartViewOptions.find((item) => item.value === chartMode)?.label || 'Price'} History</h4>
                              <div className="chart-mode-selector">
                                {chartViewOptions.map((item) => (
                                  <button
                                    key={item.value}
                                    type="button"
                                    className={chartMode === item.value ? 'active' : ''}
                                    onClick={() => setChartMode(item.value)}
                                  >
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="range-selector">
                              {rangeOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  className={range === option.value ? 'active' : ''}
                                  onClick={() => setRange(option.value)}
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {chartMode === 'allocation' ? (
                            <div className="allocation-chart-wrap">
                              <Doughnut
                                data={allocationChartData}
                                options={{
                                  responsive: true,
                                  maintainAspectRatio: false,
                                  cutout: '55%',
                                  plugins: {
                                    legend: {
                                      position: 'bottom',
                                      labels: { color: '#9db5d1', usePointStyle: true, pointStyle: 'circle' },
                                    },
                                    tooltip: { enabled: true },
                                  },
                                }}
                              />
                            </div>
                          ) : (
                            <Line
                              data={chartSeries[chartMode] || chartSeries.price}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: { display: false },
                                  tooltip: { mode: 'index', intersect: false },
                                  zoom: {
                                    pan: { enabled: true, mode: 'x' },
                                    zoom: {
                                      wheel: { enabled: true },
                                      pinch: { enabled: true },
                                      mode: 'x',
                                    },
                                  },
                                },
                                interaction: { mode: 'nearest', axis: 'x', intersect: false },
                                scales: {
                                  x: {
                                    ticks: { color: '#9db5d1' },
                                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                  },
                                  y: {
                                    ticks: { color: '#9db5d1', callback: (value) => {
                                      const label = Number(value);
                                      if (chartMode === 'performance') return `${label.toFixed(2)}%`;
                                      if (chartMode === 'marketCap' || chartMode === 'volume') return `$${Number(label).toLocaleString()}`;
                                      return `$${Number(label).toLocaleString()}`;
                                    } },
                                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                                  },
                                },
                              }}
                            />
                          )}
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

                    <div className="alert-list" style={{ margin: '16px 0' }}>
                      {tradeHistory.map((trade) => (
                        <div key={trade.id} className={`alert-item ${trade.side === 'buy' ? 'positive' : 'negative'}`}>
                          <div className="alert-dot" />
                          <div>
                            <strong>{trade.side.toUpperCase()} {trade.symbol}</strong>
                            <small>{trade.amount} {trade.symbol} • {formatCurrency(trade.quote)} • {trade.timestamp}</small>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className={`place-order ${orderSide}`}
                      onClick={handlePlaceOrder}
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

                <section className="exchange-grid">
                  <div className="panel-card order-book-panel">
                    <div className="panel-header">
                      <h3>Order Book</h3>
                      <span>Live depth</span>
                    </div>

                    <div className="order-book-header">
                      <span>Price</span>
                      <span>Size</span>
                      <span>Total</span>
                    </div>

                    <div className="order-book-columns">
                      <div className="book-column asks-column">
                        {orderBook.asks.map((row, index) => (
                          <div key={`ask-${index}`} className="book-row ask-row">
                            <span>{formatCurrency(row.price)}</span>
                            <span>{row.size.toFixed(2)}</span>
                            <span>{row.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      <div className="spread-box">
                        <small>Spread</small>
                        <strong>{selectedCoin ? formatCurrency(Math.abs((orderBook.bids[0]?.price || 0) - (orderBook.asks[0]?.price || 0))) : '$0.00'}</strong>
                      </div>

                      <div className="book-column bids-column">
                        {orderBook.bids.map((row, index) => (
                          <div key={`bid-${index}`} className="book-row bid-row">
                            <span>{formatCurrency(row.price)}</span>
                            <span>{row.size.toFixed(2)}</span>
                            <span>{row.total.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="panel-card indicator-panel">
                    <div className="panel-header">
                      <h3>Indicators</h3>
                      <span>AI + TA</span>
                    </div>

                    <div className="indicator-list">
                      {indicatorRows.map((item) => (
                        <div key={item.label} className="indicator-row">
                          <div>
                            <span>{item.label}</span>
                            <strong>{item.value}</strong>
                          </div>
                          <span className={item.status === 'Bullish' || item.status === 'Strong' || item.status === 'Confirmed' ? 'positive' : 'neutral'}>{item.status}</span>
                        </div>
                      ))}
                    </div>

                    <div className="feed-panel">
                      <div className="feed-item positive">
                        <span>Trend</span>
                        <strong>Uptrend intact</strong>
                      </div>
                      <div className="feed-item neutral">
                        <span>Volume</span>
                        <strong>Above average</strong>
                      </div>
                      <div className="feed-item warning">
                        <span>Risk</span>
                        <strong>Moderate</strong>
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
                    <>
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
                          {visibleMarketCoins.slice(0, 5).map((coin) => (
                            <tr key={coin.id}>
                              <td>
                                <div className="table-coin">
                                  <img src={getSafeCoinImage(coin)} alt={coin.name} />
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

                      {sortedCoins.length > visibleMarketCoins.length && (
                        <div className="table-actions">
                          <button type="button" className="show-more-btn" onClick={() => setShowMoreCoins((current) => current + 8)}>
                            Show more
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">∎</div>
                      <h4>No rows to display</h4>
                      <p>Adjust your market filter to show available assets.</p>
                    </div>
                  )}
                </section>
              </>
            )}

            {marketTab === 'sectors' && (
              <section className="sector-panel-grid">
                {segmentWidgets.map((segment) => (
                  <div key={segment.key} className="panel-card sector-card">
                    <div className="panel-header">
                      <h3>{segment.label}</h3>
                      <span>{segment.count} assets</span>
                    </div>

                    <div className="sector-metric-row">
                      <strong>{segment.averageChange >= 0 ? '+' : ''}{segment.averageChange.toFixed(2)}%</strong>
                      <span>avg. 24h move</span>
                    </div>

                    <div className="segment-token-list">
                      {segment.topCoins.map((coin) => (
                        <button
                          key={coin.id}
                          type="button"
                          className="segment-token"
                          onClick={() => setSelectedId(coin.id)}
                        >
                          <span>{coin.symbol}</span>
                          <small className={coin.change >= 0 ? 'positive' : 'negative'}>
                            {coin.change >= 0 ? '+' : ''}{coin.change.toFixed(2)}%
                          </small>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}

            {marketTab === 'heatmap' && (
              <section className="panel-card heatmap-panel">
                <div className="panel-header">
                  <h3>Trending Heatmap</h3>
                  <span>Momentum intensity</span>
                </div>

                <div className="heatmap-grid">
                  {trendingHeatmap.map((coin) => (
                    <button
                      key={coin.id}
                      type="button"
                      className="heatmap-cell"
                      style={{
                        background: `linear-gradient(135deg, rgba(94,196,255,0.18), rgba(14,20,30,0.88))`,
                        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.03), 0 0 ${Math.max(coin.intensity, 10)}px rgba(94,196,255,0.12)`,
                        borderColor: coin.price_change_percentage_24h >= 0 ? 'rgba(54,211,153,0.5)' : 'rgba(255,107,107,0.5)',
                      }}
                      onClick={() => setSelectedId(coin.id)}
                    >
                      <span className="heatmap-symbol">{coin.symbol.toUpperCase()}</span>
                      <strong className={coin.price_change_percentage_24h >= 0 ? 'positive' : 'negative'}>
                        {coin.price_change_percentage_24h >= 0 ? '+' : ''}{Number(coin.price_change_percentage_24h || 0).toFixed(2)}%
                      </strong>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {marketTab === 'portfolio' && (
              <>
                <section className="portfolio-breakdown-grid">
                  <div className="panel-card portfolio-block">
                    <div className="panel-header">
                      <h3>Portfolio Category Breakdown</h3>
                      <span>Weighted mix</span>
                    </div>

                    <div className="allocation-list">
                      {portfolioCategoryBreakdown.map((item) => (
                        <div key={item.key} className="allocation-row">
                          <div className="allocation-header">
                            <strong>{item.label}</strong>
                            <span>{item.weight}%</span>
                          </div>
                          <div className="allocation-bar">
                            <span style={{ width: `${item.weight}%`, background: item.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="panel-card portfolio-block">
                    <div className="panel-header">
                      <h3>Exchange Pulse</h3>
                      <span>Live desk</span>
                    </div>

                    <div className="widget-grid">
                      {advancedWidgets.map((widget) => (
                        <div key={widget.label} className={`market-widget ${widget.tone}`}>
                          <span>{widget.label}</span>
                          <strong>{widget.value}</strong>
                          <small>{widget.detail}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="portfolio-insights-grid">
                  <div className="panel-card">
                    <div className="panel-header">
                      <h3>Portfolio Strategy</h3>
                      <span>Alpha view</span>
                    </div>

                    <div className="portfolio-insight-list">
                      {strategyCards.map((card) => (
                        <div key={card.title} className={`insight-pill ${card.tone}`}>
                          <span>{card.tag}</span>
                          <strong>{card.title}</strong>
                          <p>{card.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              </>
            )}
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

          <section className={`portfolio-section ${selectedNav === 'Portfolio' ? 'section-active' : 'section-hidden'}`}>
            <section className="portfolio-grid">
              <div className="panel-card">
                <div className="panel-header">
                  <h3>Portfolio Allocation</h3>
                  <span>{portfolio.positions.length ? 'Live' : 'Demo'}</span>
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
                  <span>{alerts.length ? `${alerts.length} saved` : '3 new'}</span>
                </div>

                <div className="alert-list">
                  {alertFeed.map((alert) => (
                    <div key={`${alert.title}-${alert.detail}`} className={`alert-item ${alert.tone}`}>
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

            <section className="panel-card" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header">
                <h3>Create alert</h3>
                <span>{user ? 'Saved to account' : 'Login required'}</span>
              </div>

              <form className="alert-form" onSubmit={handleCreateAlert}>
                <label className="modal-field">
                  Coin
                  <select value={newAlert.coinId} onChange={(event) => setNewAlert((current) => ({ ...current, coinId: event.target.value }))}>
                    {coins.map((coin) => (
                      <option key={coin.id} value={coin.id}>{coin.symbol.toUpperCase()} - {coin.name}</option>
                    ))}
                  </select>
                </label>

                <label className="modal-field">
                  Target price
                  <input type="number" min="0" step="0.01" value={newAlert.targetPrice} onChange={(event) => setNewAlert((current) => ({ ...current, targetPrice: event.target.value }))} placeholder="3500" />
                </label>

                <label className="modal-field">
                  Direction
                  <select value={newAlert.direction} onChange={(event) => setNewAlert((current) => ({ ...current, direction: event.target.value }))}>
                    <option value="above">Above</option>
                    <option value="below">Below</option>
                  </select>
                </label>

                <button type="submit" className="primary-btn" disabled={!user}>Save alert</button>
              </form>
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

      {authOpen && (
        <div className="modal-backdrop" onClick={() => setAuthOpen(false)}>
          <div className="modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="topbar-kicker">Secure access</p>
                <h3>{authMode === 'login' ? 'Login to BitNexa' : 'Create account'}</h3>
              </div>
              <button type="button" className="close-btn" onClick={() => setAuthOpen(false)}>×</button>
            </div>

            <form className="modal-body" onSubmit={handleAuthSubmit}>
              {authMode === 'register' && (
                <label className="modal-field">
                  Full name
                  <input type="text" value={authForm.name} onChange={(event) => setAuthForm((current) => ({ ...current, name: event.target.value }))} placeholder="Alex Trader" />
                </label>
              )}

              <label className="modal-field">
                Email
                <input type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} placeholder="you@example.com" />
              </label>

              <label className="modal-field">
                Password
                <input type="password" value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} placeholder="••••••••" />
              </label>

              {authError && <div className="error-banner">{authError}</div>}

              <div className="modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setAuthMode((current) => (current === 'login' ? 'register' : 'login'))}>
                  {authMode === 'login' ? 'Create account' : 'Use login'}
                </button>
                <button type="submit" className="primary-btn">{authMode === 'login' ? 'Login' : 'Register'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

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
