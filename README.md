# SalonBook Server

SalonBook's REST API provides service management, appointment booking, role-based access, customer administration, and Stripe payment handling.

## Features

- Better Auth email/password and optional Google authentication with MongoDB
- Short-lived JWT access cookie verified on every protected API request
- Server-side customer/admin role checks and blocked-account checks
- Service catalogue search, category filtering, sorting, and admin CRUD
- Appointment availability, conflict prevention, status management, and customer isolation
- ImgBB uploads with supported-image and size validation
- Stripe Checkout and signature-verified webhook transaction processing
- Health endpoint, request limits, secure headers, and database indexes

## Technology

Node.js, Express, MongoDB, Better Auth, JWT, Stripe Checkout, and ImgBB.

## Run locally

1. Copy `.env.example` to `.env` and fill in your own credentials. Use long, unique values for `BETTER_AUTH_SECRET` and `JWT_SECRET`.
2. Install dependencies with `npm install`.
3. Run `npm run seed` to add starter services. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` if the script should create the evaluator admin account.
4. Start the API with `npm run dev`; the health check is `http://localhost:5000/api/health`.
5. Run `npm test` for validation tests.

## Environment variables

`PORT`, `NODE_ENV`, `CLIENT_URL`, `MONGODB_URI`, `DB_NAME`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `IMGBB_API_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.

Set a Stripe webhook endpoint to `POST /api/webhooks/stripe` and subscribe to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. Configure production origins and HTTPS before deployment. Never commit `.env` or live credentials.

## API overview

- `GET /api/health` — health check
- `/api/services` — public catalogue and admin service management
- `/api/availability` — available appointment slots for a date and service
- `/api/appointments` — customer booking and admin appointment actions
- `/api/admin/*` — protected administration endpoints
- `/api/customer/*` — customer dashboard endpoints
- `/api/transactions` — role-scoped payment history
- `/api/webhooks/stripe` — signature-verified payment events

## Deployment and submission links

- Live website: add after deployment
- Client repository: add after creating/pushing the GitHub repository
- Server repository: add after creating/pushing the GitHub repository
