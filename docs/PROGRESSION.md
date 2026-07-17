# Progression Engine v1

## State shape

Schema v3 keeps the player track at `state.player` and category tracks in `state.progression.tracks`:

```json
{
  "meta": {
    "schemaVersion": 3,
    "appVersion": "1.2.0"
  },
  "player": {
    "id": "player",
    "name": "The Optimizer",
    "type": "player",
    "level": 27,
    "xp": 57,
    "xpRequired": 100
  },
  "progression": {
    "version": 1,
    "tracks": {
      "alignment": {
        "id": "alignment",
        "name": "Alignment",
        "type": "coreStat",
        "level": 1,
        "xp": 44,
        "xpRequired": 100
      }
    },
    "baseline": {
      "player": {},
      "tracks": {}
    }
  },
  "rewardTransactions": [],
  "levelUps": [],
  "earnedAchievements": [],
  "settings": {
    "audio": {
      "enabled": true,
      "volume": 0.22
    }
  }
}
```

The baseline is an immutable migration and conflict-rebuild anchor. Current player and track values are baseline plus all canonical applied reward transactions.

## XP calculation

`applyProgressionXp(track, amount)` accepts a non-negative integer up to one billion. It normalizes missing fields, applies 100 XP levels, carries overflow, supports multiple levels, mutates the target track, and returns previous/final values, levels gained, and bounded checkpoints.

Negative, non-finite, and oversized values are rejected. Zero is a valid no-op.

## Mission rewards and idempotency

Missions include stable mission/task IDs, classification, impact, structured rewards, `completedAt`, `rewardClaimedAt`, `rewardVersion`, and `completionCount`.

A mission claim transaction uses:

```json
{
  "id": "transaction-id",
  "idempotencyKey": "mission-id:reward-v1",
  "type": "mission-completion",
  "sourceType": "mission",
  "sourceId": "mission-id",
  "sourceName": "Restore Home Base",
  "rewardVersion": 1,
  "createdAt": "2026-07-17T13:00:00.000Z",
  "rewards": {},
  "mission": {},
  "before": {
    "player": {},
    "tracks": {}
  },
  "after": {
    "player": {},
    "tracks": {}
  },
  "results": [],
  "levelUps": [],
  "achievementIds": [],
  "diagnostics": [],
  "status": "applied"
}
```

The idempotency key is checked before mutation. The transaction and progression changes are created in one guarded operation. Any calculation failure restores the original state. UI presentation begins only after `saveState()` has persisted the applied transaction.

Invalid reward targets are skipped, logged as warnings, and included in transaction diagnostics while valid targets continue.

## Achievements and level-ups

Achievement definitions are data-driven. `mission-complete` is repeatable, so each different mission completion receives an earned instance. Earned records and level-up badges include transaction ID, target/source IDs, timestamps, and before/after levels.

Replay reads the original transaction and creates no records.

## Cloud conflict strategy

Both snapshots are migrated before merge. Reward transactions are merged by transaction ID and then reduced to one canonical applied record per idempotency key. Level-up and achievement records linked to discarded duplicate transactions are removed. Progression is rebuilt from baseline plus canonical transactions, which safely combines rewards from different missions while applying a same-mission claim once.

Mission completion metadata is reconciled with the canonical transaction. Editable mission content follows the snapshot with the newer state timestamp. Other non-history fields retain the existing last-write-wins behavior.

## AI operations

Controlled positive XP uses:

```json
{
  "id": "op-xp",
  "operation": "add",
  "entityType": "progression",
  "entityId": "alignment",
  "previousValue": {
    "id": "alignment",
    "name": "Alignment",
    "type": "coreStat",
    "level": 1,
    "xp": 44,
    "xpRequired": 100
  },
  "value": {
    "amount": 15
  }
}
```

Structured mission reward replacement uses `operation: "update"`, `entityType: "missionReward"`, the mission ID, the previous rewards object, and a complete structured rewards value. Claimed transactions are immutable and are not retroactively changed.

## Extending progression

Future gym, challenge, streak, or AI-review systems should call `createManualAdjustment()` with a globally unique source/idempotency key. They should not mutate current track levels directly. The shared transaction path provides overflow, level-ups, event reporting, cloud merge safety, and handoff visibility.

## Validation

```powershell
npm.cmd test
npm.cmd run check
```

The progression suite covers arithmetic, overflow, large values, migration, structured defaults, final-task claims, refresh/import/replay safety, duplicate cloud claims, different missions, AI operations, presentation queue ordering, achievement deduplication, and audio fallback.
