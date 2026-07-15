# The Optimizer HUD

A responsive, game-inspired life dashboard for tracking quests, habits, resources, money, skills, environment, and momentum.

## What it does

- Tracks daily systems, weekly habits, missions, quest stages, skills, and home-base status.
- Stores changes locally in your browser; there is no account, server, or analytics.
- Exports and imports save files so you can back up your HUD or move it between devices.
- Includes mobile navigation, reduced-motion controls, fullscreen mode, and ultrawide scaling.

## Run locally

Open `index.html` in a modern browser. No install or build step is required.

Run `node scripts/check.mjs` to validate the HTML, local asset references, and inline JavaScript before publishing.

Because saves live in browser storage, data is separate for each browser and device. Use **EXPORT SAVE** and **IMPORT SAVE** inside the HUD to transfer or back up progress.

## Publish with GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch.
2. Open **Settings > Pages** in the repository.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Run the **Deploy HUD to GitHub Pages** workflow, or push another change to `main`.

GitHub will show the public site URL in the deployment summary. Every later push to `main` redeploys the HUD automatically.

## Project structure

- `index.html` contains the complete HUD interface and behavior.
- `.github/workflows/pages.yml` publishes the static site to GitHub Pages.
- `scripts/check.mjs` validates the static site before each deployment.

## Privacy note

The site code can be public while your entered HUD data remains private on your device. Exported save files can contain personal information, so keep them out of the repository.
