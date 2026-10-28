import { loadModel, todayISO } from "./lib/load.mjs";

const arg = process.argv.find((a) => a.startsWith("--today="));
const today = arg ? arg.slice("--today=".length) : todayISO();

try {
  const model = await loadModel({ today });
  const c = model.counts;

  console.log("Data is valid.");
  console.log(
    `  ${c.packages} packages · ${c.requirements} active requirements · ${c.adopted} adopted · ` +
      `${c.dropped} dropped · ${c.hold} hold · ${c.rejected} rejected`
  );

  if (model.attention.length) {
    console.log(`\n${model.attention.length} item(s) need attention:`);
    for (const item of model.attention) {
      console.log(`  ${item.severity === "overdue" ? "✕" : "!"} ${item.title} — ${item.detail}`);
    }
  } else {
    console.log("\nNothing overdue or expiring.");
  }

  if (model.warnings.length) {
    console.log(`\n${model.warnings.length} warning(s):`);
    for (const w of model.warnings) console.log(`  ! ${w}`);
  }
} catch (err) {
  if (err.name === "ValidationError") {
    console.error(`${err.message}\n`);
    for (const e of err.errors) console.error(`  ✕ ${e}`);
    for (const w of err.warnings) console.error(`  ! ${w}`);
    process.exit(1);
  }
  throw err;
}
