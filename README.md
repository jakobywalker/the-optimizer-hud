# The Optimizer HUD

A responsive, game-inspired life dashboard for tracking quests, habits, resources, money, skills, environment, momentum, AI-assisted planning, and persistent progression.

Production: [the-optimizer-hud.vercel.app](https://the-optimizer-hud.vercel.app)

## What it does

- Tracks daily systems, weekly habits, missions, quest stages, skills, home-base status, and an immutable money ledger.
- Synchronizes one authenticated HUD across desktop and mobile through Supabase realtime.
- Migrates older personalized saves to schema v6 without resetting progress.
- Turns mission, habit, daily-clear, and bottleneck completion into claim-once progression transactions and queued summaries.
- Levels the player, core stats, attributes, and skills with a fixed 100 XP rule and overflow.
- Stores level-ups, repeatable mission/bottleneck achievements, completion events, claim markers, and replayable reward summaries.
- Exports authoritative AI handoffs and validates deliberate AI progression or mission-reward updates.
- Preserves the full-save JSON workflow, responsive navigation, reduced-motion controls, fullscreen mode, and controlled ultrawide layout.

## Local development

Requirements: Node.js 18 or newer.

```powershell
npm.cmd run check
npm.cmd run build
```

`npm run check` validates source assets and script order, runs the behavior and progression suites, builds `dist/`, and validates production output. The source `index.html` can be opened directly for local UI work, but cloud sync requires the Vercel API route and Supabase environment variables.

## Missions and Grinds

The application has separate top-level `HUD` and `GRINDS` screens. The HUD is a command center for the personalized Main Quest, current campaign, up to six finite actions, player progression, daily completion, canonical resources, the current bottleneck, and one compact Grind recommendation. Full mission, skill, resource, modifier, habit, Home Base, Party, bottleneck, and leverage controls remain available through the collapsible Systems deck.

`OptimizerGrindEngine.getPrimaryProgressionSurface()` is the shared classifier. Explicit surface fields win, then repeatability and record kind, then safe structural fallbacks. Existing mission and campaign records remain finite Missions, while writing, recording, rehearsal, content, revenue, movement, sleep, and similar repeatable activities remain Grinds.

The dedicated Grind Board provides readable recommendation and activity cards, category filters, focused sessions, measurable grading, repeatable contracts, mastery and streak tracking, immutable replays, data-driven management, recent runs, and the Unlock Vault. Gym Mode stays a separate workout game; Grinds shows only a compact next-protocol launcher. Revenue Credits still come only from manually verified realized revenue events, and purchases are never automatic.

The selected top-level screen, Systems collapse map, and two-state HUD density setting use guarded local storage. They do not call canonical save, realtime sync, event recording, handoff generation, or reward functions. Ultrawide mode uses a centered container capped at 3200 pixels and natural vertical scrolling; it never zooms the HUD to fit the viewport.

See [docs/GRIND-ENGINE.md](docs/GRIND-ENGINE.md), [docs/REWARD-ECONOMY.md](docs/REWARD-ECONOMY.md), [docs/UNLOCK-VAULT.md](docs/UNLOCK-VAULT.md), and [docs/CAMPAIGNS.md](docs/CAMPAIGNS.md).
## Gym Mode

GYM MODE opens a dedicated full-screen training minigame with five repeatable protocols, persistent set logging, variation-isolated history, rest timers, four-part scoring, grades, PRs, claim-once rewards, achievements, editable templates, and replayable cinematic results. Active workouts save after every interaction and synchronize through the existing Supabase realtime path, so desktop and mobile continue the same session.

The rotation is advisory: Chest + Triceps, Back + Biceps, Arms + Shoulders, Upper, then Lower, looping back to Protocol 1. Any protocol can be selected at any time.

See [docs/GYM-MODE.md](docs/GYM-MODE.md) for protocol behavior, state, scoring, rewards, cloud merge rules, AI operations, and verification.

## Progression Engine v1

Every progression track has a stable ID, name, type, level, current XP, and `xpRequired: 100`. Reaching 100 XP increments the level, subtracts 100 XP, and carries all overflow. A single reward can grant multiple levels.

The player track lives at `state.player`. Category tracks live in `state.progression.tracks`. `state.progression.baseline` is the immutable migration/rebuild anchor used to replay merged transactions safely. Existing percentage values seed Level 1 XP the first time the progression schema migrates a save.

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

## Habits and daily clear

Schema 7 retains seven stable standard habits while preserving custom habits and all checked history: Gym / Train, 8k Steps, Sleep 7+ Hours, Main Quest Work, No Social Media AM, Content Made, and Content Released. Each new completion grants a configurable default of +5 Player XP plus its skill/core rewards. Unchecking reverses exactly that date's reward, and rechecking reinstates the same canonical claim without stacking.

Habit sound pitch comes from the completed count for that date, not row order. The E-flat frequencies are `311.13`, `349.23`, `392`, `466.16`, `523.25`, `622.25`, and `783.99` Hz. This stays ascending when habits are completed out of order.

Completing all seven grants a separate Daily System Clear: +10 Player XP, +5 Momentum XP, and +5 Alignment XP by default. Breaking the day reverses that bonus; restoring the final habit reinstates it once. Direct local transitions show a small XP label; reduced-motion mode uses a glow. Import, AI, and cloud events do not create local celebration feedback.

## Bottleneck resolution

Legacy bottleneck arrays migrate into stable objects with name, description, severity, status, timestamps, resolution note, reward version, transaction link, and structured rewards. Users can add, edit, resolve, review history, and replay resolved summaries.

The default resolution grants +40 Player XP, +35 Alignment XP, +25 Clarity XP, +20 Momentum XP, and the repeatable Bottleneck Removed achievement. Resolution archives immutable history and enters a compact five-stage presentation through the same serialized queue used by missions.

## Audio Manager v2

The complete event catalog is: `missionComplete`, `rewardReveal`, `xpGain`, `levelUp`, `playerLevelUp`, `achievement`, `buttonConfirm`, `error`, `uiClick`, `toggleOn`, `toggleOff`, `panelOpen`, `panelClose`, `taskComplete`, `taskReopen`, `dailyComplete`, `habitStep`, `habitDayComplete`, `questAdvance`, `bottleneckResolved`, and `bottleneckReward`.

Grind language adds `grindStart`, `grindComplete`, `contractStart`, `contractComplete`, `campaignMilestone`, `bossComplete`, `currencyGain`, `masteryToken`, `unlockKey`, `revenueEvent`, `unlockProgress`, `realWorldUnlock`, `streakAdvance`, and `masteryLevelUp`.

Sounds are tiered into UI, progress, and cinematic categories. Synchronized settings include `enabled`, master `volume`, `uiVolume`, `progressVolume`, and `cinematicVolume`. Sound tests are available in DATA > SOUND SETTINGS.

`audio-manager.js` tries optional WAV overrides, then silently uses original Web Audio synthesis. Unknown names return false; missing files, blocked contexts, and playback failures never interrupt state changes. Cooldowns, one-interaction deduplication, and bounded polyphony avoid audio fatigue. Mission reward rows now use `rewardReveal` and progression animation uses `xpGain`.

See [assets/audio/README.md](assets/audio/README.md) for every custom path, numbered habit-note priority, and extension guidance.
## AI workflow

Open `DATA` in the HUD to export a JSON handoff or readable report, record a condition check-in, preview an AI update, and undo the latest imported update.

The handoff includes separate `missions` and `grind` summaries in JSON and separate `## Missions` and `## Grinds` sections in the readable report, followed by Gym and the complete authoritative state. AI updates can add positive XP, replace mission/habit/active-bottleneck rewards, add/edit/resolve bottlenecks, and complete/reopen dated habit cells. Every operation remains previewed and explicitly approved.

See [docs/AI-WORKFLOW.md](docs/AI-WORKFLOW.md) and the privacy-safe examples in [docs/examples](docs/examples).

## Cloud sync

The first device to sign into an empty account uploads its current local HUD. Later devices on the same account download that shared state. Successful changes are stored in the existing Postgres JSONB row and broadcast to other active sessions.

On revision conflicts, snapshots are migrated before merge. Append-only histories are deduplicated by stable IDs. Reward transactions are additionally deduplicated by idempotency key and lifecycle revision, then progression is rebuilt from the baseline and canonical active reward list. Reversed reward and level-up audit records remain in history but are not active progression. Different mission, habit-date, daily-clear, and bottleneck rewards are retained. Habit checkbox state is reconciled from the same canonical reward lifecycle, and a canonical bottleneck transaction forces resolved history.

Mission completion metadata preserves the canonical transaction and earliest valid claim timestamp. Other editable scalar fields and non-history collections still use the existing newest-snapshot or optimistic local-write behavior, so simultaneous edits to the same ordinary field remain last-write-wins.

Apply `supabase/schema.sql`, then configure Vercel with:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

No Supabase table or environment-variable change is required for schema 7 because the reversible transaction fields remain inside the existing user-scoped JSONB state.

## Migration and import safety

`OptimizerHudCore.migrateState()` runs for local storage, full-save imports, cloud hydration, realtime snapshots, and conflict snapshots. It is idempotent and tolerant of missing optional fields.

Schema 6:

- Preserves existing player level and converts legacy player XP/goal into progress toward the next 100 XP level.
- Converts old percentage stats to Level 1 track XP.
- Preserves existing stable mission and task IDs or creates missing IDs once.
- Adds structured default rewards only when a newer structured reward is absent.
- Normalizes and deduplicates reward transactions, level-ups, and achievements without reapplying history.
- Treats an old imported mission that is already complete as previously claimed, preventing retroactive XP.
- Adds the seven standard habits while preserving custom habits and checked history.
- Marks checked legacy habit cells without fabricating XP transactions.
- Converts bottleneck arrays into stable active objects and preserves resolved history.

Legacy completed missions without a recorded transaction cannot replay a historical summary because no trustworthy before/after reward record exists.

## Deployment

The private GitHub repository is connected to Vercel with `main` as the production branch. GitHub Actions validates each push; Vercel runs the build command from `vercel.json`.

## Project structure

- `index.html` contains the personalized HUD, local persistence, mission task edge detection, rendering, and responsive behavior.
- `progression-engine.js` contains migration, XP math, transactions, achievements, idempotency, replay data, queueing, AI summaries, and cloud reconciliation.
- `progression-ui.js` contains the shared presentation queue, mission cinematic, reward editor, replay controls, achievements, and tiered audio settings.
- `engagement-engine.js` contains habits, daily clears, bottleneck migration/resolution, claim markers, AI summaries, and cloud reconciliation.
- `engagement-ui.js` contains interaction sound routing, sparks/XP indicators, compact presentations, and bottleneck management/history.
- `audio-manager.js` contains custom-file mapping and synthesized sound fallbacks.
- `hud-core.js` contains shared state migration, events, rollovers, handoffs, AI patches, rollback, and cloud-history merging.
- `ai-workflow.js` contains check-in, handoff export, update preview, approval, and rollback UI.
- `sync.js` adds authentication, durable cloud saves, offline recovery, realtime updates, and optimistic revisions.
- `scripts/test-hud.mjs`, `scripts/test-progression.mjs`, `scripts/test-engagement.mjs`, `scripts/test-gym.mjs`, and `scripts/test-grind.mjs` provide behavior and regression coverage.
- `scripts/build.mjs`, `scripts/check.mjs`, and `scripts/check-build.mjs` validate and assemble production output.
- Art generation tools and approval workflow live in [`tools/art-pipeline/`](tools/art-pipeline/README.md).
- `supabase/schema.sql` defines the existing user-scoped JSONB state and realtime policies.

## Privacy

The repository contains personalized default HUD content because it is private. Live account data is protected by Supabase row-level security and is not stored in Git. Exported saves, handoffs, AI updates, and `.env` files may contain sensitive information and are ignored.
