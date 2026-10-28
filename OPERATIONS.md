# Operations runbook

## One-time setup

### Repository permissions

- **Settings → Actions → General → Workflow permissions**: allow read and write
  if you rely on `GITHUB_TOKEN` to push branches and open PRs.
- Enable **Allow GitHub Actions to create and approve pull requests**.
- **Settings → Pages → Build and deployment → Source: GitHub Actions**.
- **Settings → Branches → Add branch protection rule** for `main`:
  - require a pull request before merging,
  - disallow force pushes,
  - optionally require the `validate` status check.

If you require `validate` on bot-created PRs, use a GitHub App installation token
in the bot workflows. PRs opened with the default `GITHUB_TOKEN` do not trigger
other pull-request workflows. Until the App token is configured, keep the check
optional or allow the owner to bypass it.

### Labels

Create:

- `review-request` — starts a package review.

Optional:

- `needs-triage` — your own triage marker.

Only the owner and collaborators with `write` or `triage` can apply labels. The
workflow re-checks the labeler and requires `write`, `maintain` or `admin`.
Set the optional `REVIEW_LABELERS` variable to an explicit allowlist if you want
owner-only control.

### Variables and secrets

**Settings → Secrets and variables → Actions**

Variables:

```text
OPENCODE_MODEL     provider/model, pinned. Example: commandcode/deepseek/deepseek-v4.1-flash
REVIEW_LABELERS    optional comma-separated usernames allowed to start a review
```

Secrets:

```text
COMMANDCODE_API_KEY   if using CommandCode
OPENCODE_API_KEY      if using the OpenCode provider / free models
ANTHROPIC_API_KEY     if using Anthropic
OPENAI_API_KEY        if using OpenAI
```

The model and key must match. A bare model name is invalid; use
`provider/model`. Free OpenCode models still require an OpenCode key in CI.

## Daily workflow

1. **Requirement.** If the task is new, add it under
   `data/requirements/<id>.json` with an owner, criticality, cadence,
   constraints and out-of-scope items. Update the issue-form dropdown.
2. **Request.** Open the package review issue form. Put one package per line.
   Leave **Auto-select** for an existing requirement, or choose it explicitly.
   Use **Batch** only for related packages.
3. **Triage.** Apply `review-request`. The workflow collects evidence, drafts
   reviews, builds the site and opens a PR.
4. **Review.** Read the evidence and suite notes. Edit verdicts if needed.
   Merge the review PR when you are satisfied.
5. **Decision.** Open a separate PR that adds each package to exactly one bucket
   in `data/decisions/<requirement-id>.json`. Include the rationale and expiry.
6. **Deploy.** Merging to `main` triggers `site.yml`; the site rebuilds and
   deploys. A nightly run refreshes date-derived staleness.

## Re-triggering a failed or stopped run

A run is pinned to the commit that triggered it. **Re-run all jobs** will not
pick up new data.

Use one of:

- remove then re-add `review-request` on the issue, or
- **Actions → package-review → Run workflow** with the package list and
  requirement.

The new run must show the latest `main` commit, not the old one.

## Troubleshooting

### “Unknown requirement”

The requirement file does not exist. Add
`data/requirements/<id>.json` and update the issue-form dropdown. Then re-trigger.

### “The request describes a new requirement”

The issue selected **New requirement / not sure**. The bot intentionally stops
and comments. Add the requirement, then re-trigger.

### “Invalid model reference”

`OPENCODE_MODEL` is a bare name. Use `provider/model`, for example
`opencode/deepseek-v4.1-flash-free`.

### “This API key can't call models”

The key does not belong to the provider in `OPENCODE_MODEL`, is revoked, or its
workspace lacks model access. Test locally:

```bash
OPENCODE_API_KEY=... opencode run --standalone \
  --model opencode/deepseek-v4.1-flash-free "Say ok"
```

### Node 20 warning

That warning refers to the runtime bundled inside an Action, not the project.
Keep the Actions on current major versions and `node-version: 24`.

### Site deploy fails

- Confirm **Settings → Pages → Source: GitHub Actions**.
- Check the `github-pages` environment.
- The build job must create `dist/`; it is not committed.

## Metadata refresh

`metadata-refresh.yml` runs weekly and opens a PR that updates registry facts
only:

- latest version and publish date,
- licence, dependency count, unpacked size,
- maintainers, formats, types,
- npm provenance.

It does not change reviews, decisions or `notes`. Review the diff, especially
version drift, before merging.

## Revising a review from a PR

Comment on a review PR:

```text
/revise axios: the advisory is fixed in 1.7.7; update the CVE evidence
```

Only `REVIEW_LABELERS` or repository collaborators with write access may use it.
The workflow checks out the PR branch, runs the restricted revision agent,
updates `data/reviews/`, validates, commits back to the branch and replies.

The revision agent cannot edit decisions, packages or requirements.

## Public data

This repository and the generated site are public. Package decisions, evidence,
CVE notes and team names are public. If that changes, move the data to a private
repository and host the output behind Cloudflare Access or an authenticated
static host.
