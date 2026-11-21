# Northpath 2.0 — homepage milestone

This ZIP contains **three complete replacement files**, not a diff:

- `src/App.tsx`
- `src/index.css`
- `index.html`

Copy them into the matching locations in your existing Northpath project, on the `development` branch. Do not delete any other files. This replaces the coming-soon gateway with a public landing page and makes no backend or login claims.

```powershell
git switch development
npm run typecheck
npm run lint
npm run build
npm audit
npm run dev
```

Visit the Vite local address shown by `npm run dev`, normally `http://localhost:5173/`, and test desktop/mobile navigation and email links.

The Ice Pack Companion dashboard shown on the hero is an **illustration using example data**, not connected to a server. No authentication, database, newsletter forms, or server credentials are included.

When satisfied:

```powershell
git add src/App.tsx src/index.css index.html
git commit -m "Build Northpath 2.0 landing page and Ice Pack Companion showcase"
git push origin development
```

Keep the `main` branch and Bolt production deployment unchanged until review.
