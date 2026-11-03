# Package Review Board

A static, git-backed database of package reviews and whitelist decisions. You record the evidence in JSON, run one command, and get a browsable site that answers: **for this task, what should we adopt, and what should we drop?**

No server, no database engine, no runtime dependencies. Node.js 24+ only.

**Scope.** The board selects and reviews packages. It does not have access to
consuming applications, so application lockfiles, browser baselines, migration
regressions and product-specific thresholds are consumer obligations, not board
evidence. A decision can approve a package or library target without certifying
a particular application migration.

```bash
npm run build     # validate data → generate dist/
npm run dev       # rebuild on change + serve at http://localhost:4173
npm run validate  # data checks only
npm run check     # pipeline test + data + links + allowlist
npm run serve     # serve the existing dist/
npm run audit:lockfile -- /path/to/app/package-lock.json  # check reviewed packages and parents
```

Open `dist/index.html`, or run `npm run dev`.

---

## What is already in here

Requirements are seeded from real reviews.

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

### HTTP requests from browser and Node

| | |
|---|---|
| **Adopt** | `axios` 1.21.0 (primary), `follow-redirects` 1.16.2 (required Node transport) |
| **On hold** | `undici`, `fast-uri`, `js-cookie`, `protobufjs`, `cookie` — not HTTP clients, or duplicate role |
| **Rejected** | None |
| **Out of scope** | Replacing axios with native fetch |

Seven packages. The earlier hold on axios was based on an unverified dependency tree and publish pipeline. Both were re-checked: axios publishes from GitHub Actions with OIDC trusted publishing and SLSA provenance, its 27-package runtime tree is entirely MIT with no install scripts, OSV is clean, and a local ESM/CJS interceptor and mock-adapter probe passed. `follow-redirects` is the only verified axios edge; it has no npm provenance, so pin 1.16.2 and record the gap. The other five are held because they do not provide the HTTP client role: `undici` is a Node-only client already embedded in modern Node, `fast-uri` is a URI utility, `js-cookie` and `cookie` are cookie helpers, and `protobufjs` is a codec. Firebase 13.2.0 pulls `protobufjs` 7.6.6 through `@grpc/proto-loader`, not the reviewed 8.8.1, and the Firebase tree shows no edge for the other four; that is monitoring context, not a condition for the HTTP client decision.

### Sanitize untrusted HTML before rendering

| | |
|---|---|
| **Adopt** | `dompurify` (browser, primary), `sanitize-html` (Node/SSR) |
| **On hold** | `rehype-sanitize` (no release since 2023), `isomorphic-dompurify` (27 MB jsdom), `xss` (escape-not-strip, thin advisory history) |
| **Rejected** | `insane` (abandoned, unfixed ReDoS), `sanitizer` (abandoned since 2015) |

Seven packages. No sanitizer in the category publishes npm provenance, so the decision waives that constraint explicitly and substitutes exact pinning plus a 90-day cadence. `rehype-sanitize` has a strong HAST mechanism, but its last release was August 2023 and its repository has been inactive since September 2023, so it is held under the active-maintenance constraint. The review includes a 25-vector bypass corpus run in headless Chrome: the unsanitized control executed 11 vectors, every tested sanitizer executed none.

### Graph visualization in a React application

| | |
|---|---|
| **Adopt** | `cytoscape` (primary), `sigma` (large-graph core fallback) |
| **On hold** | `@antv/g6` (88 MB install), `@xyflow/react` (node editor, not exploration), `@react-sigma/core` + `graphology` (no graphology release since Jan 2025) |
| **Denied** | `@neo4j-nvl/react`, `@neo4j-nvl/base`, `@neo4j-nvl/layout-workers`, `@neo4j-nvl/interaction-handlers` — proprietary, no source, no provenance |
| **Not needed** | `@neo4j-bloom/dagre` — MIT fork, unused by the suite |

