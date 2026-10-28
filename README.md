# Package Review Board

A static, git-backed database of package reviews and whitelist decisions. You record the evidence in JSON, run one command, and get a browsable site that answers: **for this task, what should we adopt, and what should we drop?**

No server, no database engine, no runtime dependencies. Node.js 20.11+ only.

```bash
npm run build     # validate data → generate dist/
npm run dev       # rebuild on change + serve at http://localhost:4173
npm run validate  # data checks only
npm run check     # data checks + broken internal links
npm run serve     # serve the existing dist/
```

Open `dist/index.html`, or run `npm run dev`.

---

## What is already in here

Two requirements are seeded from real reviews.

### Deep merge of nested configuration objects

| | |
|---|---|
| **Adopt** | `@fastify/deepmerge` (primary), `deepmerge-ts` (also adopted) |
| **Drop** | `deepmerge` — by 31 Dec 2026, unfixed CVE-2026-93753 |
| **Rejected** | `ts-deepmerge`, `merge-deep`, `lodash.merge`, `@corex/deepmerge`, `deep-extend`, `@stackline/deepmerge` |
| **On hold** | `defu`, `merge-anything`, `@75lb/deep-merge` |

Twelve packages, each with scored reviews, reasoning, caveats and structured evidence. The CVE row includes the reproduction notes and the scanner blind spot, so the decision is auditable rather than asserted.

### In-app AI assistant chat interface (React)

| | |
|---|---|
| **Adopt** | `@assistant-ui/react` (the only direct dependency), `@assistant-ui/react-markdown` if formatted output is needed |
| **Transitive, must be allowlisted** | `@assistant-ui/core`, `@assistant-ui/tap`, `@assistant-ui/store` |
| **Review cadence** | 90 days — 0.x packages shipping roughly 30 releases per quarter |

Five packages. `@assistant-ui/store` is included because it is a required peer of core and react and was missing from the original four-package list. The reviews record the measured footprint (63 MB full install, ~135 KB gzip), the OIDC publish pipeline, and the fact that no package in the 183-package tree has an install script.

### Sanitize untrusted HTML before rendering

| | |
|---|---|
| **Adopt** | `dompurify` (browser, primary), `sanitize-html` (Node/SSR), `rehype-sanitize` (markdown pipeline) |
| **On hold** | `isomorphic-dompurify` (27 MB jsdom), `xss` (escape-not-strip, thin advisory history) |
| **Rejected** | `insane` (abandoned, unfixed ReDoS), `sanitizer` (abandoned since 2015) |

Seven packages. No sanitizer in the category publishes npm provenance, so the decision waives that constraint explicitly and substitutes exact pinning plus a 90-day cadence. The review includes a 25-vector bypass corpus run in headless Chrome: the unsanitized control executed 11 vectors, every tested sanitizer executed none.

---

## Structure

```
data/                    source of truth (edit these)
  requirements.json      tasks, constraints, owners, cadence
  packages.json          registry metadata and packaging facts
  reviews.json           verdict, score, reasoning, caveats, evidence
  decisions.json         adopted / hold / dropped / rejected buckets

scripts/
  lib/load.mjs           read, validate, compute derived state
  lib/render.mjs         HTML rendering
  build.mjs              data → dist/
  dev.mjs                watch + rebuild + serve
  check.mjs              data + link integrity
  serve.mjs              zero-dependency static server
  validate.mjs           data validation CLI

assets/
  style.css              light/dark, print styles
  app.js                 client-side search and filtering

dist/                    generated, committed so it can be served anywhere
```

Relative links are used throughout, so `dist/` works from a subdirectory, an S3 bucket, GitHub Pages or an internal file share.

---

## The model

### `requirements.json`

A task that needs a package, and the constraints a candidate must meet.

| Field | Notes |
|---|---|
| `id`, `slug` | `slug` becomes the page name |
| `title`, `summary` | what the task is and what "done" means |
| `owner` | accountable team |
| `criticality` | `low` · `medium` · `high` · `critical` |
| `status` | `active` · `retired` |
| `created_at` | `YYYY-MM-DD` |
| `review_cadence_days` | how long a review stays valid |
| `constraints` | hard requirements, shown on the page |
| `out_of_scope` | optional clarifications |

### `packages.json`

Facts about the artifact, not opinions.

| Field | Notes |
|---|---|
| `name`, `ecosystem` | `ecosystem` is currently `npm` |
| `latest_version`, `published_at` | the version actually reviewed |
| `repo`, `registry` | `repo` may be `null` — and that itself is a finding |
| `license` | SPDX identifier |
| `weekly_downloads` | popularity proxy; includes CI traffic |
| `runtime_deps` | direct runtime dependency count |
| `install_size_kb`, `unpacked_size_kb` | `null` when not measured |
| `maintainers` | npm account names |
| `types` | `bundled` · `unresolved` · `@types` · `none` |
| `formats` | `cjs` · `esm` · `dual` |
| `npm_provenance` | `true` when the published npm tarball carries a SLSA attestation |
| `release_provenance` | optional; `true` when GitHub release artifacts are attested but the npm tarball is not |
| `signed_release` | optional; `true` when release artifacts carry Sigstore signatures |
| `provenance_note` | optional explanation shown on the package page |
| `notes` | one or two sentences of context |

Licence category is derived from the SPDX string, not stored by hand: permissive (MIT, ISC, BSD, Apache-2.0, 0BSD), weak copyleft (MPL, LGPL), strong copyleft (GPL, AGPL). A dual licence is classified by its most permissive arm, because that is the arm you can choose.

