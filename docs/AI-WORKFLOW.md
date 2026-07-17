# AI Handoff and Update Workflow

The Optimizer HUD keeps one versioned state object in local storage and, when signed in, in the user-scoped Supabase `hud_state.state` snapshot. The AI workflow exports that state for external analysis and imports explicit ID-targeted patches only after a local preview and approval.

## State schema

Schema version 5 uses this metadata:

```json
{
  "meta": {
    "schemaVersion": 5,
    "appVersion": "1.4.0",
    "createdAt": "2026-07-15T12:00:00.000Z",
    "updatedAt": "2026-07-15T12:00:00.000Z",
    "lastHandoffAt": null,
    "lastHandoffId": null
  }
}
```

The authoritative state also contains player progression, category tracks, reward transactions, level-ups, earned achievements, audio settings, top and character stats, the bottleneck, resources, the money ledger, main quest and stages, daily actions and priorities, buffs, debuffs, missions and tasks, skills, habits, home-base locations, party slots, notes, events, check-ins, handoff records, daily history, weekly history, and one rollback record.

### Migration behavior

`OptimizerHudCore.migrateState()` runs before normalization or rendering for local imports, existing browser saves, incoming cloud snapshots, and conflict snapshots. It converts the original array-based records into objects without resetting completion or personalized values.

The first migration generates missing IDs with `crypto.randomUUID()` or a safe fallback. The migrated state is immediately persisted locally, so later loads preserve the same IDs. Existing money history is retained. A legacy Money resource is converted into an opening ledger balance only when no money object exists.

### Stable IDs

AI-targetable collections use permanent IDs, including:

- Top HUD and character stats
- Main quest and quest stages
- Missions and mission tasks
- Bottleneck, buffs, and debuffs
- Resources, skills, and home-base locations
- Party slots
- Daily actions and priorities
- Habits

An AI must use the exact ID in `currentState`. It must never infer an entity from its name when an ID is missing or unknown.

## Event history

Every meaningful mutation is recorded in `state.events`:

```json
{
  "id": "event-id",
  "timestamp": "2026-07-15T12:00:00.000Z",
  "action": "task completed",
  "entityType": "missionTask",
  "entityId": "task-id",
  "entityName": "Example task",
  "previousValue": false,
  "newValue": true,
  "note": "",
  "source": "user",
  "clientId": "browser-session-id"
}
```

The HUD deduplicates events by ID and keeps the latest 5,000. Actions include task and mission lifecycle changes, quest/stat/skill/resource/home-base changes, buff and debuff changes, habit and daily action completion, money additions and undos, check-ins, AI imports, rollovers, reset, and save import. Visual-only controls do not create events.

Daily and weekly rollovers archive final completion into `dailyHistory` and `weeklyHistory` before resetting current values.

## Condition check-ins

The `DATA` menu provides `CONDITION CHECK-IN` and an optional check-in step during `AI HANDOFF`. Fields are optional and observational. They do not award progression XP. The explicit copy option updates condition values only; progression changes require a reward or adjustment transaction.

## AI handoff format

`AI HANDOFF` downloads `optimizer-handoff-YYYY-MM-DD-HHmm.json` with:

- `format: "optimizer-ai-handoff"`
- `schemaVersion: "1.0"`
- A unique `exportId` and timestamp
- Previous handoff ID and timestamp
- Calculated summaries
- Latest condition check-in
- Events since the previous handoff
- Complete authoritative current state
- Relevant event, check-in, rollover, money, reward-transaction, level-up, and achievement history

The handoff record is committed to state only after the browser download has been generated. `EXPORT READABLE REPORT` creates a Markdown view of the same data without advancing the handoff checkpoint. Rollback snapshots, authentication sessions, environment variables, and Supabase credentials are excluded.

See [example-handoff.json](examples/example-handoff.json).

## AI update format

An update file uses:

```json
{
  "format": "optimizer-ai-update",
  "schemaVersion": "1.0",
  "updateId": "unique-update-id",
  "generatedAt": "2026-07-15T13:00:00.000Z",
  "baseExportId": "the-handoff-export-id",
  "title": "Short update title",
  "rationale": "Why these changes are proposed",
  "operations": []
}
```

Supported operations are `add`, `update`, `complete`, `reopen`, `archive`, and `remove`. Engagement-aware entity types include `bottleneck`, `habit`, `habitReward`, and `bottleneckReward` in addition to the existing stat, quest, mission, daily, resource, money, progression, and note targets.

Gym-aware types are gymProtocol, gymExercise, gymSettings, and gymChallenge. AI may update future-session templates and settings or add a challenge. Completed sets, workout snapshots, scores, PRs, reward transactions, and workout achievements remain immutable history.

### Operation rules

