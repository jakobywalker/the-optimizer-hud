# The Optimizer HUD

A responsive, game-inspired life dashboard for tracking quests, habits, resources, money, skills, environment, momentum, and AI-assisted planning.

Production: [the-optimizer-hud.vercel.app](https://the-optimizer-hud.vercel.app)

## What it does

- Tracks daily systems, weekly habits, missions, quest stages, skills, home-base status, and an immutable money ledger.
- Synchronizes one authenticated HUD across desktop and mobile through Supabase realtime.
- Migrates older personalized saves to a versioned, stable-ID state model without resetting progress.
- Records meaningful changes and preserves daily and weekly rollover history.
- Exports authoritative AI handoffs and readable reports with optional condition check-ins.
- Validates AI update patches, previews safe/conflicting/unresolved operations, supports selective approval, and keeps a rollback snapshot.
- Preserves the existing full-save JSON export/import as a separate backup workflow.
- Retains responsive mobile navigation, reduced-motion controls, fullscreen mode, and ultrawide scaling.

## Local development

Requirements: Node.js 18 or newer.

```powershell
npm.cmd run check
npm.cmd run build
```

`npm run check` validates source assets, runs the behavior suite, builds `dist/`, and validates production output. The source `index.html` can also be opened directly for local UI work, but cloud sync requires the Vercel API route and Supabase environment variables.

## AI workflow

Open `DATA` in the HUD to:

- Save an optional `CONDITION CHECK-IN`.
- Generate an `AI HANDOFF` JSON file for an external AI.
- Generate an `EXPORT READABLE REPORT` Markdown file.
- `IMPORT AI UPDATE`, review each operation, and explicitly apply selected changes.
- `UNDO LAST AI UPDATE` from the complete pre-update snapshot.

The JSON handoff is authoritative. External AIs must target exact stable IDs from its `currentState`, use the handoff export ID as `baseExportId`, and use additive money ledger operations only.

See [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) and the privacy-safe [example handoff](docs/examples/example-handoff.json) and [example AI update](docs/examples/example-ai-update.json).

## Cloud sync

The first device to sign into an empty account uploads its current local HUD. Every later device signed into the same account downloads that shared state. Successful changes are stored in Postgres and broadcast to the user's other active sessions.

Revision conflicts merge events, check-ins, handoff records, daily and weekly histories, rollback markers, and money entries before retrying. This prevents one device from silently discarding append-only history created by another.

Apply `supabase/schema.sql` to a Supabase project, then configure the Vercel project with:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

The Vercel Supabase Marketplace integration may supply these automatically. Never commit service-role keys or database connection strings.

The AI workflow does not require a Supabase schema change or new Vercel environment variable; versioned state remains inside the existing JSONB snapshot.

## Deployment

The repository is designed for a private GitHub-to-Vercel deployment:

1. Import or connect the GitHub repository in the existing Vercel project.
2. Keep `main` as the production branch.
3. Preserve the existing Supabase environment variables in Vercel.
4. Push to `main`; Vercel runs the build command from `vercel.json`.

GitHub Actions validates and builds every push and pull request. Vercel remains responsible for production hosting.

## Project structure

- `index.html` contains the personalized HUD interface, local persistence, event hooks, and responsive behavior.
- `hud-core.js` contains migrations, IDs, events, rollovers, handoffs, patch validation/application, rollback, and cloud-history merging.
- `ai-workflow.js` contains check-in, handoff export, update preview, approval, and rollback UI.
- `sync.js` adds authentication, durable cloud saves, offline recovery, realtime updates, and revision conflict merging.
- `api/config.mjs` exposes only the public Supabase browser configuration.
- `supabase/schema.sql` defines the user-scoped database and realtime policies.
- `scripts/build.mjs` assembles the Vercel output in `dist/`.
- `scripts/check.mjs`, `scripts/test-hud.mjs`, and `scripts/check-build.mjs` validate source, behavior, and build output.

## Privacy

The repository contains personalized default HUD content because it is private. Live account data is protected by Supabase row-level security and is not stored in Git. Exported saves, handoffs, AI updates, and `.env` files may contain sensitive information and are ignored.
