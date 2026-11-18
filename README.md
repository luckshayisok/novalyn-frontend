# NOVALYN web

The NOVALYN single-page application: React, TypeScript, Vite and Tailwind CSS.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8000
npm run typecheck
npm run lint
npm run build
npm run preview    # the production build with the production Content-Security-Policy
npm run e2e        # browser test of the customer journey; needs the backend checked out next to this repo
```

`npm run e2e` starts its own API (fresh database, port 8100) and serves the production build on port 4174.
Install a browser once with `npx playwright install chromium`, or use an installed one with
`E2E_BROWSER=msedge` (or `chrome`).

Configuration is in `.env.example`. Setup, structure and conventions are
described in [DEVELOPMENT.md](https://github.com/luckshayisok/novalyn-backend/blob/main/docs/DEVELOPMENT.md) in the backend repository,
which also holds the rest of the project documentation.

The API this app talks to is [novalyn-backend](https://github.com/luckshayisok/novalyn-backend).
