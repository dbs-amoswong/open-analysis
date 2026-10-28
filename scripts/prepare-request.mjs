import { appendFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AI_DIR = path.join(ROOT, "ai");
const REQUESTS_DIR = path.join(AI_DIR, "requests");
const MAX_PACKAGES = 20;

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
  return JSON.parse(await readFile(path.join(ROOT, file), "utf8"));
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseSections(body) {
  const sections = new Map();
  let current = null;

  for (const rawLine of String(body || "").replace(/\r\n/g, "\n").split("\n")) {
    const heading = rawLine.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      current = heading[1].trim();
      sections.set(current, []);
      continue;
    }
    if (current) sections.get(current).push(rawLine);
  }

  return sections;
}

function sectionValue(sections, labels) {
  for (const label of labels) {
    if (!sections.has(label)) continue;
    const value = sections
      .get(label)
      .join("\n")
      .trim()
      .replace(/^_No response_$/i, "")
      .trim();
    if (value) return value;
  }
  return "";
}

function firstLine(value) {
  return String(value || "")
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function cleanVersion(value) {
  const version = firstLine(value).replace(/^`+|`+$/g, "").trim();
  if (!version || /^_?no response_?$/i.test(version) || /^latest$/i.test(version)) return "";
  return version.replace(/^v/i, "");
}

function parsePackageList(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .split(/[\n,]+/)
    .map((line) =>
      line
        .trim()
        .replace(/^[-*]\s+/, "")
        .replace(/^`+|`+$/g, "")
        .trim()
    )
    .filter(Boolean)
    .filter((line) => !/^_?no response_?$/i.test(line));
}

function parsePackageEntry(raw) {
  const value = String(raw).trim();

  // Scoped package, optionally with @version.
  const scoped = value.match(/^(@[^/\s]+\/[^@\s]+)(?:@([^\s]+))?$/);
  if (scoped) {
    return { name: scoped[1], version: scoped[2] ? cleanVersion(scoped[2]) : "" };
  }

  // Unscoped package, optionally with @version.
  const plain = value.match(/^([^@\s]+)(?:@([^\s]+))?$/);
  if (plain) {
    return { name: plain[1], version: plain[2] ? cleanVersion(plain[2]) : "" };
  }

  return { name: value, version: "" };
}

function packageId(name) {
  return `pkg-${name
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()}`;
}

function validPackageName(name) {
  return (
    name.length <= 214 &&
    /^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i.test(name)
  );
}

const args = parseArgs(process.argv.slice(2));
const issueBody = args["issue-body-file"]
  ? await readFile(args["issue-body-file"], "utf8")
  : process.env.ISSUE_BODY || "";
const sections = parseSections(issueBody);

const packageInput =
  (typeof args.packages === "string" && args.packages) ||
  (typeof args.package === "string" && args.package) ||
  process.env.PACKAGES ||
  process.env.PACKAGE ||
  sectionValue(sections, [
    "npm package names",
    "npm package name",
    "Packages",
    "Package name",
  ]);
const defaultVersion = cleanVersion(
  (typeof args.version === "string" && args.version) ||
    process.env.VERSION ||
    sectionValue(sections, ["Version to review", "Version"])
);
const requirementInput = firstLine(
  (typeof args.requirement === "string" && args.requirement) ||
    process.env.REQUIREMENT ||
    sectionValue(sections, ["Requirement ID or slug", "Requirement"])
);
const modeInput = firstLine(
  (typeof args.mode === "string" && args.mode) ||
    process.env.REVIEW_MODE ||
    sectionValue(sections, ["Review mode"])
);
const mode = /^separate/i.test(modeInput) ? "separate" : "batch";
const useCase = sectionValue(sections, ["What are you trying to do?", "Use case"]);
const alternatives = sectionValue(sections, ["Alternatives considered", "Alternatives"]);
const disclosure = sectionValue(sections, ["Disclosure", "Disclosures"]);

const issueNumberRaw = args["issue-number"] || process.env.ISSUE_NUMBER || "";
const issueNumber = Number.parseInt(issueNumberRaw, 10);
const issueURL = args["issue-url"] || process.env.ISSUE_URL || "";
const requester = args.requester || process.env.REQUESTER || "";

async function setOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, `${name}=${value}\n`, "utf8");
}

