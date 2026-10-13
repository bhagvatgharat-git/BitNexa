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
import { Line, Doughnut } from 'react-chartjs-2';
import marketApi from './services/marketApi';
import PriceChart from './components/PriceChart';
import AllocationPanel from './components/AllocationPanel';
import PerformanceRiskGrid from './components/PerformanceRiskGrid';
import StrategyGrid from './components/StrategyGrid';
import AuthModal from './components/AuthModal';
import AdminModal from './components/AdminModal';
import AdminPanel from './components/AdminPanel';
import WatchlistSection from './components/WatchlistSection';
import TradeHistorySection from './components/TradeHistorySection';
import { closePaperPosition, createDemoWallet, DEMO_WALLET_STORAGE_KEY, executePaperTrade, STARTING_DEMO_CASH } from './services/paperTrading';

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

const getSafeCoinImage = (coin) => {
  const img = [coin?.image, coin?.large, coin?.thumb, coin?.small, coin?.logo, coin?.icon].find((s) => typeof s === 'string' && /^https?:\/\//i.test(s.trim()));
  if (img) return img.trim();
  const symbol = (coin?.symbol || coin?.name || 'C').toString().trim().slice(0, 3).toUpperCase() || 'C';
  const bg = Number(coin?.price_change_percentage_24h || 0) >= 0 ? '#1dbf73' : '#ff6b6b';
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="#0f172a"/></linearGradient></defs><rect width="100" height="100" rx="20" fill="url(#g)"/><text x="50" y="58" text-anchor="middle" font-size="42" fill="#ffffff" font-family="Arial,sans-serif" font-weight="700">${symbol.charAt(0) || 'C'}</text></svg>`)}`;
};

const formatCompact = (val) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(val ?? 0);
const formatPercent = (val) => `${Number(val || 0).toFixed(2)}%`;

const DISPLAY_CURRENCIES = [
  { code: 'usd', label: 'USD' },
  { code: 'eur', label: 'EUR' },
  { code: 'gbp', label: 'GBP' },
  { code: 'inr', label: 'INR' },
  { code: 'jpy', label: 'JPY' },
  { code: 'cad', label: 'CAD' },
  { code: 'aud', label: 'AUD' },
];
const INTRADAY_INTERVALS = ['15s', '20s', '1m', '2m', '3m', '5m'];

function App() {
  const [coins, setCoins] = useState([]);
  const [selectedId, setSelectedId] = useState('bitcoin');
  const [tradeCoinId, setTradeCoinId] = useState('bitcoin');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState(7);
  const [showMoreCoins, setShowMoreCoins] = useState(8);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [chartMode, setChartMode] = useState('price');
  const [chartStyle, setChartStyle] = useState('line');
  const [coinWorkspaceFullscreen, setCoinWorkspaceFullscreen] = useState(false);
  const [sortBy, setSortBy] = useState('market_cap');
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedNav, setSelectedNav] = useState('Dashboard');
  const [lastNonMarketNav, setLastNonMarketNav] = useState('Dashboard');
  const [marketTab, setMarketTab] = useState('overview');
  const [compareCoinIds, setCompareCoinIds] = useState(['bitcoin', 'ethereum', '']);
  const [currency, setCurrency] = useState('usd');
  const [currencyRates, setCurrencyRates] = useState({ usd: 1 });
  const [currencyRatesLoaded, setCurrencyRatesLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chartData, setChartData] = useState({ labels: [], datasets: [], source: 'loading' });
  const [candleChartData, setCandleChartData] = useState({ labels: [], datasets: [], source: 'loading' });
  const [marketDataSource, setMarketDataSource] = useState('loading');
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orderSide, setOrderSide] = useState('buy');
  const [tradeMode, setTradeMode] = useState('demo');
  const [binanceStatus, setBinanceStatus] = useState({
    exchange: 'Binance Spot',
    environment: 'testnet',
    credentialsConfigured: false,
    liveOrdersEnabled: false,
  });
  const [liveBalances, setLiveBalances] = useState([]);
  const [liveTrades, setLiveTrades] = useState([]);
  const [liveAccountError, setLiveAccountError] = useState('');
  const [amount, setAmount] = useState('0.5');
  const [paperWallet, setPaperWallet] = useState(() => {
    if (typeof window === 'undefined') return createDemoWallet();
    try {
      const savedWallet = JSON.parse(localStorage.getItem(DEMO_WALLET_STORAGE_KEY) || 'null');
      if (savedWallet && Number.isFinite(Number(savedWallet.cash)) && Array.isArray(savedWallet.positions) && Array.isArray(savedWallet.trades)) {
        return savedWallet;
      }
    } catch {
      return createDemoWallet();
    }
    return createDemoWallet();
  });
  const [theme, setTheme] = useState('dark');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [trending, setTrending] = useState([]);
  const [toasts, setToasts] = useState([
    { id: 1, type: 'success', text: 'Market feed connected successfully.' },
  ]);
  const [tradeHistoryFilter, setTradeHistoryFilter] = useState('all');
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
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authError, setAuthError] = useState('');
  const [adminToken, setAdminToken] = useState(() => {
    if (typeof window === 'undefined') return '';
    return sessionStorage.getItem('bitnexa-admin-token') || '';
  });
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminPanel, setAdminPanel] = useState(false);
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [adminError, setAdminError] = useState('');
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSelectedUser, setAdminSelectedUser] = useState(null);
  const [brandClickCount, setBrandClickCount] = useState(0);
  const brandClickTimerRef = { current: null };
  const [portfolio, setPortfolio] = useState({ positions: [], totalValue: 0 });
  const [portfolioSummary, setPortfolioSummary] = useState({ totalValue: 0, totalInvested: 0, change: 0, changePercent: 0, positions: [] });
  const [portfolioInsights, setPortfolioInsights] = useState({
    diversificationScore: 0,
    concentrationRisk: 0,
    topPerformer: 'N/A',
    largestPosition: 'N/A',
    rebalancingNote: 'Add positions to unlock insights.',
    allocations: [],
  });
  const [alerts, setAlerts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [newAlert, setNewAlert] = useState({ coinId: 'bitcoin', targetPrice: '', direction: 'above' });
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: currency === 'jpy' ? 0 : 2,
  }), [currency]);
  const formatCurrency = (value) => currencyFormatter.format(
    (Number(value) || 0) * (currencyRates[currency] || 1)
  );
  const chartCoinSymbol = coins.find((coin) => coin.id === selectedId)?.symbol?.toUpperCase();

  useEffect(() => {
    let isCurrent = true;

    marketApi.getCurrencyRates()
      .then((response) => {
        if (!isCurrent) return;
        if (response?.rates?.usd) {
          setCurrencyRates(response.rates);
          const savedCurrency = localStorage.getItem('bitnexa-currency');
          if (savedCurrency && response.rates[savedCurrency]) setCurrency(savedCurrency);
        }
        setCurrencyRatesLoaded(true);
      })
      .catch((error) => {
        console.error('Unable to load currency rates:', error);
        if (isCurrent) setCurrencyRatesLoaded(true);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (currencyRatesLoaded) localStorage.setItem('bitnexa-currency', currency);
  }, [currency, currencyRatesLoaded]);

  useEffect(() => {
    let isCurrent = true;
    marketApi.getBinanceStatus()
      .then((status) => {
        if (isCurrent) setBinanceStatus(status);
      })
      .catch((error) => console.error('Unable to load Binance status:', error));
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (tradeMode !== 'live' || !token || !binanceStatus.liveOrdersEnabled) {
      setLiveBalances([]);
      return undefined;
    }

    let isCurrent = true;
    setLiveAccountError('');
    marketApi.getBinanceAccount(token)
      .then((response) => {
        if (isCurrent) setLiveBalances(response.balances || []);
      })
      .catch((error) => {
        if (isCurrent) setLiveAccountError(error.message || 'Unable to load Binance balances.');
      });

    return () => {
      isCurrent = false;
    };
  }, [binanceStatus.liveOrdersEnabled, token, tradeMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DEMO_WALLET_STORAGE_KEY, JSON.stringify(paperWallet));
    }
  }, [paperWallet]);

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

  const openCoinWorkspace = (coinId) => {
    // If user clicks the already-selected coin, open fullscreen chart workspace
    if (selectedId === coinId && selectedNav === 'Markets' && !coinWorkspaceFullscreen) {
      setLastNonMarketNav((prev) => (prev !== 'Markets' ? prev : 'Dashboard'));
      setCoinWorkspaceFullscreen(true);
      return;
    }

    // First click: select the coin to display in the right-side detail & chart panel
    setSelectedId(coinId);
    setTradeCoinId(coinId);
    setDetailExpanded(true);
    setMarketTab('overview');
    if (selectedNav !== 'Markets') {
      setLastNonMarketNav(selectedNav);
      setSelectedNav('Markets');
    }
  };

  useEffect(() => {
    const loadMarket = async () => {
      try {
        setLoading(true);
        const data = await marketApi.getMarket(TOP_50_IDS);
        setCoins(data);
        setMarketDataSource(data.length && data.every((coin) => coin.data_source === 'live') ? 'live' : 'fallback');
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
    let isCurrent = true;
    const isIntraday = INTRADAY_INTERVALS.includes(range);

    const loadChart = async () => {
      if (!selectedId) return;

      const chartDays = range === 'max' ? 'max' : Number(range);

      try {
        const data = await marketApi.getChart(selectedId, chartDays);
        if (!isCurrent) return;
        setChartData({
          labels: data.labels,
          times: data.times || [],
          prices: data.prices || [],
          source: data.source || 'fallback',
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
        if (isCurrent) setError(err.message || 'Unable to load chart data.');
      }
    };

    const loadCandles = async () => {
      if (!selectedId) return;

      try {
        const data = await marketApi.getOhlc(selectedId, range);
        if (!isCurrent) return;
        const candles = data.candles || [];

        setCandleChartData({
          labels: candles.map((item) => item.label),
          candles: candles,
          source: data.source || 'fallback',
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
        if (isCurrent) setError(err.message || 'Unable to load candle data.');
      }
    };

    const loadIntradayCandles = async () => {
      if (!selectedId || !chartCoinSymbol) return;

      try {
        const data = await marketApi.getBinanceKlines(`${chartCoinSymbol}USDT`, range);
        if (!isCurrent) return;
        const candles = data.candles || [];
        const labels = candles.map((item) => item.label);
        const prices = candles.map((item) => Number(item.close));

        setChartData({
          labels,
          times: candles.map((item) => Math.floor(new Date(item.time).getTime() / 1000)),
          prices,
          source: data.source || 'binance',
          datasets: [{
            label: `${chartCoinSymbol} Price`,
            data: prices,
            borderColor: '#5ec4ff',
            backgroundColor: 'rgba(94, 196, 255, 0.18)',
            borderWidth: 2,
            fill: true,
            tension: 0.35,
          }],
        });
        setCandleChartData({
          labels,
          candles,
          source: data.source || 'binance',
          datasets: [{
            label: 'Candles',
            data: candles.map((item) => item.range),
            backgroundColor: candles.map((item) => (
              item.direction === 'up' ? 'rgba(54, 211, 153, 0.8)' : 'rgba(255, 100, 124, 0.78)'
            )),
            borderRadius: 4,
            borderSkipped: false,
          }],
        });
      } catch (err) {
        if (isCurrent) {
          setChartData((current) => ({ ...current, source: 'error' }));
          setCandleChartData((current) => ({ ...current, source: 'error' }));
          setError(err.message || 'Unable to load Binance chart candles.');
        }
      }
    };

    const refreshCharts = () => {
      if (isIntraday) {
        loadIntradayCandles();
      } else {
        loadChart();
        loadCandles();
      }
    };

    refreshCharts();
    if (!autoRefresh) return () => { isCurrent = false; };

    const interval = setInterval(refreshCharts, isIntraday ? 5000 : 60000);
    return () => {
      isCurrent = false;
      clearInterval(interval);
    };
  }, [autoRefresh, chartCoinSymbol, selectedId, range]);

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

  const marketFilterCounts = useMemo(() => {
    const counts = { all: coins.length, gainers: 0, losers: 0, layer1: 0, defi: 0, stable: 0, meme: 0, ai: 0, watchlist: 0 };
    for (const coin of coins) {
      if ((Number(coin.price_change_percentage_24h) || 0) >= 0) counts.gainers++; else counts.losers++;
      const seg = getCoinSegment(coin);
      if (counts[seg] !== undefined) counts[seg]++;
      if (watchlist.includes(coin.id)) counts.watchlist++;
    }
    return counts;
  }, [coins, watchlist]);

  const marketSegmentOptions = useMemo(() => [
    { key: 'all', label: 'All', icon: '🌐', count: marketFilterCounts.all },
    { key: 'gainers', label: 'Gainers', icon: '↗', count: marketFilterCounts.gainers },
    { key: 'losers', label: 'Losers', icon: '↘', count: marketFilterCounts.losers },
    { key: 'layer1', label: 'Layer 1', icon: '⬡', count: marketFilterCounts.layer1 },
    { key: 'defi', label: 'DeFi', icon: '⚡', count: marketFilterCounts.defi },
    { key: 'stable', label: 'Stablecoins', icon: '🛡️', count: marketFilterCounts.stable },
    { key: 'meme', label: 'Meme', icon: '🚀', count: marketFilterCounts.meme },
    { key: 'ai', label: 'AI & Infra', icon: '🧠', count: marketFilterCounts.ai },
    { key: 'watchlist', label: 'Watchlist', icon: '★', count: marketFilterCounts.watchlist },
  ], [marketFilterCounts]);

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
    const segments = [
      { key: 'layer1', label: 'Layer 1', icon: '⬡', color: '#38bdf8' },
      { key: 'defi', label: 'DeFi', icon: '⚡', color: '#a78bfa' },
      { key: 'stable', label: 'Stablecoins', icon: '🛡️', color: '#34d399' },
      { key: 'meme', label: 'Meme', icon: '🚀', color: '#fbbf24' },
      { key: 'ai', label: 'AI & Infra', icon: '🧠', color: '#22d3ee' },
    ];

    return segments.map((seg) => {
      const segmentCoins = coins.filter((coin) => getCoinSegment(coin) === seg.key);
      const averageChange = segmentCoins.length
        ? segmentCoins.reduce((sum, coin) => sum + (Number(coin.price_change_percentage_24h) || 0), 0) / segmentCoins.length
        : 0;

      return {
        key: seg.key,
        label: seg.label,
        icon: seg.icon,
        color: seg.color,
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
  const comparedCoins = compareCoinIds
    .map((coinId) => coins.find((coin) => coin.id === coinId))
    .filter(Boolean);

  const comparisonMetrics = [
    { label: 'Price', value: (coin) => formatCurrency(coin.current_price) },
    {
      label: '24h change',
      value: (coin) => formatPercent(coin.price_change_percentage_24h),
      className: (coin) => Number(coin.price_change_percentage_24h) >= 0 ? 'positive' : 'negative',
    },
    { label: 'Market cap', value: (coin) => formatCompact(coin.market_cap) },
    { label: '24h volume', value: (coin) => formatCompact(coin.total_volume) },
    { label: '24h high / low', value: (coin) => `${formatCurrency(coin.high_24h)} / ${formatCurrency(coin.low_24h)}` },
    { label: 'Circulating supply', value: (coin) => formatCompact(coin.circulating_supply) },
    { label: 'Market rank', value: (coin) => coin.market_cap_rank ? `#${coin.market_cap_rank}` : '—' },
  ];

  const rangeOptions = [
    { value: '15s', label: '15s' },
    { value: '20s', label: '20s' },
    { value: '1m', label: '1m' },
    { value: '2m', label: '2m' },
    { value: '3m', label: '3m' },
    { value: '5m', label: '5m' },
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

  const trendingCoins = useMemo(() => marketCapLeaders.slice(0, 3), [marketCapLeaders]);

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
    if (!user) return [];
    if (portfolio.positions && portfolio.positions.length) {
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

    const palette = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f43f5e', '#a78bfa'];
    const totalCryptoValue = paperWallet.positions.reduce((sum, pos) => {
      const coin = coins.find((c) => c.id === pos.coinId);
      const price = Number(coin?.current_price || pos.averagePrice || 0);
      return sum + (Number(pos.amount || 0) * price);
    }, 0);
    const totalEquity = totalCryptoValue + Number(paperWallet.cash || 0);

    if (paperWallet.positions.length > 0) {
      const items = paperWallet.positions.map((pos, index) => {
        const coin = coins.find((c) => c.id === pos.coinId);
        const price = Number(coin?.current_price || pos.averagePrice || 0);
        const val = Number(pos.amount || 0) * price;
        const weight = totalEquity > 0 ? (val / totalEquity) * 100 : 0;
        return {
          label: pos.symbol?.toUpperCase() || pos.coinId?.toUpperCase(),
          weight: Number(weight.toFixed(1)),
          value: formatCurrency(val),
          color: palette[index % palette.length],
          coinId: pos.coinId,
          amount: Number(pos.amount),
        };
      });

      if (paperWallet.cash > 0) {
        const cashWeight = totalEquity > 0 ? (paperWallet.cash / totalEquity) * 100 : 0;
        items.push({
          label: 'Demo Cash',
          weight: Number(cashWeight.toFixed(1)),
          value: formatCurrency(paperWallet.cash),
          color: '#10b981',
          isCash: true,
        });
      }
      return items;
    }

    return [
      { label: 'Available Demo Cash', weight: 100, value: formatCurrency(paperWallet.cash || STARTING_DEMO_CASH), color: '#38bdf8', isCash: true },
    ];
  }, [coins, currency, currencyRates, paperWallet, portfolio, user]);

  const alertFeed = useMemo(() => {
    if (alerts.length) {
      return alerts.map((alert) => ({
        title: `${String(alert.coinId || 'Asset').toUpperCase()} ${alert.direction === 'above' ? 'above' : 'below'} target`,
        detail: `${alert.status === 'triggered' ? 'Triggered' : 'Watching'} • ${formatCurrency(Number(alert.currentPrice || alert.targetPrice || 0))} / ${formatCurrency(Number(alert.targetPrice || 0))}`,
        tone: alert.status === 'triggered' ? 'positive' : alert.direction === 'above' ? 'positive' : 'negative',
      }));
    }

    return [
      { title: 'Your BTC breakout', detail: 'Above your 20-day trend line with rising volume.', tone: 'positive' },
      { title: 'Your ETH watch', detail: 'Range squeeze building near your key resistance level.', tone: 'neutral' },
      { title: 'Your SOL risk', detail: 'Pullback signal needs confirmation before adding more size.', tone: 'negative' },
    ];
  }, [alerts, currency, currencyRates]);

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
  const selectedPaperPosition = paperWallet.positions.find((position) => position.coinId === tradeCoin?.id && (position.side || 'buy') === orderSide);

  // Calculate total equity including long and short unrealized PnL
  const paperOpenPnL = paperWallet.positions.reduce((total, position) => {
    const marketPrice = Number(coins.find((coin) => coin.id === position.coinId)?.current_price || position.averagePrice || 0);
    const entryPrice = Number(position.averagePrice || 0);
    const qty = Number(position.amount || 0);
    const isLong = (position.side || 'buy') === 'buy';
    const posPnL = isLong ? (marketPrice - entryPrice) * qty : (entryPrice - marketPrice) * qty;
    return total + posPnL;
  }, 0);

  const paperMarginTotal = paperWallet.positions.reduce((sum, pos) => sum + (Number(pos.margin) || (Number(pos.amount) * Number(pos.averagePrice))), 0);
  const paperOpenValue = paperMarginTotal + paperOpenPnL;

  const estimatedFee = Number((orderTotal * 0.001).toFixed(2));
  const estimatedSettlement = orderTotal + estimatedFee;

  const effectivePortfolioSummary = useMemo(() => {
    if (!user) {
      return {
        totalValue: 0,
        totalInvested: 0,
        cash: 0,
        openPositionsValue: 0,
        change: 0,
        changePercent: 0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        positions: [],
        trades: [],
      };
    }

    if (portfolio.positions && portfolio.positions.length > 0) {
      return portfolioSummary;
    }

    const totalInvested = paperWallet.positions.reduce((sum, pos) => {
      return sum + (Number(pos.amount || 0) * Number(pos.averagePrice || 0));
    }, 0);

    let totalUnrealizedPnl = 0;
    paperWallet.positions.forEach((pos) => {
      const coin = coins.find((c) => c.id === pos.coinId);
      const currentPrice = Number(coin?.current_price || pos.averagePrice || 0);
      const entryPrice = Number(pos.averagePrice || 0);
      const qty = Number(pos.amount || 0);
      const isLong = (pos.side || 'buy') === 'buy';
      totalUnrealizedPnl += isLong ? (currentPrice - entryPrice) * qty : (entryPrice - currentPrice) * qty;
    });

    const totalEquity = Number((Number(paperWallet.cash || 0) + totalInvested + totalUnrealizedPnl).toFixed(2));
    const startingCapital = STARTING_DEMO_CASH || 10000;
    const totalPnl = Number((totalEquity - startingCapital).toFixed(2));
    const totalPnlPercent = startingCapital > 0 ? Number(((totalPnl / startingCapital) * 100).toFixed(2)) : 0;
    const unrealizedPnl = Number(totalUnrealizedPnl.toFixed(2));
    const unrealizedPnlPercent = totalInvested > 0 ? Number(((unrealizedPnl / totalInvested) * 100).toFixed(2)) : 0;

    return {
      totalValue: totalEquity,
      totalInvested: Number(totalInvested.toFixed(2)),
      cash: Number(paperWallet.cash || 0),
      openPositionsValue: Number((totalInvested + totalUnrealizedPnl).toFixed(2)),
      change: totalPnl,
      changePercent: totalPnlPercent,
      unrealizedPnl,
      unrealizedPnlPercent,
      positions: paperWallet.positions,
      trades: paperWallet.trades,
    };
  }, [coins, paperWallet, portfolio.positions, portfolioSummary, user]);

  const effectivePortfolioInsights = useMemo(() => {
    if (!user) {
      return {
        diversificationScore: 0,
        concentrationRisk: 0,
        topPerformer: 'N/A',
        rebalancingNote: 'Log in to view portfolio insights.',
      };
    }

    if (portfolio.positions && portfolio.positions.length > 0) {
      return portfolioInsights;
    }

    const positionsCount = paperWallet.positions.length;
    if (positionsCount === 0) {
      return {
        diversificationScore: 10,
        concentrationRisk: 0,
        topPerformer: 'All in Cash',
        rebalancingNote: 'Your demo portfolio is 100% in cash ($10,000). Place demo buy orders on crypto assets to start building an active portfolio.',
        allocations: [],
      };
    }

    const openPositions = paperWallet.positions.map((pos) => {
      const coin = coins.find((c) => c.id === pos.coinId);
      const currentPrice = Number(coin?.current_price || pos.averagePrice || 0);
      const value = Number(pos.amount || 0) * currentPrice;
      const cost = Number(pos.amount || 0) * Number(pos.averagePrice || 0);
      const pnlPct = cost > 0 ? ((value - cost) / cost) * 100 : 0;
      return { ...pos, value, currentPrice, pnlPct };
    });

    const totalEquity = Math.max(1, effectivePortfolioSummary.totalValue);
    const largestPos = openPositions.reduce((max, p) => p.value > max.value ? p : max, openPositions[0]);
    const concentrationRisk = Number(((largestPos.value / totalEquity) * 100).toFixed(1));

    let diversificationScore = 30;
    if (positionsCount === 1) diversificationScore = 35;
    else if (positionsCount === 2) diversificationScore = 60;
    else if (positionsCount === 3) diversificationScore = 78;
    else diversificationScore = Math.min(95, 78 + (positionsCount - 3) * 5);

    const topPos = openPositions.reduce((max, p) => p.pnlPct > max.pnlPct ? p : max, openPositions[0]);
    const topPerformer = `${topPos.symbol.toUpperCase()} (${topPos.pnlPct >= 0 ? '+' : ''}${topPos.pnlPct.toFixed(2)}%)`;

    let rebalancingNote = `Active demo allocation with ${positionsCount} open position(s).`;
    if (concentrationRisk > 60) {
      rebalancingNote = `High concentration risk in ${largestPos.symbol.toUpperCase()} (${concentrationRisk}% of equity). Consider rebalancing into other sectors to hedge downside.`;
    } else if (positionsCount >= 3) {
      rebalancingNote = `Good sector diversification across ${positionsCount} assets with balanced risk exposure.`;
    }

    return {
      diversificationScore,
      concentrationRisk,
      topPerformer,
      rebalancingNote,
      allocations: openPositions,
    };
  }, [coins, effectivePortfolioSummary, paperWallet.positions, portfolio.positions, portfolioInsights]);

  const handlePlaceOrder = async () => {
    if (!user) {
      setToast({ id: Date.now(), type: 'error', text: 'Please log in to your account before placing orders.' });
      setAuthOpen(true);
      return;
    }
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

    if (currentCoin.data_source !== 'live') {
      setToast({
        id: Date.now(),
        type: 'error',
        text: 'Live quotes are unavailable; demo orders are paused until the market feed recovers.',
      });
      return;
    }

    if (tradeMode === 'live') {
      if (!token || !user) {
        setToast({ id: Date.now(), type: 'error', text: 'Log in to BitNexa before placing a Binance Spot order.' });
        return;
      }
      if (!binanceStatus.liveOrdersEnabled) {
        setToast({ id: Date.now(), type: 'error', text: 'Binance production orders are not enabled on the backend.' });
        return;
      }

      const pair = `${currentCoin.symbol.toUpperCase()}USDT`;
      const confirmed = window.confirm(
        `REAL BINANCE SPOT ORDER: ${orderSide.toUpperCase()} ${parsedAmount} ${currentCoin.symbol.toUpperCase()} using ${pair}. This can spend or sell real assets. Continue?`
      );
      if (!confirmed) return;

      try {
        const response = await marketApi.placeBinanceOrder(token, {
          symbol: pair,
          side: orderSide,
          quantity: String(parsedAmount),
        });
        const order = response.order;
        const liveTrade = {
          id: order.orderId,
          side: String(order.side || orderSide).toLowerCase(),
          symbol: currentCoin.symbol.toUpperCase(),
          amount: Number(order.executedQty || order.origQty || parsedAmount),
          quote: Number(order.cummulativeQuoteQty || orderTotal),
          timestamp: new Date(order.transactTime || Date.now()).toISOString(),
          status: order.status || 'submitted',
        };
        setLiveTrades((current) => [liveTrade, ...current].slice(0, 20));
        setToast({
          id: Date.now(),
          type: 'success',
          text: `Binance order ${order.orderId} ${String(order.status || 'accepted').toLowerCase()}.`,
        });
        marketApi.getBinanceAccount(token)
          .then((account) => setLiveBalances(account.balances || []))
          .catch((error) => setLiveAccountError(error.message || 'Unable to refresh Binance balances.'));
      } catch (error) {
        setToast({ id: Date.now(), type: 'error', text: error?.message || 'Binance order failed.' });
      }
      return;
    }

    try {
      const result = executePaperTrade(paperWallet, {
        coinId: currentCoin.id,
        symbol: currentCoin.symbol,
        side: orderSide,
        amount: parsedAmount,
        price: currentCoin.current_price,
      });
      setPaperWallet(result.wallet);
      setToast({
        id: Date.now(),
        type: 'success',
        text: `Demo ${orderSide.toUpperCase()} filled: ${result.trade.amount} ${currentCoin.symbol.toUpperCase()} at ${formatCurrency(result.trade.price)}.`,
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        type: 'error',
        text: error?.message || 'Unable to place trade order right now.',
      });
    }
  };

  const handleClosePosition = (coinId, closePercent = 100) => {
    try {
      const position = paperWallet.positions.find((p) => p.coinId === coinId);
      if (!position) {
        setToast({ id: Date.now(), type: 'error', text: 'Position not found in demo wallet.' });
        return;
      }

      const positionCoin = coins.find((c) => c.id === coinId) || (selectedCoin?.id === coinId ? selectedCoin : null);
      const currentPrice = Number(positionCoin?.current_price || position.averagePrice);

      if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
        setToast({ id: Date.now(), type: 'error', text: 'Current market quote is not available.' });
        return;
      }

      const result = closePaperPosition(paperWallet, {
        coinId: position.coinId,
        price: currentPrice,
        percent: closePercent,
        side: position.side,
      });

      setPaperWallet(result.wallet);

      const isLong = (position.side || 'buy') === 'buy';
      const pnl = Number(result.trade.pnl !== undefined
        ? result.trade.pnl
        : isLong
          ? (((currentPrice - position.averagePrice) * result.trade.amount) - (result.trade.fee || 0)).toFixed(2)
          : (((position.averagePrice - currentPrice) * result.trade.amount) - (result.trade.fee || 0)).toFixed(2));
      const pnlPct = result.trade.pnlPercent !== undefined
        ? result.trade.pnlPercent
        : position.averagePrice > 0
          ? Number((((isLong ? currentPrice - position.averagePrice : position.averagePrice - currentPrice) / position.averagePrice) * 100).toFixed(2))
          : 0;
      const pnlSign = pnl >= 0 ? '+' : '';

      setToast({
        id: Date.now(),
        type: pnl >= 0 ? 'success' : 'info',
        text: `Closed ${isLong ? 'Long' : 'Short'} position: ${result.trade.amount} ${position.symbol.toUpperCase()} at ${formatCurrency(currentPrice)}. PnL: ${pnlSign}${formatCurrency(pnl)} (${pnlSign}${pnlPct}%)`,
      });
    } catch (error) {
      setToast({
        id: Date.now(),
        type: 'error',
        text: error?.message || 'Unable to close position.',
      });
    }
  };

  const handleCloseAllPositions = () => {
    if (!paperWallet.positions.length) return;
    try {
      let currentWallet = { ...paperWallet, positions: [...paperWallet.positions] };
      let totalClosedPnl = 0;
      const closedSymbols = [];

      for (const position of paperWallet.positions) {
        const positionCoin = coins.find((c) => c.id === position.coinId) || (selectedCoin?.id === position.coinId ? selectedCoin : null);
        const currentPrice = Number(positionCoin?.current_price || position.averagePrice);
        if (Number.isFinite(currentPrice) && currentPrice > 0) {
          const result = closePaperPosition(currentWallet, {
            coinId: position.coinId,
            price: currentPrice,
            percent: 100,
            side: position.side,
          });
          currentWallet = result.wallet;
          const pnl = Number(result.trade.pnl || 0);
          totalClosedPnl += pnl;
          closedSymbols.push(`${(position.side || 'buy').toUpperCase()} ${position.symbol.toUpperCase()}`);
        }
      }

      setPaperWallet(currentWallet);
      const pnlSign = totalClosedPnl >= 0 ? '+' : '';
      setToast({
        id: Date.now(),
        type: totalClosedPnl >= 0 ? 'success' : 'info',
        text: `Closed ${closedSymbols.length} position(s). Realized PnL: ${pnlSign}${formatCurrency(totalClosedPnl)}`,
      });
    } catch (error) {
      setToast({ id: Date.now(), type: 'error', text: error?.message || 'Failed to close all positions.' });
    }
  };

  const handleResetDemoWallet = () => {
    const freshWallet = createDemoWallet();
    setPaperWallet(freshWallet);
    setToast({ id: Date.now(), type: 'success', text: `Demo portfolio reset to ${formatCurrency(STARTING_DEMO_CASH)} cash.` });
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
        const [watchlistResponse, portfolioResponse, portfolioSummaryResponse, portfolioInsightsResponse, alertsResponse, transactionsResponse] = await Promise.all([
          marketApi.getWatchlist(token),
          marketApi.getPortfolio(token),
          marketApi.getPortfolioSummary(token),
          marketApi.getPortfolioInsights(token),
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

        if (portfolioSummaryResponse && typeof portfolioSummaryResponse === 'object') {
          setPortfolioSummary({
            totalValue: Number(portfolioSummaryResponse.totalValue || 0),
            totalInvested: Number(portfolioSummaryResponse.totalInvested || 0),
            change: Number(portfolioSummaryResponse.change || 0),
            changePercent: Number(portfolioSummaryResponse.changePercent || 0),
            positions: Array.isArray(portfolioSummaryResponse.positions) ? portfolioSummaryResponse.positions : [],
          });
        }

        if (portfolioInsightsResponse && typeof portfolioInsightsResponse === 'object') {
          setPortfolioInsights({
            diversificationScore: Number(portfolioInsightsResponse.diversificationScore || 0),
            concentrationRisk: Number(portfolioInsightsResponse.concentrationRisk || 0),
            topPerformer: String(portfolioInsightsResponse.topPerformer || 'N/A'),
            largestPosition: String(portfolioInsightsResponse.largestPosition || 'N/A'),
            rebalancingNote: String(portfolioInsightsResponse.rebalancingNote || 'No insights yet.'),
            allocations: Array.isArray(portfolioInsightsResponse.allocations) ? portfolioInsightsResponse.allocations : [],
          });
        }

        if (Array.isArray(alertsResponse?.alerts)) {
          setAlerts(alertsResponse.alerts);
        }

        if (Array.isArray(transactionsResponse?.transactions)) setTransactions(transactionsResponse.transactions);
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
      setAuthForm({ name: '', email: '', password: '' });
      setToast({ id: Date.now(), type: 'success', text: authMode === 'login' ? 'Welcome back to BitNexa.' : 'Account created successfully.' });
    } catch (error) {
      setAuthError(error?.message || 'Authentication failed.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken('');
    setPortfolio({ positions: [], totalValue: 0 });
    setPortfolioSummary({ totalValue: 0, totalInvested: 0, change: 0, changePercent: 0, positions: [] });
    setPortfolioInsights({
      diversificationScore: 0,
      concentrationRisk: 0,
      topPerformer: 'N/A',
      largestPosition: 'N/A',
      rebalancingNote: 'Add positions to unlock insights.',
      allocations: [],
    });
    setAlerts([]);
    setTransactions([]);
    setPaperWallet(createDemoWallet());
    try {
      localStorage.removeItem(DEMO_WALLET_STORAGE_KEY);
      localStorage.removeItem('bitnexa-user');
      localStorage.removeItem('bitnexa-token');
      localStorage.removeItem('bitnexa-watchlist');
    } catch {}
    if (selectedNav === 'Portfolio' || selectedNav === 'Trade History') {
      setSelectedNav('Dashboard');
    }
    setToast({ id: Date.now(), type: 'info', text: 'You have been logged out.' });
  };

  const handleDemoLogin = () => {
    const demoUser = { name: 'Demo Trader', email: 'demo@example.com', id: 'demo-user' };
    setUser(demoUser);
    setToken('');
    setAuthOpen(false);
    setToast({ id: Date.now(), type: 'success', text: 'Welcome! You are in Demo Mode.' });
  };

  const handleAdminBrandClick = () => {
    setBrandClickCount((c) => {
      const next = c + 1;
      if (next >= 3) {
        setAdminOpen(true);
        return 0;
      }
      clearTimeout(brandClickTimerRef.current);
      brandClickTimerRef.current = setTimeout(() => setBrandClickCount(0), 2000);
      return next;
    });
  };

  const handleAdminLogin = async (event) => {
    event.preventDefault();
    setAdminError('');
    setAdminLoading(true);
    try {
      const response = await marketApi.adminLogin({ email: adminForm.email, password: adminForm.password });
      const tok = response.token || '';
      setAdminToken(tok);
      sessionStorage.setItem('bitnexa-admin-token', tok);
      setAdminOpen(false);
      setAdminPanel(true);
      // Load data immediately
      const [usersRes, statsRes] = await Promise.all([
        marketApi.getAdminUsers(tok),
        marketApi.getAdminStats(tok),
      ]);
      setAdminUsers(usersRes.users || []);
      setAdminStats(statsRes);
    } catch (err) {
      setAdminError(err?.message || 'Admin login failed.');
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminRefresh = async () => {
    if (!adminToken) return;
    setAdminLoading(true);
    try {
      const [usersRes, statsRes] = await Promise.all([
        marketApi.getAdminUsers(adminToken),
        marketApi.getAdminStats(adminToken),
      ]);
      setAdminUsers(usersRes.users || []);
      setAdminStats(statsRes);
    } catch (err) {
      setToast({ id: Date.now(), type: 'error', text: err?.message || 'Admin refresh failed.' });
    } finally {
      setAdminLoading(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    setAdminPanel(false);
    setAdminUsers([]);
    setAdminStats(null);
    setAdminSelectedUser(null);
    sessionStorage.removeItem('bitnexa-admin-token');
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

  const navItems = ['Dashboard', 'Markets', 'Watchlist', 'Portfolio', 'Trade History'];
  const navTitles = {
    Dashboard: 'Market Overview',
    Markets: 'Live Markets',
    Watchlist: 'Watchlist',
    Portfolio: 'My Portfolio',
    'Trade History': 'Trade History & Fills',
  };

  const navIcons = {
    Dashboard: '◈',
    Markets: '◎',
    Watchlist: '★',
    Portfolio: '▣',
    'Trade History': '⏱',
  };

  const marketTabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'portfolio', label: 'Your Mix' },
    { key: 'compare', label: 'Compare' },
  ];

  const advancedWidgets = useMemo(() => [
    { label: 'Order Flow', value: '+12.4%', detail: 'Aggressive buys on BTC/ETH', tone: 'positive' },
    { label: 'Funding Rate', value: '0.008%', detail: 'Neutral across majors', tone: 'neutral' },
    { label: 'Liquidity', value: 'High', detail: 'Depth remains healthy', tone: 'positive' },
    { label: 'Volatility', value: 'Moderate', detail: 'Range expansion normal', tone: 'warning' },
  ], []);

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
      <div className={`dashboard-shell ${coinWorkspaceFullscreen && selectedNav === 'Markets' ? 'market-fullscreen-layout' : ''} ${sidebarCollapsed ? 'sidebar-is-collapsed' : ''}`}>
        <aside className={`sidebar ${(coinWorkspaceFullscreen && selectedNav === 'Markets') || sidebarCollapsed ? 'sidebar-hidden' : ''}`}>
          <div className="brand-block" onClick={handleAdminBrandClick} title="BitNexa" style={{ cursor: 'pointer' }}>
            <span className="brand-mark">B</span>
            <div>
              <span className="brand">BITNEXA</span>
              <span className="brand-subtitle">Trading Desk</span>
            </div>
          </div>

          {selectedNav === 'Markets' ? (
            <div className="sidebar-market-panel">
              <button
                type="button"
                className="sidebar-market-back"
                onClick={() => setSelectedNav(lastNonMarketNav || 'Dashboard')}
              >
                ← Back
              </button>
              <div className="sidebar-market-caption">Market Explorer</div>
            </div>
          ) : (
            <nav className="sidebar-nav">
              {navItems.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`nav-item ${selectedNav === item ? 'active' : ''}`}
                  onClick={() => {
                    if (item !== 'Markets') {
                      setLastNonMarketNav(item);
                      setCoinWorkspaceFullscreen(false);
                    }
                    setSelectedNav(item);
                  }}
                >
                  <span>{navIcons[item] || '◈'}</span>
                  {item}
                </button>
              ))}
            </nav>
          )}

          {user ? (
            <div
              className="sidebar-card interactive-sidebar-card"
              onClick={() => {
                setLastNonMarketNav('Portfolio');
                setCoinWorkspaceFullscreen(false);
                setSelectedNav('Portfolio');
              }}
              title="Open Portfolio Dashboard"
              role="button"
              tabIndex={0}
            >
              <div className="sidebar-card-top-row">
                <span className="eyebrow">{portfolio.positions.length ? 'Live Portfolio' : 'Demo Portfolio'}</span>
                <span className="sidebar-portfolio-live-dot" />
              </div>
              <strong>{formatCurrency(effectivePortfolioSummary.totalValue)}</strong>
              <small className={effectivePortfolioSummary.change >= 0 ? 'positive' : 'negative'}>
                {effectivePortfolioSummary.change >= 0 ? '+' : ''}{formatCurrency(effectivePortfolioSummary.change)} ({effectivePortfolioSummary.change >= 0 ? '+' : ''}{effectivePortfolioSummary.changePercent.toFixed(2)}%)
              </small>
            </div>
          ) : (
            <div
              className="sidebar-card interactive-sidebar-card"
              onClick={() => setAuthOpen(true)}
              title="Login to BitNexa"
              role="button"
              tabIndex={0}
            >
              <div className="sidebar-card-top-row">
                <span className="eyebrow">Trading Desk</span>
              </div>
              <strong>Sign In</strong>
              <small>Login to track portfolio & trades</small>
            </div>
          )}
        </aside>

        <main className={`content-area ${coinWorkspaceFullscreen && selectedNav === 'Markets' ? 'market-fullscreen-shell' : ''}`}>
          <header className="topbar">
            <div className="topbar-left">
              <button
                type="button"
                className="icon-button"
                aria-label="Toggle sidebar menu"
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => setSidebarCollapsed((current) => !current)}
              >
                ☰
              </button>
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
                          openCoinWorkspace(coin.id);
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

              <label className="currency-control">
                <span>Currency</span>
                <select
                  aria-label="Display currency"
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value)}
                >
                  {DISPLAY_CURRENCIES.map((option) => (
                    <option key={option.code} value={option.code} disabled={!currencyRatesLoaded || !currencyRates[option.code]}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

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
                <button
                  type="button"
                  className="mini-stat interactive-mini-stat"
                  onClick={() => {
                    setLastNonMarketNav('Portfolio');
                    setSelectedNav('Portfolio');
                  }}
                  title="View Portfolio Breakdown & Demo Equity"
                >
                  <span>Demo Equity</span>
                  <strong>{formatCurrency(effectivePortfolioSummary.totalValue)}</strong>
                </button>

                <button
                  type="button"
                  className="mini-stat accent interactive-mini-stat"
                  onClick={() => {
                    setLastNonMarketNav('Trade History');
                    setSelectedNav('Trade History');
                  }}
                  title="View Trade History & Realized P/L Audit"
                >
                  <span>Total P/L</span>
                  <strong className={effectivePortfolioSummary.change >= 0 ? 'positive' : 'negative'}>
                    {effectivePortfolioSummary.change >= 0 ? '+' : ''}{formatCurrency(effectivePortfolioSummary.change)} ({effectivePortfolioSummary.changePercent >= 0 ? '+' : ''}{effectivePortfolioSummary.changePercent.toFixed(2)}%)
                  </strong>
                </button>

                <button
                  type="button"
                  className="mini-stat interactive-mini-stat"
                  onClick={() => {
                    setLastNonMarketNav('Portfolio');
                    setSelectedNav('Portfolio');
                  }}
                  title="View and Manage Open Positions in Portfolio"
                >
                  <span>Open Positions</span>
                  <strong>{paperWallet.positions.length > 0 ? paperWallet.positions.length : '0'}</strong>
                </button>
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

            <AllocationPanel
              title="Portfolio Allocation"
              badge={portfolio.positions.length ? 'Live' : 'Demo'}
              portfolioBreakdown={portfolioBreakdown}
              alertFeed={alertFeed}
              alertsCount={alerts.length}
            />


            <PerformanceRiskGrid portfolioPerformance={portfolioPerformance} />
            <StrategyGrid strategyCards={strategyCards} />

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

          <section className={`markets-section ${selectedNav === 'Markets' ? 'section-active' : 'section-hidden'} ${coinWorkspaceFullscreen ? 'coin-workspace-fullscreen' : ''}`}>
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
                      <div className="coin-header-left">
                        <button
                          type="button"
                          className="coin-back-btn"
                          onClick={() => setSelectedNav(lastNonMarketNav || 'Dashboard')}
                          title="Back to Dashboard"
                        >
                          ← Back
                        </button>
                        <div className="coin-meta large">
                          <img src={getSafeCoinImage(selectedCoin)} alt={selectedCoin.name} />
                          <div>
                            <h2>{selectedCoin.name}</h2>
                            <span>{selectedCoin.symbol.toUpperCase()} • {selectedCoin.market_cap_rank ? `#${selectedCoin.market_cap_rank}` : 'Market'}</span>
                          </div>
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
                  <div className="coin-list-panel modern-market-panel">
                    {/* Top Header Row: Clean, uncluttered, title with live pulse & sort on right */}
                    <div className="market-panel-header">
                      <div className="market-title-area">
                        <div className="market-heading-with-live">
                          <span className="market-live-beacon" title="Live crypto market stream">
                            <span className="beacon-dot" />
                            <span className="beacon-ring" />
                          </span>
                          <h3>Market Overview</h3>
                        </div>
                        <div className="market-meta-badge-row">
                          <span className="market-counter-badge">{sortedCoins.length} coins</span>
                          {quickFilter !== 'all' && (
                            <button
                              type="button"
                              className="market-filter-reset-pill"
                              onClick={() => setQuickFilter('all')}
                              title="Reset filter to show all coins"
                            >
                              Reset filter ✕
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="market-sort-wrapper">
                        <div className="modern-sort-pill">
                          <span className="sort-pill-glyph" aria-hidden="true">⇅</span>
                          <label htmlFor="sortSelect" className="sort-pill-label">Sort</label>
                          <select
                            id="sortSelect"
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value)}
                            className="modern-sort-select"
                          >
                            <option value="market_cap">Market Cap</option>
                            <option value="price">Price</option>
                            <option value="change">24h Change</option>
                            <option value="symbol">Symbol</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* HORIZONTAL Filter Tabs Bar (Full width, horizontal scroll track, sleek pills) */}
                    <div className="market-horizontal-filter-wrapper">
                      <div
                        className="market-horizontal-filter-track"
                        role="tablist"
                        aria-label="Market category filters"
                        onWheel={(e) => {
                          if (e.deltaY !== 0 && e.currentTarget) {
                            e.currentTarget.scrollLeft += e.deltaY * 0.8;
                          }
                        }}
                      >
                        {marketSegmentOptions.map((filter) => {
                          const isActive = quickFilter === filter.key;
                          return (
                            <button
                              key={filter.key}
                              type="button"
                              role="tab"
                              aria-selected={isActive}
                              className={`market-filter-tab-pill ${isActive ? 'active' : ''} filter-tab-${filter.key}`}
                              onClick={() => setQuickFilter(filter.key)}
                            >
                              <span className="tab-pill-icon">{filter.icon}</span>
                              <span className="tab-pill-text">{filter.label}</span>
                              {typeof filter.count === 'number' && (
                                <span className="tab-pill-count">{filter.count}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sector Pulse Horizontal Strip */}
                    <div className="market-sector-pulse-wrap">
                      <div className="sector-pulse-label-row">
                        <span className="sector-pulse-caption">SECTOR PULSE</span>
                        <span className="sector-pulse-caption-hint">24h Avg</span>
                      </div>
                      <div
                        className="market-sector-pulse-track"
                        onWheel={(e) => {
                          if (e.deltaY !== 0 && e.currentTarget) {
                            e.currentTarget.scrollLeft += e.deltaY * 0.8;
                          }
                        }}
                      >
                        {marketSegmentSummary.map((segment) => {
                          const isSegmentActive = quickFilter === segment.key;
                          const isPositive = (segment.averageChange || 0) >= 0;
                          return (
                            <button
                              key={segment.key}
                              type="button"
                              className={`sector-metric-card sector-theme-${segment.key} ${isSegmentActive ? 'active' : ''}`}
                              onClick={() => setQuickFilter(isSegmentActive ? 'all' : segment.key)}
                              title={`Filter by ${segment.label}`}
                            >
                              <div className="sector-metric-top">
                                <span className="sector-metric-icon">{segment.icon}</span>
                                <span className="sector-metric-title">{segment.label}</span>
                                <span className="sector-metric-count">{segment.count}</span>
                              </div>
                              <div className="sector-metric-bottom">
                                <span className={`sector-metric-change ${isPositive ? 'positive' : 'negative'}`}>
                                  {isPositive ? '▲ +' : '▼ '}{segment.averageChange.toFixed(2)}%
                                </span>
                              </div>
                            </button>
                          );
                        })}
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
                      <div className="empty-state market-empty-state">
                        <div className="empty-icon">⌕</div>
                        <h4>No crypto found</h4>
                        <p>No coins found matching "{quickFilter}".</p>
                        <button type="button" className="ghost-btn" onClick={() => setQuickFilter('all')}>
                          Reset to all coins
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="modern-coin-list-stack">
                          {visibleMarketCoins.map((coin, index) => {
                            const isPositive = (coin.price_change_percentage_24h || 0) >= 0;
                            const isSelected = selectedCoin?.id === coin.id;
                            const rank = coin.market_cap_rank || (index + 1);
                            return (
                              <button
                                key={coin.id}
                                type="button"
                                className={`coin-card modern-coin-item ${isSelected ? 'selected' : ''}`}
                                onClick={() => openCoinWorkspace(coin.id)}
                              >
                                <div className="coin-meta">
                                  <span className="coin-rank-chip" title={`Rank #${rank}`}>#{rank}</span>
                                  <div className="coin-avatar-wrapper">
                                    <img src={getSafeCoinImage(coin)} alt={coin.name} loading="lazy" />
                                  </div>
                                  <div className="coin-name-group">
                                    <strong className="coin-primary-name">{coin.name}</strong>
                                    <span className="coin-symbol-ticker">{coin.symbol.toUpperCase()}</span>
                                  </div>
                                </div>

                                <div className="coin-price">
                                  <strong className="coin-price-display">{formatCurrency(coin.current_price)}</strong>
                                  <span className={`coin-change-badge ${isPositive ? 'positive' : 'negative'}`}>
                                    <span className="change-arrow">{isPositive ? '▲' : '▼'}</span>
                                    {formatPercent(coin.price_change_percentage_24h)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {sortedCoins.length > visibleMarketCoins.length && (
                          <button
                            type="button"
                            className="show-more-btn modern-show-more-btn"
                            onClick={() => setShowMoreCoins((current) => current + 8)}
                          >
                            <span>Show more</span>
                            <span className="show-more-counter">({visibleMarketCoins.length} of {sortedCoins.length})</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div className="details-panel">
                    {selectedCoin ? (
                      <>
                        <div className="coin-header">
                          <div className="coin-header-left">
                            <button
                              type="button"
                              className="coin-back-btn"
                              onClick={() => {
                                setCoinWorkspaceFullscreen(false);
                                setSelectedNav(lastNonMarketNav || 'Dashboard');
                              }}
                              title="Go back to Dashboard"
                            >
                              ← Back
                            </button>
                            <div className="coin-meta large">
                              <img src={getSafeCoinImage(selectedCoin)} alt={selectedCoin.name} />
                              <div>
                                <h2>{selectedCoin.name}</h2>
                                <span>{selectedCoin.symbol.toUpperCase()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="coin-header-actions">
                            {coinWorkspaceFullscreen && (
                              <button
                                type="button"
                                className="exit-fullscreen-btn"
                                onClick={() => setCoinWorkspaceFullscreen(false)}
                                title="Exit Fullscreen Mode"
                              >
                                ✕ Exit Fullscreen
                              </button>
                            )}
                            <button
                              type="button"
                              className="watch-btn"
                              onClick={() => toggleWatchlist(selectedCoin.id)}
                            >
                              {watchlist.includes(selectedCoin.id) ? '★ Saved' : '☆ Add to Watchlist'}
                            </button>
                          </div>
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
                              <span className={`chart-feed-status ${chartData.source}`}>
                                {chartData.source === 'binance' ? autoRefresh ? `Binance · live · refreshes every 5s` : 'Binance · auto-refresh paused' : chartData.source === 'live' ? autoRefresh ? 'Live · refreshes every 60s' : 'Live · auto-refresh paused' : chartData.source === 'fallback' ? 'Preview data · feed limited' : chartData.source === 'error' ? 'Binance feed unavailable' : 'Loading live history'}
                              </span>
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
                              {chartMode === 'price' && (
                                <div className="chart-style-selector" aria-label="Price chart style">
                                  {[
                                    { value: 'line', label: 'Line' },
                                    { value: 'area', label: 'Area' },
                                    { value: 'candlestick', label: 'Candles' },
                                    { value: 'bar', label: 'OHLC bars' },
                                    { value: 'baseline', label: 'Baseline' },
                                  ].map((option) => (
                                    <button
                                      key={option.value}
                                      type="button"
                                      className={chartStyle === option.value ? 'active' : ''}
                                      onClick={() => setChartStyle(option.value)}
                                    >
                                      {option.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="range-selector">
                              {!coinWorkspaceFullscreen ? (
                                <button
                                  type="button"
                                  className="workspace-view-button"
                                  onClick={() => setCoinWorkspaceFullscreen(true)}
                                >
                                  Full screen
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="workspace-view-button active"
                                  onClick={() => setCoinWorkspaceFullscreen(false)}
                                >
                                  ✕ Exit Fullscreen
                                </button>
                              )}
                              {rangeOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  className={range === option.value ? 'active' : ''}
                                  onClick={() => {
                                    setRange(option.value);
                                    if (INTRADAY_INTERVALS.includes(option.value)) setChartStyle('candlestick');
                                  }}
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
                          ) : chartMode === 'price' ? (
                            <PriceChart
                              prices={chartData}
                              candles={candleChartData.candles || []}
                              style={chartStyle}
                              currency={currency}
                              currencyRate={currencyRates[currency] || 1}
                              resetKey={`${selectedId}:${range}`}
                              showSeconds={INTRADAY_INTERVALS.includes(range)}
                            />
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
                                    ticks: {
                                      color: '#9db5d1', callback: (value) => {
                                        const label = Number(value);
                                        if (chartMode === 'performance') return `${label.toFixed(2)}%`;
                                        return formatCurrency(label);
                                      }
                                    },
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
                    {coinWorkspaceFullscreen && (
                      <button
                        type="button"
                        className="ghost-btn demo-back-button"
                        onClick={() => {
                          setCoinWorkspaceFullscreen(false);
                          setSelectedNav(lastNonMarketNav || 'Dashboard');
                        }}
                      >
                        ← Back
                      </button>
                    )}
                    <div className="panel-header">
                      <h3>Demo Trading</h3>
                      <div className="demo-ticket-actions">
                        <span className={`paper-trading-badge ${marketDataSource}`}>
                          {marketDataSource === 'live' ? 'Paper · live quotes' : marketDataSource === 'loading' ? 'Loading live quotes' : 'Preview quotes · paused'}
                        </span>
                        <button
                          type="button"
                          className="demo-reset-btn"
                          onClick={() => {
                            if (window.confirm('Reset demo cash, positions, and trade history?')) {
                              setPaperWallet(createDemoWallet());
                            }
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div className="demo-trading-landscape-grid">
                      {/* Left Column: Order Ticket */}
                      <div className="demo-trading-col-ticket">
                        <div className="segmented-control trade-direction-control">
                          <button
                            type="button"
                            className={`trade-btn-long ${orderSide === 'buy' ? 'active' : ''}`}
                            onClick={() => setOrderSide('buy')}
                          >
                            <span>↗ Buy / Long</span>
                            <small>Uptrend</small>
                          </button>
                          <button
                            type="button"
                            className={`trade-btn-short ${orderSide === 'sell' ? 'active' : ''}`}
                            onClick={() => setOrderSide('sell')}
                          >
                            <span>↘ Sell / Short</span>
                            <small>Downtrend</small>
                          </button>
                        </div>

                        <div className="demo-wallet-summary">
                          <div>
                            <span>Available demo cash</span>
                            <strong>{formatCurrency(paperWallet.cash)}</strong>
                          </div>
                          <div>
                            <span>Account equity</span>
                            <strong>{formatCurrency(paperWallet.cash + paperOpenValue)}</strong>
                          </div>
                        </div>

                        <div className="ticket-form">
                          <label>
                            Order direction &amp; type
                            <span className="market-order-label">
                              {orderSide === 'buy' ? '🟢 Long (Profits when market rises)' : '🔴 Short (Profits when market falls)'}
                            </span>
                          </label>

                          <label>
                            Quantity (lot)
                            <div className="amount-row">
                              <input type="number" min="0.000001" step="0.000001" value={amount} onChange={(event) => setAmount(event.target.value)} />
                              <span>{selectedCoin?.symbol?.toUpperCase() || 'BTC'}</span>
                            </div>
                            <small>
                              {orderSide === 'buy' ? 'Open Long position' : 'Open Short position'} · Demo size: {Number(selectedPaperPosition?.amount || 0).toFixed(6)}
                            </small>
                          </label>
                        </div>

                        <div className="order-summary">
                          <div>
                            <span>Market price</span>
                            <strong>{selectedCoin ? formatCurrency(selectedCoin.current_price) : '--'}</strong>
                          </div>
                          <div>
                            <span>Required Margin incl. 0.1% fee</span>
                            <strong>{selectedCoin ? formatCurrency(estimatedSettlement) : '--'}</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`place-order ${orderSide}`}
                          onClick={handlePlaceOrder}
                          style={{ marginTop: '1rem' }}
                        >
                          {orderSide === 'buy' ? '↗ Open Long (Buy)' : '↘ Open Short (Sell)'} {selectedCoin?.symbol?.toUpperCase() || 'BTC'}
                        </button>
                      </div>

                      {/* Right Column: Positions & Recent Fills */}
                      <div className="demo-trading-col-activity">
                        {/* ── Live Open Positions Panel ── */}
                        <div className="demo-position-section" style={{ marginTop: 0 }}>
                          <div className="demo-section-heading">
                            <div className="demo-pos-heading-left">
                              <span className="live-pos-dot" />
                              <strong>Open Positions</strong>
                              <span className="pos-count-badge">{paperWallet.positions.length}</span>
                            </div>
                            {paperWallet.positions.length > 0 && (
                              <button
                                type="button"
                                className="close-all-btn"
                                onClick={handleCloseAllPositions}
                                title="Close all demo positions at market price"
                              >
                                Close All
                              </button>
                            )}
                          </div>

                          {paperWallet.positions.length ? (
                            <div className="demo-position-list">
                              {paperWallet.positions.map((position) => {
                                const positionCoin = coins.find((coin) => coin.id === position.coinId);
                                const currentPrice = Number(positionCoin?.current_price || position.averagePrice || 0);
                                const entryPrice = Number(position.averagePrice || 0);
                                const isLong = (position.side || 'buy') === 'buy';
                                const currentValue = Number(position.amount) * currentPrice;
                                const costBasis = Number(position.amount) * entryPrice;

                                // Proper PnL: Long gains if price rises, Short gains if price drops
                                const unrealizedPnl = isLong
                                  ? (currentPrice - entryPrice) * Number(position.amount)
                                  : (entryPrice - currentPrice) * Number(position.amount);
                                const unrealizedPnlPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
                                const isProfit = unrealizedPnl >= 0;

                                return (
                                  <div key={`${position.coinId}-${position.side || 'buy'}`} className={`live-position-card ${isProfit ? 'profit' : 'loss'}`}>
                                    <div className="live-pos-header">
                                      <div className="live-pos-meta">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <span className={`pos-direction-chip ${isLong ? 'long' : 'short'}`}>
                                            {isLong ? 'LONG ↗' : 'SHORT ↘'}
                                          </span>
                                          <span className="live-pos-symbol">{position.symbol.toUpperCase()}</span>
                                        </div>
                                        <span className="live-pos-amount">{Number(position.amount).toFixed(6)} @ {formatCurrency(position.averagePrice)}</span>
                                      </div>
                                      <div className="live-pos-pnl-badge">
                                        <span className={`pnl-pill ${isProfit ? 'positive' : 'negative'}`}>
                                          {isProfit ? '▲' : '▼'} {isProfit ? '+' : ''}{formatCurrency(unrealizedPnl)} ({isProfit ? '+' : ''}{unrealizedPnlPct.toFixed(2)}%)
                                        </span>
                                      </div>
                                    </div>

                                    <div className="live-pos-stats-row">
                                      <div className="live-pos-stat">
                                        <span>Entry</span>
                                        <strong>{formatCurrency(position.averagePrice)}</strong>
                                      </div>
                                      <div className="live-pos-stat">
                                        <span>Current</span>
                                        <strong className={isProfit ? 'positive' : 'negative'}>{formatCurrency(currentPrice)}</strong>
                                      </div>
                                      <div className="live-pos-stat">
                                        <span>Margin</span>
                                        <strong>{formatCurrency(costBasis)}</strong>
                                      </div>
                                    </div>

                                    <div className="live-pos-actions">
                                      <button
                                        type="button"
                                        className="pos-action-btn view-btn"
                                        onClick={() => openCoinWorkspace(position.coinId)}
                                      >
                                        📈 Chart
                                      </button>
                                      <button
                                        type="button"
                                        className="pos-action-btn half-close-btn"
                                        onClick={() => handleClosePosition(position.coinId, 50)}
                                        title="Close 50% of position"
                                      >
                                        ½ Close
                                      </button>
                                      <button
                                        type="button"
                                        className="pos-action-btn close-pos-btn"
                                        onClick={() => handleClosePosition(position.coinId, 100)}
                                        title="Close entire position at market price"
                                      >
                                        ✕ Close
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="demo-empty-state">No open positions. Use Buy / Long or Sell / Short to trade.</p>
                          )}
                        </div>

                        {/* ── Recent Trade History ── */}
                        <div className="demo-trade-history" style={{ marginTop: '16px' }}>
                          <div className="demo-section-heading" style={{ marginBottom: '8px' }}>
                            <strong>Recent Fills</strong>
                            <span>{Math.min(paperWallet.trades.length, 5)} of {paperWallet.trades.length}</span>
                          </div>
                          {paperWallet.trades.length ? paperWallet.trades.slice(0, 5).map((trade) => {
                            const isPnlTrade = trade.pnl !== undefined;
                            const isBuy = trade.side === 'buy';
                            return (
                              <div key={trade.id} className={`trade-history-row ${isBuy ? 'buy' : 'sell'}`}>
                                <div className="trade-hist-icon">{isBuy ? '↑' : '↓'}</div>
                                <div className="trade-hist-info">
                                  <span className="trade-hist-label">{isBuy ? 'BUY' : 'SELL'} {trade.symbol}</span>
                                  <small className="trade-hist-detail">
                                    {trade.amount} {trade.symbol} @ {formatCurrency(trade.price)} · {formatCurrency(trade.quote)}
                                  </small>
                                </div>
                                <div className="trade-hist-right">
                                  {isPnlTrade ? (
                                    <span className={`trade-pnl-chip ${trade.pnl >= 0 ? 'positive' : 'negative'}`}>
                                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                                    </span>
                                  ) : null}
                                  <small className="trade-hist-time">{new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                                </div>
                              </div>
                            );
                          }) : <p className="demo-empty-state">No fills yet.</p>}
                        </div>
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
                        <strong>{selectedCoin ? formatCurrency(Math.abs((orderBook.bids[0]?.price || 0) - (orderBook.asks[0]?.price || 0))) : formatCurrency(0)}</strong>
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
                              <td><button className="link-btn" type="button" onClick={() => openCoinWorkspace(coin.id)}>View</button></td>
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

            {marketTab === 'compare' && (
              <section className="panel-card comparison-panel">
                <div className="panel-header">
                  <h3>Coin comparison</h3>
                  <span>{comparedCoins.length} of 3 selected</span>
                </div>

                <div className="comparison-selectors">
                  {compareCoinIds.map((coinId, index) => (
                    <label className="comparison-select-field" key={`comparison-asset-${index}`}>
                      <span>Asset {index + 1}</span>
                      <select
                        aria-label={`Comparison asset ${index + 1}`}
                        value={coinId}
                        onChange={(event) => {
                          const nextCoinId = event.target.value;
                          setCompareCoinIds((current) => current.map((currentId, currentIndex) => (
                            currentIndex === index ? nextCoinId : currentId
                          )));
                        }}
                      >
                        <option value="">Choose an asset</option>
                        {coins.map((coin) => (
                          <option
                            key={coin.id}
                            value={coin.id}
                            disabled={compareCoinIds.some((selectedId, selectedIndex) => selectedIndex !== index && selectedId === coin.id)}
                          >
                            {coin.name} ({coin.symbol.toUpperCase()})
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {comparedCoins.length >= 2 ? (
                  <div className="comparison-table-wrap">
                    <table className="data-table comparison-table" aria-label="Coin market comparison">
                      <thead>
                        <tr>
                          <th scope="col">Metric</th>
                          {comparedCoins.map((coin) => (
                            <th scope="col" key={coin.id}>{coin.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {comparisonMetrics.map((metric) => (
                          <tr key={metric.label}>
                            <th scope="row">{metric.label}</th>
                            {comparedCoins.map((coin) => (
                              <td className={metric.className?.(coin) || ''} key={coin.id}>
                                {metric.value(coin)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    <h4>Choose at least two different assets</h4>
                    <p>Select assets above to compare their current market data.</p>
                  </div>
                )}
              </section>
            )}

            {marketTab === 'portfolio' && (
              <>
                <section className="portfolio-breakdown-grid">
                  <div className="panel-card portfolio-block">
                    <div className="panel-header">
                      <h3>Your Asset Mix</h3>
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
                      <h3>Your Portfolio Strategy</h3>
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

          <WatchlistSection
            selectedNav={selectedNav}
            watchlistCoins={watchlistCoins}
            setWatchlist={setWatchlist}
            user={user}
            setAuthOpen={setAuthOpen}
            getSafeCoinImage={getSafeCoinImage}
            formatCurrency={formatCurrency}
            formatPercent={formatPercent}
          />

          <section className={`portfolio-section ${selectedNav === 'Portfolio' ? 'section-active' : 'section-hidden'}`}>
            {!user ? (
              <div className="panel-card empty-state" style={{ padding: '3.5rem 2rem', textAlign: 'center', marginTop: '1rem' }}>
                <div className="empty-icon" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💼</div>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem' }}>Sign in to view Portfolio</h3>
                <p style={{ color: 'var(--muted)', maxWidth: '440px', margin: '0 auto 1.5rem auto' }}>
                  Log in to track your live holdings, asset allocation, portfolio intelligence, and open positions.
                </p>
                <button type="button" className="primary-btn" onClick={() => setAuthOpen(true)}>
                  Login now
                </button>
              </div>
            ) : (
              <>
                {/* ── Demo Portfolio Summary Banner ── */}
            <section className="panel-card demo-portfolio-banner" style={{ marginTop: '0.75rem' }}>
              <div className="demo-pf-banner-top">
                <div className="demo-pf-title-group">
                  <span className="sidebar-portfolio-live-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', display: 'inline-block', marginRight: 8 }} />
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{portfolio.positions.length ? 'Live Holdings' : 'Demo Portfolio'}</h3>
                </div>
                <div className="demo-pf-banner-actions">
                  {paperWallet.positions.length > 0 && (
                    <button type="button" className="ghost-btn small-btn" onClick={handleCloseAllPositions}>Close All</button>
                  )}
                  <button type="button" className="ghost-btn small-btn" onClick={handleResetDemoWallet} title="Reset demo wallet to $10,000">
                    ↺ Reset
                  </button>
                </div>
              </div>

              <div className="demo-pf-equity-row">
                <div className="demo-pf-stat">
                  <span>Total Equity</span>
                  <strong style={{ fontSize: '1.6rem', letterSpacing: '-0.02em' }}>{formatCurrency(effectivePortfolioSummary.totalValue)}</strong>
                </div>
                <div className="demo-pf-stat">
                  <span>Total P/L</span>
                  <strong className={effectivePortfolioSummary.change >= 0 ? 'positive' : 'negative'} style={{ fontSize: '1.2rem' }}>
                    {effectivePortfolioSummary.change >= 0 ? '+' : ''}{formatCurrency(effectivePortfolioSummary.change)}
                    <small style={{ fontSize: '0.8rem', marginLeft: 4, opacity: 0.8 }}>({effectivePortfolioSummary.changePercent >= 0 ? '+' : ''}{effectivePortfolioSummary.changePercent.toFixed(2)}%)</small>
                  </strong>
                </div>
                <div className="demo-pf-stat">
                  <span>Demo Cash</span>
                  <strong style={{ fontSize: '1.1rem' }}>{formatCurrency(effectivePortfolioSummary.cash)}</strong>
                </div>
                <div className="demo-pf-stat">
                  <span>Open P/L</span>
                  <strong className={effectivePortfolioSummary.unrealizedPnl >= 0 ? 'positive' : 'negative'} style={{ fontSize: '1.1rem' }}>
                    {effectivePortfolioSummary.unrealizedPnl >= 0 ? '+' : ''}{formatCurrency(effectivePortfolioSummary.unrealizedPnl || 0)}
                    {effectivePortfolioSummary.unrealizedPnlPercent !== 0 && (
                      <small style={{ fontSize: '0.75rem', marginLeft: 4, opacity: 0.8 }}>({effectivePortfolioSummary.unrealizedPnlPercent >= 0 ? '+' : ''}{(effectivePortfolioSummary.unrealizedPnlPercent || 0).toFixed(2)}%)</small>
                    )}
                  </strong>
                </div>
              </div>

              {/* Open Positions in Portfolio Tab */}
              {paperWallet.positions.length > 0 && (
                <div className="demo-pf-positions-list" style={{ marginTop: 16 }}>
                  <div className="demo-section-heading" style={{ marginBottom: 8 }}>
                    <strong>Live Positions</strong>
                    <span className="pos-count-badge">{paperWallet.positions.length}</span>
                  </div>
                  {paperWallet.positions.map((pos) => {
                    const positionCoin = coins.find((c) => c.id === pos.coinId);
                    const currentPrice = Number(positionCoin?.current_price || pos.averagePrice || 0);
                    const currentValue = Number(pos.amount) * currentPrice;
                    const costBasis = Number(pos.amount) * Number(pos.averagePrice || 0);
                    const unrealizedPnl = currentValue - costBasis;
                    const unrealizedPct = costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;
                    const isProfit = unrealizedPnl >= 0;
                    return (
                      <div key={pos.coinId} className={`live-position-card ${isProfit ? 'profit' : 'loss'}`}>
                        <div className="live-pos-header">
                          <div className="live-pos-meta">
                            <span className="live-pos-symbol">{pos.symbol.toUpperCase()}</span>
                            <span className="live-pos-amount">{Number(pos.amount).toFixed(6)} @ {formatCurrency(pos.averagePrice)}</span>
                          </div>
                          <span className={`pnl-pill ${isProfit ? 'positive' : 'negative'}`}>
                            {isProfit ? '▲ +' : '▼ '}{formatCurrency(unrealizedPnl)} ({isProfit ? '+' : ''}{unrealizedPct.toFixed(2)}%)
                          </span>
                        </div>
                        <div className="live-pos-stats-row">
                          <div className="live-pos-stat"><span>Entry</span><strong>{formatCurrency(pos.averagePrice)}</strong></div>
                          <div className="live-pos-stat"><span>Current</span><strong className={isProfit ? 'positive' : 'negative'}>{formatCurrency(currentPrice)}</strong></div>
                          <div className="live-pos-stat"><span>Value</span><strong>{formatCurrency(currentValue)}</strong></div>
                        </div>
                        <div className="live-pos-actions">
                          <button type="button" className="pos-action-btn view-btn" onClick={() => openCoinWorkspace(pos.coinId)}>📈 Chart</button>
                          <button type="button" className="pos-action-btn half-close-btn" onClick={() => handleClosePosition(pos.coinId, 50)}>½ Close</button>
                          <button type="button" className="pos-action-btn close-pos-btn" onClick={() => handleClosePosition(pos.coinId, 100)}>✕ Close</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="portfolio-spotlight-grid" style={{ marginTop: 16 }}>
                {portfolioBreakdown.map((item) => (
                  <div key={item.label} className="portfolio-holding-pill" style={{ borderColor: item.color }}>
                    <span className="holding-dot" style={{ background: item.color }} />
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.weight}% of portfolio</small>
                    </div>
                    <em>{item.value}</em>
                  </div>
                ))}
              </div>
            </section>

            <AllocationPanel
              title="Asset Mix"
              badge={paperWallet.positions.length > 0 ? `${paperWallet.positions.length} assets` : 'All Cash'}
              portfolioBreakdown={portfolioBreakdown}
              alertFeed={alertFeed}
              alertsCount={alerts.length}
              style={{ marginTop: '1.5rem' }}
            />


            <section className="panel-card" style={{ marginTop: '1.5rem' }}>
              <div className="panel-header">
                <h3>Portfolio Intelligence</h3>
                <span>{portfolioInsights.diversificationScore.toFixed(0)}/100</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                <div className="mini-stat">
                  <span>Diversification</span>
                  <strong>{portfolioInsights.diversificationScore.toFixed(1)}%</strong>
                </div>
                <div className="mini-stat">
                  <span>Concentration</span>
                  <strong className={portfolioInsights.concentrationRisk > 60 ? 'negative' : 'positive'}>
                    {portfolioInsights.concentrationRisk.toFixed(1)}%
                  </strong>
                </div>
                <div className="mini-stat">
                  <span>Top performer</span>
                  <strong>{portfolioInsights.topPerformer}</strong>
                </div>
              </div>

              <small style={{ display: 'block', marginTop: '1rem', color: 'var(--text-secondary)' }}>
                {portfolioInsights.rebalancingNote}
              </small>
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

            <PerformanceRiskGrid portfolioPerformance={portfolioPerformance} />
            <StrategyGrid strategyCards={strategyCards} />
              </>
            )}
          </section>

          {/* ── Trade History Section ── */}
          <TradeHistorySection
            selectedNav={selectedNav}
            transactions={transactions}
            paperWallet={paperWallet}
            tradeHistoryFilter={tradeHistoryFilter}
            setTradeHistoryFilter={setTradeHistoryFilter}
            user={user}
            setAuthOpen={setAuthOpen}
            formatCurrency={formatCurrency}
            setSelectedNav={setSelectedNav}
          />

        </main>
      </div>

      {authOpen && (
        <AuthModal
          authMode={authMode}
          setAuthMode={setAuthMode}
          authForm={authForm}
          setAuthForm={setAuthForm}
          authError={authError}
          handleAuthSubmit={handleAuthSubmit}
          handleDemoLogin={handleDemoLogin}
          onClose={() => setAuthOpen(false)}
        />
      )}

      {adminOpen && (
        <AdminModal
          adminForm={adminForm}
          setAdminForm={setAdminForm}
          adminError={adminError}
          adminLoading={adminLoading}
          handleAdminLogin={handleAdminLogin}
          onClose={() => setAdminOpen(false)}
        />
      )}

      {adminPanel && (
        <AdminPanel
          adminStats={adminStats}
          adminUsers={adminUsers}
          adminLoading={adminLoading}
          adminSelectedUser={adminSelectedUser}
          setAdminSelectedUser={setAdminSelectedUser}
          handleAdminRefresh={handleAdminRefresh}
          handleAdminLogout={handleAdminLogout}
        />
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