Nine packages. NVL is denied at both 2.0.0 and 1.2.2. Cytoscape.js is MIT, zero dependencies and provenance-signed; use a thin React ref wrapper because `react-cytoscapejs` is stale. A React 19 ref-wrapper spike rendered 20 nodes and 20 edges in 25 ms and selection passed. Sigma.js is the WebGL core fallback for large graphs, client-only and without provenance; a React 19 ref-wrapper spike with `graphology` 0.26.0 rendered 20 nodes and 20 edges on WebGL2 without errors. Do not pair Sigma with `@react-sigma/core`: the wrapper requires `graphology` ^0.26, whose latest release is January 2025, outside the 12-month maintenance window.

### Graph visualization and editing

| | |
|---|---|
| **Adopt** | `@antv/x6` 3.1.8 (primary), `@antv/x6-react-shape` 3.0.1 (React nodes) |
| **Bridge only** | `@antv/x6` 2.19.2 + compatible 2.x plugins — deprecated, remove by 17 Nov 2026 |
| **Fallback** | `maxGraph` 0.25.1 — Apache-2.0, zero dependencies, but a rewrite and still 0.x |
| **Excluded** | GoJS, JointJS+ — commercial licences |

Two adopted packages. The vanilla and React browser spikes pass after adding `tslib`; the React spike renders 20 interactive React nodes with selection. Native Node/SSR is explicitly not approved because X6 v3 fails native ESM and CJS loading. The runtime tree is permissive. No npm provenance exists for X6 or the React shape package, so pin both exact versions and record the gaps. This is a library recommendation, not a certified migration: the consuming application team owns its lockfile, browser baseline, regression suite and the X6 v2 removal deadline.

---

## Structure

```
data/                    source of truth (one JSON object per file)
  requirements/<id>.json tasks, constraints, owners, cadence
  packages/<id>.json     registry metadata and packaging facts
  reviews/<id>.json      verdict, score, reasoning, caveats, evidence
  decisions/<id>.json    adopted / hold / dropped / rejected buckets
  evaluations/<id>.json  alternatives, feature fit, spike metrics, screenshots

scripts/
  lib/data.mjs           per-record read/write helpers
  lib/load.mjs           read, validate, compute derived state
  lib/render.mjs         HTML rendering
  lib/export.mjs         allowlist JSON/CSV export
  build.mjs              data → dist/
  dev.mjs                watch + rebuild + serve
  check.mjs              data + link integrity
  audit-lockfile.mjs     find reviewed packages, versions and parents in an app lockfile
  serve.mjs              zero-dependency static server
  validate.mjs           data validation CLI
  migrate-data.mjs       one-time array → per-record migration (npm run migrate:data)
  refresh-metadata.mjs   refresh registry facts (CI)
  prepare-request.mjs    parse an issue request
  collect.mjs            collect npm/OSV/provenance evidence
  verify-review.mjs      validate an AI draft
  publish-review.mjs     append a draft to data/
  collect-suite.mjs      build a related-package suite context
  verify-suite.mjs       validate suite notes

spikes/                   small browser integrations used by evaluations/

assets/
  style.css              light/dark, print styles
  app.js                 client-side search and filtering
  evaluations/*.png      spike screenshots copied into dist/

dist/                    generated; not committed. CI builds and deploys it.
```

Relative links are used throughout, so `dist/` works from a subdirectory, an S3 bucket, GitHub Pages or an internal file share. `dist/` is generated and ignored by git; `site.yml` builds and deploys it.

---

## The model

### `data/requirements/<id>.json`

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

### `data/packages/<id>.json`

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
| `build_vs_buy` | optional; `scope`, `difficulty`, `commodity`, `integration` (1–5), `effort`, `rationale`; score and verdict are derived. Packages ingested automatically stay unrated until a reviewer adds it |
| `prior_versions` | optional list of earlier versions with `version`, `published_at`, `recommendation`, `note`, and optional `remove_by` to surface a removal deadline in Needs attention |
| `notes` | one or two sentences of context |

