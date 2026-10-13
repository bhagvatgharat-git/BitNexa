# ⚡ BitNexa

> Institutional-grade cryptocurrency market tracking, portfolio analytics, and paper trading platform.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bitnexabg.vercel.app-00f2fe?style=flat&logo=vercel&logoColor=white)](https://bitnexabg.vercel.app/)
[![BitNexa CI](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml/badge.svg)](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/react-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🌐 **Live Demo**: [https://bitnexabg.vercel.app/](https://bitnexabg.vercel.app/)

---

## 📌 About BitNexa

**BitNexa** is a modern cryptocurrency terminal that provides real-time market data, interactive candlestick charts, risk-scored portfolio analytics, and a simulated paper trading sandbox.

---

## ✨ Features

- **📊 Real-Time Market Data**: Live tracking for 50+ cryptocurrencies with multi-currency fiat support (USD, EUR, INR, GBP, etc.).
- **📈 Interactive Candlestick Charts**: High-frequency intraday intervals (15s to 5m via Binance) and historical macro trends with indicators.
- **🎮 Paper Trading Simulator**: Zero-risk sandbox with $10,000 virtual balance, Long/Short orders, 0.1% fees, and real-time PnL.
- **💼 Portfolio Intelligence**: Automated diversification score (0–100), concentration risk index, and asset allocation breakdown.
- **🔔 Price Alerts & Watchlist**: Custom price threshold alerts and personalized watchlist.
- **🛡️ Secure Backend**: Built with Helmet security headers, rate limiting, and JWT authentication.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Chart.js, Lightweight Charts, Vanilla CSS
- **Backend**: Node.js, Express, MongoDB (with automatic in-memory fallback)
- **External Data**: CoinGecko API & Binance Spot API

---

## 🚀 Getting Started

```bash
# 1. Clone repository
git clone https://github.com/bhagvatgharat-git/BitNexa.git
cd BitNexa

# 2. Install dependencies
npm install && npm install --prefix backend && npm install --prefix frontend

# 3. Start development
npm run dev
```

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built by [Bhagvat Gharat](https://github.com/bhagvatgharat-git).