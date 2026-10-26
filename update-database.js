const fs = require("node:fs");
const path = require("node:path");

const filesDirectory = path.join(__dirname, "files");
const databasePath = path.join(__dirname, "database.csv");
const columns = ["id", "name", "value"];

function findJsonFiles(directory) {

  if (!fs.existsSync(directory)) {
    throw new Error(`Input directory does not exist: ${directory}`);
  }

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return findJsonFiles(entryPath);
      }
      if (!entry.isFile()) {
        return [];
      }
      if (!entry.name.toLowerCase().endsWith(".json")) {
        throw new Error(
          `Unsupported input file: ${path.relative(__dirname, entryPath)}. Only JSON files are supported.`,
        );
      }
      return [entryPath];
    })
    .sort((left, right) => {
      const relativeLeft = path.relative(filesDirectory, left);
      const relativeRight = path.relative(filesDirectory, right);
      return relativeLeft < relativeRight ? -1 : relativeLeft > relativeRight ? 1 : 0;
    });
    
}

function readRecord(filePath) {
  let record;
  try {
    record = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Could not parse ${path.relative(__dirname, filePath)}: ${error.message}`);
  }

  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error(`${path.relative(__dirname, filePath)} must contain a JSON object.`);
  }

  for (const column of columns) {
    if (!Object.hasOwn(record, column)) {
      throw new Error(`${path.relative(__dirname, filePath)} is missing required field "${column}".`);
    }
  }

  if (
    (typeof record.id !== "string" && typeof record.id !== "number") ||
    typeof record.name !== "string" ||
    (record.value !== null &&
      !["string", "number", "boolean"].includes(typeof record.value))
  ) {
    throw new Error(
      `${path.relative(__dirname, filePath)} must have a string or numeric id, a string name, and a scalar value.`,
    );
  }

  return record;
}

function escapeCsv(value) {
  const text = value === null ? "" : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const jsonFiles = findJsonFiles(filesDirectory);
if (jsonFiles.length === 0) {
  throw new Error(`No JSON files found in ${path.relative(__dirname, filesDirectory)}.`);
}

const rows = jsonFiles.map((filePath) => readRecord(filePath));
const csv = [
  columns.join(";"),
  ...rows.map((row) => columns.map((column) => escapeCsv(row[column])).join(";")),
  "",
].join("\n");

if (!fs.existsSync(databasePath) || fs.readFileSync(databasePath, "utf8") !== csv) {
  fs.writeFileSync(databasePath, csv, "utf8");
  console.log(`Updated database.csv with ${rows.length} record(s).`);
} else {
  console.log(`database.csv is already up to date (${rows.length} record(s)).`);
}