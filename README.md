# BitNexa

BitNexa is a cryptocurrency market tracking and analytics platform built with a React frontend and an Express backend.

## Current milestone

This branch includes the first professional production-style checkpoint for the platform:

- secure API foundation with Helmet and rate limiting
- authenticated portfolio and watchlist APIs
- Swagger documentation for the backend
- Docker and CI configuration for deployment readiness

## Project Structure

- frontend: React application
- backend: Express application
- .github/workflows: CI pipeline
- Dockerfile: container definition
- README.md: project documentation

## Getting Started

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at http://localhost:5173.

### Backend

```bash
cd backend
npm install
npm run dev
```

The API will be available at http://localhost:5001.

### Health Check

```bash
curl http://localhost:5001/api/health
```

### Swagger docs

```bash
http://localhost:5001/api/docs
```

## Tech Stack

- React
- Vite
- Express
- Node.js
- Helmet
- CORS
- JWT auth
- Swagger
- Docker
- GitHub Actions

## License

This project is currently under development.