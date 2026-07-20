import { existsSync, readFileSync } from "node:fs";

const htmlPath = "index.html";
if (!existsSync(htmlPath)) {
  throw new Error("Missing index.html");
}

const html = readFileSync(htmlPath, "utf8");
const grindUi = readFileSync("grind-ui.js", "utf8");
const grindEngine = readFileSync("grind-engine.js", "utf8");
if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
  throw new Error("index.html is not a complete HTML document");
}

if (!/\.quick-actions\{[^}]*clip-path:none;[^}]*overflow:visible/.test(html)) {
  throw new Error("DATA menu container must remain unclipped");
}

const runtimeScripts = ["progression-engine.js", "audio-manager.js", "engagement-engine.js", "gym-engine.js", "grind-engine.js", "hud-core.js", "ai-workflow.js", "progression-ui.js", "engagement-ui.js", "gym-ui.js", "grind-ui.js"];
let previousScriptIndex = -1;
for (const runtimeScript of runtimeScripts) {
  const marker = `src="${runtimeScript}"`;
  const index = html.indexOf(marker);
  if (index < 0) throw new Error(`Missing runtime script: ${runtimeScript}`);
  if (index <= previousScriptIndex) throw new Error(`Runtime script order is invalid at ${runtimeScript}`);
  previousScriptIndex = index;
}
if (!html.includes("core.completeMission(state,m.id") || !html.includes("OptimizerProgressionUI?.enqueue")) {
  throw new Error("Mission completion must persist rewards before presentation");
}
const primaryTabs = [...grindUi.matchAll(/data-primary-tab="(missions|grinds)"/g)].map((match) => match[1]);
if (primaryTabs.join(",") !== "missions,grinds") {
  throw new Error("Primary progression must expose exactly Missions and Grinds");
}
if ((html.match(/data-primary-tab-mirror=/g) || []).length !== 2 || html.includes("data-mobile-tab=")) {
  throw new Error("Mobile progression must mirror only Missions and Grinds");
}
const tabSelection = grindUi.match(/function selectPrimaryTab[\s\S]*?function renderBoard/)?.[0] || "";
if (!grindUi.includes('value==="grinds"?"grinds":"missions"') || !grindUi.includes('catch{return"missions"}') || !tabSelection.includes("localStorage.setItem") || /saveState|recordEvent|grantReward|createRewardTransaction/.test(tabSelection)) {
  throw new Error("Primary tab switching must be a local-only UI preference");
}
if (!grindUi.includes("data-enter-gym-mode") || !grindUi.includes("Mission History") || !grindEngine.includes("function getPrimaryProgressionSurface")) {
  throw new Error("Progression surface integration is incomplete");
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
