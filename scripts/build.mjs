import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const web = path.join(root, "web");
const sha =
  process.env.WORKERS_CI_COMMIT_SHA ||
  process.env.CF_PAGES_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  gitSha();
const version = sha.slice(0, 12);

const files = [
  "index.html",
  "app.js",
  "auth.js",
  "sw.js",
  "manifest.webmanifest"
];

for (const relativePath of files) {
  const file = path.join(web, relativePath);
  const source = await readFile(file, "utf8");
  const stamped = source.replaceAll("__COMMIT_SHA__", version);
  await writeFile(file, stamped, "utf8");
}

console.log(`Stamped cfFreeUsage web/ with commit ${version}`);

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}
