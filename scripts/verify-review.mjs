import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RECOMMENDATIONS = ["adopt", "hold", "avoid", "replace"];
const RISKS = ["low", "medium", "high", "critical"];
const EVIDENCE_STATUSES = ["pass", "warn", "fail", "info"];
const EVIDENCE_KEYS = [
  "publish_pipeline",
  "provenance",
  "cve",
  "maintenance",
  "dependencies",
  "types",
  "behaviour",
  "license",
];

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

function realDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function extractJSON(text) {
  let value = String(text).trim();
  value = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  if (value.startsWith("{") && value.endsWith("}")) return value;

  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start >= 0 && end > start) return value.slice(start, end + 1);
  return value;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const args = parseArgs(process.argv.slice(2));
const reviewPath = path.resolve(ROOT, args.review || path.join("ai", "review.json"));
const dossierPath = path.resolve(ROOT, args.dossier || path.join("ai", "dossier.json"));

async function main() {
  const dossier = await readJSON(dossierPath);
  const [reviews, packages] = await Promise.all([
    readJSON("data/reviews.json"),
    readJSON("data/packages.json"),
  ]);

  const raw = await readFile(reviewPath, "utf8");
  const extracted = extractJSON(raw);
  let review;
  try {
    review = JSON.parse(extracted);
  } catch (error) {
    throw new Error(`ai/review.json is not valid JSON: ${error.message}`);
  }

  if (extracted !== raw) {
    await writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  }

  const errors = [];
  const warnings = [];

  if (!review || typeof review !== "object" || Array.isArray(review)) {
    throw new Error("ai/review.json must contain one JSON object.");
  }

  if (!isNonEmptyString(review.id)) errors.push("id: required");
  if (!isNonEmptyString(review.package_id)) errors.push("package_id: required");
  if (!isNonEmptyString(review.requirement_id)) errors.push("requirement_id: required");
  if (!realDate(review.reviewed_at)) errors.push("reviewed_at: expected a real YYYY-MM-DD date");
  if (!isNonEmptyString(review.reviewer)) errors.push("reviewer: required");
  if (!RECOMMENDATIONS.includes(review.recommendation)) {
    errors.push(`recommendation: expected ${RECOMMENDATIONS.join(" | ")}`);
  }
  if (!RISKS.includes(review.risk)) errors.push(`risk: expected ${RISKS.join(" | ")}`);
  if (!Number.isInteger(review.score) || review.score < 0 || review.score > 100) {
    errors.push("score: expected an integer from 0 to 100");
  }
  if (!isNonEmptyString(review.summary)) errors.push("summary: required");
  if (!Array.isArray(review.reasoning) || review.reasoning.length === 0) {
    errors.push("reasoning: expected a non-empty array");
  } else {
    review.reasoning.forEach((item, index) => {
      if (!isNonEmptyString(item)) errors.push(`reasoning[${index}]: expected a non-empty string`);
    });
  }
  if (review.caveats !== undefined) {
    if (!Array.isArray(review.caveats)) {
      errors.push("caveats: expected an array when present");
    } else {
      review.caveats.forEach((item, index) => {
        if (!isNonEmptyString(item)) errors.push(`caveats[${index}]: expected a non-empty string`);
      });
    }
  }

  if (review.package_id !== dossier.package.id) {
    errors.push(
      `package_id: expected "${dossier.package.id}" from the dossier, got "${review.package_id}"`
    );
  }
  if (review.requirement_id !== dossier.requirement.id) {
    errors.push(
      `requirement_id: expected "${dossier.requirement.id}" from the dossier, got "${review.requirement_id}"`
    );
  }
  if (review.reviewed_at !== dossier.today) {
    warnings.push(
      `reviewed_at is ${review.reviewed_at}; the dossier was collected on ${dossier.today}.`
    );
  }

  const duplicateId = reviews.find((item) => item.id === review.id);
  if (duplicateId) errors.push(`id: "${review.id}" already exists in data/reviews.json`);

  const duplicateReview = reviews.find(
    (item) =>
      item.package_id === review.package_id &&
      item.requirement_id === review.requirement_id
  );
  if (duplicateReview) {
    errors.push(
      `${review.package_id} already has review ${duplicateReview.id} for ${review.requirement_id}`
    );
  }

  if (!packages.some((item) => item.id === dossier.package.id)) {
    warnings.push(
      `${dossier.package.id} is new and will be added to data/packages.json when published.`
    );
  }

  if (!Array.isArray(review.evidence) || review.evidence.length === 0) {
    errors.push("evidence: expected a non-empty array");
  } else {
    const allowedSources = new Set(dossier.sources || []);
    review.evidence.forEach((item, index) => {
      const at = `evidence[${index}]`;
      if (!isNonEmptyString(item?.key)) errors.push(`${at}.key: required`);
      else if (!EVIDENCE_KEYS.includes(item.key)) {
        warnings.push(`${at}.key: "${item.key}" is not one of the standard keys`);
      }
      if (!isNonEmptyString(item?.label)) errors.push(`${at}.label: required`);
      if (!EVIDENCE_STATUSES.includes(item?.status)) {
        errors.push(`${at}.status: expected ${EVIDENCE_STATUSES.join(" | ")}`);
      }
      if (!isNonEmptyString(item?.detail)) errors.push(`${at}.detail: required`);
      if (isNonEmptyString(item?.detail) && /\b(undefined|NaN)\b/.test(item.detail)) {
        warnings.push(`${at}.detail contains a missing-value marker`);
      }

      if (item?.sources !== undefined) {
        if (!Array.isArray(item.sources)) {
          errors.push(`${at}.sources: expected an array when present`);
        } else {
          item.sources.forEach((source, sourceIndex) => {
            const sourceAt = `${at}.sources[${sourceIndex}]`;
            if (!isNonEmptyString(source?.label)) errors.push(`${sourceAt}.label: required`);
            if (!isNonEmptyString(source?.url)) {
              errors.push(`${sourceAt}.url: required`);
            } else if (!/^https?:\/\//i.test(source.url)) {
              errors.push(`${sourceAt}.url: expected an http(s) URL`);
            } else if (!/^https:\/\//i.test(source.url)) {
              warnings.push(`${sourceAt}.url: prefer https`);
            } else if (allowedSources.size && !allowedSources.has(source.url)) {
              warnings.push(`${sourceAt}.url: not present in the dossier sources`);
            }
          });
        }
      }
    });
  }

  if (review.reviewed_version === undefined) {
    warnings.push("reviewed_version is missing; publish will copy it from the dossier.");
  }

  const serialized = JSON.stringify(review);
  if (/\b(TODO|TBD|lorem ipsum|placeholder)\b/i.test(serialized)) {
    warnings.push("Review text still contains a placeholder marker.");
  }

  if (warnings.length) {
    console.log(`Review warnings (${warnings.length}):`);
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }

  if (errors.length) {
    console.error(`Review validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  ✕ ${error}`);
    process.exit(1);
  }

  console.log(
    `Review valid: ${review.id} — ${review.package_id} for ${review.requirement_id} (${review.recommendation}, ${review.score})`
  );
}

main().catch((error) => {
  console.error(`verify-review failed: ${error.message}`);
  process.exit(1);
});
