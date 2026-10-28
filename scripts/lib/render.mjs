const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return esc(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const nf = new Intl.NumberFormat("en-US");

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const fmtNum = (n) => (typeof n === "number" ? nf.format(n) : "—");

export function fmtCompact(n) {
  if (typeof n !== "number") return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

export function fmtSize(kb) {
  if (typeof kb !== "number") return "—";
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} MB`;
  return `${kb} KB`;
}

function relativeDays(days) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

const REC = {
  adopt: { label: "Adopt", tone: "ok" },
  hold: { label: "Hold", tone: "warn" },
  avoid: { label: "Avoid", tone: "bad" },
  replace: { label: "Replace", tone: "info" },
};

const RISK = {
  low: { label: "Low risk", tone: "ok" },
  medium: { label: "Medium risk", tone: "warn" },
  high: { label: "High risk", tone: "bad" },
  critical: { label: "Critical risk", tone: "bad" },
};

const REVIEW_STATE = {
  current: { label: "Current", tone: "ok" },
  due_soon: { label: "Due soon", tone: "warn" },
  overdue: { label: "Overdue", tone: "bad" },
};

const DECISION_STATE = {
  active: { label: "Active", tone: "ok" },
  expiring: { label: "Expiring", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
};

const DECISION_STATUS = {
  approved: { label: "Approved", tone: "ok" },
  denied: { label: "Denied", tone: "bad" },
  pending: { label: "Pending", tone: "warn" },
};

const EVIDENCE = {
  pass: { label: "Pass", tone: "ok", icon: "✓" },
  warn: { label: "Warn", tone: "warn", icon: "!" },
  fail: { label: "Fail", tone: "bad", icon: "✕" },
  info: { label: "Info", tone: "neutral", icon: "i" },
};

const BUCKET = {
  adopted: { label: "Adopted", tone: "ok" },
  hold: { label: "On hold", tone: "warn" },
  dropped: { label: "Dropped", tone: "bad" },
  rejected: { label: "Rejected", tone: "bad" },
  unclassified: { label: "Unclassified", tone: "neutral" },
};

export const pill = (text, tone = "neutral") => `<span class="pill pill-${tone}">${esc(text)}</span>`;

export const recPill = (rec) => pill(REC[rec]?.label ?? rec, REC[rec]?.tone ?? "neutral");
export const riskPill = (risk) => pill(RISK[risk]?.label ?? risk, RISK[risk]?.tone ?? "neutral");

export function reviewStatePill(review) {
  const cfg = REVIEW_STATE[review.review_state] ?? REVIEW_STATE.current;
  const suffix =
    review.review_state === "overdue"
      ? ` · ${Math.abs(review.days_until_review)}d late`
      : review.review_state === "due_soon"
        ? ` · ${review.days_until_review}d`
        : "";
  return pill(`${cfg.label}${suffix}`, cfg.tone);
}

export function decisionStatePill(decision) {
  const cfg = DECISION_STATE[decision.decision_state] ?? DECISION_STATE.active;
  return pill(cfg.label, cfg.tone);
}

export const decisionStatusPill = (status) => {
  const cfg = DECISION_STATUS[status] ?? DECISION_STATUS.pending;
  return pill(cfg.label, cfg.tone);
};

export const bucketPill = (bucket) => {
  const cfg = BUCKET[bucket] ?? BUCKET.unclassified;
  return pill(cfg.label, cfg.tone);
};

const LICENSE_TONE = {
  permissive: "ok",
  "weak-copyleft": "warn",
  "strong-copyleft": "bad",
  proprietary: "bad",
  unknown: "neutral",
};

const licenseLabel = (license) =>
  String(license ?? "").replace(/\s+OR\s+/g, " / ").replace(/[()]/g, "");

const licenseText = (license) => {
  const raw = String(license ?? "");
  return /SEE LICENSE|UNLICENSED|PROPRIETARY|COMMERCIAL/i.test(raw) ? "Proprietary" : licenseLabel(raw);
};

export function licenseBadge(pkg) {
  const tone = LICENSE_TONE[pkg.license_category] ?? "neutral";
  return `<span class="license license-${tone}" title="Declared license: ${esc(pkg.license)} (${esc(pkg.license_category)})"><span class="license-mark" aria-hidden="true">©</span>${esc(licenseText(pkg.license))}</span>`;
}

export function provenanceBadge(pkg) {
  if (pkg.npm_provenance) {
    return `<span class="prov prov-npm" title="npm registry attestation present on the published tarball"><span class="prov-mark" aria-hidden="true">✓</span>npm</span>`;
  }
  if (pkg.release_provenance) {
    return `<span class="prov prov-release" title="SLSA attestation on GitHub release artifacts; the npm tarball itself is unattested"><span class="prov-mark" aria-hidden="true">✓</span>release</span>`;
  }
  return `<span class="prov prov-none" title="No provenance attestation found"><span class="prov-mark" aria-hidden="true">—</span>none</span>`;
}

const BVB = {
  buy: { label: "Buy", tone: "info" },
  evaluate: { label: "Evaluate", tone: "warn" },
  build: { label: "Build", tone: "neutral" },
};

export function buildVsBuyBadge(pkg) {
  const bvb = pkg.build_vs_buy;
  if (!bvb) return '<span class="bvb bvb-neutral" title="Not assessed yet">Unrated</span>';
  const cfg = BVB[bvb.verdict] ?? BVB.evaluate;
  return `<span class="bvb bvb-${cfg.tone}" title="Build vs buy ${bvb.score}/100. ${esc(bvb.rationale)}">${cfg.label} ${bvb.score}</span>`;
}

function bvbScale(value) {
  return `<span class="bvb-scale" aria-label="${value} of 5">${[1, 2, 3, 4, 5]
    .map((i) => `<span class="bvb-dot${i <= value ? " is-on" : ""}"></span>`)
    .join("")}</span>`;
}

function bvbRow(label, value, hint) {
  return `<div class="bvb-row" title="${esc(hint)}">
    <span class="bvb-label">${esc(label)}</span>
    ${bvbScale(value)}
    <span class="bvb-num">${value}/5</span>
  </div>`;
}

function scoreBar(score) {
  const tone = score >= 80 ? "ok" : score >= 60 ? "warn" : "bad";
  return `<span class="score" title="Score ${score} of 100"><span class="score-num">${score}</span><span class="score-track"><span class="score-fill score-${tone}" style="width:${Math.max(2, score)}%"></span></span></span>`;
}

const evIcon = (status) => `<span class="ev ev-${EVIDENCE[status]?.tone ?? "neutral"}" aria-label="${esc(EVIDENCE[status]?.label ?? status)}">${EVIDENCE[status]?.icon ?? "?"}</span>`;

function findEvidence(review, key) {
  return review?.evidence?.find((e) => e.key === key) ?? null;
}

function miniBadge(review, key, label) {
  const ev = findEvidence(review, key);
  if (!ev) return `<span class="mini mini-neutral" title="Not assessed">${esc(label)} —</span>`;
  const tone = EVIDENCE[ev.status]?.tone ?? "neutral";
  return `<span class="mini mini-${tone}" title="${esc(ev.detail)}">${esc(label)} ${evIcon(ev.status)}</span>`;
}

function pkgLink(pkg, root) {
  return `<a class="pkg-link" href="${root}packages/${esc(pkg.id)}.html">${esc(pkg.name)}</a>`;
}

function reqLink(req, root) {
  return `<a href="${root}requirements/${esc(req.slug)}.html">${esc(req.title)}</a>`;
}

function navItem(label, href, active) {
  return `<a class="nav-link${active ? " is-active" : ""}" href="${href}"${active ? ' aria-current="page"' : ""}>${label}</a>`;
}

function layout({ title, description, active, root, model, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Package Review Board</title>
<meta name="description" content="${esc(description || "")}">
<link rel="stylesheet" href="${root}style.css">
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="${root}index.html">
    <span class="brand-mark" aria-hidden="true">◆</span>
    <span class="brand-text">Package Review Board</span>
  </a>
  <nav class="site-nav" aria-label="Primary">
    ${navItem("Overview", `${root}index.html`, active === "overview")}
    ${navItem("Requirements", `${root}requirements/index.html`, active === "requirements")}
    ${navItem("Packages", `${root}packages/index.html`, active === "packages")}
    ${navItem("Whitelist", `${root}whitelist.html`, active === "whitelist")}
    ${navItem("Method", `${root}method.html`, active === "method")}
  </nav>
</header>
<main id="main" class="page">
${body}
</main>
<footer class="site-footer">
  <p>Generated ${esc(fmtDate(model.today))} from <code>data/*.json</code>. Edits go through git, so the commit history is the audit log.</p>
  <p>${model.counts.packages} packages · ${model.counts.requirements} active requirement${model.counts.requirements === 1 ? "" : "s"} · ${model.decisions.length} decision${model.decisions.length === 1 ? "" : "s"}</p>
</footer>
<script src="${root}app.js" defer></script>
</body>
</html>`;
}

function pageHeader({ eyebrow, title, lede, meta = "" }) {
  return `<header class="page-head">
  ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ""}
  <h1>${title}</h1>
  ${lede ? `<p class="lede">${lede}</p>` : ""}
  ${meta ? `<div class="head-meta">${meta}</div>` : ""}
</header>`;
}

function breadcrumbs(items) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items
    .map((item, i) =>
      item.href
        ? `<a href="${item.href}">${esc(item.label)}</a>${i < items.length - 1 ? '<span class="crumb-sep">/</span>' : ""}`
        : `<span aria-current="page">${esc(item.label)}</span>`
    )
    .join("")}</nav>`;
}

function statCard(label, value, hint, tone = "") {
  return `<div class="stat${tone ? ` stat-${tone}` : ""}">
  <span class="stat-label">${esc(label)}</span>
  <span class="stat-value">${value}</span>
  <span class="stat-hint">${esc(hint)}</span>
