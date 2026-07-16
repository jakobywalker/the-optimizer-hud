# The Optimizer HUD

A responsive, game-inspired life dashboard for tracking quests, habits, resources, money, skills, environment, and momentum.

Production: [the-optimizer-hud.vercel.app](https://the-optimizer-hud.vercel.app)

## What it does

- Tracks daily systems, weekly habits, missions, quest stages, skills, home-base status, and money history.
- Synchronizes one authenticated HUD across desktop and mobile through Supabase.
- Updates other signed-in devices in real time while retaining a local offline cache.
- Exports and imports save files for manual backups.
- Includes responsive navigation, reduced-motion controls, fullscreen mode, and ultrawide scaling.

## Local development

Requirements: Node.js 18 or newer.

```powershell
npm run check
npm run build
```

The build writes the deployable site to `dist/`. The source `index.html` can also be opened directly for local UI work, but cloud sync requires the Vercel API route and Supabase environment variables.

## Cloud sync

The first device to sign into an empty account uploads its current local HUD. Every later device signed into the same account downloads that shared state. Successful changes are stored in Postgres and broadcast to the user's other active sessions.

Apply `supabase/schema.sql` to a Supabase project, then configure the Vercel project with:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The Vercel Supabase Marketplace integration may supply these automatically. Never commit service-role keys or database connection strings.

## Deployment

The repository is designed for a private GitHub-to-Vercel deployment:

1. Import or connect the GitHub repository in the existing Vercel project.
2. Keep `main` as the production branch.
3. Preserve the existing Supabase environment variables in Vercel.
4. Push to `main`; Vercel runs the build command from `vercel.json`.

GitHub Actions validates and builds every push and pull request. Vercel remains responsible for production hosting.

## Project structure

- `index.html` contains the personalized HUD interface and local behavior.
- `sync.js` adds authentication, durable cloud saves, offline recovery, and realtime updates.
- `api/config.mjs` exposes only the public Supabase browser configuration.
- `supabase/schema.sql` defines the user-scoped database and realtime policies.
- `scripts/build.mjs` assembles the Vercel output in `dist/`.
- `scripts/check.mjs` validates the source before deployment.

## Privacy

The repository contains personalized default HUD content because it is private. Live account data is protected by Supabase row-level security and is not stored in Git. Exported saves and `.env` files may contain sensitive information and are ignored.