import { existsSync, readFileSync } from "node:fs";

const htmlPath = "index.html";
if (!existsSync(htmlPath)) {
  throw new Error("Missing index.html");
}

const html = readFileSync(htmlPath, "utf8");
if (!/^<!doctype html>/i.test(html.trimStart()) || !/<\/html>\s*$/i.test(html)) {
  throw new Error("index.html is not a complete HTML document");
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
