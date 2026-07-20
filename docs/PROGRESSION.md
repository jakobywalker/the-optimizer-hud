# Progression, Engagement, and Grind Transactions

## Schema v6

App version 1.5.0 uses state schema 6. Migration is idempotent and runs for local storage, imported saves, cloud hydration, realtime snapshots, and conflict snapshots. It preserves personalized values, mission history, checked habits, custom habits, and legacy bottleneck text.

Schema 6 retains all earlier behavior and adds:

- `state.engagement.version`
- Seven standard habits with stable IDs, structured rewards, and `rewardVersion`
- `state.rewardClaims` for trusted legacy/import claim markers
- Object-based bottlenecks with stable IDs and resolution history
- Habit, daily-clear, and bottleneck reward transaction source snapshots
- `bottleneck-removed` achievement records
- Audio category settings: uiVolume, progressVolume, and cinematicVolume
- state.gym protocol templates, one active session, completed session snapshots, variation history, Gym settings, achievements, and challenges
- Canonical workout-completion reward transactions and result replay snapshots
- Gym-aware AI handoffs, AI update validation, and cloud conflict merging
- `state.grind` activities, sessions, contracts, campaigns, reward tables, currencies, mastery, revenue events, recommendations, and unlock targets
- Currency, title, and cosmetic fields preserved in canonical progression transaction rewards
- Gym-to-contract and Gym-to-habit deduplication, including the five-protocol cycle reward

Checked legacy habit cells receive a claim marker without a fabricated XP transaction. This prevents retroactive rewards and uncheck/recheck farming while preserving visible history.

## XP model

The player track is `state.player`. Core-stat, attribute, and skill tracks are in `state.progression.tracks`. Every track has `level`, `xp`, and `xpRequired: 100`. XP carries across level boundaries and can grant multiple levels.

`state.progression.baseline` is the immutable rebuild anchor. Current progression equals the baseline plus canonical applied reward transactions. All rewards use `createRewardTransaction()` or `createManualAdjustment()`.

## Habit model

| ID | Label | Structured reward |
| --- | --- | --- |
| `gym-train` | Gym / Train | +5 Fitness, +2 Energy |
| `steps-8k` | 8k Steps | +3 Energy, +3 Fitness |
| `sleep-seven-hours` | Sleep 7+ Hours | +5 Energy, +3 Capacity |
| `main-quest-work` | Main Quest Work | +5 Momentum, +3 Alignment |
| `no-social-media-am` | No Social Media AM | +5 Clarity, +2 Alignment |
| `content-made` | Content Made | +5 Music Creation, +3 Momentum |
| `content-released` | Content Released | +6 Leverage, +4 Music Creation, +2 Momentum |

Custom habits remain after the standard seven and retain their values and structured rewards. A first unchecked-to-checked transition uses:

```text
habit:<habit-id>:<YYYY-MM-DD>:reward-v<reward-version>
```

The date comes from `habits.week` plus the selected column, not the current clock. A transaction and a `rewardClaims` marker make the claim durable. Refresh, import, replay, uncheck/recheck, and duplicate cloud writes cannot reapply it.

## Habit pitch language

The completed count for that date selects the note, regardless of which habit was checked:

```text
1: 311.13 Hz
2: 349.23 Hz
3: 392.00 Hz
4: 466.16 Hz
5: 523.25 Hz
6: 622.25 Hz
7: 783.99 Hz
```

This is an ascending E-flat language. Out-of-order completion remains consistent because the algorithm counts completed standard habits after the transition. A numbered custom file wins first; otherwise `habit-step.wav` is pitch-shifted; otherwise synthesis uses the exact frequency. Unchecking uses `toggleOff` and never reverses a claim.

## Daily clear

Completing all seven standard habits for one date creates `habit-day-clear:<YYYY-MM-DD>:reward-v1`. The claim grants +10 Player XP, +5 Momentum XP, and +5 Alignment XP. It is separate from the seventh habit transaction and is presented through the shared queue. Reopening and rechecking cannot reclaim it.

## Bottleneck model

