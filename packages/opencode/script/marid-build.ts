#!/usr/bin/env bun

// MARID PROFILE BUILD (WBS-1.1). Additive, Marid-owned: compiles the marid entry
// (src/marid.ts) into a single `marid` binary. Mirrors the essential Bun.build
// config of the upstream build.ts (defines, worker paths, compile target) but
// swaps the entrypoint and binary name. Excluded packages are absent by
// construction — nothing reachable from src/marid.ts imports them (verified by
// test/marid/hygiene.test.ts + EXP-004 Q1).
//
// SYNC NOTE (P-* checklist): if upstream build.ts changes its defines / worker
// wiring, reconcile them here. (upstream-sync-strategy.md)

import { $ } from "bun"
import fs from "fs"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"
import { createSolidTransformPlugin } from "@opentui/solid/bun-plugin"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")
process.chdir(dir)

const generated = await import("./generate.ts")
import { Script } from "@opencode-ai/script"
import pkg from "../package.json"

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
const skipInstall = process.argv.includes("--skip-install")
const sourcemapsFlag = process.argv.includes("--sourcemaps")
// --release (or OPENCODE_RELEASE, matching build.ts's Script.release gate): after building the
// targets, package each into dist/<name>.{tar.gz|zip} + a dist/<name>.<ext>.sha256 sidecar.
// Signing (minisign) and `gh release` upload are done by marid-release.yml, NOT here — the secret
// key stays in the workflow and this script has no network/gh dependency (locally testable). WBS-5.1.
const releaseFlag = process.argv.includes("--release") || Script.release
const plugin = createSolidTransformPlugin()

const allTargets: { os: string; arch: "arm64" | "x64"; abi?: "musl"; avx2?: false }[] = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "x64", abi: "musl" },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "win32", arch: "arm64" },
  { os: "win32", arch: "x64" },
]

const targets = singleFlag
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) return false
      if (item.avx2 === false) return baselineFlag
      if (item.abi !== undefined) return false
      return true
    })
  : allTargets

await $`rm -rf dist/marid`

const built: string[] = []

if (!skipInstall) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
  await $`bun install --os="*" --cpu="*" @ff-labs/fff-bun@${pkg.dependencies["@ff-labs/fff-bun"]}`
}

