import { existsSync, readFileSync } from "node:fs";

const htmlPath = "index.html";
if (!existsSync(htmlPath)) {
  throw new Error("Missing index.html");
}

const html = readFileSync(htmlPath, "utf8");
if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
  throw new Error("index.html is not a complete HTML document");
}

if (!/\.quick-actions\{[^}]*clip-path:none;[^}]*overflow:visible/.test(html)) {
  throw new Error("DATA menu container must remain unclipped");
}

const runtimeScripts = ["progression-engine.js", "audio-manager.js", "hud-core.js", "ai-workflow.js", "progression-ui.js"];
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
