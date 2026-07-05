---
status: Draft
version: v0.1
updated: 2026-07-03
owner: operator (STK-001)
---

# R-06: Channel Adapters (Slack) and Web/Cloud Surface Packages

Findings only, no decisions. All paths relative to repo root. Line numbers from branch `dev` as of 2026-07-03.

---

## 1. packages/slack — what it actually is

**One file, 146 lines:** `packages/slack/src/index.ts`. A prototype Slack bot, not an enterprise feature and not a framework.

### How it connects to the runtime

- It does NOT call a remote server. It **embeds** an opencode server in-process: `createOpencode({ port: 0 })` (`packages/slack/src/index.ts:17-19`), imported from `@opencode-ai/sdk` (`packages/slack/src/index.ts:2`, dep at `packages/slack/package.json:11`).
- All interaction then goes through the SDK client against that embedded server: `client.session.create` (`src/index.ts:78`), `client.session.prompt` (`src/index.ts:105`), `client.session.share` (`src/index.ts:96`).

### Ingress (Slack -> agent)

- Slack Bolt in **Socket Mode** (`socketMode: true`, `src/index.ts:7`), so no public webhook endpoint is exposed. `signingSecret` is passed (`src/index.ts:6`) but webhook signature validation is moot in socket mode — Slack pushes over an outbound WebSocket.
- `app.message(...)` handler (`src/index.ts:58`): every non-subtype text message is forwarded verbatim to the agent. No mention-gating, no channel allowlist.

### Identity mapping

- **There is none.** Session key is `${channel}-${thread}` (`src/index.ts:70`); the Slack *user* is never read. One session per Slack thread, shared by everyone in the thread, held in an in-memory `Map` (`src/index.ts:22`) — lost on restart.

### Permission handling

- **None.** No permission prompts are surfaced to Slack; whatever the embedded server's default permission config allows, runs. No approval flow, no user checks.

### Egress / streaming simulation

- No message editing. Final answer is posted once via `say(...)` (`src/index.ts:135`). Tool activity is simulated by subscribing to the server SSE event stream (`opencode.client.event.subscribe()`, `src/index.ts:24`) and posting a **new** thread message per completed tool call (`handleToolUpdate`, `src/index.ts:41-51`); errors on post are swallowed (`src/index.ts:50`).
- Session transcript visibility is delegated to the share feature: it posts the `session.share` URL into the thread (`src/index.ts:96-101`).

### Deployment assumptions

- Long-lived Bun process with three env vars (`SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`, `src/index.ts:5-8`); run via `bun run src/index.ts` (`packages/slack/package.json:7`). No Dockerfile, no infra wiring found in `sst.config.ts` for it (`unverified` — did not exhaustively read sst.config.ts).

### Verdict (evidence, not decision)

It is a **one-off demo**, not a reusable channel-adapter pattern: `console.log` debugging throughout, `any`-typed session map (`src/index.ts:22`), no identity, no permissions, no persistence, no attachment handling (text parts only, `src/index.ts:107`). **However**, the shape it demonstrates is exactly the ingress/egress contract a channel adapter needs and is all public-API based: create session -> prompt -> subscribe to SSE events -> mirror parts to channel -> share URL for full transcript. Any future adapter (Telegram, Teams, email) can copy this 4-step loop against the same HTTP+SSE API without touching core.

---

## 2. Package-by-package: what each surface IS

Note: the task list named some packages that do not exist as workspace packages: `packages/identity`, `packages/docs`, `packages/containers` have **no package.json**; `packages/console` and `packages/stats` are **folders containing multiple workspace packages** each.