async function main() {
  const rawPackages = parsePackageList(packageInput);
  if (rawPackages.length === 0) {
    throw new Error(
      "No package names found. Add one per line to the issue form or pass --packages a,b,c."
    );
  }

  if (rawPackages.length > MAX_PACKAGES) {
    throw new Error(
      `Too many packages in one request (${rawPackages.length}). Limit is ${MAX_PACKAGES}; split the rest into another issue.`
    );
  }

  const entries = [];
  const seen = new Set();

  for (const raw of rawPackages) {
    const entry = parsePackageEntry(raw);
    if (!validPackageName(entry.name)) {
      throw new Error(`"${entry.name}" does not look like an npm package name.`);
    }
    if (seen.has(entry.name)) {
      throw new Error(`Duplicate package "${entry.name}" in the request.`);
    }
    seen.add(entry.name);

    const version = entry.version || defaultVersion;
    if (version && !/^[0-9A-Za-z][0-9A-Za-z.+-]*$/.test(version)) {
      throw new Error(
        `"${version}" is not an exact version for ${entry.name}. Use 1.2.3, not a range.`
      );
    }

    entries.push({ name: entry.name, version: version || null });
  }

  if (!requirementInput) {
    throw new Error(
      "No requirement found. Add it to the issue form or pass --requirement <id>."
    );
  }

  const requirementMatch = requirementInput.match(/req-[a-z0-9-]+/i);
  const requirementKey = requirementMatch ? requirementMatch[0] : requirementInput;
  const [requirements, packages, reviews] = await Promise.all([
    readJSON("data/requirements.json"),
    readJSON("data/packages.json"),
    readJSON("data/reviews.json"),
  ]);
  const requirement = requirements.find(
    (item) => item.id === requirementKey || item.slug === requirementKey
  );

  if (!requirement) {
    throw new Error(
      `Unknown requirement "${requirementInput}". Available: ${requirements
        .map((item) => `${item.id} (${item.slug})`)
        .join(", ")}`
    );
  }

  const pending = [];
  const skipped = [];
  const ids = new Set();

  for (const entry of entries) {
    const existingPackage = packages.find(
      (item) => item.name === entry.name && item.ecosystem === "npm"
    );
    const existingReview = existingPackage
      ? reviews.find(
          (review) =>
            review.package_id === existingPackage.id &&
            review.requirement_id === requirement.id
        )
      : null;
    const id = existingPackage?.id || packageId(entry.name);

    if (ids.has(id)) {
      throw new Error(
        `Two requested packages map to the same id "${id}". Split the request or rename one package id manually.`
      );
    }
    ids.add(id);

    const item = {
      name: entry.name,
      version: entry.version,
      package_id: id,
      skip: Boolean(existingReview),
      skip_reason: existingReview
        ? `${entry.name} already has review ${existingReview.id} for ${requirement.id}.`
        : null,
    };

    if (existingReview) skipped.push(item);
    else pending.push(item);
  }

  const request = {
    packages: [...pending, ...skipped],
    pending: pending.map((item) => item.name),
    skipped: skipped.map((item) => ({ name: item.name, reason: item.skip_reason })),
    requirement_id: requirement.id,
    requirement_slug: requirement.slug,
    mode,
    issue_number: Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : null,
    issue_url: issueURL || null,
    requester: requester || null,
    use_case: useCase || null,
    alternatives: alternatives || null,
    disclosure: disclosure || null,
    requested_at: new Date().toISOString(),
    skip: pending.length === 0,
    skip_reason:
      pending.length === 0
        ? "Every requested package already has a review for this requirement."
        : null,
  };

  await writeJSON(path.join(AI_DIR, "request.json"), request);
  await Promise.all([
    rm(REQUESTS_DIR, { recursive: true, force: true }),
    rm(path.join(AI_DIR, "dossiers"), { recursive: true, force: true }),
    rm(path.join(AI_DIR, "reviews"), { recursive: true, force: true }),
    rm(path.join(AI_DIR, "suite"), { recursive: true, force: true }),
  ]);

  if (pending.length === 0) {
    await setOutput("skip", "true");
    await setOutput("count", "0");
    await setOutput("mode", mode);
    console.log(`Skipping: ${request.skip_reason}`);
    for (const item of skipped) console.log(`  = ${item.name}: ${item.skip_reason}`);
    return;
  }

  const { packages: _packages, pending: _pending, skipped: _skipped, ...base } = request;
  await mkdir(REQUESTS_DIR, { recursive: true });

  for (const item of pending) {
    await writeJSON(path.join(REQUESTS_DIR, `${item.package_id}.json`), {
      ...base,
      package: item.name,
      version: item.version,
      package_id: item.package_id,
      batch: mode === "batch" && pending.length > 1,
      batch_size: pending.length,
      ...(mode === "batch" && pending.length > 1
        ? {
            batch_packages: pending.map((entry) => ({
              name: entry.name,
              version: entry.version,
              package_id: entry.package_id,
            })),
          }
        : {}),
    });
  }

  await setOutput("skip", "false");
  await setOutput("count", String(pending.length));
  await setOutput("mode", mode);

  console.log(
    `Request: ${pending.length} package(s) for ${requirement.id} in ${mode} mode${
      skipped.length ? `, ${skipped.length} skipped` : ""
    }`
  );
  for (const item of pending) {
    console.log(`  + ${item.name}${item.version ? `@${item.version}` : ""}`);
  }
  for (const item of skipped) console.log(`  = ${item.name}: ${item.skip_reason}`);
  if (request.issue_url) console.log(`  Issue: ${request.issue_url}`);
  if (request.requester) console.log(`  Requester: ${request.requester}`);
}

main().catch((error) => {
  console.error(`prepare-request failed: ${error.message}`);
  process.exit(1);
});