Licence category is derived from the SPDX string, not stored by hand: permissive (MIT, ISC, BSD, Apache-2.0, 0BSD), weak copyleft (MPL, LGPL), strong copyleft (GPL, AGPL), and proprietary (`SEE LICENSE IN …`, unlicensed, commercial). A dual licence is classified by its most permissive arm, because that is the arm you can choose. An SPDX exception such as `Apache-2.0 WITH LLVM-exception` keeps the permissive category of its base licence; the exception only removes permissions, it does not add copyleft obligations.

The board distinguishes two provenance states. **`npm`** means the registry tarball itself is attested and can be verified automatically. **`release`** means only the GitHub release artifacts are attested; this is DOMPurify's case, where the four `dist` files in the npm tarball hash-match the attested subjects byte-for-byte, but `npm install` cannot verify that for you.

Every package also carries a **build-vs-buy** assessment. Four sub-scores from 1 to 5 are stored, and the 0–100 score plus verdict are derived:

| Sub-score | Weight | 5 means | 1 means |
|---|---:|---|---|
| `scope` | 35% | large surface to rebuild | trivial to write |
| `difficulty` | 30% | adversarial, edge-case-heavy | straightforward |
| `commodity` | 20% | undifferentiated infrastructure | core to the product |
| `integration` | 15% | light footprint, easy to swap | heavy deps or lock-in |

Bands: **70–100 Buy**, **50–69 Evaluate**, **0–49 Build**. The score is independent of the security verdict — a vulnerable package can still represent a capability you should buy from a maintained implementation — and it assumes the capability is needed at all. `effort` and `rationale` hold the human judgement.

### `data/reviews/<id>.json`

One verdict per package per requirement.

| Field | Notes |
|---|---|
| `recommendation` | `adopt` · `hold` · `avoid` · `replace` |
| `risk` | `low` · `medium` · `high` · `critical` |
| `score` | 0–100, a summary of the rubric — not the decision itself |
| `reviewed_version` | the exact version assessed; defaults to the package's latest if omitted |
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

Reviews are **version-scoped**. Every review records the exact `reviewed_version`; the package page shows the current latest separately and flags drift. An older version that differs materially gets a `prior_versions` entry with its own verdict and note instead of silently inheriting the latest verdict. A bridge version can also carry `remove_by`; a deadline inside 30 days appears in **Needs attention**. If the difference is large enough to need new evidence, model it as a separate package entry.

### `data/decisions/<id>.json`

The whitelist outcome for a requirement. Every reviewed package must appear in **exactly one** bucket — the validator enforces it.

| Bucket | Meaning |
|---|---|
| `adopted` | approved; `primary_package_id` must be in this list |
| `hold` | not approved, not banned; exceptions need a documented reason |
| `dropped` | in use today; carries `deadline` and `reason` |
| `rejected` | not permitted for this requirement |

`status` is `approved` · `denied` · `pending`, and `expires_at` drives the expiry warnings.

### `data/evaluations/<id>.json`

A comparison record for a library, stack, reference implementation or build option. Evaluations are intentionally separate from reviews: a review judges a package for a requirement; an evaluation compares alternatives and records a small browser spike.

```json
{
  "id": "eval-x6-v2",
  "requirement_id": "req-graph-editor",
  "name": "@antv/x6",
  "version": "2.19.2",
  "kind": "stack",
  "verdict": "retain",
  "fit_score": 85,
  "license": "MIT",
  "summary": "Why this option fits or does not.",
  "gains": ["What improves"],
  "losses": ["What gets worse"],
  "blockers": ["Commercial licence is not allowed"],
  "features": {
    "general_editing": "native",
    "undo_redo": "plugin",
    "framework_independent": "native"
  },
  "spike": {
    "status": "spike-pass",
    "tested_at": "2026-11-04",
    "scenario": "20 nodes, 20 edges, production build.",
    "metrics": { "mount_ms": 14, "bundle_kb": 479.61, "gzip_kb": 137.67 },
    "screenshot": "x6-v2.png",
    "code_path": "spikes/x6-v2/main.js",
    "notes": "What the spike did and did not test."
  }
}
```

