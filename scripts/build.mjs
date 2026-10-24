import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { readdir, rm, mkdir } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
execFileSync("node", ["node_modules/typescript/bin/tsc"], { stdio: "inherit" });
const hooks = (await readdir("src/react"))
  .filter((f) => f.startsWith("use") && f.endsWith(".ts"))
  .map((f) => "react/" + f.slice(0, -3));
const entries = [
  "core",
  "models",
  "sdk",
  "server",
  "browser",
  "react",
  "sdk-types",
  "sdk-validators",
  ...hooks,
];
for (const entry of entries) {
  const client =
    entry === "browser" || entry === "react" || entry.startsWith("react/");
  await build({
    entryPoints: ["src/" + entry + ".ts"],
    outfile: "dist/" + entry + ".js",
    bundle: true,
    format: "esm",
    platform: entry === "server" ? "node" : "neutral",
    packages: "external",
    target: "es2022",
    banner: client ? { js: '"use client";' } : undefined,
  });
}
for (const name of ["auth", "home"])
  await build({
    entryPoints: ["src/models/" + name + ".ts"],
    outfile: "dist/models-" + name + ".js",
    bundle: true,
    format: "esm",
    packages: "external",
  });
