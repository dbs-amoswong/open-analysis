import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readCollection, writeRecord } from "./lib/data.mjs";

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";
const ATTESTATIONS = "https://registry.npmjs.org/-/npm/v1/attestations";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function encodePackageName(name) {
  return encodeURIComponent(name).replace(/^%40/, "@");
}

async function fetchJSON(url, { timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": "package-review-board-metadata/0.1",
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: response.ok, status: response.status, json };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRepo(repo) {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (!raw) return null;
  const url = String(raw)
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
    .replace(/^git:\/\//i, "https://")
    .replace(/^github:/i, "https://github.com/")
    .replace(/\.git$/i, "");
  return /^https:\/\//i.test(url) ? url : null;
}

function licenseValue(manifest, packument) {
  if (typeof manifest.license === "string") return manifest.license;
  if (typeof manifest.license?.type === "string") return manifest.license.type;
  if (typeof packument.license === "string") return packument.license;
  return "UNKNOWN";
}

function detectFormats(manifest) {
  const exports = manifest.exports;
  const hasImport = Boolean(
    manifest.module ||
      manifest.type === "module" ||
      (exports &&
        typeof exports === "object" &&
        (exports.import || exports["."]?.import))
  );
  const hasRequire = Boolean(
    manifest.main ||
      manifest.type !== "module" ||
      (exports &&
        typeof exports === "object" &&
        (exports.require || exports["."]?.require))
  );
  if (hasImport && hasRequire) return ["dual"];
  if (hasImport) return ["esm"];
  return ["cjs"];
}

function detectTypes(manifest) {
  if (manifest.types || manifest.typings) return "bundled";
  if (Object.keys(manifest.dependencies || {}).some((name) => name.startsWith("@types/"))) {
    return "@types";
  }
  return "none";
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function realDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args["dry-run"]);
const includeDownloads = Boolean(args.downloads);
const includeSizes = Boolean(args.sizes);
const only = args.package ? String(args.package) : null;
const summaryPath = args.summary ? path.resolve(args.summary) : null;

async function refreshPackage(pkg) {
  const packumentResponse = await fetchJSON(
    `${REGISTRY}/${encodePackageName(pkg.name)}`
  );
  if (!packumentResponse.ok || !packumentResponse.json) {
    throw new Error(`npm registry returned ${packumentResponse.status}`);
  }

  const packument = packumentResponse.json;
  const version = packument["dist-tags"]?.latest;
  const manifest = packument.versions?.[version];
  if (!version || !manifest) {
    throw new Error("latest version is missing from the registry");
  }

  const publishedAt = (packument.time?.[version] || "").slice(0, 10);
  const attestationResponse = await fetchJSON(
    `${ATTESTATIONS}/${encodePackageName(pkg.name)}@${version}`
  );
  const npmProvenance =
    attestationResponse.ok &&
    Array.isArray(attestationResponse.json?.attestations) &&
    attestationResponse.json.attestations.length > 0;

  let weeklyDownloads = pkg.weekly_downloads;
  if (includeDownloads) {
    const downloadsResponse = await fetchJSON(
      `${DOWNLOADS}/${encodePackageName(pkg.name)}`
    );
    if (
      downloadsResponse.ok &&
      typeof downloadsResponse.json?.downloads === "number"
    ) {
      weeklyDownloads = downloadsResponse.json.downloads;
    }
  }

  const maintainers = (manifest.maintainers || packument.maintainers || [])
    .map((maintainer) =>
      typeof maintainer === "string" ? maintainer : maintainer?.name
    )
    .filter(Boolean);
  const unpackedBytes = manifest.dist?.unpackedSize;
  const unpackedSizeKB =
    typeof unpackedBytes === "number" && Number.isFinite(unpackedBytes)
      ? Math.round(unpackedBytes / 1024)
      : pkg.unpacked_size_kb ?? null;

  const next = {
    ...pkg,
    latest_version: version,
    published_at: realDate(publishedAt) ? publishedAt : pkg.published_at,
    repo: pkg.repo ?? normalizeRepo(manifest.repository || packument.repository),
    license: licenseValue(manifest, packument),
    weekly_downloads: weeklyDownloads,
    runtime_deps: Object.keys(manifest.dependencies || {}).length,
    unpacked_size_kb: includeSizes ? unpackedSizeKB : pkg.unpacked_size_kb,
    maintainers: maintainers.length ? maintainers : pkg.maintainers,
    formats: detectFormats(manifest),
    types: detectTypes(manifest),
    npm_provenance: npmProvenance,
  };

  const fields = [
    "latest_version",
    "published_at",
    "repo",
    "license",
    "weekly_downloads",
    "runtime_deps",
    "maintainers",
    "formats",
    "types",
    "npm_provenance",
  ];
  if (includeSizes) fields.push("unpacked_size_kb");

  const changes = [];
  for (const field of fields) {
    if (!same(pkg[field], next[field])) {
      changes.push({ field, from: pkg[field] ?? null, to: next[field] ?? null });
    }
  }

  return { next, changes };
}

async function main() {
  const packages = await readCollection("packages");
  const selected = only
    ? packages.filter((pkg) => pkg.id === only || pkg.name === only)
    : packages;

  if (selected.length === 0) {
    throw new Error(`No package matched "${only}"`);
  }

  const changed = [];
  const errors = [];

  for (const pkg of selected) {
    try {
      const result = await refreshPackage(pkg);
      if (result.changes.length) {
        changed.push({
          id: pkg.id,
          name: pkg.name,
          changes: result.changes,
        });
        if (!dryRun) await writeRecord("packages", result.next);
      }
      console.log(
        `${pkg.name}: ${result.changes.length ? `${result.changes.length} change(s)` : "current"}`
      );
      for (const change of result.changes) {
        console.log(
          `  ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`
        );
      }
    } catch (error) {
      errors.push({ id: pkg.id, name: pkg.name, error: error.message });
      console.error(`${pkg.name}: ${error.message}`);
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    checked: selected.length,
    changed,
    errors,
    dry_run: dryRun,
    downloads: includeDownloads,
    sizes: includeSizes,
  };

  if (summaryPath) {
    await mkdir(path.dirname(summaryPath), { recursive: true });
    await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  console.log(
    `\n${selected.length} package(s) checked, ${changed.length} changed, ${errors.length} error(s).`
  );
  if (dryRun) console.log("Dry run: no files were written.");
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`refresh-metadata failed: ${error.message}`);
  process.exit(1);
});
