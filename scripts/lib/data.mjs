import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const ROOT_DIR = ROOT;
export const DATA_DIR = process.env.PRB_DATA_DIR
  ? path.resolve(process.env.PRB_DATA_DIR)
  : path.join(ROOT, "data");
export const DIST_DIR = path.join(ROOT, "dist");
export const ASSETS_DIR = path.join(ROOT, "assets");

export const COLLECTIONS = ["packages", "requirements", "reviews", "decisions"];

const COLLECTION_SET = new Set(COLLECTIONS);

function assertCollection(name) {
  if (!COLLECTION_SET.has(name)) {
    throw new Error(`Unknown data collection "${name}"`);
  }
}

function validateId(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    throw new Error(`Invalid record id "${id}"`);
  }
}

async function readJSONFile(file, label) {
  const raw = await readFile(file, "utf8");
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${label} is not valid JSON: ${error.message}`);
  }
}

/**
 * Read a collection from data/<name>/*.json.
 *
 * The legacy data/<name>.json array is still supported so a checkout that has
 * not run the migration yet can build. New writes always use record files.
 */
export async function readCollection(name) {
  assertCollection(name);
  const directory = path.join(DATA_DIR, name);

  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    entries = null;
  }

  if (entries) {
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name)
      .sort();
    const records = [];
    for (const file of files) {
      records.push(
        await readJSONFile(path.join(directory, file), `${name}/${file}`)
      );
    }
    return records;
  }

  const legacy = path.join(DATA_DIR, `${name}.json`);
  const value = await readJSONFile(legacy, `${name}.json`);
  if (!Array.isArray(value)) {
    throw new Error(`${name}.json must be an array`);
  }
  return value;
}

export function recordPath(name, id) {
  assertCollection(name);
  validateId(id);
  return path.join(DATA_DIR, name, `${id}.json`);
}

export async function writeRecord(name, record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`writeRecord(${name}): expected one object`);
  }
  validateId(record.id);
  const file = recordPath(name, record.id);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  return file;
}

export async function writeCollection(name, records) {
  assertCollection(name);
  if (!Array.isArray(records)) throw new Error(`writeCollection(${name}): expected an array`);
  for (const record of records) await writeRecord(name, record);
}

export async function removeRecord(name, id) {
  assertCollection(name);
  await rm(recordPath(name, id), { force: true });
}

export async function removeLegacyCollection(name) {
  assertCollection(name);
  await rm(path.join(DATA_DIR, `${name}.json`), { force: true });
}