Screenshots live in `assets/evaluations/` and are copied to `dist/evaluations/` by the build. Spike source lives under `spikes/`. The evaluation page is generated at `/evaluations/` and linked from every requirement.

---

## Machine-readable allowlist

Every build writes two files consumers can use:

- `dist/allowlist.json` — requirements, decisions, and one row per reviewed package
- `dist/allowlist.csv` — the same rows as CSV

A consumer enforces the policy by taking rows where `decision_status === "approved"`, `expired === false`, and `bucket === "adopted"`, then pinning the exact `version`. Rows in `dropped` carry a `drop_deadline`; `hold` and `rejected` are not permitted. Conditional approvals also expose `conditions` on the requirement and `decision_conditions` on each package row; a consumer must apply them, not just the bucket.

```json
{
  "today": "2026-11-04",
  "requirements": [
    {
      "id": "req-deep-merge",
      "status": "approved",
      "primary": "@fastify/deepmerge",
      "expires_at": "2027-04-18",
      "expired": false,
      "scope": "Library selection; application integration is a consumer obligation.",
      "conditions": [
        "Use @fastify/deepmerge 3.2.4 as the default; pin it exactly and keep the lockfile."
      ]
    }
  ],
  "packages": [
    {
      "requirement_id": "req-deep-merge",
      "package": "@fastify/deepmerge",
      "version": "3.2.4",
      "bucket": "adopted",
      "decision_status": "approved",
      "decision_expires_at": "2027-04-18",
      "decision_conditions": [
        "Use @fastify/deepmerge 3.2.4 as the default; pin it exactly and keep the lockfile."
      ]
    }
  ]
}
```

The whitelist page links both files. `npm run check` fails if either is missing from `dist/`.

## Review cadence and staleness

Nothing is hardcoded as "current". On every build:

- `next_review_at = reviewed_at + (review.cadence_days ?? requirement.review_cadence_days)`
- A review is **current** until 30 days before that date, **due soon** inside the window, and **overdue** after it.
- A decision is **active** until 30 days before `expires_at`, **expiring** inside the window, and **expired** after it.
- Overdue reviews and expiring or expired decisions are listed under **Needs attention** on the overview page.

With the seeded 180-day cadence, the current review is due **18 Apr 2027**. On 19 Apr 2027 the site will show it as overdue without anyone editing a file.

---

## Auditing an application lockfile

`npm run audit:lockfile -- /path/to/app/package-lock.json` reports the reviewed
HTTP and graph packages that actually resolve, the versions, whether they are
dev/optional/peer, and which package declares them. Pass package names to narrow
it, or `--json` for a machine-readable report:

```bash
npm run audit:lockfile -- ../app/package-lock.json axios protobufjs @antv/x6
npm run audit:lockfile -- ../app/package-lock.json --json > ai/lockfile-audit.json
```

Use it to give the consuming team a concrete view of what its application
actually resolves. The board does not require the application lockfile to make
the HTTP client decision, and the X6 v2 deadline remains an application-side
obligation.

## Adding a review

1. **Add the package** as `data/packages/<package-id>.json` if it is new. Record what you measured, and use `null` where you did not measure it — do not guess.
2. **Add the review** as `data/reviews/<review-id>.json`. Include at least one evidence item per decision driver, and a `sources` link where a claim is checkable.
3. **Classify it** in `data/decisions/<requirement-id>.json` under exactly one of `adopted`, `hold`, `rejected` or `dropped`.
4. **Verify and build**:
   ```bash
   npm run validate
   npm run build
   npm run check
   ```
