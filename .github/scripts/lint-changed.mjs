import { execFileSync } from "node:child_process";
import process from "node:process";
import { ESLint } from "eslint";

const baseSha = String(process.env.LINT_BASE_SHA || "").trim();
const headSha = String(process.env.LINT_HEAD_SHA || "HEAD").trim();

if (!baseSha) {
  console.error("LINT_BASE_SHA is required.");
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function changedRanges(file) {
  const patch = git(["diff", "--unified=0", "--diff-filter=ACMR", baseSha, headSha, "--", file]);
  const ranges = [];
  for (const line of patch.split(/\r?\n/)) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    if (count > 0) ranges.push([start, start + count - 1]);
  }
  return ranges;
}

function isChangedLine(line, ranges) {
  return ranges.some(([start, end]) => line >= start && line <= end);
}

function annotationText(value) {
  return String(value || "")
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

const changedFiles = git(["diff", "--name-only", "--diff-filter=ACMR", baseSha, headSha])
  .split(/\r?\n/)
  .filter(Boolean);
const jsFiles = changedFiles.filter(
  (file) =>
    file.endsWith(".js") &&
    !file.startsWith("node_modules/") &&
    !file.startsWith("pit-guru/exports/")
);

if (!jsFiles.length) {
  console.log("No changed JavaScript files.");
  process.exit(0);
}

for (const file of jsFiles) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

const eslint = new ESLint({
  errorOnUnmatchedPattern: false,
  overrideConfig: {
    overrides: [
      {
        files: ["**/*.user.js"],
        rules: { "prettier/prettier": "off" },
      },
    ],
  },
});
const results = await eslint.lintFiles(jsFiles);
let changedErrors = 0;
let changedWarnings = 0;
let ignoredBaselineMessages = 0;

for (const result of results) {
  const file = result.filePath
    .replaceAll("\\", "/")
    .replace(`${process.cwd().replaceAll("\\", "/")}/`, "");
  const ranges = changedRanges(file);
  for (const message of result.messages) {
    if (!isChangedLine(Number(message.line || 0), ranges)) {
      ignoredBaselineMessages += 1;
      continue;
    }
    const level = message.severity === 2 ? "error" : "warning";
    if (message.severity === 2) changedErrors += 1;
    else changedWarnings += 1;
    const rule = message.ruleId ? ` [${message.ruleId}]` : "";
    console.log(
      `::${level} file=${annotationText(file)},line=${message.line || 1},col=${message.column || 1}::${annotationText(message.message)}${annotationText(rule)}`
    );
  }
}

console.log(
  `Changed-line ESLint: ${changedErrors} errors, ${changedWarnings} warnings; ignored ${ignoredBaselineMessages} pre-existing messages outside the diff.`
);
if (changedErrors) process.exit(1);
