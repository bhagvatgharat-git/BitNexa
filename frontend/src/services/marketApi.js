const API_PORT_CANDIDATES = [5000, 5001, 5002, 5003, 5004, 5005, 5006];
let cachedApiBaseUrl = null;

async function resolveApiBaseUrl() {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  const configured = import.meta.env.VITE_API_URL;
  if (configured) {
    cachedApiBaseUrl = configured;
    return cachedApiBaseUrl;
  }

  for (const port of API_PORT_CANDIDATES) {
    try {
      const response = await fetch(`http://localhost:${port}/api/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        cachedApiBaseUrl = `http://localhost:${port}`;
        return cachedApiBaseUrl;
      }
    } catch {
      // Try the next port.
    }
  }

  cachedApiBaseUrl = 'http://localhost:5001';
  return cachedApiBaseUrl;
}

async function request(path, options = {}) {
  const apiBaseUrl = await resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}${path}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || 'Request failed.');
  }

  return response.json();
}

export const marketApi = {
  getMarket(ids = []) {
    const query = Array.isArray(ids) && ids.length ? ids.join(',') : '';
    return request(`/api/market${query ? `?ids=${encodeURIComponent(query)}` : ''}`);
  },
  getOverview(ids = []) {
    const query = Array.isArray(ids) && ids.length ? ids.join(',') : '';
    return request(`/api/overview${query ? `?ids=${encodeURIComponent(query)}` : ''}`);
  },
  getChart(id, days = 7) {
    return request(`/api/chart/${encodeURIComponent(id)}?days=${days}`);
  },
  getOhlc(id, days = 7) {
    return request(`/api/ohlc/${encodeURIComponent(id)}?days=${days}`);
  },
  getTrending() {
    return request('/api/trending');
  },
  getCoin(id) {
    return request(`/api/coin/${encodeURIComponent(id)}`);
  },
  placeTrade(payload) {
    return request('/api/trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },
  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },
  getWatchlist(token) {
    return request('/api/watchlist', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  },
  saveWatchlist(token, coinIds) {
    return request('/api/watchlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ coinIds }),
    });
  },
  getPortfolio(token) {
    return request('/api/portfolio', {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  },
  savePortfolio(token, entry) {
    return request('/api/portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(entry),
    });
  },
};

export default marketApi;
