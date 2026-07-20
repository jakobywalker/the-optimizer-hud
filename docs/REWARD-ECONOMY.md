# Reward Economy

The reward economy turns verified work into transparent progression. It does not replace the real money ledger and never treats a task as realized revenue.

## Ordered tiers

| Rank | Tier | Typical Player XP | Typical Skill XP | Typical Optimizer Credits |
| ---: | --- | ---: | ---: | ---: |
| 1 | Micro | 0-5 | 1-10 | 0-5 |
| 2 | Farming | 10-30 | 25-80 | 10-40 |
| 3 | Contract | 25-75 | 60-200 | 30-120 |
| 4 | Mission | 75-250 | 150-500 | 100-350 |
| 5 | Milestone | 200-750 | 400-1,200 | 300-1,200 |
| 6 | Boss | 750-3,000 | 1,000-5,000 | 1,000-5,000 |
| 7 | Legendary | 1,500-6,000 | 2,500-10,000 | 2,500-15,000 |

These are design ranges, not promises. A reward table may be fixed or ranged. Every ranged result is deterministic for its idempotency key, so reloads and device retries cannot reroll it.

## Reward shape

```json
{
  "playerXp": 25,
  "progression": [
    {
      "targetType": "skill",
      "targetId": "music-creation",
      "amount": 60
    }
  ],
  "currencies": [
    {
      "currencyId": "optimizer-credits",
      "amount": 30
    }
  ],
  "achievements": [],
  "titles": [],
  "cosmetics": []
}
```

The progression transaction remains the canonical audit record. Currency rewards create separate ledger entries linked to the transaction:

```text
<reward-idempotency-key>:currency:<currency-id>
```

This keeps XP rebuilds independent from currency balance calculations while preserving one completion claim.

## Fixed and ranged tables

A fixed table stores exact `rewards`. A ranged table stores min/max values. `resolveRewards()` uses a stable hash of the completion key and each reward field to choose a value. It then applies the measurable grade modifier and configured modifier.

The preview uses a stable preview seed. The completion uses the permanent session or run key. The UI explains the table, tier, modifier percentage, and deterministic rule before and after completion.

## Measurable grading

Activity grades use only configured fields:

- Logged duration against minimum duration.
- Output count against required output count.
- Required evidence or reference.
- Explicit user confirmation when configured.

A session below any required threshold cannot complete. Subjective quality is not inferred. Current grade multipliers are:

| Grade | Requirement ratio | Multiplier |
| --- | ---: | ---: |
| B | 1.00x | 1.00x |
| A | 1.20x | 1.10x |
| S | 1.50x | 1.20x |

Modifiers are bounded. Reward amounts are non-negative and capped by the progression engine maximum.

## Currencies

### Optimizer Credits

A virtual soft currency paid by verified gameplay work. It can support future virtual systems but cannot satisfy a real-world unlock.

### Mastery Tokens

A rare virtual currency paid by sustained mastery, complete cycles, milestones, and bosses.

### Unlock Keys

A rare virtual milestone token. It is separate from financial eligibility.

### Revenue Credits

A financially grounded lifetime ledger. By default, one Revenue Credit equals one dollar of verified qualifying realized revenue. Revenue Credits are created only through finalized revenue events and corrected only through append-only void entries.

Completing outreach, applications, pipeline work, paid delivery, or any revenue-labelled task creates gameplay rewards only. It never creates Revenue Credits.

## Current Gym rewards

Each newly completed Gym protocol transaction includes 30 Optimizer Credits in addition to its existing XP rewards. A cycle completes after each of the five unique protocols has been completed once, in any order:

- +75 Player XP.
- +150 Fitness XP.
- +2 Mastery Tokens.

The cycle then advances and resets its protocol set. There is no weekday binding.

## Idempotency patterns

```text
activity:<sessionId>:completion:reward-v1
contract:<runId>:completion:reward-v1
campaign:<campaignId>:milestone:<chapterId>:reward-v1
campaign:<campaignId>:completion:reward-v1
workout:<sessionId>:completion:reward-v1
gym-cycle:<cycleNumber>:reward-v1
revenue:<eventId>:credits-v1
revenue:<eventId>:void-v1
```

Replays are read-only. Migration never applies missing historical rewards. Cloud merge deduplicates before rebuilding progression or summing currency ledgers.
