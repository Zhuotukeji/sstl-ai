import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/check-demo-script.mjs <html-file>");
  process.exit(1);
}

const html = fs.readFileSync(file, "utf8");
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1].trim()).filter(Boolean);
if (!scripts.length) {
  console.log(`No inline script found in ${file}`);
  process.exit(0);
}

const tmp = path.join(os.tmpdir(), `demo-script-${Date.now()}.mjs`);
fs.writeFileSync(tmp, scripts.join("\n;\n"), "utf8");
try {
  execFileSync(process.execPath, ["--check", tmp], { stdio: "inherit" });
  console.log(`Checked ${scripts.length} inline script block(s) in ${file}`);
} finally {
  fs.rmSync(tmp, { force: true });
}
