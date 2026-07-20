# Campaigns

Campaigns are multi-chapter progression arcs. Progress, milestone confirmation, and campaign completion are deliberately separate.

## Subject to Change

The first campaign maps the current album work into seven chapters:

| Chapter | Migrated known progress |
| --- | ---: |
| Concept | 100% |
| Tracklist | 100% |
| Writing | 80% |
| Recording | 60% |
| Mix / Master | 0% |
| Release | 0% |
| Rollout | 0% |

Migration only preserves or raises visible progress to these known values. It does not set `completedAt`, create milestone transactions, award XP or currency, play sounds, or show presentations.

The campaign remains the primary active campaign until explicitly completed.

## Chapter lifecycle

A chapter has a stable ID, progress from 0 to 100, status, reward table, completion timestamp, and reward transaction link.

```text
updateChapterProgress -> ready at 100% -> completeCampaignChapter
```

Reaching 100% sets `status: "ready"`. It does not complete the chapter. Explicit confirmation uses:

```text
campaign:<campaignId>:milestone:<chapterId>:reward-v1
```

The current chapter reward is a mission-tier transaction:

- +125 Player XP.
- +225 Music Creation XP.
- +75 Momentum XP.
- +150 Optimizer Credits.

The transaction is stored before the milestone presentation. Repeating confirmation or replay does not pay again.

## Campaign boss

The campaign boss remains locked until every chapter has an explicit `completedAt`. The completion key is:

```text
campaign:<campaignId>:completion:reward-v1
```

The Subject to Change boss reward is:

- +1,250 Player XP.
- +1,800 Music Creation XP.
- +600 Momentum XP.
- +400 Alignment XP.
- +1,500 Optimizer Credits.
- +5 Mastery Tokens.
- +1 Unlock Key.

The 100-XP progression engine carries overflow across every level boundary. A large boss reward may therefore produce multiple player and skill level-up records in one transaction.

Completion sets the permanent campaign world-state marker and opens the boss presentation. Replay reads the stored record only.

## UI behavior

The Grind Board shows the current campaign before legacy mission and bottleneck panels. The command deck exposes:

- Overall chapter-average progress.
- Per-chapter progress and status.
- Verified progress editing.
- Explicit chapter confirmation only at 100%.
- Campaign boss confirmation only after all chapters.
- Near-completion entries at 60% or higher.
- Immutable history and replay through the shared presentation queue.

Reduced-motion mode removes animated transitions without changing sequence or state.

## Editing and AI

Campaign content is data-driven and can be renamed, duplicated, paused, archived, and reordered before completion. Completed campaign and chapter history is immutable.

Approved AI patches may add a campaign or edit safe top-level content fields. AI patches cannot set chapter progress, completion timestamps, reward transaction IDs, completed status, or boss completion. AI handoffs include complete campaign state and relevant reward history so an external planner can recommend work without fabricating it.

## Cloud behavior

Campaigns merge by stable campaign ID. Editable copies use latest update time. Completed records cannot be replaced by an older active copy. Canonical milestone and campaign transactions remain in the progression ledger and make duplicate claims harmless.