</div>`;
}

function attentionPanel(model) {
  if (model.attention.length === 0) {
    const next = model.requirements
      .flatMap((r) => r.candidates.map((c) => c.review.next_review_at))
      .filter(Boolean)
      .sort()[0];
    return `<section class="panel">
  <div class="panel-head"><h2>Needs attention</h2></div>
  <div class="empty">
    <span class="empty-icon" aria-hidden="true">✓</span>
    <div>
      <strong>Nothing overdue or expiring.</strong>
      <p>${next ? `Next scheduled review is ${esc(fmtDate(next))}.` : "No reviews scheduled."}</p>
    </div>
  </div>
</section>`;
  }

  const rows = model.attention
    .map(
      (item) => `<tr>
  <td>${pill(item.severity === "overdue" ? "Overdue" : "Due soon", item.severity === "overdue" ? "bad" : "warn")}</td>
  <td><a href="${item.href}">${esc(item.title)}</a></td>
  <td class="muted">${esc(item.detail)}</td>
</tr>`
    )
    .join("");

  return `<section class="panel">
  <div class="panel-head">
    <h2>Needs attention</h2>
    <span class="count-badge">${model.attention.length}</span>
  </div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Severity</th><th>Item</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
}

function decisionDigest(model, root) {
  const decision = [...model.decisions].sort((a, b) => (a.decided_at < b.decided_at ? 1 : -1))[0];
  if (!decision) {
    return `<section class="panel"><div class="empty"><div><strong>No decisions recorded yet.</strong><p>Add one to <code>data/decisions.json</code>.</p></div></div></section>`;
  }
  const req = decision.requirement;
  const primary = decision.primary;
  const dropped = decision.dropped;
  const fallback = decision.adopted.filter((id) => id !== decision.primary_package_id);
  const digest =
    decision.status === "approved"
      ? { label: "Adopt", tone: "digest-ok" }
      : decision.status === "denied"
        ? { label: "Rejected", tone: "digest-bad" }
        : { label: "Pending", tone: "digest-warn" };

  return `<section class="panel decision-digest">
  <div class="panel-head">
    <h2>Latest decision</h2>
    ${decisionStatusPill(decision.status)}
  </div>
  <div class="digest-grid">
    <div class="digest-card ${digest.tone}">
      <span class="digest-kicker">${digest.label}</span>
      <strong>${pkgLink(primary, root)}</strong>
      <span class="muted">${esc(primary.latest_version)} · ${licenseBadge(primary)}</span>
      ${
        decision.status === "approved" && fallback.length
          ? `<span class="digest-foot">Also adopted: ${fallback.map((id) => esc(model.packages.find((p) => p.id === id)?.name ?? id)).join(", ")}</span>`
          : ""
      }
    </div>
    ${
      dropped.length
        ? dropped
            .map(
              (d) => `<div class="digest-card digest-bad">
      <span class="digest-kicker">Drop by ${esc(fmtDate(d.deadline))}</span>
      <strong>${esc(model.packages.find((p) => p.id === d.package_id)?.name ?? d.package_id)}</strong>
      <span class="muted">${esc(d.reason)}</span>
    </div>`
            )
            .join("")
        : ""
    }
    <div class="digest-card">
      <span class="digest-kicker">Requirement</span>
      <strong>${reqLink(req, root)}</strong>
      <span class="muted">Re-review by ${esc(fmtDate(decision.expires_at))}</span>
    </div>
  </div>
</section>`;
}

