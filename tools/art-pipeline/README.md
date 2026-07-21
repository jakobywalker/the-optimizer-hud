# Optimizer Art Pipeline

This development-only tool generates reusable production artwork for The Optimizer HUD from `art_manifest.json`. It does not modify the application or add generated images to the HUD.

The pipeline uses Google's official [`google-genai`](https://googleapis.github.io/python-genai/) SDK and the official [Gemini native image-generation API](https://ai.google.dev/gemini-api/docs/image-generation). The verified model IDs are:

- `gemini-3.1-flash-image` for routine production assets and approval drafts
- `gemini-3-pro-image` for prestige campaign, achievement, and unlock assets

## Security

Set the secret only through `GEMINI_API_KEY`. Never place a real key in source files, frontend code, metadata, screenshots, or Git history.

The local `.env`, `.venv`, `__pycache__`, partial files, and `outputs/` directory are ignored. `.env.example` contains only a placeholder. A process-level environment variable takes precedence because dotenv loading does not override existing values.

If a key was ever pasted into chat, source code, or another log, revoke it and create a replacement before generation.

## Windows PowerShell setup

From `tools/art-pipeline/`:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install --upgrade pip
py -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Add the rotated key to the ignored `.env`, or set it only for the current shell:

```powershell
$env:GEMINI_API_KEY = "your-rotated-key"
```

## macOS and Linux setup

From `tools/art-pipeline/`:

```bash
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install --upgrade pip
python3 -m pip install -r requirements.txt
cp .env.example .env
```

Then edit the ignored `.env`, or export the secret for the current shell:

```bash
export GEMINI_API_KEY="your-rotated-key"
```

## Validate without API calls

```powershell
py generate_assets.py --dry-run
```

Dry run validates the complete manifest before filtering, including unique IDs and filenames, safe relative paths, model IDs, aspect ratios, image sizes, MIME/extension agreement, prompt policy, and actual reference-image files. It does not load the API key, import the Gemini SDK, create output directories, or make network calls.

Validate only the planned approval selection while still checking all 20 manifest tasks:

```powershell
py generate_assets.py --dry-run --only `
  hud-command-center-ultrawide `
  grinds-contract-terminal-ultrawide `
  subject-to-change-card `
  grind-music-creation
```

## Generate the four-image approval batch

Do not run the full manifest until these four assets are visually approved:

```powershell
py generate_assets.py --only `
  hud-command-center-ultrawide `
  grinds-contract-terminal-ultrawide `
  subject-to-change-card `
  grind-music-creation
```

On macOS or Linux, use `python3` and backslash line continuations instead of PowerShell backticks.

The approval batch checks environment consistency, campaign identity, and music-tile direction before spending quota on the remaining tasks. Weak outputs may be refined and regenerated at most twice during review.

## Output and resumption

Generated assets are written beneath `outputs/` using the manifest filename, for example:

```text
outputs/backgrounds/hud-command-center-ultrawide.png
outputs/backgrounds/hud-command-center-ultrawide.png.json
```

Each sidecar records the task ID, output filename, model, aspect ratio, requested size, MIME type, effective prompt, reference filenames, and UTC timestamp. It never contains the API key, environment, authentication headers, or encoded image data.

Completed image/sidecar pairs are skipped, so rerunning the same command safely resumes an interrupted batch. Partial `.part` files are cleaned up. If an image exists without its required metadata sidecar, inspect it and rerun that task with `--force`.

```powershell
py generate_assets.py --force --only subject-to-change-card
```

The generator continues to later tasks after an individual failure and exits nonzero if failures remain. Temporary API failures use bounded exponential backoff with jitter. The official SDK may also retry transient `429` and `5xx` responses internally.

## Reference-image behavior

Every initial task supplies `references/optimizer-visual-direction-board.png` as actual base64 image input to Gemini. The filename is not merely mentioned in the prompt. Every request also states:

```text
Use the supplied image input as a style reference.
Do not recreate the presentation board.
Return one clean production asset.
```

The visual board is a direction reference, not a flattened HUD template. Functional text, buttons, values, charts, progress bars, and navigation remain HTML and CSS.

## Icon transparency

Gemini image generation does not reliably provide transparent production cutouts. Currency and achievement prompts therefore request isolated objects on a clean white background. Background removal is a later reviewed production step and is intentionally not automated here.

## Manifest workflow

`art_manifest.json` is the source of truth for task IDs, filenames, models, aspect ratios, requested sizes, reference images, the global visual direction, and asset prompts. The Python generator contains no asset-specific prompt list.

To add a future task after this initial 20-task batch:

1. Add one object to `tasks` with a unique lowercase-hyphenated `id`.
2. Give it a unique safe path beneath `outputs/` through `filename`.
3. Choose a verified image model, supported aspect ratio, uppercase image size, reference list, and prompt.
4. Keep the no-baked-UI/text policy in the global and task-specific direction.
5. Run `py generate_assets.py --dry-run --only new-task-id`.

To revise art direction, edit the global or task prompt in `art_manifest.json`; Python changes are not required.

## Cost-control and approval

1. Run the full dry run.
2. Generate only the four approval assets.
3. Inspect composition, negative space, fake text, visual consistency, and crop safety.
4. Refine manifest prompts rather than hard-coding exceptions.
5. Regenerate weak approval assets no more than twice.
6. Obtain explicit visual approval.
7. Only then run `py generate_assets.py` for the remaining manifest.
8. Integrate approved art in a separate HUD task.

Generated outputs are ignored and should remain untracked until the repository's asset policy explicitly approves them.