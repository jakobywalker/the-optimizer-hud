import { existsSync, readFileSync } from "node:fs";

const required = ["dist/index.html", "dist/sync.js", "dist/hud-core.js", "dist/ai-workflow.js", "dist/progression-engine.js", "dist/audio-manager.js", "dist/progression-ui.js", "dist/assets/audio/README.md"];
for (const path of required) {
  if (!existsSync(path)) throw new Error(`Build output is missing ${path}`);
}

const html = readFileSync("dist/index.html", "utf8");
for (const script of ["progression-engine.js", "audio-manager.js", "hud-core.js", "ai-workflow.js", "progression-ui.js", "/sync.js"]) {
  const matches = html.split(`src="${script}"`).length - 1;
  if (matches !== 1) throw new Error(`Expected one ${script} reference in dist/index.html, found ${matches}`);
}
if (!html.includes("@supabase/supabase-js@2.110.6")) throw new Error("Production build is missing the pinned Supabase browser client");
if (/service[_-]?role|SUPABASE_SERVICE_ROLE_KEY/i.test(html)) throw new Error("Production HTML appears to contain a private Supabase secret");

for (const path of ["dist/sync.js", "dist/hud-core.js", "dist/ai-workflow.js", "dist/progression-engine.js", "dist/audio-manager.js", "dist/progression-ui.js"]) {
  const source = readFileSync(path, "utf8");
  try {
    Function(source);
  } catch (error) {
    throw new Error(`${path} has invalid JavaScript: ${error.message}`);
  }
}

console.log(`Build output check passed: ${required.length} required files.`);
