import { mkdir, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import { loadModel, DIST_DIR, ASSETS_DIR, todayISO } from "./lib/load.mjs";
import { renderSite } from "./lib/render.mjs";
import { buildAllowlist } from "./lib/export.mjs";

function parseToday() {
  const arg = process.argv.find((a) => a.startsWith("--today="));
  if (!arg) return todayISO();
  const value = arg.slice("--today=".length);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(`Invalid --today value "${value}". Expected YYYY-MM-DD.`);
    process.exit(1);
  }
  return value;
}

export async function build({ quiet = false } = {}) {
  const started = performance.now();
  const today = parseToday();
  const model = await loadModel({ today });
  const pages = renderSite(model);
  const allowlist = buildAllowlist(model);

  await mkdir(DIST_DIR, { recursive: true });
  await Promise.all([
    ...pages.map(async (page) => {
      const file = path.join(DIST_DIR, page.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, page.html, "utf8");
    }),
    copyFile(path.join(ASSETS_DIR, "style.css"), path.join(DIST_DIR, "style.css")),
    copyFile(path.join(ASSETS_DIR, "app.js"), path.join(DIST_DIR, "app.js")),
    writeFile(path.join(DIST_DIR, "allowlist.json"), `${JSON.stringify(allowlist.json, null, 2)}\n`, "utf8"),
    writeFile(path.join(DIST_DIR, "allowlist.csv"), allowlist.csv, "utf8"),
  ]);

  const ms = Math.round(performance.now() - started);

  if (!quiet) {
    console.log(`Built ${pages.length} pages in ${ms}ms → dist/`);
    console.log(
      `  ${model.counts.packages} packages · ${model.counts.adopted} adopted · ${model.counts.dropped} dropped · ` +
        `${model.counts.hold} hold · ${model.counts.rejected} rejected`
    );
    if (model.warnings.length) {
      console.log(`\n${model.warnings.length} warning(s):`);
      for (const w of model.warnings) console.log(`  ! ${w}`);
    }
  }

  return { model, pages, ms };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  build().catch((err) => {
    if (err.name === "ValidationError") {
      console.error(`${err.message}\n`);
      for (const e of err.errors) console.error(`  ✕ ${e}`);
      for (const w of err.warnings) console.error(`  ! ${w}`);
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}