5. **Commit the JSON.** The commit is the audit entry: who changed the verdict, when, and with what evidence. `dist/` is generated by CI and is not committed.

The validator rejects unknown package or requirement IDs, duplicate IDs, invalid enums, malformed dates, scores outside 0–100, missing evidence, and decisions whose primary package is not adopted or whose review is not an `adopt`. Bucket coverage problems are warnings rather than errors so you can stage a decision incrementally.

---

## Requesting a review through GitHub Actions

The request path is an issue, not a JSON edit:

1. Open an issue with the **Package review request** form. Put one package per
   line; add `@version` to a line for an exact version. Up to 20 packages per
   request. Pick a requirement from the dropdown, or leave **Auto-select**.
   Auto-select matches the package names and use case against the existing
   requirements. If it cannot match confidently, the workflow comments with the
   available requirement IDs and stops before spending any model tokens. A new
   requirement still needs a human to add it.
2. A collaborator checks that the packages are not already reviewed for that
   requirement, then adds the `review-request` label.

The requirement dropdown is static because GitHub issue forms do not support
dynamic options. When a requirement is added, update the options in
`.github/ISSUE_TEMPLATE/package-review.yml` as well.
3. `.github/workflows/package-review.yml` parses the list, collects npm,
   download, OSV, provenance and GitHub facts into `ai/dossiers/<pkg-id>.json`
   per package, and runs OpenCode once per package with the restricted
   `package-review` agent.
4. Each agent run writes only `ai/reviews/<pkg-id>.json`. A trusted script
   validates every draft, writes each one to `data/reviews/<review-id>.json`,
   builds the site, and opens **one pull request for the batch**. The workflow
   comments the PR link on the issue. Packages that already have a review for
   the requirement are skipped and listed in the PR body.
5. A human checks the evidence and each verdict. A separate decision PR puts
   every package in exactly one whitelist bucket. The AI never edits
   `data/decisions/`.

The form also asks for a **review mode**:

- **Batch** treats the packages as a related suite. In addition to the
  per-package reviews, it builds `ai/suite/input.json` (direct relationships,
  shared dependencies, shared maintainers, licences, scopes) and runs a second
  agent that writes suite notes into the PR. The suite pass is best-effort: if
  it fails, the individual reviews still open.
- **Separate** reviews each package independently. It still runs one OpenCode
  session per package, but skips the shared-context and suite pass. Choose this
  when the packages have no meaningful relationship.

Both modes open **one pull request**. For one PR per package, submit one issue
per package instead. The record-based data files make independent PRs safe, but
one PR per issue keeps the review and approval boundary simple.

If one draft fails verification, the workflow stops before opening the PR;
fix the request or the draft and re-run.

Maintainers can also run the workflow manually from **Actions → package-review
→ Run workflow** with a comma-separated package list. The requirement can be
left blank for auto-selection; if no requirement matches confidently, the run
stops with a clear error instead of guessing.

Required configuration:

- Repository variable `OPENCODE_MODEL`, for example
  `anthropic/claude-sonnet-5-5`. Always use the `provider/model` form, not a
  bare model name. Free OpenCode models need the `opencode/` prefix, for example
  `opencode/deepseek-v4.1-flash-free`, and still need `OPENCODE_API_KEY` in CI.
  Pin a specific model, not a moving alias.
- A provider secret. `OPENCODE_API_KEY` works for the OpenCode provider;
  `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` and `COMMANDCODE_API_KEY` are passed
  through for those providers. For any other provider, add its key variable to
  the OpenCode step's `env` block.
- The workflow installs `@opencode/cli@2.2.0` explicitly. Keep that pin.

The agent lives in `.opencode/agents/package-review.md`. It can read the
repository and write only under `ai/`; shell, web access, subagents and external
directories are denied. `ai/` is scratch space and is ignored by git. The
committed review records the model, agent, run URL and dossier hash under
`generated_by`.

