# Grind Engine

The Grind Engine is the data-driven progression layer introduced in app version `1.5.0` and state schema `6`. It turns verified real-world activity into replayable sessions, repeatable contracts, campaign milestones, virtual rewards, mastery, streaks, recommendations, and financially safe unlock planning.

`grind-engine.js` contains rules and state transitions. `grind-ui.js` contains the HUD command-center shell, dedicated Grind Board, focused session UI, contract registry, campaign controls, mission and Grind histories, management tools, completion presentations, and Unlock Vault.

## Primary progression surfaces

The application exposes separate top-level `HUD` and `GRINDS` experiences. Mission Control owns the current campaign, up to six finite actions, progression and resource summaries, mission details, campaign controls, and mission history. The dedicated Grind Board owns repeatable activities, contracts, recommendations, mastery, streaks, recent verified work, reward previews, unlock contribution, category filters, currencies, and the compact Gym launcher.

`getPrimaryProgressionSurface(item, fallbackKind)` centralizes routing. It prefers `primaryProgressionSurface`, `progressionSurface`, or `surfaceType`; then explicit repeatability and collection kind; then type and structural fallbacks. It defaults conservatively to Missions for unknown finite records. The selector never mutates state.

The selected screen uses `optimizerHudScreenV1` in guarded local storage and recognizes the legacy primary-tab preference during transition. Invalid or unavailable values fall back to HUD. `optimizerHudSystemsV1` stores a validated boolean collapse map, and `optimizerHudDensityV1` stores `comfortable` or `compact`. These display preferences never call `saveState()`, realtime sync, event recording, or reward operations.

## State model

All Grind data lives under `state.grind`:

```js
{
  version: 1,
  settings: {},
  goals: [],
  activities: [],
  activitySessions: [],
  activeSession: null,
  contracts: [],
  contractRuns: [],
  campaigns: [],
  rewardTables: [],
  currencies: [],
  currencyLedger: [],
  masteryTracks: [],
  streaks: [],
  challenges: [],
  unlocks: [],
  unlockAllocations: [],
  revenueEvents: [],
  recommendations: [],
  presentationHistory: [],
  gym: {
    processedSessionIds: [],
    cycle: { number: 1, protocolIds: [], sessionIds: [] }
  }
}
```

Content is editable data with stable IDs. Engine behavior is code. Adding a learning, performance, sales, recovery, or creative domain does not require a new engine.

## Activity lifecycle

An activity defines its domain, type, skill link, reward table, and measurable verification rules. A focused session follows:

```text
startActivity -> activeSession -> completeActivity or abandonActivity
```

Completion can require duration, output count, evidence, and explicit confirmation. Grades are calculated only from those observable fields. The session snapshot, verification result, reward explanation, transaction ID, timestamps, and notes become immutable history.

The completion key is:

```text
activity:<sessionId>:completion:reward-v1
```

A replay reads the stored session and transaction. It never reruns grading or rewards.

## Contract lifecycle

Contracts define an activity link, target count, unit, reward table, and repeatability. A run follows:

```text
startContract -> recordContractProgress -> completeContract or abandonContract
```

Progress submissions can include a stable submission ID. Duplicate submissions are ignored. Reaching the target makes the run ready but does not claim it automatically. Explicit completion uses:

```text
contract:<runId>:completion:reward-v1
```

Activity completions advance linked active contracts, but contract rewards remain separately claimable only when the target is satisfied.

## Recommendations

`getRecommendedGrinds()` ranks active non-external activities using:

- Active campaign priority.
- Active contract progress and proximity to completion.
- Linked unlock action requirements.
- Available time, energy, and requested domain context.
- Recent repetition cooldown.
- The activity's current availability.

Every recommendation includes human-readable reasons. Recommendations are advisory and never start work or claim rewards.

## Generic management

The command deck supports adding, renaming, duplicating, pausing, resuming, archiving, and reordering content. Source content can change without rewriting active or completed session snapshots.

Supported content collections are goals, activities, contracts, campaigns, reward tables, currencies, mastery tracks, streaks, challenges, and unlocks. Completed campaign, session, purchase, and reward history is immutable.

## Cloud merge

Both snapshots migrate before merge. Editable content uses stable IDs and newest-update selection. Append-only records are unioned and deduplicated:

- Activity sessions and contract runs by stable ID.
- Currency entries by idempotency key.
- Revenue events, allocations, and presentation history by stable ID.
- Completed, verified, and purchased records cannot be replaced by an older mutable copy.
- Active sessions use newest `updatedAt`.
- Processed Gym session IDs are unioned.

Progression transactions are canonicalized first by the existing progression engine. Grind currency entries reference those transaction keys, preventing two devices from paying the same currency reward twice.

## Migration

Schema 6 migration:

- Preserves all personalized HUD, Gym, progression, engagement, money, and cloud data.
- Adds default content only when a stable content ID is absent.
- Seeds known album progress as `100 / 100 / 80 / 60` without completing chapters or granting rewards.
- Reconciles real completed Gym sessions into historical contract runs without creating XP, currency, mastery, cycle progress, sounds, or presentations.
- Creates no activity sessions, revenue events, Revenue Credits, purchases, or reward transactions.
- Uses a read-only runtime selector for Missions and Grinds, so no schema bump or canonical-state rewrite is required.
- Is idempotent on repeated local, import, and cloud migration.

## Extension checklist

1. Add content with a stable ID.
2. Link an existing progression track or intentionally add a new stable track.
3. Select or add a reward table within tier guidance.
4. Define measurable completion requirements.
5. Use a globally unique idempotency key.
6. Preserve source snapshots and immutable history.
7. Add cloud merge and handoff coverage.
8. Add tests before exposing the content in the board.

Never mutate XP directly, infer revenue from task completion, mark a purchase automatically, or replay a completion function to show history.