The board distinguishes two provenance states. **`npm`** means the registry tarball itself is attested and can be verified automatically. **`release`** means only the GitHub release artifacts are attested; this is DOMPurify's case, where the four `dist` files in the npm tarball hash-match the attested subjects byte-for-byte, but `npm install` cannot verify that for you.

### `reviews.json`

One verdict per package per requirement.

| Field | Notes |
|---|---|
| `recommendation` | `adopt` · `hold` · `avoid` · `replace` |
| `risk` | `low` · `medium` · `high` · `critical` |
| `score` | 0–100, a summary of the rubric — not the decision itself |
| `summary` | the verdict in one sentence |
| `reasoning[]` | the evidence that drove the verdict |
| `caveats[]` | what could bite us after adoption |
| `evidence[]` | structured checks (below) |
| `cadence_days` | optional override of the requirement cadence |

Each evidence item:

```json
{
  "key": "provenance",
  "label": "SLSA provenance",
  "status": "pass",
  "detail": "SLSA v1 attestation: builder actions/runner/github-hosted, source fastify/deepmerge, workflow .github/workflows/release.yml.",
  "sources": [{ "label": "npm attestation", "url": "https://registry.npmjs.org/…" }]
}
```

`status` is `pass` · `warn` · `fail` · `info`. Reuse these keys so the comparison table stays meaningful: `publish_pipeline`, `provenance`, `cve`, `maintenance`, `dependencies`, `types`, `behaviour`, `license`.

### `decisions.json`

The whitelist outcome for a requirement. Every reviewed package must appear in **exactly one** bucket — the validator enforces it.

| Bucket | Meaning |
|---|---|
| `adopted` | approved; `primary_package_id` must be in this list |
| `hold` | not approved, not banned; exceptions need a documented reason |
| `dropped` | in use today; carries `deadline` and `reason` |
| `rejected` | not permitted for this requirement |

`status` is `approved` · `denied` · `pending`, and `expires_at` drives the expiry warnings.

---

## Review cadence and staleness

Nothing is hardcoded as "current". On every build:

- `next_review_at = reviewed_at + (review.cadence_days ?? requirement.review_cadence_days)`
- A review is **current** until 30 days before that date, **due soon** inside the window, and **overdue** after it.
- A decision is **active** until 30 days before `expires_at`, **expiring** inside the window, and **expired** after it.
- Overdue reviews and expiring or expired decisions are listed under **Needs attention** on the overview page.

With the seeded 180-day cadence, the current review is due **18 Apr 2027**. On 19 Apr 2027 the site will show it as overdue without anyone editing a file.

---

## Adding a review

1. **Add the package** to `data/packages.json` if it is new. Record what you measured, and use `null` where you did not measure it — do not guess.
2. **Add the review** to `data/reviews.json`. Include at least one evidence item per decision driver, and a `sources` link where a claim is checkable.
3. **Classify it** in `data/decisions.json` under exactly one of `adopted`, `hold`, `rejected` or `dropped`.
4. **Verify and build**:
   ```bash
   npm run validate
   npm run build
   npm run check
   ```
5. **Commit the JSON and `dist/`.** The commit is the audit entry: who changed the verdict, when, and with what evidence.

The validator rejects unknown package or requirement IDs, duplicate IDs, invalid enums, malformed dates, scores outside 0–100, missing evidence, and decisions whose primary package is not adopted or whose review is not an `adopt`. Bucket coverage problems are warnings rather than errors so you can stage a decision incrementally.

---

## Scoring rubric

Scores summarise five weighted dimensions:

| Weight | Dimension | What it covers |
|---:|---|---|
| 30 | Security | advisories, prototype-pollution behaviour, remediation status, scanner visibility |
| 25 | Release integrity | CI publishing, OIDC vs long-lived token, SLSA provenance, pinned actions |
| 20 | Maintenance | release recency, stale PRs, maintainer count, org ownership |
| 15 | Fit | semantics, type inference, ESM/CJS, cycles, special objects |
| 10 | Footprint | runtime dependencies, install size, license |

| Score | Verdict |
|---:|---|
| 80–100 | adopt |
| 60–79 | hold |
| 0–59 | avoid |

A hard failure — unfixed high/critical advisory, no CI publishing, unmaintained — caps the verdict regardless of the score. That is why `deepmerge` scores 18 despite 59M weekly downloads, and why `ts-deepmerge` scores 62 but is still rejected.

---

## Design notes

**Why JSON instead of SQLite or Postgres?** The dataset is small, changes slowly, and every change should be reviewable by a human. A diff in a pull request is the review mechanism; git is the audit log. There is no server to patch and no credentials to manage. If the dataset grows past a few hundred packages, the loader and renderer are independent, so the storage layer can be swapped without touching the UI.

**Why generate static HTML?** It can be published anywhere, opened offline, printed to PDF, and diffed in CI. No client framework, ~20 KB of CSS and JS.

**Why categories instead of a single allowlist?** A binary whitelist hides the difference between "approved", "not approved but tolerated", and "must be removed". Those three need different actions and different deadlines.

---

## Known limitations

- **Provenance is not a safety proof.** It ties a tarball to a commit and a builder; it says nothing about whether the source is malicious.
- **Package scanners have gaps.** CVE-2026-93753 has only a GIT range in OSV, so package-scoped matching — and therefore `npm audit` — reports zero for `deepmerge@4.3.1`. Check advisories by CVE as well as by package.
- **Download counts are not adoption.** They include CI traffic and transitive installs.
- **Bus factor is recorded, not solved.** Several adopted packages have a single maintainer. The mitigations are a small surface area, org ownership and a short cadence.
- **Static means no auth.** Access control is the repository and wherever you publish `dist/`.
- **The site has no write UI by design.** Editing happens in JSON, under review. A form would need a server and would bypass the diff.