Two operational notes:

- A pull request opened with the default `GITHUB_TOKEN` does not trigger other
  PR workflows. This workflow validates and builds before opening it, so the
  data is checked. Use a GitHub App token if you also want ordinary PR checks.
- Scheduled or bot-created reviews are drafts. A named human is still
  accountable for the verdict and the decision.

Create the `review-request` label before using the form. The issue form does
not apply any label on creation. By default GitHub only lets users with
`triage` or `write` access apply labels; the workflow additionally checks the
person who applied `review-request` and fails closed unless they have `write`,
`maintain` or `admin` access. Set the optional `REVIEW_LABELERS` repository
variable to a comma-separated allowlist if you want an explicit list instead of
the permission check.

This is a personal repository, so there are no organization or team settings.
Use the repository-level equivalent:

1. **Settings → Collaborators**: invite only trusted people. Give them `write`
   or `triage`; everyone else stays `read`. Read-only collaborators cannot
   apply labels.
2. If you are the only owner and want to be the only person who can start a
   review, set `REVIEW_LABELERS` to your username. That is the per-label
   control, because GitHub has no per-label ACL.
3. Do not give `triage` to people who should not be able to label. The workflow
   requires `write` or above even for triage users.

On a public personal repository, anyone can open an issue but only you and
collaborators with `triage` or `write` can apply a label. If you make the
repository private, only collaborators can see it at all. GitHub Pages for a
private repository requires GitHub Pro or higher; a public repository is free.

Where to configure the model and key:

| Where | Name | Value |
|---|---|---|
| **Settings → Secrets and variables → Actions → Variables** | `OPENCODE_MODEL` | Provider/model, pinned, e.g. `commandcode/deepseek/deepseek-v4.1-flash` or `anthropic/claude-sonnet-5-5` |
| **Settings → Secrets and variables → Actions → Secrets** | provider key | `COMMANDCODE_API_KEY`, `OPENCODE_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, matching the model |
| Optional variable | `REVIEW_LABELERS` | Comma-separated GitHub usernames allowed to trigger a review |

The model is a repository **variable**, not a secret: it is not sensitive and
you will want to see it in logs. The API key is a repository **secret**; never
put it in `opencode.json`, the workflow file, or an issue.

`.github/workflows/site.yml` validates, builds and deploys `dist/` to GitHub
Pages on every push to `main` and once a night. Enable Pages with **Source:
GitHub Actions** once. If you host elsewhere, keep the build job and replace the
deploy job with your host's deploy action.

Other automation:

- `validate.yml` runs validation, build and link checks on pull requests.
- `metadata-refresh.yml` refreshes registry facts weekly and opens a PR. It
  updates versions, licences, dependencies, maintainers and provenance; it does
  not change reviews or decisions.
- `pr-revise.yml` accepts an explicit `/revise <instruction>` comment on a
  review PR. Only `REVIEW_LABELERS` or write collaborators may use it. It
  updates `data/reviews/` (or the PR description for suite corrections) on the
  PR branch, validates and replies.

See `AGENTS.md` for agent rules and `OPERATIONS.md` for setup, troubleshooting
and the full runbook.

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

| Score | Typical verdict |
|---:|---|
| 80–100 | adopt |
| 60–79 | hold |
| 0–59 | avoid |

A hard failure — unfixed high/critical advisory, no CI publishing, unmaintained — caps the verdict regardless of the score. That is why `deepmerge` scores 18 despite 59M weekly downloads, and why `ts-deepmerge` scores 62 but is still rejected.

The bands are guidance, not a gate. A package can be adopted below 80 when it meets every constraint and the gap is footprint, novelty or migration cost, not a hard failure. The review records the exception and the decision records the condition. Examples in the current data are `@assistant-ui/tap` (required peer), `@assistant-ui/react-markdown` (optional companion) and X6 v3 (primary with a migration-cost gap).

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
