# Banking GenAI Assistant — React frontend

## Folder structure
`src/app` route configuration and route guards; `src/components` shared layout; `src/features` auth, chat, history and usage pages; `src/lib` API client and shared types.

## Run
```bash
cp .env.example .env
npm install
npm run dev
```
Open http://localhost:5173. Start the backend on http://localhost:8000 first.

Set `VITE_API_BASE_URL=http://localhost:8000/api`. Backend CORS must allow `http://localhost:5173` and credentials. The frontend expects cookie-based auth and the endpoints `/auth/signup`, `/auth/login`, `/auth/logout`, `/auth/me`, `/ai/ask`, `/conversations`, `/conversations/:id`, `/usage/me`, and `/usage/admin`.

If your backend response envelopes differ, adjust the relevant API response types in the feature files. This is a demo frontend, not a production banking UI; ensure CSRF protections and secure cookie settings on the backend.
