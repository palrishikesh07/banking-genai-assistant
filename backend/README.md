# Banking GenAI backend starter

Express + TypeScript + PostgreSQL + Prisma 6. Includes signup/login/logout, cookie JWT auth, conversations, AI demo endpoint, AI usage tracking, per-user usage reports, admin aggregate reports and audit events. Policy evidence is fictional.

## Setup
1. Copy `.env.example` to `.env` and set your real local PostgreSQL password in `DATABASE_URL`.
2. Ensure the database `banking_genai` exists.
3. Run `npm install`, `npx prisma generate`, `npx prisma migrate dev --name init`, `npm run typecheck`, `npm run dev`.
4. Test `http://localhost:8000/api/health`.

If your existing project has a Prisma 7/8 `prisma.config.ts`, don't copy it into this Prisma 6 starter. Back up existing files before merging.

## Routes
- POST `/api/auth/signup` `{email,password}` (password 12+ characters)
- POST `/api/auth/login`, POST `/api/auth/logout`, GET `/api/auth/me`
- POST `/api/ai/ask` `{question,conversationId?}`
- GET/POST `/api/conversations`, GET/DELETE `/api/conversations/:id`
- GET `/api/usage/me`
- GET `/api/usage/me/requests?page=1&pageSize=20`
- GET `/api/usage/me/summary?from=ISO_DATE&to=ISO_DATE`
- GET `/api/usage/admin` (admin role required)

`AIUsage` records are created as PENDING before the AI call and updated to SUCCESS or FAILED. Offline mode reports zero tokens because no provider token metrics exist. Cost estimates are only meaningful when the `.env` per-million token pricing values are set from current provider pricing.

## Production caveats
This is a learning POC, not production banking software. Add CSRF protection for cookie-authenticated mutations, server-side session revocation, email verification, password reset, MFA, document ACL-aware RAG, robust retrieval/citation validation, timeouts/retries/idempotency, tests, retention controls, structured monitoring and backups. Never use real customer banking data until reviewed and secured.
