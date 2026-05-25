# NicheFinder - App Store Opportunity Search

Find niche app opportunities on the Google Play Store: apps with high downloads but poor ratings, solo developer gems, profitable niches, and trending categories.

## Quick Start

```bash
npm run install:all
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Tech Stack

- **Frontend**: React + Vite, Material UI, React Router
- **Backend**: Node.js + Express, google-play-scraper
- **Database**: SQLite (via sql.js, zero native deps)

## SaaS Finder

Browse a catalogue of SaaS/micro-SaaS products with opportunity scoring. Optional env var for Product Hunt sync:

```bash
# server/.env (optional — copy from server/.env.example)
PRODUCT_HUNT_API_KEY=your_api_key
PRODUCT_HUNT_API_SECRET=your_api_secret
```

The server exchanges these for a bearer token automatically (OAuth client credentials).
