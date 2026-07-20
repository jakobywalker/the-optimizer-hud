# Custom HUD Audio

Audio Manager v2 uses three restrained sound tiers:

- UI: short micro-interactions at `uiVolume`, default `0.35`
- Progress: tasks, habits, rewards, and XP at `progressVolume`, default `0.65`
- Cinematic: mission and bottleneck resolution at `cinematicVolume`, default `1.0`

Each category multiplier is combined with the synchronized master `volume`. `enabled: false` prevents AudioContext creation. Cooldowns, one-interaction deduplication, and bounded polyphony reduce fatigue.

The manager tries a custom WAV first and silently uses its original Web Audio synthesis if the file is missing. Unknown event names return `false` and never fall back to another sound.

## Custom paths

Cinematic and existing progression:

- `assets/audio/mission-complete.wav`
- `assets/audio/reward-reveal.wav`
- `assets/audio/xp-gain.wav`
- `assets/audio/level-up.wav`
- `assets/audio/player-level-up.wav`
- `assets/audio/achievement.wav`
- `assets/audio/confirm.wav`
- `assets/audio/error.wav`

UI and progress interactions:

- `assets/audio/ui-click.wav`
- `assets/audio/toggle-on.wav`
- `assets/audio/toggle-off.wav`
- `assets/audio/panel-open.wav`
- `assets/audio/panel-close.wav`
- `assets/audio/task-complete.wav`
- `assets/audio/task-reopen.wav`
- `assets/audio/daily-complete.wav`
- `assets/audio/habit-step.wav`
- `assets/audio/habit-day-complete.wav`
- `assets/audio/quest-advance.wav`
- `assets/audio/bottleneck-resolved.wav`
- `assets/audio/bottleneck-reward.wav`

Gym Mode:

- assets/audio/gym-mode-enter.wav
- assets/audio/gym-mode-exit.wav
- assets/audio/protocol-move.wav
- assets/audio/protocol-selected.wav
- assets/audio/workout-briefing-open.wav
- assets/audio/workout-start.wav
- assets/audio/gym-set-complete.wav
- assets/audio/gym-set-edit.wav
- assets/audio/rest-start.wav
- assets/audio/rest-30.wav
- assets/audio/rest-10.wav
- assets/audio/rest-ready.wav
- assets/audio/rest-cancelled.wav
- assets/audio/gym-exercise-complete.wav
- assets/audio/exercise-skipped.wav
- assets/audio/exercise-reordered.wav
- assets/audio/personal-record.wav
- assets/audio/score-reveal.wav
- assets/audio/grade-reveal.wav
- assets/audio/gym-workout-complete.wav
- assets/audio/gym-workout-abandoned.wav

Each Gym cue has a synthesized fallback. The Gym sound toggle gates these cues before the global master and category volumes are applied. One specialized action plays one dominant sound; generic click audio is suppressed inside Gym Mode.

Grind Engine:

- `assets/audio/grind-start.wav`
- `assets/audio/grind-complete.wav`
- `assets/audio/contract-start.wav`
- `assets/audio/contract-complete.wav`
- `assets/audio/campaign-milestone.wav`
- `assets/audio/boss-complete.wav`
- `assets/audio/currency-gain.wav`
- `assets/audio/mastery-token.wav`
- `assets/audio/unlock-key.wav`
- `assets/audio/revenue-event.wav`
- `assets/audio/unlock-progress.wav`
- `assets/audio/real-world-unlock.wav`
- `assets/audio/streak-advance.wav`
- `assets/audio/mastery-level-up.wav`

Every Grind cue has a synthesized fallback. Farming uses short progress cues; contracts and milestones use compact completion cues; boss and real-world unlock confirmation use the longest cinematic tier. Reduced motion does not disable audio, but the global sound toggle does.
Optional numbered habit notes:

- `assets/audio/habit-step-1.wav`
- `assets/audio/habit-step-2.wav`
- `assets/audio/habit-step-3.wav`
- `assets/audio/habit-step-4.wav`
- `assets/audio/habit-step-5.wav`
- `assets/audio/habit-step-6.wav`
- `assets/audio/habit-step-7.wav`

For `habitStep`, the numbered file has highest priority. If it is absent, `habit-step.wav` is pitch-shifted to the E-flat sequence. If that is also absent, synthesis plays the exact configured frequency.

Keep files short, normalized conservatively, and free of long reverb tails. The production build copies this directory into `dist/assets/audio/`.

## Extension guidance

1. Add a future Grind, gym, challenge, streak, or seasonal event to `SOUND_CATALOG` with a category, cooldown, and duration.
2. Add its optional path to `CUSTOM_AUDIO_FILES`.
3. Add a distinct synthesized fallback in `playSynth()`.
4. Route it from the primary interaction so the generic click router does not also fire.
5. Test disabled audio, fallback behavior, category volume, cooldown, and custom-file priority.
