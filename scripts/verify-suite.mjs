import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECOMMENDATIONS = ["adopt", "hold", "avoid", "mixed"];

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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const args = parseArgs(process.argv.slice(2));
const reviewPath = args.review || path.join("ai", "suite", "review.json");
const inputPath = args.input || path.join("ai", "suite", "input.json");
const markerPath = path.join(path.dirname(path.resolve(ROOT, reviewPath)), "review.ok");

async function main() {
  const input = await readJSON(inputPath);
  let review;
  try {
    review = await readJSON(reviewPath);
  } catch (error) {
    throw new Error(`Suite review is not valid JSON: ${error.message}`);
  }

  const errors = [];
  if (review.requirement_id !== input.requirement?.id) {
    errors.push(
      `requirement_id: expected "${input.requirement?.id}", got "${review.requirement_id}"`
    );
  }
  if (!realDate(review.reviewed_at)) errors.push("reviewed_at: expected a real YYYY-MM-DD date");
  if (!RECOMMENDATIONS.includes(review.recommendation)) {
    errors.push(`recommendation: expected ${RECOMMENDATIONS.join(" | ")}`);
  }
  if (!isNonEmptyString(review.summary)) errors.push("summary: required");
  if (!isNonEmptyString(review.decision_note)) errors.push("decision_note: required");

  for (const field of ["compatibility", "shared_risks"]) {
    if (!Array.isArray(review[field])) {
      errors.push(`${field}: expected an array`);
      continue;
    }
    review[field].forEach((item, index) => {
      if (!isNonEmptyString(item)) errors.push(`${field}[${index}]: expected a non-empty string`);
    });
  }

  const expected = new Map((input.packages || []).map((pkg) => [pkg.id, pkg.name]));
  const seen = new Set();
  if (!Array.isArray(review.per_package) || review.per_package.length === 0) {
    errors.push("per_package: expected a non-empty array");
  } else {
    review.per_package.forEach((item, index) => {
      const at = `per_package[${index}]`;
      if (!isNonEmptyString(item?.package_id)) errors.push(`${at}.package_id: required`);
      else if (!expected.has(item.package_id)) {
        errors.push(`${at}.package_id: unknown package "${item.package_id}"`);
      } else if (seen.has(item.package_id)) {
        errors.push(`${at}.package_id: duplicate "${item.package_id}"`);
      } else {
        seen.add(item.package_id);
      }
      if (!isNonEmptyString(item?.name)) errors.push(`${at}.name: required`);
      if (!isNonEmptyString(item?.note)) errors.push(`${at}.note: required`);
    });
    for (const [id, name] of expected) {
      if (!seen.has(id)) errors.push(`per_package: missing ${name} (${id})`);
    }
  }

  if (/\b(undefined|NaN)\b/.test(JSON.stringify(review))) {
    errors.push("review contains a missing-value marker");
  }

  if (errors.length) {
    await rm(markerPath, { force: true });
    console.error(`Suite review validation failed with ${errors.length} error(s):`);
    for (const error of errors) console.error(`  ✕ ${error}`);
    process.exit(1);
  }

  await writeFile(markerPath, "ok\n", "utf8");
  console.log(
    `Suite review valid: ${review.recommendation} — ${input.packages.length} packages`
  );
}

main().catch(async (error) => {
  await rm(markerPath, { force: true }).catch(() => {});
  console.error(`verify-suite failed: ${error.message}`);
  process.exit(1);
});
