<!-- generated-by: gsd-doc-writer -->
# bengaluru-walkability-frontend

Next.js 14 (App Router) PWA and admin dashboard for the Bengaluru Walkability Public Audit. Citizens use this interface to photograph and geolocate subpar pedestrian infrastructure; admins manage submitted reports through a separate protected section.

Part of the [bengaluru-walkability-public-audit](../README.md) monorepo.

---

## Quick Start

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set env vars (see below)
npm run dev                         # http://localhost:3000
```

---

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Dev server on `0.0.0.0:3000` (hot reload) |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run lint` | ESLint (next lint) |
| `npm test` | Run all tests (Jest, passes with no tests) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage report |

---

## Environment Variables

All env-based configuration is centralized in `app/lib/config.ts`. Never use `process.env.*` directly in component files.

| Variable | When to set | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Local dev and staging | Client-side base URL for public endpoints (report submission, map). Set to the Rust backend URL (e.g. `http://localhost:3001`). Leave empty in Docker — nginx proxies requests and relative URLs work. |
| `INTERNAL_API_URL` | Local dev, Docker, staging | Server-side URL for Next.js server components and `next.config.mjs` rewrites to reach the backend. Defaults to `http://localhost:3001` if unset. In Docker Compose use `http://backend:3001`. |

`ADMIN_API_BASE_URL` is always `""` (empty string / relative). Admin requests go through the Next.js rewrite at `/api/admin/*` so the auth cookie is scoped to the frontend domain.

---

## App Structure

```
app/
├── page.tsx              # Public landing page (report CTA + map)
├── layout.tsx            # Root layout
├── globals.css           # Tailwind base styles
├── report/
│   └── page.tsx          # Multi-step report submission flow
├── map/
│   └── page.tsx          # Full public map view
├── admin/
│   ├── layout.tsx        # Admin auth guard (reads admin_token cookie)
│   ├── page.tsx          # Admin reports list
│   ├── login/            # Admin login page
│   ├── reports/          # Report detail and status management
│   ├── users/            # Admin user management
│   └── profile/          # Admin profile / password change
├── components/
│   ├── BilingualText.tsx  # EN/KN bilingual label helper
│   ├── CategoryPicker.tsx # Infrastructure category selector
│   ├── LocationMap.tsx    # Leaflet map for manual pin placement
│   ├── PhotoCapture.tsx   # Camera / file upload + EXIF GPS extraction
│   ├── ReportsMap.tsx     # Public map of all submitted reports
│   ├── ReportCTA.tsx      # Landing page call-to-action
│   ├── ReviewStrip.tsx    # Report submission review step
│   ├── SubmitSuccess.tsx  # Post-submission confirmation
│   ├── redesign/          # UI redesign component variants
│   └── ui/               # Shared primitive components
└── lib/
    └── config.ts          # Centralized env-var configuration (source of truth)
```

---

## Testing

Tests use **Jest 29** with two isolated projects configured in `jest.config.js`:

- **`middleware`** project — runs `__tests__/middleware.test.ts` in the `node` environment (requires Web Fetch API globals from Node 18+).
- **`jsdom`** project — runs all other tests in `jest-environment-jsdom`.

```bash
npm test              # run both projects
npm run test:coverage # coverage report (jsdom project only)
```

Coverage thresholds enforced on `app/**/*.{ts,tsx}` (jsdom project):

| Type | Threshold |
|---|---|
| Branches | 70% |
| Functions | 75% |
| Lines | 75% |
| Statements | 75% |

`react-leaflet` and `leaflet` are fully mocked in tests (`__mocks__/reactLeaflet.js`, `__mocks__/leaflet.js`) because Leaflet requires a real browser DOM.

---

## Key Conventions

- **No inline `process.env.*`** — all environment access must go through `app/lib/config.ts`. This is the project rule.
- **Leaflet SSR** — All components that import `leaflet` or `react-leaflet` must be loaded with `dynamic(() => import(...), { ssr: false })`. Leaflet uses `window` and will crash during server-side rendering.
- **EXIF GPS extraction is client-side only** — `exifr` runs in the browser so raw GPS coordinates are never sent to the server. The backend additionally strips EXIF metadata before writing images to disk.
- **Admin auth** — Admin routes are protected by Next.js middleware that reads an `admin_token` HttpOnly cookie. The `/api/admin/*` rewrite in `next.config.mjs` proxies admin requests to the Rust backend so the cookie is scoped to the frontend domain.
- **20 MB photo uploads** — `POST /api/reports` (public submission) calls the Rust backend directly via `NEXT_PUBLIC_API_URL`, bypassing the Next.js rewrite. This avoids Vercel's 4.5 MB body size limit.