```json
{
  "id": "stable-id",
  "name": "Walking pad deployment",
  "description": "Movement setup creates recurring friction.",
  "severity": "high",
  "status": "active",
  "createdAt": "2026-07-17T12:00:00.000Z",
  "resolvedAt": null,
  "resolutionNote": "",
  "rewardVersion": 1,
  "rewardClaimedAt": null,
  "rewardTransactionId": null,
  "rewards": {
    "playerXp": 40,
    "progression": [
      { "targetType": "coreStat", "targetId": "alignment", "amount": 35 },
      { "targetType": "coreStat", "targetId": "clarity", "amount": 25 },
      { "targetType": "coreStat", "targetId": "momentum", "amount": 20 }
    ],
    "achievements": [{ "achievementId": "bottleneck-removed" }]
  }
}
```

Resolution uses `bottleneck:<id>:resolve:reward-v1`. It archives the object as immutable history, stores the resolution note and transaction link, grants the reward once, and records the repeatable `bottleneck-removed` achievement. Replay reads the stored transaction without mutation.

The compact five-stage presentation covers pressure break, resolution source, rewards, level results, and permanent record/achievement. It shares the mission presentation queue.

## Mission integration

Mission claims remain claim-once transactions from Progression Engine v1. The transaction is saved before the cinematic. `rewardReveal` now accompanies reward rows and `xpGain` accompanies progression application.

## Grind reward integration

Grind activities, contracts, campaign milestones, campaign bosses, Gym runs, and Gym cycles use `createRewardTransaction()` before writing their linked virtual-currency entries. The progression transaction retains `currencies`, `titles`, and `cosmetics` for audit, but progression rebuild applies XP only. Currency balances rebuild independently from the append-only Grind ledger.

Representative keys:

```text
activity:<sessionId>:completion:reward-v1
contract:<runId>:completion:reward-v1
campaign:<campaignId>:milestone:<chapterId>:reward-v1
campaign:<campaignId>:completion:reward-v1
gym-cycle:<cycleNumber>:reward-v1
```

Ranged tables are deterministic for the claim key. A replay reads the stored transaction and never resolves a new range.

Completing a Gym workout through core records one completed Gym contract run, applies the transaction's 30 Optimizer Credits once, advances Fitness mastery and the five-protocol cycle, and satisfies the current Gym habit without its separate habit XP. If this completes all seven habits, the independent daily-clear transaction may still apply.
## Cloud and import reconciliation

Both snapshots migrate before merge. Transactions are deduplicated by ID and then reduced to one canonical applied record per `idempotencyKey`. Progression is rebuilt from the baseline. Level-ups and achievements tied to discarded duplicate transactions are removed.

`rewardClaims` are unioned by key. Bottlenecks merge by stable ID. A canonical bottleneck-resolution transaction forces resolved state and its canonical transaction link. Import migration marks already-checked legacy cells without XP. Import, remote sync, and AI application do not trigger local sparks, cinematics, or interaction sounds.

## AI operations

Supported engagement operations include:

- `update` + `habitReward` for a known habit
- `update` + `bottleneckReward` for an active bottleneck
- `add` or `update` + `bottleneck`
- `complete` + `bottleneck` with an optional `resolutionNote`
- `complete` or `reopen` + `habit` with `path: "values.0"` through `values.6`

Resolved bottlenecks and claimed transaction history are immutable. AI operations use the same canonical transaction paths as direct interaction.

## Extending progression

Future activity, contract, campaign, challenge, streak, or AI-review systems should define a stable source ID, reward version, source snapshot, and globally unique idempotency key, then call `createRewardTransaction()`. New sounds should be registered in `SOUND_CATALOG`, assigned a category, given a short cooldown/duration, mapped to an optional custom file, and provided with an original synthesized fallback.

Do not add casual direct XP mutation or reuse another system's claim key.

## Validation

```powershell
npm.cmd test
npm.cmd run check
```

The suites cover schema 6 migration, Grind economy safety, custom habit preservation, exact rewards, daily clears, E-flat steps, cloud deduplication, bottleneck resolution/replay/immutability, AI compatibility, audio tiers/fallbacks, queue ordering, mission progression, production output, and legacy behavior.
