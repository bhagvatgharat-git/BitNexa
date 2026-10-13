# ⚡ BitNexa — Cryptocurrency Tracker & Demo Trading Platform

> Institutional-grade cryptocurrency market tracking, real-time charts, portfolio risk analytics, and beginner-friendly spot demo trading.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bitnexabg.vercel.app-00f2fe?style=flat&logo=vercel&logoColor=white)](https://bitnexabg.vercel.app/)
[![BitNexa CI](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml/badge.svg)](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/react-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🌐 **Live Website**: [https://bitnexabg.vercel.app/](https://bitnexabg.vercel.app/)

---

## 📌 About BitNexa

**BitNexa** is a modern, responsive cryptocurrency terminal designed for both crypto beginners and active market observers. It combines live market data from CoinGecko and Binance Spot with a zero-risk simulated demo-trading desk, real-time price alerts, and automated portfolio intelligence.

---

## ✨ Features

- **📊 Market Overview & Tracker**:
  - Live price tracking for 50+ cryptocurrencies with multi-currency fiat support (USD, EUR, INR, GBP, JPY, CAD, AUD).
  - 24-hour volume, price changes, global market cap, and top gainers & losers movers grid.
  - Fast search box and filter categories (All, Top 10, DeFi, Layer 1, Metaverse).

- **📈 Interactive Charts & Deep Coin Metrics**:
  - Multi-timeframe historical charts (24H, 7D, 30D, 90D, 1Y) with volume overlays.
  - High-frequency Binance candlestick charts for live intraday price movement.
  - Deep coin metrics: All-Time High (ATH), 24h High/Low, circulating supply, volume, dominance, and market rank.

- **🎮 Spot Demo Trading Desk**:
  - Zero-risk sandbox with $10,000 initial virtual cash.
  - Buy and Sell cryptocurrencies with automatic balance and holdings validation.
  - Real-time estimated transaction quote and 0.1% exchange fee calculation.
  - Instant order fills with realized profit/loss calculations.
  - Reset demo cash anytime with a single click.

- **💼 User-Isolated Portfolio & Intelligence**:
  - Strict privacy: portfolio holdings and trade history are protected behind authentication.
  - Per-user isolated storage ensuring clean slate for new users and zero cross-user data leakage.
  - Automated diversification score (0–100), concentration risk index, and asset allocation breakdown.

- **📋 Searchable Transaction History**:
  - Detailed audit log of all executed orders: coin, side (Buy/Sell), filled quantity, execution price, fee, and timestamp.
  - Search trades instantly by coin name or ticker symbol.
  - Filter by All, Buys, or Sells.

- **🔔 Watchlist & Live Price Alerts**:
  - Pin favorite assets to a personalized watchlist saved across sessions.
  - Set custom target price alerts (above or below specified levels).
  - Real-time price trigger monitor that fires toast notifications when target levels are reached.

- **🔐 Security & Access**:
  - JWT authentication with secure password hashing.
  - Native browser password manager autofill support.
  - Secret Easter-egg Admin Control Panel with system health metrics and user management.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite, Chart.js, Vanilla CSS (modular design system with dark navy theme and glassmorphism)
- **Backend**: Node.js, Express, Helmet, Rate Limiter, MongoDB (with automatic in-memory fallback for zero-config runs)
- **APIs**: CoinGecko API & Binance Spot API

---

## 🚀 Getting Started (Windows PowerShell)

Run these commands in Windows PowerShell:

```powershell
# 1. Clone the repository
git clone https://github.com/bhagvatgharat-git/BitNexa.git
cd BitNexa

# 2. Install dependencies for root, backend, and frontend
npm install
npm --prefix backend install
npm --prefix frontend install

# 3. Start development server (runs both backend and frontend concurrently)
npm run dev
```

The frontend will start at `http://localhost:5173` and the backend will start at `http://localhost:5001`.

---

## 🧪 Testing & Verification

Run the test suites and production build:

```powershell
# Run backend test suite (14 automated API tests)
npm --prefix backend test

# Validate frontend production bundle
npm --prefix frontend run build
```

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built with ❤️ by [Bhagvat Gharat](https://github.com/bhagvatgharat-git).