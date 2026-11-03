import { readCollection, DATA_DIR, DIST_DIR, ASSETS_DIR } from "./data.mjs";

export { DATA_DIR, DIST_DIR, ASSETS_DIR };

const RECOMMENDATIONS = ["adopt", "hold", "avoid", "replace"];
const RISKS = ["low", "medium", "high", "critical"];
const CRITICALITIES = ["low", "medium", "high", "critical"];
const EVIDENCE_STATUSES = ["pass", "warn", "fail", "info"];
const DECISION_STATUSES = ["approved", "denied", "pending"];
const EVALUATION_KINDS = ["library", "stack", "prototype", "build", "reference"];
const EVALUATION_VERDICTS = ["retain", "migrate", "candidate", "reject", "reference", "build"];
const SPIKE_STATUSES = ["spike-pass", "spike-partial", "spike-fail", "not-spiked", "not-applicable"];
const FEATURE_STATES = ["native", "plugin", "custom", "none", "unknown", "not-applicable"];
const FEATURE_KEYS = ["general_editing", "ports", "undo_redo", "clipboard", "stencil", "snaplines", "minimap", "export", "layouts", "custom_nodes", "framework_independent"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const DAY_MS = 86400000;

const PERMISSIVE_LICENSES = ["MIT", "ISC", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "APACHE-2.0", "0BSD", "UNLICENSE", "CC0-1.0"];

const BVB_WEIGHTS = { scope: 0.35, difficulty: 0.3, commodity: 0.2, integration: 0.15 };

export function computeBuildVsBuy(bvb) {
  const weighted =
    BVB_WEIGHTS.scope * bvb.scope +
    BVB_WEIGHTS.difficulty * bvb.difficulty +
    BVB_WEIGHTS.commodity * bvb.commodity +
    BVB_WEIGHTS.integration * bvb.integration;
  const score = Math.round((weighted / 5) * 100);
  const verdict = score >= 70 ? "buy" : score >= 50 ? "evaluate" : "build";
  return { ...bvb, score, verdict };
}

export function licenseCategory(license) {
  const raw = String(license ?? "").toUpperCase();
  if (!raw) return "unknown";
  if (/SEE LICENSE|UNLICENSED|PROPRIETARY|COMMERCIAL/.test(raw)) return "proprietary";
  if (raw.includes(" OR ")) {
    const choices = raw.split(/\s+OR\s+/).map((part) => part.replace(/[()]/g, "").trim());
    if (choices.some((choice) => PERMISSIVE_LICENSES.includes(choice))) return "permissive";
  }
  const single = raw.replace(/[()]/g, "").trim();
  if (PERMISSIVE_LICENSES.includes(single)) return "permissive";
  // SPDX exceptions such as "Apache-2.0 WITH LLVM-exception" keep the
  // permissive character of the base licence. The exception only removes
  // permissions; it does not add copyleft obligations.
  if (single.includes(" WITH ")) {
    const [base] = single.split(/\s+WITH\s+/);
    if (PERMISSIVE_LICENSES.includes(base.trim())) return "permissive";
  }
  if (/AGPL|GPL-3|GPL-2/.test(single)) return "strong-copyleft";
  if (/LGPL|MPL/.test(single)) return "weak-copyleft";
  return "unknown";
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toUTC(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(iso, n) {
  return new Date(toUTC(iso) + n * DAY_MS).toISOString().slice(0, 10);
}

export function diffDays(a, b) {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

export async function loadModel({ today = todayISO() } = {}) {
  const [packages, requirements, reviews, decisions, evaluations] = await Promise.all([
    readCollection("packages"),
    readCollection("requirements"),
    readCollection("reviews"),
    readCollection("decisions"),
    readCollection("evaluations"),
  ]);

  const errors = [];
  const warnings = [];
  const err = (msg) => errors.push(msg);

  if (!Array.isArray(packages)) err("packages.json must be an array");
  if (!Array.isArray(requirements)) err("requirements.json must be an array");
  if (!Array.isArray(reviews)) err("reviews.json must be an array");
  if (!Array.isArray(decisions)) err("decisions.json must be an array");
  if (!Array.isArray(evaluations)) err("evaluations.json must be an array");
  if (errors.length) throw new ValidationError(errors, warnings);

  const seen = new Set();
  const pkgById = new Map();
  for (const [i, p] of packages.entries()) {
    const at = `packages[${i}]`;
    if (!isNonEmptyString(p.id)) err(`${at}.id: required`);
    if (!isNonEmptyString(p.name)) err(`${at}.name: required`);
    if (p.ecosystem !== "npm") err(`${at}.ecosystem: expected "npm"`);
    if (!isNonEmptyString(p.latest_version)) err(`${at}.latest_version: required`);
    if (!ISO_DATE.test(p.published_at || "")) err(`${at}.published_at: expected YYYY-MM-DD`);
    if (!isNonEmptyString(p.license)) err(`${at}.license: required`);
    if (typeof p.weekly_downloads !== "number") err(`${at}.weekly_downloads: expected number`);
    if (typeof p.runtime_deps !== "number") err(`${at}.runtime_deps: expected number`);
    if (!Array.isArray(p.formats) || p.formats.length === 0) err(`${at}.formats: expected non-empty array`);
    if (!Array.isArray(p.maintainers) || p.maintainers.length === 0) err(`${at}.maintainers: expected non-empty array`);
    if (!["bundled", "unresolved", "@types", "none"].includes(p.types)) {
      err(`${at}.types: expected bundled | unresolved | @types | none`);
    }
    if (typeof p.npm_provenance !== "boolean") {
      err(`${at}.npm_provenance: expected boolean`);
    }
    if (p.release_provenance !== undefined && typeof p.release_provenance !== "boolean") {
      err(`${at}.release_provenance: expected boolean when present`);
    }
    if (p.signed_release !== undefined && typeof p.signed_release !== "boolean") {
      err(`${at}.signed_release: expected boolean when present`);
    }
    if (p.provenance_note !== undefined && !isNonEmptyString(p.provenance_note)) {
      err(`${at}.provenance_note: expected non-empty string when present`);
    }
    if (p.build_vs_buy !== undefined) {
      if (!p.build_vs_buy || typeof p.build_vs_buy !== "object" || Array.isArray(p.build_vs_buy)) {
        err(`${at}.build_vs_buy: expected object when present`);
      } else {
        for (const key of ["scope", "difficulty", "commodity", "integration"]) {
          const value = p.build_vs_buy[key];
          if (!Number.isInteger(value) || value < 1 || value > 5) {
            err(`${at}.build_vs_buy.${key}: expected integer 1-5`);
          }
        }
        if (!isNonEmptyString(p.build_vs_buy.effort)) err(`${at}.build_vs_buy.effort: required`);
        if (!isNonEmptyString(p.build_vs_buy.rationale)) err(`${at}.build_vs_buy.rationale: required`);
      }
    }
    if (p.prior_versions !== undefined) {
      if (!Array.isArray(p.prior_versions)) {
        err(`${at}.prior_versions: expected array when present`);
      } else {
        for (const [j, prior] of p.prior_versions.entries()) {
          if (!isNonEmptyString(prior.version)) err(`${at}.prior_versions[${j}].version: required`);
          if (!ISO_DATE.test(prior.published_at || "")) {
            err(`${at}.prior_versions[${j}].published_at: expected YYYY-MM-DD`);
          }
          if (!RECOMMENDATIONS.includes(prior.recommendation)) {
            err(`${at}.prior_versions[${j}].recommendation: invalid`);
          }
          if (!isNonEmptyString(prior.note)) err(`${at}.prior_versions[${j}].note: required`);
        }
      }
    }
    if (p.install_size_kb !== null && typeof p.install_size_kb !== "number") {
      err(`${at}.install_size_kb: expected number or null`);
    }
    const key = `${p.ecosystem}:${p.name}`;
    if (seen.has(key)) err(`${at}: duplicate package ${key}`);
    seen.add(key);
    if (p.repo && !/^https:\/\//.test(p.repo)) err(`${at}.repo: expected https URL`);
    pkgById.set(p.id, {
      ...p,
      license_category: licenseCategory(p.license),
      build_vs_buy: p.build_vs_buy ? computeBuildVsBuy(p.build_vs_buy) : null,
      reviews: [],
    });
  }

  const reqById = new Map();
  for (const [i, r] of requirements.entries()) {
    const at = `requirements[${i}]`;
    if (!isNonEmptyString(r.id)) err(`${at}.id: required`);
    if (!isNonEmptyString(r.slug)) err(`${at}.slug: required`);
    if (!isNonEmptyString(r.title)) err(`${at}.title: required`);
    if (!isNonEmptyString(r.owner)) err(`${at}.owner: required`);
    if (!CRITICALITIES.includes(r.criticality)) err(`${at}.criticality: invalid`);
    if (!["active", "retired"].includes(r.status)) err(`${at}.status: expected active | retired`);
    if (!ISO_DATE.test(r.created_at || "")) err(`${at}.created_at: expected YYYY-MM-DD`);
    if (!Number.isInteger(r.review_cadence_days) || r.review_cadence_days < 1) {
      err(`${at}.review_cadence_days: expected positive integer`);
    }
    if (!Array.isArray(r.constraints)) err(`${at}.constraints: expected array`);
    reqById.set(r.id, { ...r, reviews: [], candidates: [], decision: null, evaluations: [] });
  }

  const evaluationById = new Map();
  for (const [i, evaluation] of evaluations.entries()) {
    const at = `evaluations[${i}]`;
    if (!isNonEmptyString(evaluation.id)) err(`${at}.id: required`);
    if (evaluationById.has(evaluation.id)) err(`${at}: duplicate evaluation id ${evaluation.id}`);
    if (!reqById.has(evaluation.requirement_id)) {
      err(`${at}.requirement_id: unknown requirement "${evaluation.requirement_id}"`);
    }
    if (!isNonEmptyString(evaluation.name)) err(`${at}.name: required`);
    if (evaluation.version !== undefined && !isNonEmptyString(evaluation.version)) {
      err(`${at}.version: expected non-empty string when present`);
    }
    if (!EVALUATION_KINDS.includes(evaluation.kind)) err(`${at}.kind: invalid`);
    if (!EVALUATION_VERDICTS.includes(evaluation.verdict)) err(`${at}.verdict: invalid`);
    if (!isNonEmptyString(evaluation.license)) err(`${at}.license: required`);
    if (!Number.isInteger(evaluation.fit_score) || evaluation.fit_score < 0 || evaluation.fit_score > 100) {
      err(`${at}.fit_score: expected 0-100`);
    }
    if (!isNonEmptyString(evaluation.summary)) err(`${at}.summary: required`);
    for (const field of ["gains", "losses"]) {
      if (!Array.isArray(evaluation[field]) || evaluation[field].some((item) => !isNonEmptyString(item))) {
        err(`${at}.${field}: expected array of non-empty strings`);
      }
    }
    if (evaluation.blockers !== undefined) {
      if (!Array.isArray(evaluation.blockers) || evaluation.blockers.some((item) => !isNonEmptyString(item))) {
        err(`${at}.blockers: expected array of non-empty strings when present`);
      }
    }
    if (!evaluation.features || typeof evaluation.features !== "object" || Array.isArray(evaluation.features)) {
      err(`${at}.features: expected object`);
    } else {
      for (const [key, state] of Object.entries(evaluation.features)) {
        if (!FEATURE_KEYS.includes(key)) err(`${at}.features.${key}: unknown feature`);
        if (!FEATURE_STATES.includes(state)) err(`${at}.features.${key}: invalid state`);
      }
    }
    if (!evaluation.spike || typeof evaluation.spike !== "object" || Array.isArray(evaluation.spike)) {
      err(`${at}.spike: expected object`);
    } else {
      const spike = evaluation.spike;
      if (!SPIKE_STATUSES.includes(spike.status)) err(`${at}.spike.status: invalid`);
      if (spike.tested_at !== undefined && !ISO_DATE.test(spike.tested_at)) {
        err(`${at}.spike.tested_at: expected YYYY-MM-DD when present`);
      }
      if (spike.screenshot !== undefined && !/^[a-z0-9][a-z0-9._-]*\.(png|jpg|webp)$/i.test(spike.screenshot)) {
        err(`${at}.spike.screenshot: expected a local image filename`);
      }
      if (spike.code_path !== undefined && !/^spikes\//.test(spike.code_path)) {
        err(`${at}.spike.code_path: expected a path under spikes/`);
      }
      if (spike.notes !== undefined && !isNonEmptyString(spike.notes)) {
        err(`${at}.spike.notes: expected non-empty string when present`);
      }
      if (spike.metrics !== undefined) {
        if (!spike.metrics || typeof spike.metrics !== "object" || Array.isArray(spike.metrics)) {
          err(`${at}.spike.metrics: expected object when present`);
        } else {
          for (const key of ["mount_ms", "nodes", "edges", "bundle_kb", "gzip_kb"]) {
            if (spike.metrics[key] !== undefined && typeof spike.metrics[key] !== "number") {
              err(`${at}.spike.metrics.${key}: expected number when present`);
            }
          }
        }
      }
    }
    if (evaluation.sources !== undefined) {
      if (!Array.isArray(evaluation.sources)) err(`${at}.sources: expected array when present`);
      else {
        for (const [j, source] of evaluation.sources.entries()) {
          if (!isNonEmptyString(source.label)) err(`${at}.sources[${j}].label: required`);
          if (!isNonEmptyString(source.url) || !/^https:\/\//.test(source.url)) {
            err(`${at}.sources[${j}].url: expected https URL`);
          }
        }
      }
    }
    evaluationById.set(evaluation.id, evaluation);
    if (reqById.has(evaluation.requirement_id)) reqById.get(evaluation.requirement_id).evaluations.push(evaluation);
    if (evaluation.spike?.status === "spike-pass" && !evaluation.spike.screenshot) {
      warnings.push(`${at}: spiked but has no screenshot`);
    }
  }

  const reviewById = new Map();
  for (const [i, rev] of reviews.entries()) {
    const at = `reviews[${i}]`;
    if (!isNonEmptyString(rev.id)) err(`${at}.id: required`);
    if (reviewById.has(rev.id)) err(`${at}: duplicate review id ${rev.id}`);
    if (!pkgById.has(rev.package_id)) err(`${at}.package_id: unknown package "${rev.package_id}"`);
    if (!reqById.has(rev.requirement_id)) err(`${at}.requirement_id: unknown requirement "${rev.requirement_id}"`);
    if (!ISO_DATE.test(rev.reviewed_at || "")) err(`${at}.reviewed_at: expected YYYY-MM-DD`);
    if (rev.reviewed_version !== undefined && !isNonEmptyString(rev.reviewed_version)) {
      err(`${at}.reviewed_version: expected non-empty string when present`);
    }
    if (!RECOMMENDATIONS.includes(rev.recommendation)) err(`${at}.recommendation: invalid`);
    if (!RISKS.includes(rev.risk)) err(`${at}.risk: invalid`);
    if (!Number.isInteger(rev.score) || rev.score < 0 || rev.score > 100) err(`${at}.score: expected 0-100`);
    if (!isNonEmptyString(rev.summary)) err(`${at}.summary: required`);
    if (!Array.isArray(rev.reasoning) || rev.reasoning.length === 0) err(`${at}.reasoning: expected non-empty array`);
    if (!Array.isArray(rev.evidence) || rev.evidence.length === 0) err(`${at}.evidence: expected non-empty array`);
    for (const [j, ev] of (rev.evidence || []).entries()) {
      if (!EVIDENCE_STATUSES.includes(ev.status)) err(`${at}.evidence[${j}].status: invalid`);
      if (!isNonEmptyString(ev.label)) err(`${at}.evidence[${j}].label: required`);
      if (!isNonEmptyString(ev.detail)) err(`${at}.evidence[${j}].detail: required`);
    }
    reviewById.set(rev.id, rev);
  }

  const decisionByReq = new Map();
  for (const [i, dec] of decisions.entries()) {
    const at = `decisions[${i}]`;
    if (!isNonEmptyString(dec.id)) err(`${at}.id: required`);
    if (!reqById.has(dec.requirement_id)) err(`${at}.requirement_id: unknown requirement "${dec.requirement_id}"`);
    if (decisionByReq.has(dec.requirement_id)) err(`${at}: more than one decision for ${dec.requirement_id}`);
    if (!DECISION_STATUSES.includes(dec.status)) err(`${at}.status: invalid`);
    if (!ISO_DATE.test(dec.decided_at || "")) err(`${at}.decided_at: expected YYYY-MM-DD`);
    if (!ISO_DATE.test(dec.expires_at || "")) err(`${at}.expires_at: expected YYYY-MM-DD`);
    if (!isNonEmptyString(dec.rationale)) err(`${at}.rationale: required`);
    if (dec.confidence !== undefined && !["high", "medium", "low"].includes(dec.confidence)) {
      err(`${at}.confidence: expected high | medium | low when present`);
    }
    for (const field of ["criteria", "conditions", "unknowns", "review_triggers"]) {
      if (dec[field] !== undefined) {
        if (!Array.isArray(dec[field]) || dec[field].some((item) => !isNonEmptyString(item))) {
          err(`${at}.${field}: expected array of non-empty strings when present`);
        }
      }
    }
    if (dec.reversal_cost !== undefined && !isNonEmptyString(dec.reversal_cost)) {
      err(`${at}.reversal_cost: expected non-empty string when present`);
    }
    if (dec.alternatives_considered !== undefined) {
      if (!Array.isArray(dec.alternatives_considered)) {
        err(`${at}.alternatives_considered: expected array when present`);
      } else {
        for (const [j, alternative] of dec.alternatives_considered.entries()) {
          if (!isNonEmptyString(alternative?.name)) err(`${at}.alternatives_considered[${j}].name: required`);
          if (!isNonEmptyString(alternative?.outcome)) err(`${at}.alternatives_considered[${j}].outcome: required`);
          if (!isNonEmptyString(alternative?.reason)) err(`${at}.alternatives_considered[${j}].reason: required`);
        }
      }
    }
    for (const field of ["adopted", "hold", "rejected"]) {
      if (!Array.isArray(dec[field])) err(`${at}.${field}: expected array`);
    }
    for (const drop of dec.dropped || []) {
      if (!pkgById.has(drop.package_id)) err(`${at}.dropped: unknown package "${drop.package_id}"`);
      if (!ISO_DATE.test(drop.deadline || "")) err(`${at}.dropped.deadline: expected YYYY-MM-DD`);
    }
    decisionByReq.set(dec.requirement_id, dec);
  }

  if (errors.length) throw new ValidationError(errors, warnings);

  // Attach reviews and bucket every package that has a review for a requirement.
  for (const rev of reviews) {
    pkgById.get(rev.package_id).reviews.push(rev);
    reqById.get(rev.requirement_id).reviews.push(rev);
  }

  const reviewViews = new Map();
  for (const rev of reviews) {
    const req = reqById.get(rev.requirement_id);
    const cadence = Number.isInteger(rev.cadence_days) ? rev.cadence_days : req.review_cadence_days;
    const next = addDays(rev.reviewed_at, cadence);
    const daysLeft = diffDays(next, today);
    const state = daysLeft < 0 ? "overdue" : daysLeft <= 30 ? "due_soon" : "current";
    const view = {
      ...rev,
      reviewed_version: rev.reviewed_version || pkgById.get(rev.package_id).latest_version,
      cadence_days: cadence,
      next_review_at: next,
      days_until_review: daysLeft,
      review_state: state,
      package: pkgById.get(rev.package_id),
      requirement: req,
    };
    reviewViews.set(rev.id, view);
  }

  const attention = [];

  for (const dec of decisions) {
    const req = reqById.get(dec.requirement_id);
    const daysLeft = diffDays(dec.expires_at, today);
    const state = daysLeft < 0 ? "expired" : daysLeft <= 30 ? "expiring" : "active";
    const bucketOf = new Map();
    for (const id of dec.adopted) bucketOf.set(id, "adopted");
    for (const id of dec.hold) bucketOf.set(id, "hold");
    for (const id of dec.rejected) bucketOf.set(id, "rejected");
    for (const d of dec.dropped) bucketOf.set(d.package_id, "dropped");

    // Integrity: every package reviewed for this requirement must be bucketed exactly once.
    const dropById = new Map(dec.dropped.map((d) => [d.package_id, d]));
    const reviewedIds = req.reviews.map((r) => r.package_id);
    for (const pid of new Set(reviewedIds)) {
      if (!bucketOf.has(pid)) {
        warnings.push(`${dec.id}: package "${pid}" has a review but is not in adopted/hold/rejected/dropped`);
      }
    }
    for (const [pid] of bucketOf) {
      if (!reviewedIds.includes(pid)) {
        warnings.push(`${dec.id}: package "${pid}" is bucketed but has no review for ${req.id}`);
      }
    }
    const bucketsSeen = new Map();
    for (const [pid, bucket] of bucketOf) {
      if (bucketsSeen.has(pid)) warnings.push(`${dec.id}: package "${pid}" appears in multiple buckets`);
      bucketsSeen.set(pid, bucket);
    }

    const primary = pkgById.get(dec.primary_package_id);
    if (!primary) err(`decisions: unknown primary_package_id "${dec.primary_package_id}"`);
    const primaryReview = reviewViews.get(
      req.reviews.find((r) => r.package_id === dec.primary_package_id)?.id
    );
    if (dec.status === "approved") {
      if (!dec.adopted.includes(dec.primary_package_id)) {
        err(`${dec.id}: primary package must be listed in adopted`);
      }
      if (primaryReview && primaryReview.recommendation !== "adopt") {
        err(`${dec.id}: primary package review says "${primaryReview.recommendation}", expected adopt`);
      }
      if (primaryReview && ["high", "critical"].includes(primaryReview.risk)) {
        warnings.push(`${dec.id}: primary package has ${primaryReview.risk} risk`);
      }
    }

    const view = {
      ...dec,
      requirement: req,
      primary,
      primary_review: primaryReview || null,
      package_ids: [...bucketOf.keys()],
      bucket_of: bucketOf,
      drop_by_id: dropById,
      days_until_expiry: daysLeft,
      decision_state: state,
    };
    decisionByReq.set(dec.requirement_id, view);
    req.decision = view;

    if (state === "expired") {
      attention.push({
        kind: "decision",
        severity: "overdue",
        title: `Whitelist decision expired: ${req.title}`,
        detail: `Decision ${dec.id} expired on ${dec.expires_at}. Re-review before relying on it.`,
        href: `requirements/${req.slug}.html`,
        sort: daysLeft,
      });
    } else if (state === "expiring") {
      attention.push({
        kind: "decision",
        severity: "due_soon",
        title: `Whitelist decision expiring: ${req.title}`,
        detail: `Expires ${dec.expires_at} (${daysLeft} days).`,
        href: `requirements/${req.slug}.html`,
        sort: daysLeft,
      });
    }
  }

  for (const view of reviewViews.values()) {
    const pkg = view.package;
    const req = view.requirement;
    if (view.review_state === "overdue") {
      attention.push({
        kind: "review",
        severity: "overdue",
        title: `Review overdue: ${pkg.name}`,
        detail: `Last reviewed ${view.reviewed_at}; due ${view.next_review_at} (${Math.abs(view.days_until_review)} days ago).`,
        href: `packages/${pkg.id}.html`,
        sort: view.days_until_review,
      });
    } else if (view.review_state === "due_soon") {
      attention.push({
        kind: "review",
        severity: "due_soon",
        title: `Review due soon: ${pkg.name}`,
        detail: `Due ${view.next_review_at} (${view.days_until_review} days).`,
        href: `packages/${pkg.id}.html`,
        sort: view.days_until_review,
      });
    }
  }

  attention.sort((a, b) => a.sort - b.sort);

  for (const req of reqById.values()) {
    const latestByPackage = new Map();
    for (const rev of req.reviews) {
      const prev = latestByPackage.get(rev.package_id);
      if (!prev || rev.reviewed_at > prev.reviewed_at) latestByPackage.set(rev.package_id, rev);
    }
    req.candidates = [...latestByPackage.values()]
      .map((rev) => {
        const dec = req.decision;
        const bucket = dec ? dec.bucket_of.get(rev.package_id) || "unclassified" : "unclassified";
        return {
          package: pkgById.get(rev.package_id),
          review: reviewViews.get(rev.id),
          bucket,
          dropped: dec?.drop_by_id.get(rev.package_id) || null,
        };
      })
      .sort((a, b) => {
        const rank = { adopt: 0, hold: 1, avoid: 2, replace: 3 };
        return rank[a.review.recommendation] - rank[b.review.recommendation] || b.review.score - a.review.score;
      });
    req.next_review_at = req.candidates.reduce(
      (soonest, c) => (!soonest || c.review.next_review_at < soonest ? c.review.next_review_at : soonest),
      null
    );
  }

  for (const pkg of pkgById.values()) {
    pkg.reviews.sort((a, b) => (a.reviewed_at < b.reviewed_at ? 1 : -1));
    pkg.latest_review = pkg.reviews.length ? reviewViews.get(pkg.reviews[0].id) : null;
  }

  const adopted = [];
  const held = [];
  const dropped = [];
  const rejected = [];
  for (const dec of decisionByReq.values()) {
    for (const pid of dec.adopted) adopted.push({ package: pkgById.get(pid), decision: dec, bucket: "adopted" });
    for (const pid of dec.hold) held.push({ package: pkgById.get(pid), decision: dec, bucket: "hold" });
    for (const pid of dec.rejected) rejected.push({ package: pkgById.get(pid), decision: dec, bucket: "rejected" });
    for (const d of dec.dropped) {
      dropped.push({ package: pkgById.get(d.package_id), decision: dec, bucket: "dropped", drop: d });
    }
  }

  const model = {
    today,
    generated_at: new Date().toISOString(),
    packages: [...pkgById.values()],
    requirements: [...reqById.values()],
    reviews: [...reviews],
    review_views: reviewViews,
    decisions: [...decisionByReq.values()],
    evaluations: [...evaluations],
    attention,
    warnings,
    errors,
    whitelist: { adopted, hold: held, dropped, rejected },
  };

  const counts = {
    packages: model.packages.length,
    requirements: model.requirements.filter((r) => r.status === "active").length,
    evaluations: model.evaluations.length,
    adopted: adopted.length,
    dropped: dropped.length,
    hold: held.length,
    rejected: rejected.length,
    overdue: attention.filter((a) => a.severity === "overdue").length,
    due_soon: attention.filter((a) => a.severity === "due_soon").length,
    provenance: model.packages.filter((p) => p.npm_provenance).length,
    release_provenance: model.packages.filter((p) => p.release_provenance && !p.npm_provenance).length,
    licenses: {
      permissive: model.packages.filter((p) => p.license_category === "permissive").length,
      "weak-copyleft": model.packages.filter((p) => p.license_category === "weak-copyleft").length,
      "strong-copyleft": model.packages.filter((p) => p.license_category === "strong-copyleft").length,
      proprietary: model.packages.filter((p) => p.license_category === "proprietary").length,
      unknown: model.packages.filter((p) => p.license_category === "unknown").length,
    },
    build_vs_buy: {
      buy: model.packages.filter((p) => p.build_vs_buy?.verdict === "buy").length,
      evaluate: model.packages.filter((p) => p.build_vs_buy?.verdict === "evaluate").length,
      build: model.packages.filter((p) => p.build_vs_buy?.verdict === "build").length,
      unrated: model.packages.filter((p) => !p.build_vs_buy).length,
    },
    unclassified: model.requirements.reduce(
      (n, r) => n + (r.decision ? 0 : r.candidates.length),
      0
    ),
  };
  model.counts = counts;

  return model;
}

export class ValidationError extends Error {
  constructor(errors, warnings = []) {
    super(`Data validation failed with ${errors.length} error(s)`);
    this.name = "ValidationError";
    this.errors = errors;
    this.warnings = warnings;
  }
}
