import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(ROOT, "data");
const AI_DIR = path.join(ROOT, "ai");

const REGISTRY = "https://registry.npmjs.org";
const DOWNLOADS = "https://api.npmjs.org/downloads/point/last-week";
const OSV = "https://api.osv.dev/v1/query";
const ATTESTATIONS = "https://registry.npmjs.org/-/npm/v1/attestations";
const GITHUB_API = "https://api.github.com/repos";

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
  const raw = await readFile(path.join(ROOT, file), "utf8");
  return JSON.parse(raw);
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function encodePackageName(name) {
  return encodeURIComponent(name).replace(/^%40/, "@");
}

async function fetchJSON(url, { method = "GET", body, headers = {}, timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        accept: "application/json",
        "user-agent": "package-review-board/0.1",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
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
    return { ok: response.ok, status: response.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRepo(repo) {
  const raw = typeof repo === "string" ? repo : repo?.url;
  if (!raw) return null;

  let url = String(raw)
    .trim()
    .replace(/^git\+/, "")
    .replace(/^git@github\.com:/i, "https://github.com/")
    .replace(/^ssh:\/\/git@github\.com\//i, "https://github.com/")
    .replace(/^git:\/\//i, "https://")
    .replace(/^github:/i, "https://github.com/")
    .replace(/\.git$/i, "");

  return /^https:\/\//i.test(url) ? url : null;
}

function packageId(name) {
  return `pkg-${name
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}`;
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
  if (Object.keys(manifest.dependencies || {}).some((name) => name.startsWith("@types/"))) return "@types";
  return "none";
}

function installScripts(manifest) {
  const scripts = manifest.scripts || {};
  return ["preinstall", "install", "postinstall"].filter((key) => typeof scripts[key] === "string");
}

function mapVulnerability(vuln) {
  return {
    id: vuln.id,
    aliases: vuln.aliases || [],
    summary: vuln.summary || null,
    severity: (vuln.severity || []).map((entry) => entry.score).filter(Boolean),
    published: vuln.published || null,
    modified: vuln.modified || null,
    references: (vuln.references || []).map((entry) => entry.url).filter(Boolean).slice(0, 8),
  };
}

async function collect(request) {
  const warnings = [];
  const sources = new Set();
  const name = String(request.package || "").trim();
  if (!name) throw new Error("A package name is required.");

  const packages = await readJSON("data/packages.json");
  const requirements = await readJSON("data/requirements.json");
  const reviews = await readJSON("data/reviews.json");

  const requirement = requirements.find(
    (item) => item.id === request.requirement_id || item.slug === request.requirement_id
  );
  if (!requirement) {
    throw new Error(
      `Unknown requirement "${request.requirement_id}". Add it to data/requirements.json first.`
    );
  }

  const existingPackage = packages.find((item) => item.name === name && item.ecosystem === "npm");
  const existingReviews = existingPackage
    ? reviews.filter(
        (review) =>
          review.package_id === existingPackage.id && review.requirement_id === requirement.id
      )
    : [];

  if (existingReviews.length) {
    throw new Error(
      `${name} already has a review for ${requirement.id}: ${existingReviews
        .map((review) => review.id)
        .join(", ")}`
    );
  }

  const packageURL = `${REGISTRY}/${encodePackageName(name)}`;
  sources.add(packageURL);

  const packumentResponse = await fetchJSON(packageURL);
  if (!packumentResponse.ok || !packumentResponse.json) {
    throw new Error(`npm registry returned ${packumentResponse.status} for ${name}.`);
  }

  const packument = packumentResponse.json;
  const version = String(request.version || packument["dist-tags"]?.latest || "").trim();
  if (!version) throw new Error(`No version found for ${name}.`);

  const manifest = packument.versions?.[version];
  if (!manifest) {
    throw new Error(
      `${name}@${version} was not found. Latest is ${packument["dist-tags"]?.latest ?? "unknown"}.`
    );
  }

  const publishedAt = (packument.time?.[version] || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
    warnings.push(`Publish date for ${name}@${version} was not available.`);
  }

  const downloadsResponse = await fetchJSON(
    `${DOWNLOADS}/${encodePackageName(name)}`
  );
  const weeklyDownloads =
    downloadsResponse.ok && typeof downloadsResponse.json?.downloads === "number"
      ? downloadsResponse.json.downloads
      : 0;
  if (!downloadsResponse.ok) {
    warnings.push(`Weekly download count unavailable (HTTP ${downloadsResponse.status}).`);
  }
  sources.add(`${DOWNLOADS}/${encodePackageName(name)}`);

  const attestationURL = `${ATTESTATIONS}/${encodePackageName(name)}@${version}`;
  const attestationResponse = await fetchJSON(attestationURL);
  const npmProvenance =
    attestationResponse.ok &&
    Array.isArray(attestationResponse.json?.attestations) &&
    attestationResponse.json.attestations.length > 0;
  if (attestationResponse.ok) sources.add(attestationURL);

  const osvResponse = await fetchJSON(OSV, {
    method: "POST",
    body: {
      package: { name, ecosystem: "npm" },
      version,
    },
  });
  const vulnerabilities = (osvResponse.json?.vulns || []).map(mapVulnerability);
  if (!osvResponse.ok) {
    warnings.push(`OSV query failed (HTTP ${osvResponse.status}). Check advisories manually.`);
  }
  for (const vuln of vulnerabilities) {
    sources.add(`https://osv.dev/vulnerability/${vuln.id}`);
    for (const reference of vuln.references) sources.add(reference);
  }

  const repo = normalizeRepo(manifest.repository || packument.repository);
  if (repo) sources.add(repo);

  let github = null;
  const githubMatch = repo?.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
  if (githubMatch) {
    const owner = githubMatch[1];
    const repoName = githubMatch[2].replace(/\.git$/i, "");
    const githubURL = `${GITHUB_API}/${owner}/${repoName}`;
    const githubResponse = await fetchJSON(githubURL, {
      headers: process.env.GITHUB_TOKEN
        ? {
            authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "x-github-api-version": "2022-11-28",
          }
        : {},
    });
    if (githubResponse.ok && githubResponse.json) {
      const data = githubResponse.json;
      github = {
        url: data.html_url || repo,
        archived: Boolean(data.archived),
        pushed_at: data.pushed_at || null,
        open_issues_count:
          typeof data.open_issues_count === "number" ? data.open_issues_count : null,
        stargazers_count:
          typeof data.stargazers_count === "number" ? data.stargazers_count : null,
        forks_count: typeof data.forks_count === "number" ? data.forks_count : null,
        default_branch: data.default_branch || null,
        license: data.license?.spdx_id || null,
      };
      sources.add(githubURL);
    } else if (githubResponse.status !== 404) {
      warnings.push(
        `GitHub API returned ${githubResponse.status} for ${owner}/${repoName}; repository facts are incomplete.`
      );
    }
  }

  const maintainers = (manifest.maintainers || packument.maintainers || [])
    .map((maintainer) => (typeof maintainer === "string" ? maintainer : maintainer?.name))
    .filter(Boolean);

  if (maintainers.length === 0) {
    maintainers.push("unknown");
    warnings.push("No npm maintainer names were published.");
  }

  const unpackedBytes = manifest.dist?.unpackedSize;
  const unpackedSizeKB =
    typeof unpackedBytes === "number" && Number.isFinite(unpackedBytes)
      ? Math.round(unpackedBytes / 1024)
      : null;
  if (unpackedSizeKB === null) warnings.push("Unpacked size was not published.");

  const scripts = installScripts(manifest);
  if (scripts.length) {
    warnings.push(`Package declares install scripts: ${scripts.join(", ")}. Do not run them.`);
  }

  const formats = detectFormats(manifest);
  const types = detectTypes(manifest);
  const license = licenseValue(manifest, packument);
  const runtimeDeps = Object.keys(manifest.dependencies || {}).length;
  const today = todayISO();

  const packageFacts = {
    id: existingPackage?.id || packageId(name),
    name,
    ecosystem: "npm",
    latest_version: version,
    published_at: /^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ? publishedAt : today,
    repo,
    registry: `https://www.npmjs.com/package/${name}`,
    license,
    weekly_downloads: weeklyDownloads,
    runtime_deps: runtimeDeps,
    install_size_kb: null,
    unpacked_size_kb: unpackedSizeKB,
    maintainers,
    types,
    formats,
    notes:
      existingPackage?.notes ||
      `Facts collected from the npm registry on ${today}. Install size was not measured.`,
    npm_provenance: npmProvenance,
  };

  if (!npmProvenance) {
    packageFacts.provenance_note =
      "No npm attestation was found when these facts were collected.";
  }

  sources.add(packageFacts.registry);
  if (manifest.dist?.tarball) sources.add(manifest.dist.tarball);

  const dossier = {
    generated_at: new Date().toISOString(),
    today,
    request,
    requirement: {
      id: requirement.id,
      slug: requirement.slug,
      title: requirement.title,
      summary: requirement.summary,
      owner: requirement.owner,
      criticality: requirement.criticality,
      status: requirement.status,
      review_cadence_days: requirement.review_cadence_days,
      constraints: requirement.constraints,
      out_of_scope: requirement.out_of_scope || [],
    },
    package: packageFacts,
    facts: {
      version,
      published_at: publishedAt || null,
      weekly_downloads: weeklyDownloads,
      runtime_deps: runtimeDeps,
      install_size_kb: null,
      unpacked_size_kb: unpackedSizeKB,
      license,
      maintainers,
      types,
      formats,
      npm_provenance: npmProvenance,
      tarball: manifest.dist?.tarball || null,
      has_install_script: scripts.length > 0,
      install_scripts: scripts,
      deprecated: manifest.deprecated || null,
      engines: manifest.engines || null,
      peer_dependencies: manifest.peerDependencies || null,
      optional_dependencies: manifest.optionalDependencies || null,
      os: manifest.os || null,
      cpu: manifest.cpu || null,
      versions_count: Object.keys(packument.versions || {}).length,
      last_publish: packument.time?.modified || null,
      repository: repo,
      homepage: manifest.homepage || null,
    },
    vulnerabilities,
    github,
    existing: {
      package: existingPackage || null,
      reviews: existingReviews.map((review) => ({
        id: review.id,
        reviewed_at: review.reviewed_at,
        recommendation: review.recommendation,
        score: review.score,
      })),
    },
    sources: [...sources],
    warnings,
  };

  return dossier;
}

const args = parseArgs(process.argv.slice(2));
const outPath = path.resolve(ROOT, args.out || path.join("ai", "dossier.json"));
const requestPath = args.request
  ? path.resolve(ROOT, args.request)
  : path.join(AI_DIR, "request.json");

try {
  const request = args.request
    ? JSON.parse(await readFile(requestPath, "utf8"))
    : {
        package: args.package,
        version: args.version || null,
        requirement_id: args.requirement,
        requested_at: new Date().toISOString(),
      };

  const dossier = await collect(request);
  await writeJSON(outPath, dossier);
  console.log(
    `Collected ${dossier.facts.version} for ${dossier.package.name} (${dossier.requirement.id}) → ${path.relative(
      ROOT,
      outPath
    )}`
  );
  for (const warning of dossier.warnings) console.log(`  ! ${warning}`);
} catch (error) {
  console.error(`collect failed: ${error.message}`);
  process.exit(1);
}
