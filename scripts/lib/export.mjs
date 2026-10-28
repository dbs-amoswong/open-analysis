const BUCKET_ORDER = ["adopted", "hold", "dropped", "rejected"];

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function indexPackages(model) {
  return new Map(model.packages.map((pkg) => [pkg.id, pkg]));
}

function entryFor(req, pkg, bucket, extra = {}) {
  const candidate = req.candidates.find((item) => item.package.id === pkg.id);
  const review = candidate?.review ?? null;
  return {
    name: pkg.name,
    version: review?.reviewed_version ?? pkg.latest_version,
    license: pkg.license,
    license_category: pkg.license_category,
    npm_provenance: Boolean(pkg.npm_provenance),
    recommendation: review?.recommendation ?? null,
    risk: review?.risk ?? null,
    bucket,
    ...extra,
  };
}

export function buildAllowlist(model) {
  const byId = indexPackages(model);

  const requirements = model.requirements
    .filter((req) => req.status === "active")
    .map((req) => {
      const decision = req.decision;
      if (!decision) {
        return {
          id: req.id,
          slug: req.slug,
          title: req.title,
          status: null,
          decided_at: null,
          decided_by: null,
          expires_at: null,
          expired: null,
          days_until_expiry: null,
          primary: null,
          adopted: [],
          hold: [],
          dropped: [],
          rejected: [],
        };
      }

      const get = (id) => byId.get(id);
      const adopted = decision.adopted.map((id) => entryFor(req, get(id), "adopted"));
      const hold = decision.hold.map((id) => entryFor(req, get(id), "hold"));
      const rejected = decision.rejected.map((id) => entryFor(req, get(id), "rejected"));
      const dropped = decision.dropped.map((drop) =>
        entryFor(req, get(drop.package_id), "dropped", {
          drop_deadline: drop.deadline,
          drop_reason: drop.reason,
        })
      );

      return {
        id: req.id,
        slug: req.slug,
        title: req.title,
        status: decision.status,
        decided_at: decision.decided_at,
        decided_by: decision.decided_by,
        expires_at: decision.expires_at,
        expired: decision.decision_state === "expired",
        days_until_expiry: decision.days_until_expiry,
        primary: decision.primary?.name ?? null,
        adopted,
        hold,
        dropped,
        rejected,
      };
    });

  const packages = [];
  for (const req of model.requirements) {
    for (const candidate of req.candidates) {
      const decision = req.decision;
      const bucket = decision?.bucket_of.get(candidate.package.id) ?? "unclassified";
      const drop = decision?.drop_by_id.get(candidate.package.id) ?? null;
      packages.push({
        requirement_id: req.id,
        package: candidate.package.name,
        version: candidate.review.reviewed_version,
        bucket,
        recommendation: candidate.review.recommendation,
        risk: candidate.review.risk,
        license: candidate.package.license,
        license_category: candidate.package.license_category,
        npm_provenance: Boolean(candidate.package.npm_provenance),
        decision_status: decision?.status ?? null,
        decision_expires_at: decision?.expires_at ?? null,
        drop_deadline: drop?.deadline ?? null,
      });
    }
  }

  const json = {
    generated_at: model.generated_at,
    today: model.today,
    requirements,
    packages,
  };

  const header = [
    "requirement_id",
    "requirement",
    "decision_status",
    "decision_expires_at",
    "package",
    "version",
    "bucket",
    "recommendation",
    "risk",
    "license",
    "license_category",
    "npm_provenance",
    "drop_deadline",
  ];

  const lines = [header.join(",")];
  for (const req of requirements) {
    for (const bucket of BUCKET_ORDER) {
      for (const item of req[bucket]) {
        lines.push(
          [
            req.id,
            req.title,
            req.status ?? "",
            req.expires_at ?? "",
            item.name,
            item.version,
            bucket,
            item.recommendation ?? "",
            item.risk ?? "",
            item.license ?? "",
            item.license_category ?? "",
            item.npm_provenance,
            item.drop_deadline ?? "",
          ]
            .map(csvCell)
            .join(",")
        );
      }
    }
  }

  return { json, csv: `${lines.join("\n")}\n` };
}
