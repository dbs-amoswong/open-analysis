#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_TARGETS = [
  "axios",
  "follow-redirects",
  "undici",
  "fast-uri",
  "js-cookie",
  "protobufjs",
  "cookie",
  "@antv/x6",
  "@antv/x6-react-shape",
  "@antv/x6-common",
  "@antv/x6-geometry",
  "@antv/x6-plugin-selection",
  "@antv/x6-plugin-transform",
  "@antv/x6-plugin-scroller",
  "@antv/x6-plugin-keyboard",
  "@antv/x6-plugin-history",
  "@antv/x6-plugin-clipboard",
  "@antv/x6-plugin-snapline",
  "@antv/x6-plugin-dnd",
  "@antv/x6-plugin-minimap",
  "@antv/x6-plugin-stencil",
  "@antv/x6-plugin-export",
  "cytoscape",
  "sigma",
  "graphology",
  "@react-sigma/core",
];

function usage() {
  console.error(`Usage: node scripts/audit-lockfile.mjs <package-lock.json> [package ...] [--json]

Checks the reviewed packages this board cares about in an application lockfile.
With no package arguments it checks the HTTP and graph batches.

Examples:
  npm run audit:lockfile -- ../app/package-lock.json
  npm run audit:lockfile -- ../app/package-lock.json axios protobufjs @antv/x6
  npm run audit:lockfile -- ../app/package-lock.json --json > ai/lockfile-audit.json`);
}

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const positional = argv.filter((arg) => arg !== "--json");
const lockPath = positional[0];

if (!lockPath) {
  usage();
  process.exit(1);
}

const targets = positional.length > 1 ? positional.slice(1) : DEFAULT_TARGETS;

function nameFromKey(key) {
  const marker = "node_modules/";
  const index = key.lastIndexOf(marker);
  if (index < 0) return null;
  const tail = key.slice(index + marker.length);
  if (!tail) return null;
  if (tail.startsWith("@")) return tail.split("/").slice(0, 2).join("/");
  return tail.split("/")[0];
}

function dependencyNames(meta) {
  return new Set([
    ...Object.keys(meta.dependencies ?? {}),
    ...Object.keys(meta.optionalDependencies ?? {}),
    ...Object.keys(meta.peerDependencies ?? {}),
  ]);
}

let lock;
try {
  lock = JSON.parse(await readFile(lockPath, "utf8"));
} catch (error) {
  console.error(`Cannot read ${lockPath}: ${error.message}`);
  process.exit(1);
}

if (!lock.packages || typeof lock.packages !== "object") {
  console.error(
    `${lockPath} is not an npm lockfile v2/v3 (no "packages" map). Re-run npm install with a current npm.`
  );
  process.exit(1);
}

const root = lock.packages[""] ?? {};
const rootName = lock.name ?? root.name ?? "application";
const rootVersion = lock.version ?? root.version ?? "";
const rootDeps = dependencyNames(root);

const entries = [];
for (const [key, meta] of Object.entries(lock.packages)) {
  if (!key) continue;
  const name = meta.name ?? nameFromKey(key);
  if (!name) continue;
  entries.push({
    key,
    name,
    version: meta.version ?? null,
    dev: Boolean(meta.dev),
    optional: Boolean(meta.optional),
    peer: Boolean(meta.peer),
    dependencies: dependencyNames(meta),
  });
}

function dependentsOf(name) {
  const dependents = [];
  if (rootDeps.has(name)) {
    dependents.push({
      name: rootName,
      version: rootVersion,
      path: "(root)",
    });
  }
  for (const entry of entries) {
    if (!entry.dependencies.has(name)) continue;
    dependents.push({
      name: entry.name,
      version: entry.version,
      path: entry.key,
    });
  }
  return dependents;
}

const report = targets.map((target) => {
  const matches = entries
    .filter((entry) => entry.name === target)
    .map((entry) => ({
      version: entry.version,
      path: entry.key,
      dev: entry.dev,
      optional: entry.optional,
      peer: entry.peer,
      dependents: dependentsOf(target),
    }));
  return {
    package: target,
    present: matches.length > 0,
    versions: [...new Set(matches.map((match) => match.version))],
    matches,
  };
});

if (json) {
  console.log(
    JSON.stringify(
      {
        lockfile: path.resolve(lockPath),
        generated_at: new Date().toISOString(),
        targets: report,
      },
      null,
      2
    )
  );
} else {
  console.log(`Lockfile: ${path.resolve(lockPath)}`);
  console.log(`Targets: ${targets.length}\n`);
  for (const item of report) {
    if (!item.present) {
      console.log(`${item.package}: not found`);
      continue;
    }
    const suffix = item.versions.length > 1 ? ` (${item.versions.length} versions)` : "";
    console.log(`${item.package} ${item.versions.join(", ")}${suffix}`);
    for (const match of item.matches) {
      const flags = [
        match.dev ? "dev" : null,
        match.optional ? "optional" : null,
        match.peer ? "peer" : null,
      ].filter(Boolean);
      console.log(`  ${match.path}${flags.length ? ` [${flags.join(", ")}]` : ""}`);
      if (match.dependents.length) {
        const parents = match.dependents
          .map((parent) => `${parent.name}@${parent.version || "?"} (${parent.path})`)
          .join(", ");
        console.log(`  used by: ${parents}`);
      } else {
        console.log("  used by: no declared parent");
      }
    }
  }
}
