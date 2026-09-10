import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const source = path.join(root, "public");
const output = path.join(root, "dist");
const sha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA || gitSha();
const version = sha.slice(0, 12);

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(source, output, { recursive: true });

await transform("index.html", text =>
  text
    .replace(/(href|src)="\/(manifest\.webmanifest|icon\.svg|style\.css|app\.js)"/g,
      (_, attr, file) => `${attr}="/${file}?v=${version}"`)
    .replace("</footer>", `<br>Build ${version}</footer>`)
);

for (const file of ["app.js", "auth.js", "usage.js", "config.js"]) {
  await transform(file, text =>
    text.replace(/(from\s+["']\.\/[^"'?]+\.js)(["'])/g, `$1?v=${version}$2`)
  );
}

await transform("app.js", text =>
  text.replace('navigator.serviceWorker.register("/sw.js")', `navigator.serviceWorker.register("/sw.js?v=${version}")`)
);

await transform("sw.js", text =>
  text
    .replace('const CACHE = "cffreeusage-shell-v1";', `const CACHE = "cffreeusage-shell-${version}";`)
    .replace(/"\/(style\.css|app\.js|auth\.js|usage\.js|config\.js|manifest\.webmanifest|icon\.svg)"/g,
      (_, file) => `"/${file}?v=${version}"`)
);

await transform("manifest.webmanifest", text =>
  text.replace('"src": "/icon.svg"', `"src": "/icon.svg?v=${version}"`)
);

console.log(`Built cfFreeUsage ${version} into dist/`);

async function transform(relativePath, mapper) {
  const file = path.join(output, relativePath);
  const text = await readFile(file, "utf8");
  await writeFile(file, mapper(text), "utf8");
}

function gitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "dev";
  }
}