for (const item of targets) {
  const name = [
    "marid",
    item.os === "win32" ? "windows" : item.os,
    item.arch,
    item.avx2 === false ? "baseline" : undefined,
    item.abi === undefined ? undefined : item.abi,
  ]
    .filter(Boolean)
    .join("-")
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  const localPath = path.resolve(dir, "node_modules/@opentui/core/parser.worker.js")
  const rootPath = path.resolve(dir, "../../node_modules/@opentui/core/parser.worker.js")
  const parserWorker = fs.realpathSync(fs.existsSync(localPath) ? localPath : rootPath)
  const workerPath = "./src/cli/tui/worker.ts"
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  await Bun.build({
    conditions: ["bun", "node"],
    tsconfig: "./tsconfig.json",
    plugins: [plugin],
    // marid (sync 2026-07-07): @opencode-ai/codemode is an excluded package. Upstream's
    // src/tool/code-mode.ts imports it, but registry.ts only dynamically imports code-mode
    // behind the default-off `experimentalCodeMode` flag — mark it external so the codemode
    // package is never bundled into the marid binary (ADR-0002 exclude-by-profile).
    external: ["node-gyp", "@opencode-ai/codemode"],
    format: "esm",
    minify: true,
    sourcemap: sourcemapsFlag ? "linked" : "none",
    splitting: true,
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace("marid", "bun") as any,
      outfile: `dist/${name}/bin/marid`,
      execArgv: [`--user-agent=marid/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    // MVP marid profile ships the token-secured API/serve surface; the embedded
    // web UI is added when that surface is exercised (kept-list app package).
    entrypoints: ["./src/marid.ts", parserWorker, workerPath],
    define: {
      FFF_LIBC: JSON.stringify(item.abi === "musl" ? "musl" : "gnu"),
      // MARID P-6 (WBS-8.2): bake the app-name so the compiled binary isolates
      // all machine-global dirs under `marid` (rewrites the dot-notation read in
      // @opencode-ai/core/global.ts). Dev sets __MARID_APP at runtime instead
      // (src/marid-env.ts); the binary needs no runtime env.
      "process.env.__MARID_APP": JSON.stringify("marid"),
      OPENCODE_VERSION: `'${Script.version}'`,
      OPENCODE_MODELS_DEV: generated.modelsData,
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      OPENCODE_WORKER_PATH: workerPath,
      OPENCODE_CHANNEL: `'${Script.channel}'`,
      OPENCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
      ...(item.os === "linux" ? { "process.env.OPENTUI_LIBC": JSON.stringify(item.abi ?? "glibc") } : {}),
    },
  })

  // Smoke test only when the binary matches the current platform.
  if (item.os === process.platform && item.arch === process.arch && !item.abi) {
    const binaryPath = `dist/${name}/bin/marid`
    console.log(`Running smoke test: ${binaryPath} --version`)
    const versionOutput = await $`${binaryPath} --version`.text().catch((e) => {
      console.error(`Smoke test failed for ${name}:`, e)
      process.exit(1)
    })
    console.log(`Smoke test passed: ${String(versionOutput).trim()}`)

    // WBS-8.2 P-6 isolation smoke: prove the baked __MARID_APP define actually
    // took. A define that fails to match doesn't error — it silently leaves the
    // app-name "opencode", shipping a NON-isolated binary green. This is the ONLY
    // check that exercises the binary's baked-define branch (dev/tests use the
    // runtime-env branch). global.ts mkdir's the data dir at module load, so even
    // `--version` materialises it; assert it lands under `marid`, not `opencode`.
    const probeRoot = path.join(os.tmpdir(), `marid-smoke-${process.pid}`)
    fs.rmSync(probeRoot, { recursive: true, force: true })
    await $`${binaryPath} --version`
      .env({
        ...process.env,
        XDG_DATA_HOME: path.join(probeRoot, "data"),
        XDG_CONFIG_HOME: path.join(probeRoot, "config"),
        XDG_STATE_HOME: path.join(probeRoot, "state"),
        XDG_CACHE_HOME: path.join(probeRoot, "cache"),
      })
      .quiet()
      .catch((e) => {
        console.error(`Isolation smoke failed for ${name}:`, e)
        process.exit(1)
      })
    const isolated = fs.existsSync(path.join(probeRoot, "data", "marid"))
    const leaked = fs.existsSync(path.join(probeRoot, "data", "opencode"))
    fs.rmSync(probeRoot, { recursive: true, force: true })
    if (!isolated || leaked) {
      console.error(
        `Isolation smoke FAILED for ${name}: expected the data dir under 'marid' (baked __MARID_APP define), ` +
          `got isolated=${isolated} leaked-opencode=${leaked}`,
      )
      process.exit(1)
    }
    console.log(`Isolation smoke passed: binary writes under 'marid' (P-6 define OK)`)
  }

  await $`rm -rf ./dist/${name}/bin/tui`
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        preferUnplugged: true,
        os: [item.os],
        cpu: [item.arch],
        ...(item.abi ? { libc: [item.abi] } : {}),
      },
      null,
      2,
    ),
  )

  built.push(name)
}

if (releaseFlag) {
  // Package each built target from its bin dir (contains only the compiled `marid[.exe]`).
  // linux → .tar.gz, everything else → .zip, matching the upstream install-script asset naming
  // (marid-<os>-<arch>[-baseline][-musl].<ext>). Archives + checksums land in dist/.
  for (const name of built) {
    const archive = name.includes("linux") ? `${name}.tar.gz` : `${name}.zip`
    if (name.includes("linux")) {
      await $`tar -czf ../../${archive} *`.cwd(`dist/${name}/bin`)
    } else {
      await $`zip -qr ../../${archive} *`.cwd(`dist/${name}/bin`)
    }
    // Checksum the basename (cwd dist/) so `sha256sum -c <archive>.sha256` verifies from dist/.
    await $`sha256sum ${archive} > ${archive}.sha256`.cwd("dist")
    console.log(`packaged ${archive} (+ .sha256)`)
  }
}
