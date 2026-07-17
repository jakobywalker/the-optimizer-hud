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

1. Add a future gym, challenge, streak, or seasonal event to `SOUND_CATALOG` with a category, cooldown, and duration.
2. Add its optional path to `CUSTOM_AUDIO_FILES`.
3. Add a distinct synthesized fallback in `playSynth()`.
4. Route it from the primary interaction so the generic click router does not also fire.
5. Test disabled audio, fallback behavior, category volume, cooldown, and custom-file priority.