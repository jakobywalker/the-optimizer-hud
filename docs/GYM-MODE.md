# Gym Mode

Gym Mode is the Optimizer HUD training minigame introduced in app version `1.4.0` and state schema `5`. It runs inside the existing vanilla HTML, CSS, and JavaScript application and uses the same local persistence, Supabase realtime synchronization, progression transactions, achievements, presentation queue, AI workflow, and audio manager.

## Protocol rotation

There are exactly five repeatable protocols:

1. Chest + Triceps
2. Back + Biceps
3. Arms + Shoulders
4. Upper
5. Lower

The recommendation advances numerically after a completed workout and loops from Protocol 5 to Protocol 1. It is advisory only. Any protocol can be started at any time, and there is no weekday or rest-day protocol.

Each protocol stores editable exercise templates. Starting a workout creates a session snapshot, so later template edits cannot rewrite active or completed workout history. Archived exercises disappear from future sessions but remain in existing snapshots.

## Session flow

The dedicated full-screen interface contains:

- Protocol selection with the next recommendation, last grade, exercise count, and required set count.
- A deliberate briefing screen before a protocol starts.
- A persistent active workout with exercise navigation, approved variations, previous matching performance, set logging, and workout progress.
- Weight, repetitions, load type, optional RIR, and notes for each completed set.
- Set editing and explicitly confirmed deletion.
- Do Later ordering, required-exercise skip reasons, optional skipping, and reopening.
- A persistent rest timer with pause, resume, add 30 seconds, ready early, and threshold cues.
- Workout history, score reports, exercise results, PRs, and read-only result replay.
- Gym settings and full future-session template editing.

Closing Gym Mode or pressing Escape never discards an active workout. The HUD entry changes to Resume Gym. Every mutation is saved immediately and enters the same realtime synchronization path as the rest of the HUD.

## State

Gym data lives at `state.gym`:

```js
{
  version: 1,
  settings: {
    weightUnit: "lb",
    autoStartRestTimer: true,
    defaultRestSeconds: 120,
    soundEnabled: true
  },
  recommendedProtocolId: "protocol-1",
  lastCompletedProtocolId: null,
  protocols: [],
  activeSession: null,
  sessions: [],
  exerciseHistory: {},
  lastUsedVariations: {},
  achievements: [],
  challenges: []
}
```

Session and set IDs are globally unique. A set submission can include a `submissionId`; retries with the same ID are ignored. Exercise history is keyed by variation ID so fundamentally different movements are never compared.

Supported load types are `external`, `bodyweight`, `bodyweight-added`, and `assisted`. Unilateral exercise volume is doubled because entered repetitions represent each side.

## Scoring

Final scores are from 0 to 100:

| Score | Weight |
| --- | ---: |
| Completion | 40% |
| Execution | 25% |
| Efficiency | 20% |
| Progression | 15% |

Completion is 70% required-set completion and 30% required-exercise completion. Optional work never lowers Completion. Execution measures logger-observable rep-range adherence and prescribed set completion. Efficiency uses broad duration thresholds and does not reward unsafe rushing. Progression detects matching-variation weight, repetition, volume, and rep-range improvements. A first workout without comparable history receives a neutral Progression baseline of 75.

Grades are data-driven: S 97, A+ 93, A 90, A- 87, B+ 83, B 80, B- 77, C+ 73, C 70, C- 67, D 60, and F below 60.

## Rewards and idempotency

Set clicks show feedback but never grant permanent XP. Finishing creates one canonical transaction with:

```text
workout:<sessionId>:completion:reward-v1
```

The base is +20 Player XP and +20 Fitness XP. Additions come from completed required exercises, score thresholds, valid PRs, optional finishers, and A/S grades. Fitness XP and Player XP are capped at sensible limits.

Rewards are written before the training-results presentation starts. Reopening the site, replaying results, merging cloud state, or retrying finalization cannot duplicate the transaction.

## Personal records

Only the same variation is comparable. Gym Mode tracks:

- Highest successful weight.
- Highest repetitions at a given weight.
- Best set volume.
- Best total exercise volume.
- Total session volume.
- Matching-variation progression events.
- Weight, rep, and volume PR records.

History is rebuilt from canonical completed session snapshots after migration and cloud merging.

## Results and achievements

Workout completion uses a dedicated serialized presentation:

```text
trainingComplete
sessionData
performanceAnalysis
personalRecords
rewardSummary
levelUps
achievements
finalResults
```

Result replay reads the stored workout transaction and never awards XP.

Gym achievements use the shared data-driven achievement framework: First Set, First Protocol, Mission Ready, Clean Run, Progressive Overload, Weight PR, Rep PR, Volume PR, Locked In, Perfect Execution, Full Protocol Cycle, Five-Day Protocol, Body Engine Online, and No Weak Links.

## Cloud and AI

`OptimizerGymEngine.mergeCloudState()` merges protocol edits, session history, active-session sets, achievements, and challenges. Completed reward transactions remain canonical in the progression engine, and their session IDs reconnect merged sessions to the already-applied reward.

AI handoffs include active workout context, completed sessions, protocol templates, exercise history, achievements, protocol frequency, and score trends. AI updates can:

- Update protocol name, description, or instructions.
- Add, update, or archive exercise templates.
- Update Gym Mode settings.
- Add Gym challenges.

AI updates cannot edit completed sets, workout history, PR records, scores, or applied reward transactions.

## Audio

Gym Mode adds 21 named cues. Every cue has a custom WAV path, category, cooldown, duration, and synthesized fallback. Gym Mode's sound toggle gates these cues in addition to the global audio settings. Specialized interactions are marked so the generic click router does not layer another sound underneath.

See `assets/audio/README.md` for exact paths.

## Verification

Run:

```powershell
npm.cmd run check
```

The Gym suite covers defaults, migration, variation isolation, validation, duplicate submissions, volume, editing, skipping, scoring, grades, rewards, idempotency, recommendation rotation, replay, PRs, template snapshots, cloud merging, and AI handoff output.