- `update` uses a path relative to the resolved entity, such as `value`, `title`, `description`, or `values.2`.
- `previousValue` should exactly match the value at that path in the handoff. A mismatch is shown as a conflict and is not selected by default.
- `complete` and `reopen` support missions, mission tasks, quest stages, daily actions, and habit day paths.
- `archive` supports missions only.
- `remove` requires a resolved collection entity. Removing a party target clears that slot instead of changing slot identity.
- `add` supports collection entities. For a new mission task, `entityId` is the parent mission ID and `value` describes the new task.
- Money must use `operation: "add"` with a non-zero `value.delta`. An AI cannot replace or remove the ledger.
- Progression uses `operation: "add"`, a `progression` target ID (or `player`), and a positive `value.amount`. It creates an idempotent manual-adjustment transaction.
- Structured mission rewards use `operation: "update"`, `entityType: "missionReward"`, and the exact mission ID. Claimed transactions remain unchanged.
- Paths containing `__proto__`, `prototype`, or `constructor` are rejected.
- Duplicate update IDs and operation IDs are rejected.

See [example-ai-update.json](examples/example-ai-update.json).

## Progression data

Each handoff includes `progression.player`, all stable progression tracks, missions completed since the prior handoff, reward transactions, level-ups, achievements, source mission IDs, and timestamps. The same information is present in authoritative `currentState` and relevant history.

A progression update must be explicit and additive. An AI must not set `level` or `xp` through a generic stat operation. Mission rewards can be edited before or after completion, but an already-applied transaction is historical and immutable. Replaying or importing a completed mission never applies its transaction again.
## Habit progression and bottleneck resolution

Each handoff has a top-level `engagement` summary and the same summary under `summary.engagement`. It includes:

- Standard habit IDs and structured reward definitions
- Habit reward transactions since the previous handoff, including `sourceDate`
- Daily-system clear transactions
- Bottleneck resolution transactions and resolved bottleneck snapshots
- Resolution notes, timestamps, reward summaries, level-ups, and achievement links
- `rewardClaims` in relevant history for import/cloud claim auditing

The readable report adds `Habit Progression` and `Bottlenecks Removed` sections.

Approved updates may:

- Update a known habit reward with `entityType: "habitReward"`
- Complete or reopen `habit` with `path: "values.0"` through `values.6`
- Add an object-based `bottleneck`
- Edit fields on an active bottleneck
- Update an active bottleneck reward with `entityType: "bottleneckReward"`
- Complete a bottleneck with an optional `value.resolutionNote`

Example resolution operation:

```json
{
  "id": "resolve-walking-pad",
  "operation": "complete",
  "entityType": "bottleneck",
  "entityId": "stable-bottleneck-id",
  "previousValue": "active",
  "value": {
    "resolutionNote": "Walking pad is deployed and ready without setup."
  },
  "reason": "The recurring movement friction is gone."
}
```

Habit and bottleneck completions use the same canonical transaction engine as direct UI actions. AI application does not play sounds, sparks, or cinematics. Resolved bottleneck history and already-applied transactions cannot be edited or reclaimed.
## Instructions for another AI

1. Read the handoff JSON, treating `currentState` as authoritative.
2. Set `baseExportId` to the handoff `exportId`.
3. Generate a globally unique `updateId` and unique operation IDs.
4. Use exact stable entity IDs from `currentState`.
5. For updates, include the exact current value as `previousValue` and a relative `path`.
6. Use `add` rather than inventing an ID for a target that does not exist.
7. Use only additive money ledger entries.
8. Keep each operation small, explicit, and independently selectable.
9. Explain the reason for each operation and include an overall rationale.
10. Do not include prose outside the JSON file when the user needs a directly importable update.

## Preview and rollback

Importing an update never applies it immediately. The preview separates safe, conflicting, and unresolved operations. Safe operations are selected by default, conflicts require manual selection, unresolved operations are disabled, and any file-level error blocks approval.

Applying selected operations creates a complete non-recursive rollback snapshot first. `UNDO LAST AI UPDATE` restores that snapshot and keeps audit events. AI money entries added after the snapshot remain in the ledger as undone records so cloud merges cannot resurrect their balance effect.

## Cloud merging

Realtime sync retains the existing optimistic revision architecture. On a remote edit or revision conflict, both snapshots are migrated and append-only histories are merged by stable keys before retrying:

- Events by event ID
- Check-ins by check-in ID
- Handoffs by export ID
- Daily and weekly histories by history ID
- Money entries by ledger ID, preserving undo markers
- Reward transactions by transaction ID and canonical mission, habit-date, daily-clear, or bottleneck idempotency key
- Reward claim markers by idempotency key
- Bottleneck objects by stable ID, with canonical resolution transactions forcing resolved state
- Level-up and achievement records by record ID, filtered to canonical transactions
- Gym sessions by session ID, active sets by set ID, and protocol templates by stable protocol/exercise IDs

Merged histories are sorted chronologically and deduplicated. No Supabase schema or Vercel environment change is required for schema version 5 because the complete state remains in the existing JSONB snapshot. Progression is rebuilt from its baseline and canonical transactions after a conflict merge.

## Validation

Run:

```powershell
npm.cmd run check
npm.cmd run build
```

`npm run check` validates source assets, runs behavior tests, builds `dist/`, and validates production output.
