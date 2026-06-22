# YOSO Creator Platform

YOSO replaces the manual LinkedIn creator workflow with a role-safe operations and payments platform. “Reach isn't luck. It's engineered.”

## Run locally

1. Create a Supabase project, then paste [db/schema.sql](db/schema.sql) into **SQL Editor** and run it. In Supabase Auth, enable Google sign-in.
2. Copy `frontend/.env.example` to `frontend/.env`, and `backend/.env.example` to `backend/.env`. Fill every relevant value.
3. In two terminals: `cd backend && npm install && npm run dev`, then `cd frontend && npm install && npm run dev`.
4. Optional sample data: `cd backend && npm run seed`.

The frontend includes a clearly labelled role preview for local UI evaluation. Real roles always come from verified Supabase Google sessions at the API.

### Supabase Google OAuth URLs

In Supabase **Authentication → URL Configuration**, set the Site URL to the Vercel production URL and add both the Vercel production URL and `http://localhost:5173` to Redirect URLs. The app sends Google back to its current origin, completes the OAuth code exchange, and then requests `/me` with the resulting Supabase access token. Personal email addresses are accepted: known emails receive their staff role, while new emails become creators and complete onboarding.

## Security model

- Creators can only fetch and mutate their own profile, tasks, and invoices.
- Account managers have operations-only routes. The API has no invoice, payment, approval, or money-dashboard route available to them.
- Rates are accepted only by the admin rate endpoint. Creator update bodies use an allowlist that excludes rate fields.
- A null rate produces a null invoice amount; payment export only contains approved, unpaid rows with amounts.
- Postgres RLS in the schema repeats these restrictions as a second line of defence.

## Deploy

Deploy `frontend/` to Vercel and set its `VITE_*` variables. Deploy `backend/` to Railway, add all backend variables, and keep the service always on: it runs task expiry, post close, and payment reminder jobs. Set `FRONTEND_URL` on Railway to the Vercel origin. Do not place `ANTHROPIC_API_KEY`, Drive credentials, VAPID private key, or Supabase service-role key in the frontend.

Create a Google service account, share the Drive parent folder with it, then provide `GOOGLE_DRIVE_PARENT_FOLDER_ID` and base64-encoded `GOOGLE_SERVICE_ACCOUNT_JSON`. Configure Slack and email for after-the-10th reminders. Generate VAPID keys, with the public key in both environments and private key only on the backend.

## Integration notes

The backend has explicit integration boundaries for Drive, push/email/Slack, and Claude. Their failure mode is manual review rather than blocking an invoice or task flow. Before production, complete the marked provider adapters and set up the monthly Drive folder creation implementation for the supplied service account.