function decisionsTable(model, root) {
  if (model.decisions.length === 0) {
    return `<section class="panel"><div class="panel-head"><h2>Whitelist decisions</h2></div><div class="empty"><div><strong>No decisions yet.</strong><p>Decisions connect a requirement to adopted and dropped packages.</p></div></div></section>`;
  }

  const rows = model.decisions
    .map(
      (d) => `<tr>
  <td>${reqLink(d.requirement, root)}</td>
  <td>${d.primary ? pkgLink(d.primary, root) : "—"}</td>
  <td>${decisionStatusPill(d.status)} ${decisionStatePill(d)}</td>
  <td class="nowrap">${esc(fmtDate(d.expires_at))}<br><span class="muted small">${esc(relativeDays(d.days_until_expiry))}</span></td>
  <td class="bucket-counts">
    <span class="mini mini-ok">${d.adopted.length} adopted</span>
    <span class="mini mini-bad">${d.dropped.length} dropped</span>
    <span class="mini mini-warn">${d.hold.length} hold</span>
    <span class="mini mini-neutral">${d.rejected.length} rejected</span>
  </td>
</tr>`
    )
    .join("");

  return `<section class="panel">
  <div class="panel-head"><h2>Whitelist decisions</h2></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Requirement</th><th>Package</th><th>Status</th><th>Expires</th><th>Buckets</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
}

function recentReviews(model, root) {
  const latest = model.packages
    .map((p) => p.latest_review)
    .filter(Boolean)
    .sort((a, b) =>
      a.reviewed_at === b.reviewed_at ? b.score - a.score : a.reviewed_at < b.reviewed_at ? 1 : -1
    )
    .slice(0, 6);

  if (latest.length === 0) return "";

  const rows = latest
    .map(
      (r) => `<tr>
  <td>${pkgLink(r.package, root)}<br><span class="muted small">${esc(r.package.latest_version)}</span></td>
  <td>${recPill(r.recommendation)}</td>
  <td>${riskPill(r.risk)}</td>
  <td>${scoreBar(r.score)}</td>
  <td class="nowrap">${esc(fmtDate(r.reviewed_at))}</td>
  <td>${reviewStatePill(r)}</td>
</tr>`
    )
    .join("");

  return `<section class="panel">
  <div class="panel-head"><h2>Recent reviews</h2><a class="panel-link" href="${root}packages/index.html">All packages</a></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Package</th><th>Recommendation</th><th>Risk</th><th>Score</th><th>Reviewed</th><th>Cadence</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</section>`;
}

export function renderOverview(model) {
  const c = model.counts;
  const body = `
${pageHeader({
  eyebrow: "Whitelist status",
  title: "Package decisions, backed by evidence.",
  lede: "Each requirement lists the candidates we reviewed, the verdict for each, and what to adopt or drop. Data is JSON in git; this site is generated from it.",
  meta: `<span class="chip">${esc(model.packages.length)} packages reviewed</span><span class="chip">${esc(plural(model.decisions.length, "decision"))}</span><span class="chip">${c.overdue + c.due_soon} items need attention</span>`,
})}

<section class="stats" aria-label="Summary">
  ${statCard("Active requirements", esc(c.requirements), "Tasks with a whitelist decision", "")}
  ${statCard("Adopted", esc(c.adopted), "Approved for use", "ok")}
  ${statCard("Dropped", esc(c.dropped), "Must be removed", "bad")}
  ${statCard("On hold", esc(c.hold), "Not approved, not banned", "warn")}
  ${statCard("Overdue", esc(c.overdue), "Reviews or decisions past due", c.overdue ? "bad" : "")}
  ${statCard("Due soon", esc(c.due_soon), "Within the next 30 days", c.due_soon ? "warn" : "")}
  ${statCard("npm provenance", esc(c.provenance), `${c.release_provenance} release-only · ${c.packages - c.provenance - c.release_provenance} none`, c.provenance ? "ok" : "")}
</section>

${attentionPanel(model)}
${decisionDigest(model, "")}
${decisionsTable(model, "")}
${recentReviews(model, "")}
`;

  return layout({
    title: "Overview",
    description: "Package whitelist decisions with the evidence behind each verdict.",
    active: "overview",
    root: "",
    model,
    body,
  });
}

export function renderRequirementsIndex(model) {
  const active = model.requirements.filter((r) => r.status === "active");
  const rows = active
    .map(
      (r) => `<tr data-search="${esc(`${r.title} ${r.owner} ${r.criticality}`.toLowerCase())}">
  <td><a href="${esc(r.slug)}.html">${esc(r.title)}</a><br><span class="muted small">${esc(r.summary).slice(0, 110)}…</span></td>
  <td>${pill(r.criticality, r.criticality === "critical" || r.criticality === "high" ? "bad" : r.criticality === "medium" ? "warn" : "neutral")}</td>
  <td class="num">${r.candidates.length}</td>
  <td>${r.decision?.primary ? pkgLink(r.decision.primary, "../") : '<span class="muted">No decision</span>'}</td>
  <td>${r.decision ? decisionStatusPill(r.decision.status) : '<span class="muted">—</span>'}</td>
  <td class="nowrap">${r.next_review_at ? esc(fmtDate(r.next_review_at)) : "—"}</td>
</tr>`
    )
    .join("");

  const body = `
${pageHeader({
  eyebrow: "Requirements",
  title: "Tasks that drive whitelist decisions",
  lede: "A requirement captures what we need a package to do and the constraints it must satisfy. Candidates are reviewed against it, then a decision adopts some and drops others.",
  meta: `<span class="chip">${active.length} active</span><span class="chip">${model.packages.length} candidates reviewed</span>`,
})}

<div class="toolbar">
  <label class="search">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input type="search" placeholder="Filter requirements…" data-filter-target="requirements-table" aria-label="Filter requirements">
  </label>
</div>

<section class="panel">
  <div class="table-wrap">
    <table class="data-table" id="requirements-table" data-filterable>
      <thead><tr><th>Requirement</th><th>Criticality</th><th class="num">Candidates</th><th>Primary</th><th>Decision</th><th>Next review</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6" class="muted">No requirements.</td></tr>'}</tbody>
    </table>
  </div>
  <p class="no-matches" hidden>No requirements match that filter.</p>
</section>
`;

  return layout({
    title: "Requirements",
    description: "Requirements and the package candidates reviewed against them.",
    active: "requirements",
    root: "../",
    model,
    body,
  });
}

export function renderRequirement(model, req) {
  const decision = req.decision;
  const candidates = req.candidates;
  const primaryLink = decision?.primary
    ? `<a href="../packages/${esc(decision.primary.id)}.html">${esc(decision.primary.name)}</a>`
    : "—";
  const verdictTitle = !decision
    ? ""
    : decision.status === "approved"
      ? `Adopt ${primaryLink}`
      : decision.status === "denied"
        ? `Do not adopt ${primaryLink}`
        : `Pending: ${primaryLink}`;

  const candidateRows = candidates
    .map(({ package: pkg, review, bucket, dropped }) => `<tr data-search="${esc(`${pkg.name} ${review.recommendation} ${review.risk} ${bucket}`.toLowerCase())}" data-group="${esc(review.recommendation)}">
  <td>
    <a class="pkg-link" href="../packages/${esc(pkg.id)}.html">${esc(pkg.name)}</a>
    <span class="version">${esc(review.reviewed_version)}</span>
    ${review.reviewed_version !== pkg.latest_version ? `<span class="inline-flag">latest ${esc(pkg.latest_version)}</span>` : ""}
    ${bucket === "dropped" && dropped ? `<span class="inline-flag">drop by ${esc(fmtDate(dropped.deadline))}</span>` : ""}
  </td>
  <td>${recPill(review.recommendation)}</td>
  <td>${riskPill(review.risk)}</td>
  <td>${scoreBar(review.score)}</td>
  <td class="num">${esc(fmtCompact(pkg.weekly_downloads))}</td>
  <td class="nowrap">${licenseBadge(pkg)}</td>
  <td class="nowrap">${provenanceBadge(pkg)}</td>
  <td class="nowrap">${buildVsBuyBadge(pkg)}</td>
  <td><div class="badges">${miniBadge(review, "cve", "CVE")}</div></td>
  <td class="nowrap">${esc(fmtDate(review.reviewed_at))}<br><span class="muted small">${reviewStatePill(review)}</span></td>
</tr>`)
    .join("");

  const bucketList = (title, items, tone, emptyText) => `<div class="bucket">
  <div class="bucket-head"><h3>${esc(title)}</h3><span class="count-badge count-${tone}">${items.length}</span></div>
  ${
    items.length
      ? `<ul class="bucket-list">${items
          .map((item) => {
            const pkg = model.packages.find((p) => p.id === item.package_id) ?? item.package;
            const review = req.candidates.find((c) => c.package.id === pkg.id)?.review;
            const extra = item.reason ? `<span class="muted small">${esc(item.reason)}</span>` : "";
            return `<li><a href="../packages/${esc(pkg.id)}.html">${esc(pkg.name)}</a>${review ? recPill(review.recommendation) : ""}${extra}</li>`;
          })
          .join("")}</ul>`
      : `<p class="muted small">${esc(emptyText)}</p>`
  }
</div>`;

  const adoptedItems = (decision?.adopted ?? []).map((id) => ({ package_id: id }));
  const holdItems = (decision?.hold ?? []).map((id) => ({ package_id: id }));
  const rejectedItems = (decision?.rejected ?? []).map((id) => ({ package_id: id }));
  const droppedItems = (decision?.dropped ?? []).map((d) => ({ package_id: d.package_id, reason: `By ${fmtDate(d.deadline)}: ${d.reason}` }));

  const timeline = candidates
    .slice()
    .sort((a, b) => (a.review.reviewed_at < b.review.reviewed_at ? 1 : -1))
    .map(
      (c) => `<li>
  <span class="timeline-date">${esc(fmtDate(c.review.reviewed_at))}</span>
  <span class="timeline-body"><a href="../packages/${esc(c.package.id)}.html">${esc(c.package.name)}</a> ${recPill(c.review.recommendation)} <span class="muted">${esc(c.review.summary)}</span></span>
</li>`
    )
    .join("");

  const body = `
${breadcrumbs([
  { label: "Requirements", href: "../requirements/index.html" },
  { label: req.title },
])}

${pageHeader({
  eyebrow: `Requirement · ${req.criticality} criticality`,
  title: esc(req.title),
  lede: esc(req.summary),
  meta: `<span class="chip">Owner: ${esc(req.owner)}</span><span class="chip">Cadence: ${esc(req.review_cadence_days)} days</span><span class="chip">Created ${esc(fmtDate(req.created_at))}</span><span class="chip">${candidates.length} candidates</span>`,
})}

${
  decision
    ? `<section class="verdict verdict-${esc(decision.status)}">
  <div class="verdict-main">
    <div class="verdict-top">
      <span class="verdict-label">Decision</span>
      ${decisionStatusPill(decision.status)}${decisionStatePill(decision)}
    </div>
    <h2>${verdictTitle}</h2>
    <p>${esc(decision.primary_review?.summary ?? "")}</p>
    <div class="verdict-meta">
      <span><strong>Re-review by</strong> ${esc(fmtDate(decision.expires_at))}</span>
      <span><strong>Decided</strong> ${esc(fmtDate(decision.decided_at))} by ${esc(decision.decided_by)}</span>
      ${
        decision.status === "approved" && decision.adopted.length > 1
          ? `<span><strong>Also adopted</strong> ${decision.adopted
              .filter((id) => id !== decision.primary_package_id)
              .map((id) => esc(model.packages.find((p) => p.id === id)?.name ?? id))
              .join(", ")}</span>`
          : ""
      }
    </div>
  </div>
  ${
    decision.dropped.length
      ? `<div class="verdict-drop">
    <span class="verdict-kicker">Drop</span>
    ${decision.dropped
      .map(
        (d) => `<strong>${esc(model.packages.find((p) => p.id === d.package_id)?.name ?? d.package_id)}</strong>
    <span class="muted">by ${esc(fmtDate(d.deadline))}</span>`
      )
      .join("")}
  </div>`
      : ""
  }
</section>`
    : `<section class="banner banner-warn"><strong>No decision recorded.</strong> Review the candidates and add one to <code>data/decisions.json</code>.</section>`
}

<section class="panel">
  <div class="panel-head"><h2>Candidate comparison</h2><span class="muted small">Latest review per package</span></div>
  <div class="table-wrap">
    <table class="data-table data-table-wide" data-filterable data-filter-target="candidates">
      <thead><tr>
        <th>Package</th><th>Recommendation</th><th>Risk</th><th>Score</th><th class="num">Downloads/wk</th><th>License</th><th>Provenance</th><th>Build vs buy</th><th>Advisories</th><th>Reviewed</th>
      </tr></thead>
      <tbody>${candidateRows}</tbody>
    </table>
  </div>
  ${candidates.length ? '<p class="table-note">Build vs buy scores the capability, not this package. A rejected package can still be a capability worth buying from a maintained alternative.</p>' : ""}
</section>

<div class="two-col">
  <section class="panel">
    <div class="panel-head"><h2>Constraints</h2></div>
    <ul class="check-list">${req.constraints.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
    ${
      req.out_of_scope?.length
        ? `<div class="panel-sub"><h3>Out of scope</h3><ul class="muted-list">${req.out_of_scope.map((c) => `<li>${esc(c)}</li>`).join("")}</ul></div>`
        : ""
    }
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Decision rationale</h2></div>
    <p class="prose">${esc(decision?.rationale ?? "No rationale recorded.")}</p>
  </section>
</div>

<section class="panel">
  <div class="panel-head"><h2>Buckets</h2><span class="muted small">Every reviewed package is classified once</span></div>
  <div class="bucket-grid">
    ${bucketList("Adopted", adoptedItems, "ok", "None adopted.")}
    ${bucketList("On hold", holdItems, "warn", "None on hold.")}
    ${bucketList("Dropped", droppedItems, "bad", "Nothing to drop.")}
    ${bucketList("Rejected", rejectedItems, "bad", "None rejected.")}
  </div>
</section>

<section class="panel">
  <div class="panel-head"><h2>Review timeline</h2></div>
  <ol class="timeline">${timeline}</ol>
</section>
`;

  return layout({
    title: req.title,
    description: req.summary,
    active: "requirements",
    root: "../",
    model,
    body,
  });
}

export function renderPackagesIndex(model) {
  const rows = model.packages
    .slice()
    .sort((a, b) => {
      const ar = a.latest_review?.recommendation ?? "zz";
      const br = b.latest_review?.recommendation ?? "zz";
      const rank = { adopt: 0, hold: 1, avoid: 2, replace: 3, zz: 4 };
      return rank[ar] - rank[br] || (b.latest_review?.score ?? 0) - (a.latest_review?.score ?? 0);
    })
    .map((pkg) => {
      const r = pkg.latest_review;
      return `<tr data-search="${esc(`${pkg.name} ${pkg.license} ${r?.recommendation ?? ""} ${pkg.notes}`.toLowerCase())}" data-group="${esc(r?.recommendation ?? "none")}">
  <td class="pkg-cell">
    <a class="pkg-link" href="${esc(pkg.id)}.html">${esc(pkg.name)}</a>
    <span class="version">${esc(pkg.latest_version)}</span>
    <span class="pkg-date">${esc(fmtDate(pkg.published_at))}</span>
    <span class="pkg-notes muted small">${esc(pkg.notes)}</span>
  </td>
  <td>${r ? recPill(r.recommendation) : '<span class="muted">—</span>'}</td>
  <td>${r ? riskPill(r.risk) : "—"}</td>
  <td>${r ? scoreBar(r.score) : "—"}</td>
  <td class="nowrap">${buildVsBuyBadge(pkg)}</td>
  <td class="nowrap">${licenseBadge(pkg)}</td>
  <td class="nowrap">${provenanceBadge(pkg)}</td>
  <td>${r ? reviewStatePill(r) : "—"}</td>
</tr>`;
    })
    .join("");

  const body = `
${pageHeader({
  eyebrow: "Packages",
  title: "Every package we have reviewed",
  lede: "Metadata comes from the npm registry and the published tarball. The recommendation, risk and score come from the latest review for the requirement it was assessed against.",
  meta: `<span class="chip">${model.packages.length} packages</span><span class="chip">${model.packages.filter((p) => p.latest_review?.recommendation === "adopt").length} adopt</span><span class="chip">${model.packages.filter((p) => p.latest_review?.recommendation === "avoid").length} avoid</span>`,
})}

<div class="toolbar">
  <label class="search">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input type="search" placeholder="Filter by name, license or note…" data-filter-target="packages-table" aria-label="Filter packages">
  </label>
  <div class="segmented" role="group" aria-label="Filter by recommendation">
    <button type="button" class="seg is-active" data-filter-value="all" data-filter-table="packages-table">All</button>
    <button type="button" class="seg" data-filter-value="adopt" data-filter-table="packages-table">Adopt</button>
    <button type="button" class="seg" data-filter-value="hold" data-filter-table="packages-table">Hold</button>
    <button type="button" class="seg" data-filter-value="avoid" data-filter-table="packages-table">Avoid</button>
  </div>
</div>

<section class="panel">
  <div class="table-wrap">
    <table class="data-table" id="packages-table" data-filterable>
      <thead><tr><th>Package</th><th>Recommendation</th><th>Risk</th><th>Score</th><th>Build vs buy</th><th>License</th><th>Provenance</th><th>Review</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <p class="no-matches" hidden>No packages match that filter.</p>
</section>
`;

  return layout({
    title: "Packages",
    description: "All reviewed packages with recommendation, risk and review cadence.",
    active: "packages",
    root: "../",
    model,
    body,
  });
}

export function renderPackage(model, pkg) {
  const review = pkg.latest_review;
  const req = review?.requirement ?? null;
  const decision = req?.decision ?? null;
  const bucket = decision?.bucket_of.get(pkg.id) ?? null;
  const drop = decision?.drop_by_id.get(pkg.id) ?? null;

  const alternatives = req
    ? req.candidates.filter((c) => c.package.id !== pkg.id)
    : [];
  const priorVersions = pkg.prior_versions ?? [];
  const versionDrift = Boolean(review && review.reviewed_version !== pkg.latest_version);

  const evidenceRows = (review?.evidence ?? [])
    .map(
      (ev) => `<tr>
  <td><code>${esc(ev.key)}</code><br><span class="muted small">${esc(ev.label)}</span></td>
  <td>${pill(EVIDENCE[ev.status]?.label ?? ev.status, EVIDENCE[ev.status]?.tone ?? "neutral")}</td>
  <td>${esc(ev.detail)}${
    ev.sources?.length
      ? `<div class="sources">${ev.sources
          .map((s) => `<a href="${esc(s.url)}" rel="noreferrer noopener">${esc(s.label)}</a>`)
          .join("")}</div>`
      : ""
  }</td>
</tr>`
    )
    .join("");

  const altRows = alternatives
    .map(
      ({ package: alt, review: ar }) => `<tr>
  <td><a href="${esc(alt.id)}.html">${esc(alt.name)}</a> <span class="version">${esc(alt.latest_version)}</span></td>
  <td>${recPill(ar.recommendation)}</td>
  <td>${riskPill(ar.risk)}</td>
  <td>${scoreBar(ar.score)}</td>
  <td class="muted small">${esc(ar.summary.slice(0, 130))}…</td>
</tr>`
    )
    .join("");

  const historyRows = pkg.reviews
    .map(
      (r) => `<tr>
  <td class="nowrap">${esc(fmtDate(r.reviewed_at))}</td>
  <td>${recPill(r.recommendation)}</td>
  <td>${riskPill(r.risk)}</td>
  <td>${scoreBar(r.score)}</td>
  <td>${esc(r.reviewer)}</td>
</tr>`
    )
    .join("");

  const body = `
${breadcrumbs([
  { label: "Packages", href: "../packages/index.html" },
  { label: pkg.name },
])}

<header class="pkg-head">
  <div>
    <p class="eyebrow">${esc(pkg.ecosystem)} · ${esc(pkg.license)}</p>
    <h1>${esc(pkg.name)} <span class="version version-lg">${esc(pkg.latest_version)}</span></h1>
    <p class="lede">${esc(pkg.notes)}</p>
  </div>
  <div class="pkg-verdict">
    ${review ? recPill(review.recommendation) : '<span class="muted">Not reviewed</span>'}
    ${review ? riskPill(review.risk) : ""}
    ${review ? scoreBar(review.score) : ""}
    ${bucket ? bucketPill(bucket) : ""}
  </div>
</header>

${
  drop
    ? `<div class="banner banner-bad"><strong>Drop by ${esc(fmtDate(drop.deadline))}.</strong> ${esc(drop.reason)}</div>`
    : ""
}
${
  versionDrift
    ? `<div class="banner banner-warn"><strong>Version-scoped review.</strong> This review covers ${esc(review.reviewed_version)}; the current latest is ${esc(pkg.latest_version)}.</div>`
    : ""
}

<section class="meta-grid" aria-label="Package metadata">
  <div><span>Last release</span><strong>${esc(fmtDate(pkg.published_at))}</strong></div>
  <div><span>Weekly downloads</span><strong>${esc(fmtNum(pkg.weekly_downloads))}</strong></div>
  <div><span>Runtime deps</span><strong>${esc(pkg.runtime_deps)}</strong></div>
  <div><span>Install size</span><strong>${pkg.install_size_kb ? esc(fmtSize(pkg.install_size_kb)) : "—"}</strong></div>
  <div><span>Unpacked</span><strong>${pkg.unpacked_size_kb ? esc(fmtSize(pkg.unpacked_size_kb)) : "—"}</strong></div>
  <div><span>Maintainers</span><strong>${esc(pkg.maintainers.join(", "))}</strong></div>
  <div><span>Types</span><strong>${esc(pkg.types)}</strong></div>
  <div><span>Formats</span><strong>${esc(pkg.formats.join(" + "))}</strong></div>
  <div><span>License</span><strong>${licenseBadge(pkg)}</strong></div>
  <div><span>Provenance</span><strong>${provenanceBadge(pkg)}</strong></div>
  <div class="meta-links">
    <span>Links</span>
    <strong>${pkg.repo ? `<a href="${esc(pkg.repo)}" rel="noreferrer noopener">Repository</a>` : '<span class="muted">No repo</span>'} · <a href="${esc(pkg.registry)}" rel="noreferrer noopener">npm</a></strong>
  </div>
</section>
${pkg.provenance_note ? `<p class="meta-note">${esc(pkg.provenance_note)}</p>` : ""}

${
  review
    ? `<div class="two-col">
  <section class="panel">
    <div class="panel-head"><h2>Verdict</h2><span class="muted small">Reviewed ${esc(fmtDate(review.reviewed_at))} · next ${esc(fmtDate(review.next_review_at))}</span></div>
    <p class="prose">${esc(review.summary)}</p>
    <div class="review-meta">
      ${reviewStatePill(review)}
      <span class="muted small">Reviewed version ${esc(review.reviewed_version)}</span>
      ${req ? `<span class="muted small">Requirement: ${reqLink(req, "../")}</span>` : ""}
    </div>
    <h3 class="sub-head">Reasoning</h3>
    <ol class="reasoning">${review.reasoning.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>
    ${
      review.caveats?.length
        ? `<h3 class="sub-head">Caveats</h3><ul class="caveats">${review.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`
        : ""
    }
  </section>
  <section class="panel">
    <div class="panel-head"><h2>Evidence</h2><span class="muted small">${review.evidence.length} checks</span></div>
    <div class="table-wrap">
      <table class="data-table evidence-table">
        <thead><tr><th>Check</th><th>Status</th><th>Detail</th></tr></thead>
        <tbody>${evidenceRows}</tbody>
      </table>
    </div>
  </section>
</div>

${
  pkg.build_vs_buy
    ? `<section class="panel">
  <div class="panel-head"><h2>Build vs buy</h2>${buildVsBuyBadge(pkg)}</div>
  <p class="prose">${esc(pkg.build_vs_buy.rationale)}</p>
  <div class="bvb-grid">
    ${bvbRow("Scope to rebuild", pkg.build_vs_buy.scope, "How much surface a DIY implementation would have to cover.")}
    ${bvbRow("Intrinsic difficulty", pkg.build_vs_buy.difficulty, "Edge cases, adversarial input, browser behaviour and accessibility.")}
    ${bvbRow("Commodity", pkg.build_vs_buy.commodity, "5 means undifferentiated infrastructure; 1 means core to the product.")}
    ${bvbRow("Integration cost", pkg.build_vs_buy.integration, "5 means a light footprint and easy replacement; 1 means heavy dependencies or lock-in.")}
  </div>
  <p class="bvb-effort"><strong>Estimated build effort:</strong> ${esc(pkg.build_vs_buy.effort)}</p>
  <p class="table-note">Capability-level score. It does not override the recommendation or risk verdict above.</p>
</section>`
    : `<section class="panel">
  <div class="panel-head"><h2>Build vs buy</h2>${buildVsBuyBadge(pkg)}</div>
  <p class="prose muted">Not assessed yet. A reviewer should record scope, difficulty, commodity, integration, build effort and rationale before the next decision.</p>
</section>`
}

${
  priorVersions.length
    ? `<section class="panel">
  <div class="panel-head"><h2>Version history</h2><span class="muted small">Current review: ${esc(review?.reviewed_version ?? pkg.latest_version)}</span></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Version</th><th>Published</th><th>Verdict</th><th>Note</th></tr></thead>
      <tbody>${priorVersions
        .map(
          (v) => `<tr>
        <td><strong>${esc(v.version)}</strong></td>
        <td class="nowrap">${esc(fmtDate(v.published_at))}</td>
        <td>${recPill(v.recommendation)}</td>
        <td class="muted small">${esc(v.note)}</td>
      </tr>`
        )
        .join("")}</tbody>
    </table>
  </div>
  <p class="table-note">Verdicts are version-scoped. A new major release needs a fresh review; do not assume this verdict carries forward.</p>
</section>`
    : ""
}

${
  alternatives.length
    ? `<section class="panel">
  <div class="panel-head"><h2>Alternatives in this requirement</h2></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Package</th><th>Recommendation</th><th>Risk</th><th>Score</th><th>Summary</th></tr></thead>
      <tbody>${altRows}</tbody>
    </table>
  </div>
</section>`
    : ""
}

${
  decision
    ? `<section class="panel">
  <div class="panel-head"><h2>Decision context</h2>${decisionStatusPill(decision.status)}</div>
  <p class="prose">${
    decision.status === "approved"
      ? `<strong>${esc(decision.primary?.name ?? "")}</strong> is the primary choice for ${reqLink(req, "../")}. This package is classified as ${bucket ? bucketPill(bucket) : "unclassified"}.`
      : decision.status === "denied"
        ? `${reqLink(req, "../")} is <strong>denied</strong>. This package is classified as ${bucket ? bucketPill(bucket) : "unclassified"}.`
        : `${reqLink(req, "../")} is <strong>pending</strong>. This package is classified as ${bucket ? bucketPill(bucket) : "unclassified"}.`
  }</p>
  <p class="prose muted">${esc(decision.rationale)}</p>
</section>`
    : ""
}

${
  pkg.reviews.length > 1
    ? `<section class="panel">
  <div class="panel-head"><h2>Review history</h2></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>Reviewed</th><th>Recommendation</th><th>Risk</th><th>Score</th><th>Reviewer</th></tr></thead>
      <tbody>${historyRows}</tbody>
    </table>
  </div>
</section>`
    : ""
}`
    : `<section class="banner banner-warn"><strong>No review recorded for this package.</strong> Add one to <code>data/reviews.json</code>.</section>`
}
`;

  return layout({
    title: `${pkg.name} ${pkg.latest_version}`,
    description: pkg.notes,
    active: "packages",
    root: "../",
    model,
    body,
  });
}

export function renderWhitelist(model) {
  const sections = [
    {
      key: "adopted",
      title: "Adopted",
      tone: "ok",
      blurb: "Approved for use in the requirements listed. Other packages may not be substituted without a new review.",
      items: model.whitelist.adopted,
    },
    {
      key: "hold",
      title: "On hold",
      tone: "warn",
      blurb: "Not approved and not banned. Use requires an exception with the reason documented.",
      items: model.whitelist.hold,
    },
    {
      key: "dropped",
      title: "To be dropped",
      tone: "bad",
      blurb: "Currently in use but must be removed by the stated deadline.",
      items: model.whitelist.dropped,
    },
    {
      key: "rejected",
      title: "Rejected",
      tone: "bad",
      blurb: "Reviewed and not permitted for this requirement.",
      items: model.whitelist.rejected,
    },
  ];

  const sectionsHtml = sections
    .map((section) => {
      const rows = section.items
        .map((item) => {
          const pkg = item.package;
          const review = pkg.latest_review;
          const reason = item.drop?.reason ?? review?.summary ?? "";
          return `<tr data-search="${esc(`${pkg.name} ${section.key} ${reason}`.toLowerCase())}" data-group="${section.key}">
  <td>
    <a class="pkg-link" href="packages/${esc(pkg.id)}.html">${esc(pkg.name)}</a>
    <span class="version">${esc(pkg.latest_version)}</span>
  </td>
  <td>${review ? riskPill(review.risk) : "—"}</td>
  <td class="nowrap">${licenseBadge(pkg)}</td>
  <td class="nowrap">${provenanceBadge(pkg)}</td>
  <td class="reason-cell" title="${esc(reason)}">${esc(reason.length > 220 ? reason.slice(0, 220) + "…" : reason)}</td>
  <td class="nowrap">${item.decision ? esc(fmtDate(item.decision.expires_at)) : "—"}</td>
  ${
    section.key === "dropped"
      ? `<td class="nowrap">${esc(fmtDate(item.drop.deadline))}</td>`
      : `<td>${review ? reviewStatePill(review) : "—"}</td>`
  }
</tr>`;
        })
        .join("");

      return `<section class="panel whitelist-section" data-bucket="${section.key}">
  <div class="panel-head">
    <h2><span class="dot dot-${section.tone}" aria-hidden="true"></span>${esc(section.title)}</h2>
    <span class="count-badge">${section.items.length}</span>
  </div>
  <p class="section-blurb">${esc(section.blurb)}</p>
  ${
    section.items.length
      ? `<div class="table-wrap">
    <table class="data-table" data-filterable data-filter-target="whitelist">
      <thead><tr><th>Package</th><th>Risk</th><th>License</th><th>Provenance</th><th>Reason</th><th>Decision expires</th><th>${section.key === "dropped" ? "Drop deadline" : "Review"}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`
      : `<p class="muted small">No entries.</p>`
  }
</section>`;
    })
    .join("");

  const body = `
${pageHeader({
  eyebrow: "Whitelist",
  title: "What you may use, and what must go",
  lede: "The enforcement view. Adopted packages are approved; dropped packages are in use but scheduled for removal; everything else is not permitted for the requirement.",
  meta: `<span class="chip">${model.whitelist.adopted.length} adopted</span><span class="chip">${model.whitelist.dropped.length} to drop</span><span class="chip">${model.whitelist.rejected.length} rejected</span><a class="chip" href="allowlist.json" download>Download JSON</a><a class="chip" href="allowlist.csv" download>Download CSV</a>`,
})}

<div class="toolbar">
  <label class="search">
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input type="search" placeholder="Filter whitelist…" data-filter-target="whitelist" aria-label="Filter whitelist">
  </label>
  <div class="segmented" role="group" aria-label="Filter by bucket">
    <button type="button" class="seg is-active" data-filter-value="all" data-filter-table="whitelist">All</button>
    <button type="button" class="seg" data-filter-value="adopted" data-filter-table="whitelist">Adopted</button>
    <button type="button" class="seg" data-filter-value="hold" data-filter-table="whitelist">Hold</button>
    <button type="button" class="seg" data-filter-value="dropped" data-filter-table="whitelist">Dropped</button>
    <button type="button" class="seg" data-filter-value="rejected" data-filter-table="whitelist">Rejected</button>
  </div>
</div>

${sectionsHtml}
<p class="no-matches" hidden>No whitelist entries match that filter.</p>
`;

  return layout({
    title: "Whitelist",
    description: "Adopted, on-hold, dropped and rejected packages.",
    active: "whitelist",
    root: "",
    model,
    body,
  });
}

export function renderMethod(model) {
  const body = `
${pageHeader({
  eyebrow: "Method",
  title: "How packages get approved, held or dropped",
  lede: "The rubric is deliberately biased toward supply-chain integrity: where a package comes from matters as much as what it does.",
})}

<div class="two-col">
  <section class="panel">
    <div class="panel-head"><h2>Verdicts</h2></div>
    <dl class="defs">
      <dt>${recPill("adopt")}</dt><dd>Meets every constraint for the requirement. Approved for use.</dd>
      <dt>${recPill("hold")}</dt><dd>Usable in narrow cases, does not meet every constraint, or the semantics do not match. Requires an exception.</dd>
      <dt>${recPill("avoid")}</dt><dd>Fails a hard constraint: unfixed advisory, no CI provenance, unmaintained, or unacceptable dependency footprint.</dd>
      <dt>${recPill("replace")}</dt><dd>Viable but superseded by a better candidate in the same requirement.</dd>
    </dl>
    <h3 class="sub-head">Buckets</h3>
    <dl class="defs">
      <dt>${bucketPill("adopted")}</dt><dd>May be used. The primary choice is listed first.</dd>
      <dt>${bucketPill("hold")}</dt><dd>Not approved for the requirement, but not prohibited outright.</dd>
      <dt>${bucketPill("dropped")}</dt><dd>In use today and must be removed by the deadline.</dd>
      <dt>${bucketPill("rejected")}</dt><dd>Not permitted for this requirement.</dd>
    </dl>
  </section>

  <section class="panel">
    <div class="panel-head"><h2>Scoring</h2></div>
    <p class="prose">Scores are a summary, not the decision. A hard failure (unfixed high/critical advisory, no CI publish, unmaintained) caps the verdict regardless of a high score.</p>
    <ul class="rubric">
      <li><span class="rubric-weight">30</span><div><strong>Security</strong><p>Known advisories, prototype-pollution behaviour, remediation status, scanner visibility.</p></div></li>
      <li><span class="rubric-weight">25</span><div><strong>Release integrity</strong><p>CI publishing, OIDC vs long-lived token, SLSA provenance, pinned actions.</p></div></li>
      <li><span class="rubric-weight">20</span><div><strong>Maintenance</strong><p>Release recency, open PR age, maintainer count, org ownership.</p></div></li>
      <li><span class="rubric-weight">15</span><div><strong>Fit</strong><p>Semantics, TypeScript inference, ESM/CJS, special-object handling, cycles.</p></div></li>
      <li><span class="rubric-weight">10</span><div><strong>Footprint</strong><p>Runtime dependencies, install size, license.</p></div></li>
    </ul>
    <div class="scale">
      <span class="scale-item"><strong>80–100</strong> adopt</span>
      <span class="scale-item"><strong>60–79</strong> hold</span>
      <span class="scale-item"><strong>0–59</strong> avoid</span>
    </div>
  </section>
</div>

<section class="panel">
  <div class="panel-head"><h2>Symbols</h2><span class="muted small">Used across the tables</span></div>
  <div class="two-col">
    <dl class="defs">
      <dt>${provenanceBadge({ npm_provenance: true })}</dt>
      <dd>SLSA provenance is attached to the published npm tarball. Verifiable automatically from the registry.</dd>
      <dt>${provenanceBadge({ release_provenance: true })}</dt>
      <dd>Provenance and signatures are attached to GitHub release artifacts only. The npm tarball is unattested, so verify that the shipped files match the attested hashes.</dd>
      <dt>${provenanceBadge({})}</dt>
      <dd>No provenance attestation found.</dd>
    </dl>
    <dl class="defs">
      <dt>${licenseBadge({ license: "MIT", license_category: "permissive" })}</dt>
      <dd>Permissive. No obligations beyond attribution.</dd>
      <dt>${licenseBadge({ license: "MPL-2.0", license_category: "weak-copyleft" })}</dt>
      <dd>Weak copyleft. File-level obligations; review before modifying.</dd>
      <dt>${licenseBadge({ license: "GPL-3.0", license_category: "strong-copyleft" })}</dt>
      <dd>Strong copyleft. Usually disqualifying for distribution.</dd>
      <dt>${licenseBadge({ license: "SEE LICENSE IN 'LICENSE.txt'", license_category: "proprietary" })}</dt>
      <dd>Proprietary or custom terms. Not open source; requires legal review.</dd>
    </dl>
  </div>
  <p class="prose muted">A dual licence is classified by its most permissive arm, because that is the arm you can choose. DOMPurify's MPL-2.0 OR Apache-2.0 therefore reads as permissive.</p>
</section>

<section class="panel">
  <div class="panel-head"><h2>Build vs buy</h2><span class="muted small">0-100 per package</span></div>
  <p class="prose">A high score means buying is the better use of time. The score is independent of the security verdict: a vulnerable package can still represent a capability you should buy from a maintained implementation. It assumes the capability is needed at all.</p>
  <div class="bvb-grid">
    ${bvbRow("Scope to rebuild", 5, "How much surface a DIY implementation would have to cover. Weight 35%.")}
    ${bvbRow("Intrinsic difficulty", 5, "Edge cases, adversarial input, browser behaviour and accessibility. Weight 30%.")}
    ${bvbRow("Commodity", 3, "5 means undifferentiated infrastructure; 1 means core to the product. Weight 20%.")}
    ${bvbRow("Integration cost", 2, "5 means a light footprint and easy replacement; 1 means heavy dependencies or lock-in. Weight 15%.")}
  </div>
  <div class="scale">
    <span class="scale-item"><strong>70-100</strong> Buy</span>
    <span class="scale-item"><strong>50-69</strong> Evaluate</span>
    <span class="scale-item"><strong>0-49</strong> Build</span>
  </div>
</section>

<section class="panel">
  <div class="panel-head"><h2>Review cadence</h2></div>
  <p class="prose">Each requirement sets <code>review_cadence_days</code>. A review is <strong>current</strong> until 30 days before its next date, <strong>due soon</strong> inside that window, and <strong>overdue</strong> afterwards. Decisions carry an <code>expires_at</code> date and move through <strong>active</strong>, <strong>expiring</strong> and <strong>expired</strong> the same way. Overdue and expiring items surface on the overview page.</p>
  <p class="prose muted">Configured cadence: ${model.requirements
    .filter((r) => r.status === "active")
    .map((r) => `<strong>${esc(r.title)}</strong> — ${esc(r.review_cadence_days)} days`)
    .join("; ")}.</p>
</section>

<section class="panel">
  <div class="panel-head"><h2>Adding a review</h2></div>
  <ol class="steps">
    <li>Add the package to <code>data/packages.json</code> if it is new.</li>
    <li>Add the review to <code>data/reviews.json</code>. Include at least one evidence item per decision driver.</li>
    <li>Classify it in <code>data/decisions.json</code> under exactly one of <code>adopted</code>, <code>hold</code>, <code>rejected</code> or <code>dropped</code>.</li>
    <li>Run <code>npm run validate</code>, then <code>npm run build</code>.</li>
    <li>Commit the JSON and the regenerated <code>dist/</code>. The commit is the audit entry.</li>
  </ol>
  <pre class="snippet"><code>{
  "id": "rev-2027-04-example",
  "package_id": "pkg-example",
  "requirement_id": "req-deep-merge",
  "reviewed_at": "2027-04-18",
  "recommendation": "adopt",
  "risk": "low",
  "score": 90,
  "summary": "One-sentence verdict.",
  "reasoning": ["Why this verdict."],
  "caveats": ["What could bite us."],
  "evidence": [
    { "key": "provenance", "label": "SLSA provenance", "status": "pass", "detail": "…" }
  ]
}</code></pre>
</section>

<section class="panel">
  <div class="panel-head"><h2>Known limitations</h2></div>
  <ul class="caveats">
    <li><strong>Provenance is not a safety proof.</strong> It ties a tarball to a commit and a builder; it does not audit the source.</li>
    <li><strong>Scanner gaps are real.</strong> CVE-2026-93753 is absent from package-scoped OSV matching, so <code>npm audit</code> reports zero for an affected <code>deepmerge@4.3.1</code>. Reviews must check advisories by CVE, not only by package.</li>
    <li><strong>Download counts are a popularity proxy.</strong> They include CI traffic and transitive installs.</li>
    <li><strong>Bus factor is recorded, not solved.</strong> Several "adopt" candidates have a single maintainer; the mitigation is small surface area, org ownership and a short review cadence.</li>
    <li><strong>Static by design.</strong> There is no server and no login. Access control is the git repository and the generated output.</li>
  </ul>
</section>

<section class="panel">
  <div class="panel-head"><h2>Data files</h2></div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr><th>File</th><th>Holds</th></tr></thead>
      <tbody>
        <tr><td><code>data/requirements.json</code></td><td>Tasks, constraints, owners, cadence.</td></tr>
        <tr><td><code>data/packages.json</code></td><td>Registry metadata and packaging facts.</td></tr>
        <tr><td><code>data/reviews.json</code></td><td>Verdict, score, reasoning, caveats, evidence.</td></tr>
        <tr><td><code>data/decisions.json</code></td><td>Adopted, hold, dropped and rejected buckets per requirement.</td></tr>
      </tbody>
    </table>
  </div>
</section>
`;

  return layout({
    title: "Method",
    description: "Scoring rubric, review cadence and data model.",
    active: "method",
    root: "",
    model,
    body,
  });
}

export function renderSite(model) {
  const pages = [];
  pages.push({ path: "index.html", html: renderOverview(model) });
  pages.push({ path: "requirements/index.html", html: renderRequirementsIndex(model) });
  for (const req of model.requirements) {
    pages.push({ path: `requirements/${req.slug}.html`, html: renderRequirement(model, req) });
  }
  pages.push({ path: "packages/index.html", html: renderPackagesIndex(model) });
  for (const pkg of model.packages) {
    pages.push({ path: `packages/${pkg.id}.html`, html: renderPackage(model, pkg) });
  }
  pages.push({ path: "whitelist.html", html: renderWhitelist(model) });
  pages.push({ path: "method.html", html: renderMethod(model) });
  return pages;
}
