# SARH Orders Console

A full-stack order management application built with React, Node.js, Express, Prisma, and PostgreSQL.

## Features

- JWT-protected authentication and role-based authorization.
- Server-side order search, status filtering, sorting, and pagination.
- Order creation with one to five line items.
- Server-calculated order totals.
- Idempotent order creation backed by a database unique constraint.
- Seeded users and a large dataset for testing.

## Requirements

- Node.js and npm.
- PostgreSQL.
- Two terminals to run the backend and frontend locally.

## Configuration

### Backend

Create `backend/.env` using the environment variable names expected by the backend configuration:

```env
DATABASE_URL="postgresql://YOUR_DB_USER@localhost:5432/sarh_orders"
JWT_SECRET="REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS"
PORT=4000
FRONTEND_URL="http://localhost:5173"
```

Adjust the database username, host, and connection settings for your local PostgreSQL installation. Do not commit real secrets.

Generate a secret locally if needed:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Create the `sarh_orders` database before running migrations.

### Frontend

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:4000/api
```

Do not put server secrets in frontend environment variables.

## Install and Run

Open a terminal for the backend:

```bash
cd backend
npm install
npx prisma migrate dev
npx prisma generate
npm run seed
npm run dev
```

Use the actual seed script name defined in `backend/package.json` if it differs from `npm run seed`.

Open a second terminal for the frontend:

```bash
cd frontend
npm install
npm run dev
```

Open the local Vite URL printed in the terminal, normally `http://localhost:5173`.

## Demo Accounts

The seed creates an administrator and an agent. Credentials are configured through the seed environment variables or the documented development defaults. Change default passwords before any shared or production deployment.

## Testing

Run backend tests:

```bash
cd backend
npm test
```

The order creation tests should verify validation, unauthenticated access rejection, idempotency-key conflict behavior, and concurrent duplicate requests.

For the concurrency scenario, send two identical create requests simultaneously with the same idempotency key and verify that only one order exists in the database.

## API Overview

- `POST /api/auth/login` — authenticate a user.
- `GET /api/orders` — list orders with supported search, filtering, sorting, and pagination.
- `POST /api/orders` — create an order using a valid access token and an `Idempotency-Key` header.

Protected endpoints require:

```http
Authorization: Bearer <access-token>
```

Check the backend route schemas for the exact accepted query parameters and request payload.


## Architecture and Trade-offs

See `DECISIONS.md` for the main implementation decisions and `SCALE.md` for the proposed evolution toward five million orders.

## AI Assistance

AI assistance was used to write README and DECISIONS.