| Package | What it is | Depends on / depended by | Classification |
|---|---|---|---|
| **app** | The actual web UI (SolidJS + Vite + Tailwind). Pages, session view, prompt input, settings (`packages/app/src/pages/`, `packages/app/package.json:1-16`). Also exports desktop glue (`./desktop-menu`, `./updater`, `./wsl/types`, `packages/app/package.json:5-12`). | Deps: `core`, `schema`, `sdk`, `session-ui`, `ui` (`packages/app/package.json` deps). Consumed by: `desktop` (`packages/desktop/package.json` devDeps `@opencode-ai/app`). | **Web UI — the thing to keep.** |
| **web** | Astro Starlight site: docs + marketing + public share-page viewer (`packages/web/package.json:12-17` astro scripts; share viewer at `packages/web/src/pages/s/[id].astro`). Deploys to Cloudflare (`@astrojs/cloudflare`, `packages/web/package.json:14`). | DevDep on `opencode` (for docs generation). Nothing in-repo depends on it. | Docs/marketing site, not an app UI. |
| **console** | Folder of 5+ packages (`app`, `core`, `function`, `mail`, `resource`, `support`) — the **hosted-cloud admin console**: OpenAuth login, Stripe billing, Planetscale DB, jsx-email, AI-gateway functions (`packages/console/app/package.json` deps: `@openauthjs/openauth`, `@stripe/stripe-js`, `@upstash/redis`; `packages/console/core/package.json` deps: `stripe`, `@planetscale/database`; `packages/console/function/package.json` deps: `@ai-sdk/*`). | Uses `ui`. SST/Cloudflare deployment (`sst shell` scripts throughout). | **Enterprise/cloud component.** |
| **session-ui** | Shared session-rendering component library (message parts, diffs, markdown streaming, Pierre diff integration) extracted so multiple surfaces render sessions identically (`packages/session-ui/package.json:7-24` exports). | Deps: `core`, `sdk`, `ui` (`packages/session-ui/package.json` deps). Consumed by: `app`, `enterprise`, `storybook`. | Web-UI building block — required by app. |
| **storybook** | Storybook dev harness for `ui` + `session-ui` components (`packages/storybook/package.json:8-10`, devDeps on both). Private, no runtime role. | Depends on `ui`, `session-ui`. Nothing depends on it. | Developer tooling. |
| **ui** | Published design system: components, themes, icons, fonts, i18n (`packages/ui/package.json:1-40`, `publishConfig.access: public`). | Consumed by `app`, `session-ui`, `desktop`, `enterprise`, `console/app`, `stats/app`. | Web-UI building block — required by app. |
| **desktop** | **Electron** desktop app wrapping `app` (`packages/desktop/package.json:20-24` electron-vite/electron-builder scripts; deps `electron-updater`, `electron-store`). NOTE: root CLAUDE.md describing desktop as "Tauri v2" is stale for this fork — only the electron package exists; `packages/containers/tauri-linux` image remains as CI residue. | Deps: `app`, `ui`, node-pty, Sentry. | Desktop surface (separate keep/remove call from web). |
| **enterprise** | Self-hostable **share-link server**: SolidStart app exposing "Opencode Enterprise API" (`packages/enterprise/src/routes/api/[...path].ts:21-24`) with `share.create` endpoints, S3-compatible storage via `aws4fetch` (`packages/enterprise/package.json:18`), share viewer routes (`packages/enterprise/src/routes/share/`), core is just `share.ts` + `storage.ts` (`packages/enterprise/src/core/`). Despite the name, it is narrow: shares only, no user management found. Auth: bearer-token compare via `timingSafeEqual` (`packages/enterprise/src/routes/api/[...path].ts:10`) — `unverified` exact scheme. | Deps: `core`, `session-ui`, `ui`. | Enterprise/cloud component. |
| **identity** | **Not a package** — a folder of brand assets only: `mark.svg`, `mark-512x512.png`, etc. No code, no package.json (`packages/identity/` listing). | Referenced by sites as static assets (`unverified`). | Static assets; irrelevant to auth. |
| **function** | Cloudflare Worker (Hono) for the **hosted share sync backend**: `SyncServer` Durable Object fans session data out over WebSockets and persists to R2 (`packages/function/src/api.ts:15-37`), plus GitHub App auth (octokit/jose, `packages/function/src/api.ts:4-5`, `packages/function/package.json:14-18`). | Deployed via SST; pairs with `web`'s share page. Nothing in-repo imports it. | Enterprise/cloud component. |
| **containers** | **Not a runtime package** — prebuilt CI Docker images to speed up GitHub Actions (`packages/containers/README.md:1-5`; images `base`, `bun-node`, `rust`, `tauri-linux`). | CI only. | Developer/CI tooling. |
| **cli** | Next-gen CLI (`bin: lildax`, `packages/cli/package.json:8-10`) built on the Effect stack: deps `core`, `sdk`, `server`, `tui` (`packages/cli/package.json:18-28`). Coexists with the current `packages/opencode` CLI. | Depends on `server` + `tui`. | Core product surface (terminal), not web. |
| **client** | Generated, Effect-optional HTTP client from `schema` + `protocol` (`packages/client/package.json:7-17`, `generate`/`check:generated` scripts). The low-level layer under `sdk-next`. | Deps: `schema`, `protocol`; consumed by `sdk-next` (`packages/sdk-next/package.json:14`). | Core plumbing (API client codegen). |
| **stats** | Separate public **stats website**: "Stats is a separate site from the console" (`packages/stats/README.md:3`). SolidStart frontend (`stats/app`), Effect+Drizzle core, Lambda/Firehose ingest server (`packages/stats/server/package.json:16-20` aws firehose dep). | Uses `ui`. SST-deployed. | Enterprise/cloud component (telemetry site). |
| **http-recorder** | Published utility: "Record and replay Effect HTTP client traffic with deterministic cassettes" (`packages/http-recorder/package.json:5`) — VCR-style test tool. | Standalone; used in tests (`unverified` which packages). | Developer tooling. |
| **codemode** | Experimental "Effect-native confined code execution over schema-described tools" (`packages/codemode/package.json:5`), v0.0.1, private; recently re-added after a revert (commits `2409c7a3d`, `379adee35`). | Standalone (acorn + effect + typescript deps only). | Experimental core feature, not a surface. |

