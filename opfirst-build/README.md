# OpFirst PMS — Operational-First Property Management System
### MVP v1.2 Beta

Full-stack property management system. Express backend + PGlite in-memory Postgres + React frontend. Zero config, runs instantly.

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3000
```

## Deploy to Render (free, persistent URL)
1. Push folder to GitHub
2. render.com → New Web Service → connect repo
3. Build: `npm install` | Start: `npm start`
4. Live in 2 minutes

## Switch to real Postgres (production)
In server.js, swap PGlite for pg Pool and set DATABASE_URL env var.
All SQL is standard Postgres — nothing else changes.

## API
GET/POST/PUT/DELETE on: /api/units /api/tenants /api/leases /api/payments /api/tickets /api/vendors
GET /api/dashboard — aggregated stats
POST /api/tickets/:id/message — add to message thread
