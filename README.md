# SalonBook Server

SalonBook's REST API for service management, appointment requests, role-based access, customer accounts, and payments.

## Technology stack

Node.js, Express, MongoDB, Better Auth, JWT, Stripe Checkout, and ImgBB.

## Local setup

1. Copy `.env.example` to `.env` and fill in your own credentials. Use long, unique values for both secrets.
2. Run `npm install`.
3. Run `npm run seed` to add starter services. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` first if you want the script to create the evaluation admin.
4. Run `npm run dev`.

## Required environment variables

`PORT`, `NODE_ENV`, `CLIENT_URL`, `MONGODB_URI`, `DB_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `IMGBB_API_KEY`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

Never commit `.env` or live credentials.

## API

- `GET /api/health` — health check
- `/api/services` — public service catalogue and admin management
- `/api/appointments` — customer and admin appointment actions
- `/api/transactions` — payment history
- `/api/webhooks/stripe` — verified Stripe payment events

## Live website and repositories

To be added after deployment.
