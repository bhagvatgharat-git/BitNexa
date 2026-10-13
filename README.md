# ⚡ BitNexa

> Institutional-grade cryptocurrency market tracking, portfolio analytics, and paper trading platform.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-bitnexabg.vercel.app-00f2fe?style=flat&logo=vercel&logoColor=white)](https://bitnexabg.vercel.app/)
[![BitNexa CI](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml/badge.svg)](https://github.com/bhagvatgharat-git/BitNexa/actions/workflows/ci.yml)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/express-4.21-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Swagger](https://img.shields.io/badge/swagger-OpenAPI%203.0-85EA2D?logo=swagger&logoColor=black)](http://localhost:5001/api/docs)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

🌐 **Live Deployment**: [https://bitnexabg.vercel.app/](https://bitnexabg.vercel.app/)

---

## 📌 Overview

**BitNexa** is a modern full-stack crypto intelligence platform built with **React 18, Vite, Express, and MongoDB** (with automatic in-memory fallback). It delivers live asset prices, intraday candlestick charts, portfolio risk analysis, and a zero-risk paper trading simulator.

## ✨ Core Features

- **📊 Live Market Data**: Real-time prices, 24h volume, and stats for 50+ coins with multi-currency conversion (**USD, EUR, GBP, INR, JPY, CAD, AUD**).
- **📈 Advanced Interactive Charts**: Intraday Binance klines (**15s, 20s, 1m, 2m, 3m, 5m**) and macro trends (**24h to 1y**) with zoom & indicators.
- **🎮 Paper Trading Simulator**: Zero-risk trading sandbox with **$10,000 virtual cash**, Long/Short orders, 0.1% fees, and real-time PnL tracking.
- **💼 Smart Portfolio Analytics**: Track holdings with automated **Diversification Score (0–100)**, concentration risk alerts, and rebalance suggestions.
- **🔔 Price Alerts & Watchlist**: Set custom price targets with automated trigger evaluation and in-app notifications.
- **🛡️ Enterprise Security**: Hardened with **Helmet**, **express-rate-limit**, JWT auth, SHA-256 passwords, and local-only Binance execution guards.
- **📑 OpenAPI / Swagger UI**: Built-in interactive API documentation at `/api/docs`.

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, Chart.js, Lightweight Charts, Vanilla CSS
- **Backend**: Node.js, Express 4, Helmet, JWT, Swagger
- **Storage**: MongoDB (Mongoose 8) with automatic in-memory fallback
- **APIs**: CoinGecko API & Binance Spot API

## 🚀 Quick Start

### 1. Install & Setup
```bash
git clone https://github.com/bhagvatgharat-git/BitNexa.git
cd BitNexa
npm install && npm install --prefix backend && npm install --prefix frontend
cp backend/.env.example backend/.env
```

### 2. Run Development Server
```bash
npm run dev
```

- **Frontend Client**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:5001](http://localhost:5001)
- **Swagger Docs**: [http://localhost:5001/api/docs](http://localhost:5001/api/docs)
- **Health Check**: [http://localhost:5001/api/health](http://localhost:5001/api/health)

## ⚙️ Key Environment Variables

| Variable | Default | Purpose |
| :--- | :--- | :--- |
| `PORT` | `5001` | Express API port |
| `JWT_SECRET` | `bitnexa-demo-secret` | JWT signing secret |
| `MONGODB_URI` | `mongodb://localhost:27017/bitnexa` | MongoDB connection (omit to use in-memory store) |
| `COINGECKO_API_KEY` | *(optional)* | CoinGecko API key |
| `BINANCE_BASE_URL` | `https://testnet.binance.vision` | Binance endpoint (`https://api.binance.com` for prod) |

## 🔌 API Summary

- `GET  /api/health` — Service health check
- `POST /api/auth/register` & `POST /api/auth/login` — Authentication
- `GET  /api/market` & `GET /api/overview` — Market data & global stats
- `GET  /api/exchange-rates` — Live fiat conversion rates
- `GET  /api/binance/klines/:symbol` — Intraday candlestick data
- `GET  /api/portfolio` & `GET /api/portfolio/insights` — Portfolio & risk score
- `GET  /api/watchlist` & `POST /api/watchlist` — User watchlist
- `GET  /api/alerts` & `POST /api/alerts` — Target price alerts

## 🧪 Testing & Deployment

```bash
npm test        # Run backend test suite (14 passing tests)
npm run build   # Build frontend for production
```

- **Vercel (Live)**: Deployed at [https://bitnexabg.vercel.app/](https://bitnexabg.vercel.app/) via `vercel.json` and `api/index.js`.
- **VPS/Docker**: Serve `frontend/dist` with Nginx and run `backend/server.js` with PM2.

## 📄 License

Distributed under the [MIT License](LICENSE). Built by [Bhagvat Gharat](https://github.com/bhagvatgharat-git).