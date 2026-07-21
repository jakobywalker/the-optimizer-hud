import { cp, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const source = await readFile("index.html", "utf8");
const marker = "</body>";
if (!source.includes(marker)) throw new Error("index.html is missing </body>");

const cloudScripts = [
  '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.6/dist/umd/supabase.min.js"></script>',
  '<script src="/sync.js"></script>',
].join("\n");

const output = source.replace(marker, `${cloudScripts}\n${marker}`);

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", output, "utf8");
await Promise.all([
  copyFile("sync.js", "dist/sync.js"),
  copyFile("hud-core.js", "dist/hud-core.js"),
  copyFile("ai-workflow.js", "dist/ai-workflow.js"),
  copyFile("artwork.js", "dist/artwork.js"),
  copyFile("progression-engine.js", "dist/progression-engine.js"),
  copyFile("audio-manager.js", "dist/audio-manager.js"),
  copyFile("engagement-engine.js", "dist/engagement-engine.js"),
  copyFile("gym-engine.js", "dist/gym-engine.js"),
  copyFile("grind-engine.js", "dist/grind-engine.js"),
  copyFile("progression-ui.js", "dist/progression-ui.js"),
  copyFile("engagement-ui.js", "dist/engagement-ui.js"),
  copyFile("gym-ui.js", "dist/gym-ui.js"),
  copyFile("grind-ui.js", "dist/grind-ui.js"),
  cp("assets", "dist/assets", { recursive: true }),
]);

console.log("Built synced HUD in dist/.");