### app vs web vs console vs session-ui vs ui, in one breath

- **ui** = design-system atoms (buttons, themes, icons).
- **session-ui** = session/chat rendering organisms built on `ui`.
- **app** = the full web application composed from both, talking to a live opencode server.
- **web** = Astro docs/marketing/share-viewer site; no live-server connection.
- **console** = hosted-cloud account/billing portal; unrelated to running the agent locally.

---

## 3. How packages/app talks to the server

Same public HTTP+SSE API as everything else — no private endpoints:

- Client construction: `createOpencodeClient({ ..., baseUrl: server.url })` from `@opencode-ai/sdk/v2/client` (`packages/app/src/utils/server.ts:1,33-40`). The SDK is the generated client in `packages/sdk/js` (name `@opencode-ai/sdk` per `packages/sdk/js/package.json`).
- Auth: optional HTTP **Basic** auth header built from a server password (`packages/app/src/utils/server.ts:5-7,26-31`) — i.e. the server can be protected with a single credential; no user accounts.
- Live updates: single global SSE stream `eventSdk.global.event({ signal, onSseError })` consumed in a reconnect-with-heartbeat loop (`packages/app/src/context/server-sdk.tsx:177-204`), events fanned into a reducer/queue (`packages/app/src/context/server-sync.tsx:28`). Same event mechanism the Slack bot uses (`packages/slack/src/index.ts:24`).
- Permission prompts also arrive over that event stream (`serverSDK().event.listen(...)`, `packages/app/src/context/permission.tsx:165`).

Implication (finding): web UI, desktop (which embeds `app`), and the Slack prototype all ride the identical API surface; keeping web UIs does not require keeping any cloud package.

---

## 4. Auth / identity notes for a single-operator target

- `packages/identity` contains **no auth code** — logo assets only.
- The only auth the local server + web UI use is optional Basic auth (username defaults to `"opencode"`, `packages/app/src/utils/server.ts:6,15`). This is the single-operator-friendly mechanism already in place.
- Multi-user identity lives exclusively in cloud packages: OpenAuth in `console/app` (`packages/console/app/package.json` dep `@openauthjs/openauth`) and `console/function`; GitHub-App JWT verification in `function` (`packages/function/src/api.ts:4-5`). All are SST/Cloudflare-coupled and assume the hosted service — a single-operator deployment gains nothing from them and inherits Stripe/Planetscale/R2 dependencies if kept.
- `enterprise`'s API token check (`timingSafeEqual`, `packages/enterprise/src/routes/api/[...path].ts:10`) is the closest thing to a simple self-hosted auth pattern, but it only guards share uploads.
- The Slack bot has zero auth of its own; it inherits whatever the embedded server allows (`packages/slack/src/index.ts:17-19`).
