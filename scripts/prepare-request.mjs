import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const AI_DIR = path.join(ROOT, "ai");

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

function cleanPackageName(value) {
  return firstLine(value)
    .replace(/^`+|`+$/g, "")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function cleanVersion(value) {
  const version = firstLine(value).replace(/^`+|`+$/g, "").trim();
  if (!version || /^_?no response_?$/i.test(version) || /^latest$/i.test(version)) return "";
  return version.replace(/^v/i, "");
}

const args = parseArgs(process.argv.slice(2));
const issueBody = args["issue-body-file"]
  ? await readFile(args["issue-body-file"], "utf8")
  : process.env.ISSUE_BODY || "";
const sections = parseSections(issueBody);

const packageName = cleanPackageName(
  args.package || process.env.PACKAGE || sectionValue(sections, ["npm package name", "Package name"])
);
const version = cleanVersion(
  args.version || process.env.VERSION || sectionValue(sections, ["Version to review", "Version"])
);
const requirementInput = firstLine(
  args.requirement ||
    process.env.REQUIREMENT ||
    sectionValue(sections, ["Requirement ID or slug", "Requirement"])
);
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
  if (!packageName) {
    throw new Error(
      "No package name found. Add it to the issue form or run with --package <name>."
    );
  }

  if (
    packageName.length > 214 ||
    !/^(@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/i.test(packageName)
  ) {
    throw new Error(`"${packageName}" does not look like an npm package name.`);
  }

  if (!requirementInput) {
    throw new Error(
      "No requirement found. Add it to the issue form or run with --requirement <id>."
    );
  }

  const requirementMatch = requirementInput.match(/req-[a-z0-9-]+/i);
  const requirementKey = requirementMatch ? requirementMatch[0] : requirementInput;
  const requirements = await readJSON("data/requirements.json");
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

  const [packages, reviews] = await Promise.all([
    readJSON("data/packages.json"),
    readJSON("data/reviews.json"),
  ]);
  const existingPackage = packages.find(
    (item) => item.name === packageName && item.ecosystem === "npm"
  );
  const existingReview = existingPackage
    ? reviews.find(
        (review) =>
          review.package_id === existingPackage.id &&
          review.requirement_id === requirement.id
      )
    : null;

  const request = {
    package: packageName,
    version: version || null,
    requirement_id: requirement.id,
    requirement_slug: requirement.slug,
    issue_number: Number.isInteger(issueNumber) && issueNumber > 0 ? issueNumber : null,
    issue_url: issueURL || null,
    requester: requester || null,
    use_case: useCase || null,
    alternatives: alternatives || null,
    disclosure: disclosure || null,
    requested_at: new Date().toISOString(),
    skip: Boolean(existingReview),
    skip_reason: existingReview
      ? `${packageName} already has review ${existingReview.id} for ${requirement.id}.`
      : null,
  };

  await writeJSON(path.join(AI_DIR, "request.json"), request);

  if (existingReview) {
    await setOutput("skip", "true");
    console.log(`Skipping: ${request.skip_reason}`);
    return;
  }

  await setOutput("skip", "false");
  console.log(
    `Request: ${packageName}${version ? `@${version}` : ""} for ${requirement.id}`
  );
  if (request.issue_url) console.log(`  Issue: ${request.issue_url}`);
  if (request.requester) console.log(`  Requester: ${request.requester}`);
}

main().catch((error) => {
  console.error(`prepare-request failed: ${error.message}`);
  process.exit(1);
});
