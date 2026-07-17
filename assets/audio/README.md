# Custom HUD Audio

Drop optional replacement WAV files into this directory. The HUD tries each file first and silently falls back to its original Web Audio synthesis when the file is missing or cannot play.

Supported filenames:

- `mission-complete.wav`
- `reward-reveal.wav`
- `xp-gain.wav`
- `level-up.wav`
- `player-level-up.wav`
- `achievement.wav`
- `confirm.wav`
- `error.wav`

Keep replacements short and normalized to a conservative level. These files are copied to `dist/assets/audio/` during production builds.
