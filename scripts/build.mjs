import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

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
await copyFile("sync.js", "dist/sync.js");

console.log("Built synced HUD in dist/.");
