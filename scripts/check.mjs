import { existsSync, readFileSync } from "node:fs";

const htmlPath = "index.html";
if (!existsSync(htmlPath)) {
  throw new Error("Missing index.html");
}

const html = readFileSync(htmlPath, "utf8");
const artworkSource = readFileSync("artwork.js", "utf8");
const progressionUi = readFileSync("progression-ui.js", "utf8");
const grindUi = readFileSync("grind-ui.js", "utf8");
const grindEngine = readFileSync("grind-engine.js", "utf8");
if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
  throw new Error("index.html is not a complete HTML document");
}

if (!/\.quick-actions\{[^}]*clip-path:none;[^}]*overflow:visible/.test(html)) {
  throw new Error("DATA menu container must remain unclipped");
}

const runtimeScripts = ["progression-engine.js", "audio-manager.js", "engagement-engine.js", "gym-engine.js", "grind-engine.js", "hud-core.js", "ai-workflow.js", "artwork.js", "progression-ui.js", "engagement-ui.js", "gym-ui.js", "grind-ui.js"];
let previousScriptIndex = -1;
for (const runtimeScript of runtimeScripts) {
  const marker = `src="${runtimeScript}"`;
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`Missing runtime script: ${runtimeScript}`);
  if (index <= previousScriptIndex) throw new Error(`Runtime script order is invalid at ${runtimeScript}`);
  previousScriptIndex = index;
}
Function(artworkSource)();
const artwork = globalThis.OptimizerArtwork;
if (!artwork || artwork.all.length !== 20 || new Set(artwork.all).size !== 20) {
  throw new Error("Artwork registry must expose exactly 20 unique production assets");
}
for (const [group, expected] of Object.entries({ backgrounds: 2, campaign: 3, grinds: 6, currencies: 4, achievements: 3, unlocks: 2 })) {
  if (Object.keys(artwork.paths[group]).length !== expected) throw new Error(`Artwork group ${group} must expose ${expected} assets`);
}
for (const assetPath of artwork.all) {
  if (!existsSync(assetPath)) throw new Error(`Missing production artwork: ${assetPath}`);
}
if (!grindUi.includes("artwork.paths.backgrounds.hud") || !grindUi.includes("artwork.paths.backgrounds.grinds") || !grindUi.includes("artwork.paths.campaign.card") || !grindUi.includes("artwork.paths.campaign.completion") || !grindUi.includes("artwork.currencyFor") || !grindUi.includes("artwork.unlockFor") || !grindUi.includes("applyViewArtwork") || !progressionUi.includes("artwork.achievementFor")) {
  throw new Error("Production artwork must remain wired into environments, completions, and achievements");
}
if (!html.includes("core.completeMission(state,m.id") || !html.includes("OptimizerProgressionUI?.enqueue")) {
  throw new Error("Mission completion must persist rewards before presentation");
}
const sliceBetween = (source, start, end) => { const from = source.indexOf(start); if (from < 0) return ""; const to = source.indexOf(end, from); return to < 0 ? "" : source.slice(from, to + end.length); };
const primaryHeader = sliceBetween(html, '<nav class="quick-actions"', "</nav>");
for (const label of ["HUD", "GRINDS", "GYM", "DATA", "MORE"]) {
  if (!primaryHeader.includes(label)) throw new Error("Missing primary navigation target: " + label);
}
const mobileNavigation = sliceBetween(html, '<nav class="mobile-menu"', "</nav>");
if ((mobileNavigation.match(/data-hud-screen=/g) || []).length !== 2 || (mobileNavigation.match(/data-hud-action=/g) || []).length !== 2) {
  throw new Error("Mobile navigation must expose HUD, Grinds, Gym, and Data");
}
if (html.includes("data-primary-tab-mirror=") || grindUi.includes("data-primary-tab=") || grindUi.includes("grindsSurface")) {
  throw new Error("Legacy Mission/Grinds tabs must not render inside Mission Control");
}
const hudRenderer = sliceBetween(grindUi, "function renderBoard()", "function navState");
if (!hudRenderer.includes('board.querySelector("#todayActions")') || !hudRenderer.includes("slice(0,6)") || !hudRenderer.includes("Open Grinds")) {
  throw new Error("HUD must prioritize the campaign, bounded Today's Actions, and one Grind launcher");
}
if (!grindUi.includes("hud-command-strip") || !grindUi.includes("hud-system-dashboard") || !grindUi.includes("hud-signal-line") || !grindUi.includes('id="dashboardSlot"')) {
  throw new Error("HUD must retain the full command-center hierarchy");
}
const requiredSystemIds = ["characterStats", "skills", "dailySystem", "buffs", "activeDebuffs", "debuffList", "resources", "habitTracker", "baseStatus", "partySlots", "todayLeverage", "missions"];
for (const id of requiredSystemIds) {
  if (!html.includes(`id="${id}"`)) throw new Error("Missing major HUD system: " + id);
}
if (!grindUi.includes('dashboard.hidden=false') || !grindUi.includes('dashboard.classList.add("hud-system-dashboard")') || grindUi.includes('dashboard.hidden=true')) {
  throw new Error("The complete personalized dashboard must remain visible on desktop and ultrawide screens");
}
if (!grindUi.includes("Current Campaign") || !grindUi.includes('id="campaignName"') || !grindUi.includes('id="campaignScore"') || !grindEngine.includes("campaign-subject-to-change")) {
  throw new Error("Subject to Change must remain the prominent live campaign");
}
if (!grindUi.includes('class="hud-inline-grind"') || !grindUi.includes('id="missionHistoryDrawer"') || !grindUi.includes("data-open-history") || grindUi.includes("data-mission-status-filter")) {
  throw new Error("HUD must keep one compact Grind launcher and secondary mission history without status tabs");
}if (!grindUi.includes('nextArt=artwork.grindFor(recommended?.activity)') || !grindUi.includes('.hud-system-dashboard .hud-system-missions{--system-art:') || !grindUi.includes('.hud-system-dashboard .hud-system-character') || !grindUi.includes('Approved art integration for the restored life-system command center')) {
  throw new Error("Approved campaign, Grind, and system art must remain visible in the restored command center");
}
if (hudRenderer.includes("Available Grinds") || hudRenderer.includes("data-grind-start")) {
  throw new Error("The full Grind catalog must not render inside Mission Control");
}
const screenSelection = sliceBetween(grindUi, "function saveScreen()", "function campaignProgress");
if (!screenSelection.includes("localStorage.setItem(SCREEN_KEY") || !screenSelection.includes('normalizeScreen(value)') || /saveState|recordEvent|recordHudEvent|grantReward|createRewardTransaction/.test(screenSelection)) {
  throw new Error("Top-level screen switching must remain a local-only display preference");
}
const systemSelection = sliceBetween(grindUi, "function saveSystemPrefs()", "function renderBoard");
if (!systemSelection.includes('aria-expanded') || !systemSelection.includes("content.hidden=!open") || !systemSelection.includes("localStorage.setItem(SYSTEM_PREF_KEY") || /saveState|recordEvent|recordHudEvent|grantReward|createRewardTransaction/.test(systemSelection)) {
  throw new Error("System collapse controls must be persistent, accessible, and progression-free");
}
if (!grindUi.includes('const defaults=Object.fromEntries(SYSTEM_KEYS.map(key=>[key,false]))') || !grindUi.includes('loadDensity()') || !grindUi.includes('HUD DENSITY: ')) {
  throw new Error("Invalid display preferences must fall back to collapsed systems and comfortable density");
}
if (!grindUi.includes("--font-body:16px") || !grindUi.includes("--font-label:13px") || !grindUi.includes(".top-nav-btn,.btn{min-height:44px") || !grindUi.includes("width:100%!important;max-width:none!important;margin:0!important") || !grindUi.includes(".hud-system-dashboard .panel-title{font-size:18px")) {
  throw new Error("Readable typography, target sizing, and full-width ultrawide use are required");
}
const mobilePanels = sliceBetween(html, "function initMobilePanels()", "function syncMobileMode");
if (!mobilePanels.includes("optimizerPanel:") || !mobilePanels.includes("mobile-collapsed") || /saveState|grantReward|createRewardTransaction/.test(mobilePanels)) {
  throw new Error("Mobile system collapse must remain persistent and progression-free");
}
if (!grindUi.includes(".hud-system-dashboard .hud-system-missions{order:1}") || !grindUi.includes("display:flex!important;flex-direction:column")) {
  throw new Error("Mobile must prioritize Active Missions in a one-column command center");
}
if (html.includes("app.style.zoom=String") || html.includes("window.innerWidth/scale") || html.includes("naturalHeight=app.scrollHeight")) {
  throw new Error("Ultrawide mode must not shrink the HUD to fit vertically");
}
if (!grindUi.includes(".grind-card-grid-page{display:grid;grid-template-columns:repeat(2") || !grindUi.includes("@media(min-width:2500px){.grind-card-grid-page{grid-template-columns:repeat(3") || grindUi.includes("repeat(4,minmax(380px")) {
  throw new Error("The dedicated Grind catalog must remain within two or three readable columns");
}
const tabletStyles = sliceBetween(grindUi, "@media(max-width:1100px)", "@media(max-width:760px)");
if (!tabletStyles.includes(".grind-card-grid-page{grid-template-columns:1fr}") || !grindUi.includes(".grind-mode .grind-nav .grind-btn{min-height:44px")) {
  throw new Error("Tablet Grind cards and navigation must remain readable");
}
for (const heading of ["Recommended Grind", "Active Contracts", "Available Grinds", "Mastery & Streaks", "Unlock Contribution", "Recent Runs"]) {
  if (!grindUi.includes(heading)) throw new Error("Missing dedicated Grind Board section: " + heading);
}
if (!grindUi.includes('data-enter-gym-mode') || !grindUi.includes('Workout selection, sets, timers, scoring, and history remain inside Gym Mode.') || !grindUi.includes('.gym-mode .gym-head nav .gym-btn{min-height:44px') || !readFileSync("gym-ui.js", "utf8").includes("z-index:1100")) {
  throw new Error("Gym Mode must remain separate and layer above the prior top-level screen");
}
if (!grindUi.includes("Mission History") || !grindEngine.includes("function getPrimaryProgressionSurface")) {
  throw new Error("Mission history and centralized progression classification must remain available");
}
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
if (!scripts.length) {
  throw new Error("No inline JavaScript found");
}

for (const [index, script] of scripts.entries()) {
  try {
    Function(script[1]);
  } catch (error) {
    throw new Error(`Inline script ${index + 1} has invalid JavaScript: ${error.message}`);
  }
}

const references = [...html.matchAll(/(?:href|src)=["']([^"']+)["']/gi)]
  .map((match) => match[1])
  .filter((value) => !/^(?:[a-z]+:|#|\/\/)/i.test(value));

for (const reference of references) {
  const path = reference.split(/[?#]/, 1)[0];
  if (path && !existsSync(path)) {
    throw new Error(`Missing local asset: ${path}`);
  }
}

console.log(`HUD check passed: ${scripts.length} script, ${references.length} local assets.`);
