import { readdir, readFile, access } from "node:fs/promises";
import path from "node:path";
import { loadModel, DIST_DIR, todayISO } from "./lib/load.mjs";

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

const arg = process.argv.find((a) => a.startsWith("--today="));
const today = arg ? arg.slice("--today=".length) : todayISO();

let failed = false;

try {
  const model = await loadModel({ today });
  console.log(`Data: valid (${model.counts.packages} packages, ${model.counts.requirements} active requirement(s))`);
  for (const w of model.warnings) console.log(`  ! ${w}`);
} catch (err) {
  if (err.name === "ValidationError") {
    console.error(`${err.message}\n`);
    for (const e of err.errors) console.error(`  ✕ ${e}`);
  } else {
    console.error(err);
  }
  process.exit(1);
}

let files;
try {
  files = await walk(DIST_DIR);
} catch {
  console.error(`\nNo build output at ${DIST_DIR}. Run "npm run build" first.`);
  process.exit(1);
}

const htmlFiles = files.filter((f) => f.endsWith(".html"));
const broken = [];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1];
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    const target = path.resolve(path.dirname(file), href.split("#")[0]);
    try {
      await access(target);
    } catch {
      broken.push(`${path.relative(DIST_DIR, file)} -> ${href}`);
    }
  }
  if (!/<title>[^<]+<\/title>/.test(html)) broken.push(`${path.relative(DIST_DIR, file)}: missing <title>`);
}

if (broken.length) {
  failed = true;
  console.error(`\nLinks: ${broken.length} broken reference(s)`);
  for (const b of broken) console.error(`  ✕ ${b}`);
} else {
  console.log(`Links: ${htmlFiles.length} pages, all internal links resolve`);
}

let allowlistOk = true;
for (const name of ["allowlist.json", "allowlist.csv"]) {
  try {
    await access(path.join(DIST_DIR, name));
  } catch {
    allowlistOk = false;
    failed = true;
    console.error(`Allowlist: missing ${name}. Run "npm run build".`);
  }
}
if (allowlistOk) console.log("Allowlist: allowlist.json and allowlist.csv present");

process.exit(failed ? 1 : 0);
