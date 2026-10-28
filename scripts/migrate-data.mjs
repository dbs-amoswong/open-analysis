import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { COLLECTIONS, DATA_DIR, writeRecord } from "./lib/data.mjs";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

let migrated = 0;

for (const collection of COLLECTIONS) {
  const legacy = path.join(DATA_DIR, `${collection}.json`);
  if (!(await exists(legacy))) {
    console.log(`${collection}: already record-based`);
    continue;
  }

  const records = JSON.parse(await readFile(legacy, "utf8"));
  if (!Array.isArray(records)) {
    throw new Error(`${collection}.json must be an array`);
  }

  const seen = new Set();
  for (const record of records) {
    if (!record?.id) throw new Error(`${collection}: record without id`);
    if (seen.has(record.id)) throw new Error(`${collection}: duplicate id ${record.id}`);
    seen.add(record.id);
    await writeRecord(collection, record);
  }

  await rm(legacy);
  migrated += 1;
  console.log(`${collection}: migrated ${records.length} record(s)`);
}

console.log(
  migrated
    ? `Migrated ${migrated} collection(s) under ${DATA_DIR}`
    : "Nothing to migrate."
);
