# NOVALYN web

The NOVALYN single-page application: React, TypeScript, Vite and Tailwind CSS.

```bash
npm install
npm run dev        # http://localhost:5173, proxies /api to the backend on :8000
npm run typecheck
npm run lint
npm run build
```

Configuration is in `.env.example`. Setup, structure and conventions are
described in [DEVELOPMENT.md](https://github.com/luckshayisok/novalyn-backend/blob/main/docs/DEVELOPMENT.md) in the backend repository,
which also holds the rest of the project documentation.

The API this app talks to is [novalyn-backend](https://github.com/luckshayisok/novalyn-backend).
