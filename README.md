# The Optimizer HUD

A responsive, game-inspired life dashboard for tracking quests, habits, resources, money, skills, environment, momentum, AI-assisted planning, and persistent progression.

Production: [the-optimizer-hud.vercel.app](https://the-optimizer-hud.vercel.app)

## What it does

- Tracks daily systems, weekly habits, missions, quest stages, skills, home-base status, and an immutable money ledger.
- Synchronizes one authenticated HUD across desktop and mobile through Supabase realtime.
- Migrates older personalized saves to schema v3 without resetting progress.
- Turns final-task mission completion into a claim-once progression transaction and cinematic summary.
- Levels the player, core stats, attributes, and skills with a fixed 100 XP rule and overflow.
- Stores level-up records, repeatable mission achievements, completion events, and replayable reward summaries.
- Exports authoritative AI handoffs and validates deliberate AI progression or mission-reward updates.
- Preserves the full-save JSON workflow, responsive navigation, reduced-motion controls, fullscreen mode, and ultrawide scaling.

## Local development

Requirements: Node.js 18 or newer.

```powershell
npm.cmd run check
npm.cmd run build
```

`npm run check` validates source assets and script order, runs the behavior and progression suites, builds `dist/`, and validates production output. The source `index.html` can be opened directly for local UI work, but cloud sync requires the Vercel API route and Supabase environment variables.

## Progression Engine v1

Every progression track has a stable ID, name, type, level, current XP, and `xpRequired: 100`. Reaching 100 XP increments the level, subtracts 100 XP, and carries all overflow. A single reward can grant multiple levels.

The player track lives at `state.player`. Category tracks live in `state.progression.tracks`. `state.progression.baseline` is the immutable migration/rebuild anchor used to replay merged transactions safely. Existing percentage values seed Level 1 XP the first time schema v3 migrates a save.

Mission rewards are structured:

```json
{
  "playerXp": 50,
  "progression": [
    {
      "targetType": "coreStat",
      "targetId": "alignment",
      "amount": 65
    }
  ],
  "achievements": [
    {
      "achievementId": "mission-complete"
    }
  ]
}
```

Completing the final remaining task creates an applied reward transaction before the cinematic begins. The transaction stores the mission snapshot, rewards, before/after progression, level-ups, achievement IDs, diagnostics, and the idempotency key `missionId + rewardVersion`. Refreshing, unchecking/rechecking, importing, replaying, and receiving the same claim from another device cannot award it again.

Completed mission cards expose `REPLAY SUMMARY`. Replay reads the recorded transaction and never changes progression or achievements. Mission editing supports name, classification, impact, tasks, player XP, and progression targets. Editing a claimed mission does not alter its historical transaction or grant more rewards.

The EDIT HUD progression fields create controlled additive adjustment transactions. Future systems and AI reviews can use the same transaction engine without adding a casual main-screen XP button.

See [docs/PROGRESSION.md](docs/PROGRESSION.md) for state shapes, migration, conflict behavior, testing, and extension guidance.

## Mission completion sequence

The full-screen sequence uses explicit stages: intro, mission details, reward overview, progression animation, level-up summary, achievement, and final summary. Rewards are already durable before stage one.

The sequence:

- Queues simultaneous mission completions and presents one at a time.
- Supports automatic pacing, click/tap advancement, skip-to-summary, keyboard controls, and replay.
- Honors the HUD motion toggle and `prefers-reduced-motion`.
- Restores focus after completion and never blocks saved progression if presentation or audio fails.
- Permanently updates player, stat, attribute, and skill level labels on the HUD.

## Audio

`audio-manager.js` first tries optional WAV overrides, then silently uses original Web Audio synthesis. Sound enabled state and conservative master volume are stored in `state.settings.audio` and sync with the HUD.

Custom paths:

- `assets/audio/mission-complete.wav`
- `assets/audio/reward-reveal.wav`
- `assets/audio/xp-gain.wav`
- `assets/audio/level-up.wav`
- `assets/audio/player-level-up.wav`
- `assets/audio/achievement.wav`
- `assets/audio/confirm.wav`
- `assets/audio/error.wav`

The production build copies `assets/` into `dist/assets/`. Missing files, blocked audio contexts, and playback failures do not interrupt reward application.

## AI workflow

Open `DATA` in the HUD to export a JSON handoff or readable report, record a condition check-in, preview an AI update, and undo the latest imported update.

The handoff includes current player and track progression, mission completions, reward transactions, level-ups, achievements, source mission IDs, and timestamps since the previous handoff. AI updates can add positive XP through a `progression` operation and replace structured rewards through a `missionReward` operation. Both remain previewed and explicitly approved.

See [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) and the privacy-safe examples in [docs/examples](docs/examples).

## Cloud sync

The first device to sign into an empty account uploads its current local HUD. Later devices on the same account download that shared state. Successful changes are stored in the existing Postgres JSONB row and broadcast to other active sessions.

On revision conflicts, snapshots are migrated before merge. Append-only histories are deduplicated by stable IDs. Reward transactions are additionally deduplicated by idempotency key, then progression is rebuilt from the baseline and canonical applied transaction list. Level-ups and achievements tied to discarded duplicate claims are removed. Different mission rewards from both devices are retained.

Mission completion metadata preserves the canonical transaction and earliest valid claim timestamp. Other editable scalar fields and non-history collections still use the existing newest-snapshot or optimistic local-write behavior, so simultaneous edits to the same ordinary field remain last-write-wins.

Apply `supabase/schema.sql`, then configure Vercel with:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

No schema or environment-variable change is required for progression v1.

## Migration and import safety

`OptimizerHudCore.migrateState()` runs for local storage, full-save imports, cloud hydration, realtime snapshots, and conflict snapshots. It is idempotent and tolerant of missing optional fields.

Schema v3:

- Preserves existing player level and converts legacy player XP/goal into progress toward the next 100 XP level.
- Converts old percentage stats to Level 1 track XP.
- Preserves existing stable mission and task IDs or creates missing IDs once.
- Adds structured default rewards only when a newer structured reward is absent.
- Normalizes and deduplicates reward transactions, level-ups, and achievements without reapplying history.
- Treats an old imported mission that is already complete as previously claimed, preventing retroactive XP.

Legacy completed missions without a recorded transaction cannot replay a historical summary because no trustworthy before/after reward record exists.

## Deployment

The private GitHub repository is connected to Vercel with `main` as the production branch. GitHub Actions validates each push; Vercel runs the build command from `vercel.json`.

## Project structure

- `index.html` contains the personalized HUD, local persistence, mission task edge detection, rendering, and responsive behavior.
- `progression-engine.js` contains migration, XP math, transactions, achievements, idempotency, replay data, queueing, AI summaries, and cloud reconciliation.
- `progression-ui.js` contains the cinematic sequence, mission reward editor, replay controls, achievements view, and audio settings.
- `audio-manager.js` contains custom-file mapping and synthesized sound fallbacks.
- `hud-core.js` contains shared state migration, events, rollovers, handoffs, AI patches, rollback, and cloud-history merging.
- `ai-workflow.js` contains check-in, handoff export, update preview, approval, and rollback UI.
- `sync.js` adds authentication, durable cloud saves, offline recovery, realtime updates, and optimistic revisions.
- `scripts/test-hud.mjs` and `scripts/test-progression.mjs` provide lightweight behavior coverage.
- `scripts/build.mjs`, `scripts/check.mjs`, and `scripts/check-build.mjs` validate and assemble production output.
- `supabase/schema.sql` defines the existing user-scoped JSONB state and realtime policies.

## Privacy

The repository contains personalized default HUD content because it is private. Live account data is protected by Supabase row-level security and is not stored in Git. Exported saves, handoffs, AI updates, and `.env` files may contain sensitive information and are ignored.
