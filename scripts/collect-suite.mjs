import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCollection } from "./lib/data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

async function readJSON(file) {
  return JSON.parse(await readFile(path.resolve(ROOT, file), "utf8"));
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function readReviews(directory) {
  const files = await readdir(path.resolve(ROOT, directory)).catch(() => []);
  const reviews = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const review = await readJSON(path.join(directory, file));
      reviews.push({
        id: review.id,
        package_id: review.package_id,
        recommendation: review.recommendation,
        risk: review.risk,
        score: review.score,
        summary: review.summary,
      });
    } catch {
      // A draft that cannot be read will fail verification elsewhere.
    }
  }
  return reviews;
}

function scopeOf(name) {
  const match = String(name).match(/^(@[^/]+)\//);
  return match ? match[1] : "unscoped";
}

function majorOf(version) {
  const match = String(version || "").match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

const args = parseArgs(process.argv.slice(2));
const requestPath = args.request || path.join("ai", "request.json");
const dossiersDir = args.dossiers || path.join("ai", "dossiers");
const reviewsDir = args.reviews || path.join("ai", "reviews");
const outPath = args.out || path.join("ai", "suite", "input.json");

async function main() {
  const request = await readJSON(requestPath);
  const requirements = await readCollection("requirements");
  const requirement = requirements.find((item) => item.id === request.requirement_id);
  if (!requirement) throw new Error(`Unknown requirement ${request.requirement_id}`);

  const requested = new Map((request.packages || []).map((item) => [item.name, item]));
  const pending = (request.pending || []).map((name) => requested.get(name)).filter(Boolean);
  if (pending.length === 0) throw new Error("No pending packages in the batch request.");

  const dossiers = [];
  for (const item of pending) {
    const dossier = await readJSON(path.join(dossiersDir, `${item.package_id}.json`));
    dossiers.push(dossier);
  }

  const packages = dossiers.map((dossier) => ({
    id: dossier.package.id,
    name: dossier.package.name,
    version: dossier.facts.version,
    license: dossier.package.license,
    repo: dossier.package.repo,
    maintainers: dossier.package.maintainers,
    weekly_downloads: dossier.package.weekly_downloads,
    runtime_deps: dossier.package.runtime_deps,
    install_size_kb: dossier.package.install_size_kb,
    unpacked_size_kb: dossier.package.unpacked_size_kb,
    types: dossier.package.types,
    formats: dossier.package.formats,
    npm_provenance: dossier.package.npm_provenance,
    published_at: dossier.package.published_at,
    dependencies: dossier.facts.dependencies || {},
    peer_dependencies: dossier.facts.peer_dependencies || {},
    optional_dependencies: dossier.facts.optional_dependencies || {},
    install_scripts: dossier.facts.install_scripts || [],
    deprecated: dossier.facts.deprecated || null,
  }));

  const relationships = [];
  const dependencyTypes = [
    ["runtime", "dependencies"],
    ["peer", "peer_dependencies"],
    ["optional", "optional_dependencies"],
  ];
  for (const from of packages) {
    for (const to of packages) {
      if (from.name === to.name) continue;
      for (const [type, field] of dependencyTypes) {
        const range = from[field]?.[to.name];
        if (range) {
          relationships.push({ from: from.name, to: to.name, type, range });
        }
      }
    }
  }

  const dependencyIndex = new Map();
  for (const pkg of packages) {
    for (const [name, range] of Object.entries(pkg.dependencies)) {
      if (!dependencyIndex.has(name)) dependencyIndex.set(name, []);
      dependencyIndex.get(name).push({ package: pkg.name, range });
    }
  }
  const sharedDependencies = [...dependencyIndex.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([name, entries]) => ({ name, packages: entries }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const maintainerIndex = new Map();
  for (const pkg of packages) {
    for (const maintainer of pkg.maintainers) {
      if (!maintainerIndex.has(maintainer)) maintainerIndex.set(maintainer, []);
      maintainerIndex.get(maintainer).push(pkg.name);
    }
  }
  const sharedMaintainers = [...maintainerIndex.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([maintainer, names]) => ({ maintainer, packages: names }));

  const licenses = {};
  for (const pkg of packages) {
    if (!licenses[pkg.license]) licenses[pkg.license] = [];
    licenses[pkg.license].push(pkg.name);
  }

  const scopes = {};
  for (const pkg of packages) {
    const scope = scopeOf(pkg.name);
    if (!scopes[scope]) scopes[scope] = [];
    scopes[scope].push(pkg.name);
  }

  const warnings = [];
  if (packages.every((pkg) => pkg.install_size_kb === null)) {
    warnings.push("Install size was not measured for any package in this batch.");
  }
  const withProvenance = packages.filter((pkg) => pkg.npm_provenance).map((pkg) => pkg.name);
  const withoutProvenance = packages.filter((pkg) => !pkg.npm_provenance).map((pkg) => pkg.name);
  if (withProvenance.length && withoutProvenance.length) {
    warnings.push(
      `Mixed npm provenance: ${withProvenance.join(", ")} have it; ${withoutProvenance.join(
        ", "
      )} do not.`
    );
  }
  const noRepo = packages.filter((pkg) => !pkg.repo).map((pkg) => pkg.name);
  if (noRepo.length) warnings.push(`No repository recorded for: ${noRepo.join(", ")}.`);
  const noTypes = packages.filter((pkg) => pkg.types === "none").map((pkg) => pkg.name);
  if (noTypes.length) warnings.push(`No TypeScript types for: ${noTypes.join(", ")}.`);
  const cjsOnly = packages
    .filter((pkg) => pkg.formats.length === 1 && pkg.formats[0] === "cjs")
    .map((pkg) => pkg.name);
  if (cjsOnly.length) warnings.push(`CommonJS-only: ${cjsOnly.join(", ")}.`);
  const withInstallScripts = packages
    .filter((pkg) => pkg.install_scripts.length)
    .map((pkg) => `${pkg.name} (${pkg.install_scripts.join(", ")})`);
  if (withInstallScripts.length) {
    warnings.push(`Install scripts declared: ${withInstallScripts.join("; ")}.`);
  }

  for (const [scope, names] of Object.entries(scopes)) {
    if (scope === "unscoped" || names.length < 2) continue;
    const majors = new Set(
      names.map((name) => majorOf(packages.find((pkg) => pkg.name === name)?.version))
    );
    if (majors.size > 1) {
      warnings.push(`Packages in ${scope} are on different major versions: ${names.join(", ")}.`);
    }
  }

  if (relationships.length) {
    warnings.push(
      `Direct relationships inside the batch: ${relationships
        .map((rel) => `${rel.from} ${rel.type} ${rel.to}@${rel.range}`)
        .join("; ")}.`
    );
  }

  const reviews = await readReviews(reviewsDir);
  const input = {
    generated_at: new Date().toISOString(),
    today: new Date().toISOString().slice(0, 10),
    mode: "batch",
    requirement: {
      id: requirement.id,
      slug: requirement.slug,
      title: requirement.title,
      summary: requirement.summary,
      owner: requirement.owner,
      criticality: requirement.criticality,
      review_cadence_days: requirement.review_cadence_days,
      constraints: requirement.constraints,
      out_of_scope: requirement.out_of_scope || [],
    },
    request: {
      issue_url: request.issue_url || null,
      requester: request.requester || null,
      use_case: request.use_case || null,
      alternatives: request.alternatives || null,
      batch_size: pending.length,
    },
    packages,
    relationships,
    shared_dependencies: sharedDependencies,
    shared_maintainers: sharedMaintainers,
    licenses,
    scopes,
    reviews,
    warnings,
  };

  await writeJSON(outPath, input);
  console.log(
    `Suite context for ${packages.length} packages → ${path.relative(ROOT, path.resolve(ROOT, outPath))}`
  );
  console.log(
    `  ${relationships.length} relationship(s), ${sharedDependencies.length} shared dependency group(s), ${warnings.length} warning(s)`
  );
}

main().catch((error) => {
  console.error(`collect-suite failed: ${error.message}`);
  process.exit(1);
});
