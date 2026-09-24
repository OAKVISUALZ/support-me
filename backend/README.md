# SupportMe Backend

This backend is a lightweight API layer for the SupportMe application.
It is built with TypeScript, Express, and Prisma, and is designed to support creator profiles, donations, and backend-driven dashboards.

## Features

- REST API for creators and donations
- PostgreSQL-compatible Prisma schema
- Local development server with hot reload
- Clear extension points for contributors

## Getting Started

1. Install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Create a `.env` from the example:
   ```bash
   cp .env.example .env
   ```

3. Set your database URL in `.env`.

4. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```

5. Run the backend in development mode:
   ```bash
   npm run dev
   ```

6. Visit the health check:
   ```bash
   http://localhost:4000/health
   ```

## API Endpoints

- `GET /health`
- `GET /api/creators`
- `POST /api/creators`
- `GET /api/creators/:username`
- `PUT /api/creators/:username`
- `GET /api/donations?creatorUsername={username}&page=1&limit=20`
- `POST /api/donations` (requires an `Idempotency-Key` header)

Donation history responses contain `items` and `pagination`. `limit` defaults to
20 and is capped at 100. Use `page` to request older pages. Recording the same
on-chain donation again with the same `Idempotency-Key` returns the original
donation without inserting another row. Keys are retained for 24 hours.

`GET /health` reports `status: "ok"` when the process and Soroban RPC are
available, and `status: "degraded"` with `dependencies.sorobanRpc.status:
"down"` when the RPC probe fails. The probe calls `getLatestLedger` and times
out after 1.5 seconds.

## Notes for Contributors

- The backend is intentionally simple so contributors can add authentication, payment workflows, and dashboard queries.
- There is no contract dependency for this API layer.
- If you add a new database model, update `prisma/schema.prisma` and run `npm run prisma:generate`.
