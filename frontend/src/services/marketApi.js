let cachedBaseUrl = null;

async function resolveBaseUrl() {
  if (cachedBaseUrl !== null) return cachedBaseUrl;
  const configured = import.meta.env.VITE_API_URL;
  if (configured) return (cachedBaseUrl = configured.replace(/\/$/, ''));
  if (typeof window !== 'undefined') {
    return (cachedBaseUrl = '');
  }
  return (cachedBaseUrl = 'http://localhost:5001');
}

async function request(path, options = {}, retries = 2) {
  const baseUrl = await resolveBaseUrl();
  const url = `${baseUrl}${path}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429 && attempt < retries) {
          await new Promise((res) => setTimeout(res, 800 * (attempt + 1)));
          continue;
        }
        const errorText = await response.text();
        throw new Error(errorText || `Request failed with status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      if (attempt < retries && !options?.signal?.aborted) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

const authHeader = (token) => (token ? { Authorization: `Bearer ${token}` } : {});
const jsonHeaders = (token) => ({ 'Content-Type': 'application/json', Accept: 'application/json', ...authHeader(token) });
const getHeaders = (token) => ({ Accept: 'application/json', ...authHeader(token) });

export const marketApi = {
  getCurrencyRates: () => request('/api/exchange-rates'),
  getBinanceStatus: () => request('/api/binance/status'),
  getBinanceAccount: (token) => request('/api/binance/account', { headers: getHeaders(token) }),
  placeBinanceOrder: (token, entry) => request('/api/binance/order', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(entry) }),
  getMarket: (ids = []) => request(`/api/market${Array.isArray(ids) && ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''}`),
  getOverview: (ids = []) => request(`/api/overview${Array.isArray(ids) && ids.length ? `?ids=${encodeURIComponent(ids.join(','))}` : ''}`),
  getChart: (id, days = 7) => request(`/api/chart/${encodeURIComponent(id)}?days=${days}`),
  getOhlc: (id, days = 7) => request(`/api/ohlc/${encodeURIComponent(id)}?days=${days}`),
  getBinanceKlines: (symbol, interval) => request(`/api/binance/klines/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}`),
  getTrending: () => request('/api/trending'),
  getCoin: (id) => request(`/api/coin/${encodeURIComponent(id)}`),
  placeTrade: (payload) => request('/api/trade', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) }),
  register: (payload) => request('/api/auth/register', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) }),
  login: (payload) => request('/api/auth/login', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) }),
  getWatchlist: (token) => request('/api/watchlist', { headers: getHeaders(token) }),
  saveWatchlist: (token, coinIds) => request('/api/watchlist', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify({ coinIds }) }),
  getPortfolio: (token) => request('/api/portfolio', { headers: getHeaders(token) }),
  getPortfolioSummary: (token) => request('/api/portfolio/summary', { headers: getHeaders(token) }),
  getPortfolioInsights: (token) => request('/api/portfolio/insights', { headers: getHeaders(token) }),
  savePortfolio: (token, entry) => request('/api/portfolio', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(entry) }),
  getTransactions: (token) => request('/api/transactions', { headers: getHeaders(token) }),
  saveTransaction: (token, entry) => request('/api/transactions', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(entry) }),
  getAlerts: (token) => request('/api/alerts', { headers: getHeaders(token) }),
  saveAlert: (token, entry) => request('/api/alerts', { method: 'POST', headers: jsonHeaders(token), body: JSON.stringify(entry) }),
  adminLogin: (payload) => request('/api/admin/login', { method: 'POST', headers: jsonHeaders(), body: JSON.stringify(payload) }),
  getAdminUsers: (token) => request('/api/admin/users', { headers: getHeaders(token) }),
  getAdminStats: (token) => request('/api/admin/stats', { headers: getHeaders(token) }),
};

export default marketApi;
