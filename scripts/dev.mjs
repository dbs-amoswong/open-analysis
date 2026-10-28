import { watch } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "./serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WATCH_DIRS = ["data", "assets", "scripts"].map((dir) => path.join(ROOT, dir));

function build() {
  const result = spawnSync(process.execPath, [path.join(ROOT, "scripts/build.mjs")], {
    stdio: "inherit",
    cwd: ROOT,
  });
  if (result.status !== 0) {
    console.error("Build failed. Fix the errors above; the last good output is still being served.");
  }
}

build();
startServer({ port: 4173 });

let timer = null;
let pending = false;

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (pending) return;
    pending = true;
    build();
    pending = false;
  }, 150);
}

for (const dir of WATCH_DIRS) {
  try {
    watch(dir, { recursive: true }, (_event, filename) => {
      if (!filename || filename.startsWith(".")) return;
      schedule();
    });
  } catch (err) {
    console.warn(`Could not watch ${dir}: ${err.message}`);
  }
}

console.log("Watching data/, assets/ and scripts/ for changes. Press Ctrl+C to stop.");

process.on("SIGINT", () => {
  console.log("\nStopped.");
  process.exit(0);
});
