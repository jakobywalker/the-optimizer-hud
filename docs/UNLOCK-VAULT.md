# Unlock Vault

The Unlock Vault tracks real-world purchase targets without pretending virtual progress is cash. It plans eligibility; it never moves money, spends credits, or marks a purchase automatically.

## Revenue events

A revenue event begins `unverified`. It records:

- Realized amount.
- Source.
- Realized timestamp.
- Evidence or reference.
- Optional note.
- Optional per-event protected expenses and reserve contribution.
- Qualification mode.

Unverified events can be edited. `Verify and Finalize` is a manual action. Finalization calculates qualifying revenue and writes one append-only Revenue Credit entry:

```text
revenue:<eventId>:credits-v1
```

A verified event is immutable. If it was wrong or later reversed, `Void with Correction` requires a reason and appends an equal negative entry:

```text
revenue:<eventId>:void-v1
```

The original entry remains visible.

## Qualification modes

### Surplus

The default:

```text
qualifyingRevenue =
  max(0, realizedRevenue - protectedExpenses - reserveContribution)
```

Global protected values are used unless the event explicitly supplies its own. Missing values are not invented.

### All

All realized revenue qualifies.

### Selected sources

Revenue qualifies only when its exact source is in the configured source list.

### Percentage

```text
qualifyingRevenue =
  realizedRevenue * qualifyingPercentage / 100
```

`revenueCreditRatio` defaults to `1`, so one qualifying dollar creates one Revenue Credit.

## Allocations

Allocations are planning records. They do not reduce the lifetime Revenue Credit ledger.

- `manual`: the user chooses an amount and unlock.
- `auto-primary`: a finalized event allocates available credits to the selected primary unlock, capped at its remaining coverage requirement.
- `percentage`: a configured percentage of each finalized event is allocated to the primary unlock.
- Archiving an unlock marks its active allocations released, returning them to the planning pool.

Automatic allocation entries use stable event/unlock keys, so cloud retries cannot allocate one event twice.

## Unlock formula

Each target stores price, coverage multiplier, protected cash floor, and optional real-world action requirements.

```text
requiredQualifyingRevenue = price * coverageMultiplier
postPurchaseCash = availableCash - price
```

An unlock is eligible only when:

```text
allocatedRevenue >= requiredQualifyingRevenue
AND postPurchaseCash >= protectedCashFloor
AND every action requirement is complete
```

Coverage presets are `1.00x`, `1.25x`, `1.50x`, and `2.00x`. The engine also accepts a custom multiplier of at least `1.00x`.

The available cash value comes from the existing HUD money ledger. The Vault reads it but does not mutate it.

## Purchase confirmation

`Mark Purchased` becomes available only when the formula passes. It then requires explicit user confirmation that the real-world purchase already occurred.

The action:

- Stores `purchasedAt`.
- Stores a manual confirmation marker.
- Preserves the eligibility snapshot.
- Does not change cash.
- Does not destroy Revenue Credits.
- Does not alter the original revenue or allocation ledger.

Purchased history is immutable.

## Safety rules

- Optimizer Credits, Mastery Tokens, and Unlock Keys cannot satisfy financial eligibility.
- Revenue-labelled tasks and contracts do not create Revenue Credits.
- AI patches cannot add revenue events, verify revenue, allocate credits, complete action requirements, or mark purchases.
- Import and migration never create revenue, credits, allocations, eligibility, or purchase history.
- Cloud merges deduplicate revenue and allocation records and preserve verified/purchased records over older mutable copies.
