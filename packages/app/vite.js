import { readFileSync, statSync, readdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import solidPlugin from "vite-plugin-solid"
import tailwindcss from "@tailwindcss/vite"
import { fileURLToPath } from "url"

const theme = fileURLToPath(new URL("./public/oc-theme-preload.js", import.meta.url))
const publicDir = fileURLToPath(new URL("./public", import.meta.url))

// Windows/`core.symlinks=false` checks out packages/app/public/* (git symlinks into
// packages/ui/src/assets) as tiny TEXT stubs whose content is the relative target path. Vite then
// serves the stub verbatim → broken favicon + "Manifest syntax error". This plugin resolves any such
// stub to its real target (generic — no hardcoded list): in dev via middleware (registered in the
// configureServer hook body so it runs BEFORE vite's public-serving), and at build via writeBundle so
// an embedded build gets the real bytes. No-op on POSIX / when core.symlinks=true (real files, not stubs).
const contentTypeFor = (p) =>
  p.endsWith(".svg") ? "image/svg+xml"
  : p.endsWith(".png") ? "image/png"
  : p.endsWith(".ico") ? "image/x-icon"
  : p.endsWith(".webmanifest") ? "application/manifest+json"
  : p.endsWith(".json") ? "application/json"
  : "application/octet-stream"

// If `file` is a symlink-stub (a tiny file whose text is a relative path to an existing file), return
// the resolved target path; otherwise undefined.
const resolveStub = (file) => {
  let stat
  try { stat = statSync(file) } catch { return undefined }
  if (!stat.isFile() || stat.size > 1024) return undefined
  const text = readFileSync(file, "utf8").trim()
  if (!text.startsWith("../") && !text.startsWith("./")) return undefined
  if (/[\r\n]/.test(text)) return undefined
  const target = path.resolve(path.dirname(file), text)
  try { if (statSync(target).isFile()) return target } catch { /* fallthrough */ }
  return undefined
}

const maridPublicSymlinks = {
  name: "marid:resolve-public-symlinks",
  configureServer(server) {
    const root = path.resolve(publicDir)
    server.middlewares.use((req, res, next) => {
      let rel
      try { rel = decodeURIComponent((req.url || "").split("?")[0]) } catch { return next() }
      if (rel.includes("\0")) return next()
      // Decode BEFORE resolving, then require the resolved path to stay inside public/ — blocks `..`
      // traversal including URL-encoded `%2e%2e` (vite binds 0.0.0.0 in dev, so this is reachable).
      const file = path.resolve(root, "." + (rel.startsWith("/") ? rel : "/" + rel))
      if (file !== root && !file.startsWith(root + path.sep)) return next()
      const target = resolveStub(file)
      if (!target) return next()
      res.setHeader("Content-Type", contentTypeFor(rel))
      res.end(readFileSync(target))
    })
  },
  writeBundle(options) {
    const outDir = options.dir
    if (!outDir) return
    for (const name of readdirSync(publicDir)) {
      const target = resolveStub(path.join(publicDir, name))
      if (target) try { writeFileSync(path.join(outDir, name), readFileSync(target)) } catch { /* skip */ }
    }
  },
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  if (process.env.OPENCODE_CHANNEL === "latest") return "prod"
  return "dev"
})()

/**
 * @type {import("vite").PluginOption}
 */
export default [
  maridPublicSymlinks,
  {
    name: "opencode-desktop:config",
    config() {
      return {
        resolve: {
          alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
          },
        },
        define: {
          "import.meta.env.VITE_OPENCODE_CHANNEL": JSON.stringify(channel),
        },
        worker: {
          format: "es",
        },
      }
    },
  },
  {
    name: "opencode-desktop:theme-preload",
    transformIndexHtml(html) {
      return html.replace(
        '<script id="oc-theme-preload-script" src="/oc-theme-preload.js"></script>',
        `<script id="oc-theme-preload-script">${readFileSync(theme, "utf8")}</script>`,
      )
    },
  },
  tailwindcss(),
  solidPlugin(),
]
