import { mkdtemp, cp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(path.join(os.tmpdir(), "prb-pipeline-"));

const fixture = {
  id: "pkg-test-unrated",
  name: "test-unrated",
  ecosystem: "npm",
  latest_version: "1.0.0",
  published_at: "2026-01-01",
  repo: null,
  registry: "https://example.com/test-unrated",
  license: "MIT",
  weekly_downloads: 0,
  runtime_deps: 0,
  install_size_kb: null,
  unpacked_size_kb: null,
  maintainers: ["fixture"],
  types: "none",
  formats: ["cjs"],
  notes: "Fixture for the publish-path smoke test.",
  npm_provenance: false,
};

try {
  await cp(path.join(ROOT, "data"), temp, { recursive: true });
  process.env.PRB_DATA_DIR = temp;

  const { loadModel, ValidationError } = await import("./lib/load.mjs");

  const packagesPath = path.join(temp, "packages.json");
  const packages = JSON.parse(await readFile(packagesPath, "utf8"));
  packages.push(fixture);
  await writeFile(packagesPath, `${JSON.stringify(packages, null, 2)}\n`);

  // A package ingested by the automated pipeline has no build-vs-buy assessment.
  const model = await loadModel({ today: "2026-10-28" });
  const ingested = model.packages.find((p) => p.id === fixture.id);
  if (!ingested) throw new Error("fixture package was not loaded");
  if (ingested.build_vs_buy !== null) {
    throw new Error("expected an ingested package without build_vs_buy to load as unrated");
  }

  // A malformed assessment must still be rejected.
  const invalid = packages.map((p) =>
    p.id === fixture.id
      ? {
          ...p,
          build_vs_buy: {
            scope: 9,
            difficulty: 3,
            commodity: 3,
            integration: 3,
            effort: "fixture",
            rationale: "fixture",
          },
        }
      : p
  );
  await writeFile(packagesPath, `${JSON.stringify(invalid, null, 2)}\n`);

  let rejected = false;
  try {
    await loadModel({ today: "2026-10-28" });
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    rejected = error.errors.some((message) => message.includes("build_vs_buy.scope"));
  }
  if (!rejected) throw new Error("expected invalid build_vs_buy to fail validation");

  console.log("Pipeline: unrated packages pass; invalid build_vs_buy is rejected.");
} finally {
  await rm(temp, { recursive: true, force: true });
}
