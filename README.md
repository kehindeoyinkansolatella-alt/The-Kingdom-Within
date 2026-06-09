# The Kingdom Within

Membership / community web app - sessions, attendance, paid memberships, and a member dashboard.

## Tech stack
- Node.js + Express backend
- Static frontend under `public/` (vanilla JavaScript)
- File-based JSON store: `kingdom.json` (managed by `database.js`)
- Stripe Checkout for payments and subscriptions
- Nodemailer for email notifications

## Quickstart (development)
1. Install dependencies:

```bash
cd /Users/oyinkansolatella/kingdom-within
npm install
```

2. Create a `.env` file or set environment variables (minimum required):

- `JWT_SECRET` — any long secret for signing JWTs
- `STRIPE_SECRET` — your Stripe secret key
- `STRIPE_PUBLISHABLE` — Stripe publishable key (used on frontend)
- `STRIPE_WEBHOOK_SECRET` — webhook signing secret (for `/api/stripe/webhook`)
- `GMAIL_USER` — optional, for sending emails via Gmail
- `GMAIL_APP_PASSWORD` — optional, app password for Gmail SMTP
- `PORT` — optional (defaults to `3000`)

Example `.env` (do not commit):

```
JWT_SECRET=supersecretvalue
STRIPE_SECRET=sk_test_...
STRIPE_PUBLISHABLE=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
GMAIL_USER=you@example.com
GMAIL_APP_PASSWORD=app_password_here
PORT=3000
```

3. Start the server:

```bash
node server.js
# Server listens on http://localhost:3000 by default
```

4. Open the dashboard in your browser:

```
http://localhost:3000/public/dashboard.html
```

## Important files
- `server.js` — Express app, API routes, auth middleware, scheduler
- `database.js` — file I/O and helper functions for `kingdom.json`
- `kingdom.json` — persistent store (contains `users`, `sessions`, `attendance`)
- `mailer.js` — email templates and sending helpers
- `public/js/auth.js` — signup/login flows
- `public/js/dashboard.js` — dashboard UI logic and API calls
- `project.xrd` — project descriptor (developer summary)

## API overview
- `POST /api/auth/register` — register user (returns JWT)
- `POST /api/auth/login` — login (returns JWT)
- `GET /api/auth/me` — current user (requires Authorization header)
- `GET /api/sessions` — list sessions
- `POST /api/attendance/:sessionId` — register attendance (auth)
- `GET /api/attendance` — get current user's attendance (auth)
- `POST /api/checkout` — create Stripe Checkout session
- `POST /api/stripe/webhook` — Stripe webhook endpoint

## Development notes & recommendations
- The project uses a single-file JSON store (`kingdom.json`) — this is fine for prototypes but not safe under concurrent writes. Plan to migrate to SQLite/Postgres for production.
- Keep secrets out of the repo. Use a `.env` file locally and a secrets manager in production.
- To test Stripe webhooks locally, use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

- Mailer requires `GMAIL_USER` and `GMAIL_APP_PASSWORD` (or another SMTP configuration). If not provided, mail sending is skipped.

## QA checklist
- Register a test user via `/api/auth/register` and confirm JWT returned.
- Login and confirm `kw_token` stored in local storage and API-accessible endpoints return 200.
- Create a Checkout session and verify webhook handling using Stripe CLI.
- Register attendance for an existing session and confirm `kingdom.json.attendance` updated.

## Contributing
- Create branches off `main`. Open PRs with clear descriptions of changes and testing steps.

## License
MIT

---
Repository: https://github.com/kehindeoyinkansolatella-alt/The-Kingdom-Within
