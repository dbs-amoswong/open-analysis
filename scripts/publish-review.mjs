import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readCollection, writeRecord } from "./lib/data.mjs";

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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function realDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function runURL() {
  if (!process.env.GITHUB_RUN_ID) return null;
  return `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${
    process.env.GITHUB_REPOSITORY || ""
  }/actions/runs/${process.env.GITHUB_RUN_ID}`;
}

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args["dry-run"]);
const reviewPath = args.review || path.join("ai", "review.json");
const dossierPath = args.dossier || path.join("ai", "dossier.json");
const requestPath = args.request || path.join("ai", "request.json");

async function main() {
  const [review, dossier, request, packages, reviews] = await Promise.all([
    readJSON(reviewPath),
    readJSON(dossierPath),
    readJSON(requestPath).catch(() => null),
    readCollection("packages"),
    readCollection("reviews"),
  ]);

  if (!isNonEmptyString(review.id)) throw new Error("review.id is required");
  if (!isNonEmptyString(review.package_id)) throw new Error("review.package_id is required");
  if (!isNonEmptyString(review.requirement_id)) {
    throw new Error("review.requirement_id is required");
  }
  if (!isNonEmptyString(review.summary)) throw new Error("review.summary is required");
  if (!Array.isArray(review.evidence) || review.evidence.length === 0) {
    throw new Error("review.evidence must be a non-empty array");
  }
  if (review.requirement_id !== dossier.requirement.id) {
    throw new Error(
      `review.requirement_id ${review.requirement_id} does not match dossier ${dossier.requirement.id}`
    );
  }

  const existingPackage = packages.find(
    (item) =>
      item.name === dossier.package.name && item.ecosystem === dossier.package.ecosystem
  );
  let newPackage = null;

  if (existingPackage) {
    review.package_id = existingPackage.id;
    if (existingPackage.latest_version !== dossier.package.latest_version) {
      console.log(
        `Note: data/packages/${existingPackage.id}.json records ${existingPackage.latest_version}, but this review covers ${dossier.package.latest_version}.`
      );
    }
  } else {
    const idCollision = packages.find(
      (item) => item.id === dossier.package.id && item.name !== dossier.package.name
    );
    if (idCollision) {
      throw new Error(
        `Package id ${dossier.package.id} is already used by ${idCollision.name}. Choose a different package name or id.`
      );
    }

    newPackage = {
      ...dossier.package,
      notes:
        dossier.package.notes ||
        `Facts collected from the npm registry on ${dossier.today}. Install size was not measured.`,
      published_at: realDate(dossier.package.published_at)
        ? dossier.package.published_at
        : dossier.today,
      install_size_kb:
        typeof dossier.package.install_size_kb === "number"
          ? dossier.package.install_size_kb
          : null,
      unpacked_size_kb:
        typeof dossier.package.unpacked_size_kb === "number"
          ? dossier.package.unpacked_size_kb
          : null,
      formats:
        Array.isArray(dossier.package.formats) && dossier.package.formats.length
          ? dossier.package.formats
          : ["cjs"],
      maintainers:
        Array.isArray(dossier.package.maintainers) && dossier.package.maintainers.length
          ? dossier.package.maintainers
          : ["unknown"],
      npm_provenance: Boolean(dossier.package.npm_provenance),
    };
  }

  if (reviews.some((item) => item.id === review.id)) {
    throw new Error(`Review id ${review.id} already exists.`);
  }
  if (
    reviews.some(
      (item) =>
        item.package_id === review.package_id &&
        item.requirement_id === review.requirement_id
    )
  ) {
    throw new Error(
      `${review.package_id} already has a review for ${review.requirement_id}.`
    );
  }

  review.reviewed_version =
    review.reviewed_version || dossier.facts?.version || dossier.package.latest_version;
  review.reviewer = review.reviewer || "opencode";
  review.generated_by = {
    kind: "ai",
    tool: "opencode",
    agent: "package-review",
    model: process.env.OPENCODE_MODEL || "unknown",
    run_url: runURL(),
    request_issue: request?.issue_url || null,
    dossier_sha256: createHash("sha256")
      .update(JSON.stringify(dossier))
      .digest("hex"),
    generated_at: new Date().toISOString(),
  };

  if (dryRun) {
    console.log(`Dry run: would ${newPackage ? "add package" : "reuse package"} and add review.`);
    if (newPackage) {
      console.log(`  package: ${newPackage.id} (${newPackage.name}@${newPackage.latest_version})`);
    }
    console.log(`  review:  ${review.id} (${review.package_id} for ${review.requirement_id})`);
    console.log(`  decision: not touched; a human must add it to exactly one bucket.`);
    return;
  }

  if (newPackage) await writeRecord("packages", newPackage);
  await writeRecord("reviews", review);

  console.log(
    `Published ${review.id}: ${review.package_id} for ${review.requirement_id}${newPackage ? " (new package)" : ""}.`
  );
  console.log("Decision not changed. Add this package to exactly one bucket in data/decisions/.");
}

main().catch((error) => {
  console.error(`publish-review failed: ${error.message}`);
  process.exit(1);
});
