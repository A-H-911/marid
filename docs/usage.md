---
status: Approved
version: 1.1.0
updated: 2026-07-19
owner: operator (STK-001)
---

# Marid — User Guide

The hands-on companion to the [README](../README.md). The README is the overview and quickstart; this guide
is the **full CLI reference, the concepts behind it, and worked recipes**. For *why* Marid is built the way it
is, see the design package in [`docs/`](README.md) (charter, architecture, ADRs) — that is the source of truth;
this guide describes how to *use* the result.

> Commands and flags below are grounded in the shipped CLI.

## Contents

- [Concepts](#concepts) — instances, tokens & scopes, agents, sessions, the event stream
- [CLI reference](#cli-reference) — every `marid` command and flag
- [Recipes](#recipes) — local TUI, API + SDK, web UI, Telegram bot, WhatsApp channel, mirroring, multi-instance
- [Configuration](#configuration) — config layer + environment variables
- [Data isolation & coexistence](#data-isolation--coexistence) — marid dirs, config name, env-pierce, v0.2.0 migration
- [Security model](#security-model) — deny-by-default, channel scope vs. agent ruleset
- [Troubleshooting](#troubleshooting)

---

## Concepts

**Instance.** A fully isolated Marid runtime — its own data, cache, config, state, logs, temp trees, and an
OS-assigned loopback port. Nothing is shared between instances (isolation is by directory namespacing, not
in-place locking). You run as many as you like on one machine. Managed with `marid instance`.

**Server.** `marid serve` (or an instance's server) exposes the **HTTP + SSE API** — the *only* authenticated
boundary. Every non-local client (web, SDK, channel gateway, remote TUI) speaks to it with a bearer token.

**Token & scope.** A bearer credential minted by `marid token`. Three scopes, weakest to strongest-restricted:

| Scope | For | Can |
|---|---|---|
| `admin` | you, full control | everything, unfiltered |
| `client` | web / SDK / scripts / remote TUI | act on and observe **its own** sessions; read config/agents/providers |
| `channel:<name>` | untrusted ingress (Telegram, WhatsApp) | **only** its bound agent, **only** its own sessions, a minimal deny-by-default route set; can never widen tools/permissions or reach privileged routes |

A token secret prints **once**, at creation. The audit log records token *names* and scopes — never secrets.

**Agent.** A named tool/permission ruleset in the instance config. A `channel:` token is *pinned* to one agent
(`--agent`); that agent's `permission` ruleset (allow / ask / deny per tool) is what gates every tool call the
channel can make. See [Telegram channel tools](execution/telegram-channel-tools.md).

**Session.** One conversation with the agent, event-sourced and durable. The **SSE firehose** (`/event`,
`/global/event`) streams a session's events live; on reconnect a client **re-reads authoritative state** (there
is no event-replay cursor). A session can be **mirrored** across surfaces by *attaching* it (see
[Cross-surface mirroring](#recipe-mirroring)).

---

## CLI reference

Global flags (accepted before any subcommand): `--print-logs` (logs to stderr), `--log-level <level>`,
`--pure` (run without external plugins).

### `marid` — TUI

```sh
marid                 # open the TUI in the current directory (in-process, no token)
marid <directory>     # open the TUI against a specific directory
```

The local TUI talks to the engine **in-process** — no server, no token.

### `marid serve` — authenticated API server

```sh
marid serve [--port <n>] [--hostname <host>]
```

| Flag | Default | Notes |
|---|---|---|
| `--port` | `0` | `0` = OS-assigned (printed at startup). Pass e.g. `--port 4096` to pin it. |
| `--hostname` | `127.0.0.1` | Loopback by default. Bind beyond localhost only behind your own TLS. |

Refuses unauthenticated requests — every call needs `Authorization: Bearer <token>` (or the token as HTTP
Basic, which the server also accepts). No token ⇒ `401`.

### `marid token` — bearer tokens

```sh
marid token create <name> --scope admin                        # full access
marid token create <name> --scope client                       # normal client (default use)
marid token create <name> --scope channel:<name> --agent <a>   # restricted channel (Telegram); agent required
marid token list                                               # names + scopes (never secrets)
marid token revoke <name>                                      # revoke by name
```

`--agent` is required for `channel:` scope and binds the token to that restricted agent (INV-001).

> **Instance gotcha:** instances are XDG-isolated, so a token must be created **into the target instance's
> store** or the server will `401` it. Prefix the create with the instance's data dir:
> `XDG_DATA_HOME="$(marid instance path <name>)/data" marid token create …`

### `marid instance` — isolated runtimes

```sh
marid instance add <name>              # create an isolated tree
marid instance start <name>            # start its authenticated server (loopback, OS-assigned port)
marid instance status <name>           # port / pid / running state
marid instance list [--json]           # all instances (+ run state); --json for machine-readable
marid instance path <name>             # print the instance's directory
marid instance attach <name> [--token <t>] [--continue|-c] [--session|-s <id>]   # open the TUI against it
marid instance stop <name>             # stop the server and its child processes
marid instance remove <name>           # delete a stopped instance and its tree
```

`marid instance attach` opens the **TUI against a running instance's server** (a `client`-token client), as
opposed to the in-process local `marid`.

### `marid telegram start` — Telegram channel gateway

```sh
marid telegram start <instance> --token <channel-token> --agent <agent>
```

Runs the gateway **as a separate process** against a running instance. Both flags are required; `--agent` must
match the agent the `channel:` token was bound to. Secrets come from the **environment**, never flags
(INV-002) — see [Configuration](#configuration).

### `marid whatsapp start` — WhatsApp channel gateway

```sh
marid whatsapp start <instance> --token <channel-token> --agent <agent>
```

Runs the WhatsApp gateway **as a separate process** against a running instance, reaching WhatsApp only through
an operator-run **WAHA (NOWEB engine)** sidecar — outbound-only (sends over HTTP, events over a WebSocket, both
dialled *out*; no inbound port). Both flags are required and `--agent` must match the token's bound agent.
WAHA URL, operator allowlist, and the WAHA key come from the **environment**, never flags (INV-002) — see
[Configuration](#configuration).

---

## Recipes

### Local TUI

```sh
marid            # that's it — in-process, no server, no token
```

<a id="recipe-api"></a>
### API server + a client / SDK

```sh
# 1. start the server on a fixed port
marid serve --port 4096

# 2. mint a client token (secret prints once)
marid token create app --scope client

# 3. call it
curl -s http://127.0.0.1:4096/session -H "Authorization: Bearer $TOKEN" -X POST
```

The generated SDK client is the same one the Telegram gateway uses; point it at the base URL with the bearer
token. The API/event contract is in [api-event-contract.md](architecture/api-event-contract.md).

### Web UI

Start a server (`marid serve`), open the web UI in the browser, and authenticate with a `client` token. The
web UI rides the same HTTP + SSE API as everything else.

<a id="recipe-telegram"></a>
### Telegram bot — end to end

```sh
# 1. create + start an isolated instance for the bot
marid instance add tgbot
marid instance start tgbot

# 2. define a restricted channel agent in the instance config (everything, sensitive-gated).
#    See docs/execution/telegram-channel-tools.md for the full recipe + gotchas.
#    { "agent": { "tg": { "mode": "primary",
#        "permission": { "*": "ask", "read": "allow", "glob": "allow",
#                        "grep": "allow", "list": "allow", "task": "deny" } } } }

# 3. mint a channel token INTO THAT INSTANCE's store, bound to the agent
XDG_DATA_HOME="$(marid instance path tgbot)/data" \
  marid token create tg --scope channel:tg --agent tg

# 4. provide bot secrets + the allowlist via env (never flags — INV-002)
export TELEGRAM_BOT_TOKEN=123456:AA...          # from @BotFather
export MARID_TG_ALLOW=<your-telegram-user-id>   # comma-separated; from @userinfobot

# 5. run the gateway against the instance
marid telegram start tgbot --token <the mar_… secret> --agent tg
```

Now the bot has **full TUI/Web parity**: Markdown replies, tool calling + MCP (each sensitive call gated by an
inline **Approve/Deny** keyboard per the agent ruleset), and files both ways. Read what you approve — an
inbound message is an untrusted prompt (INV-004). The per-tool policy is the agent's `permission` ruleset;
tune it in [Telegram channel tools](execution/telegram-channel-tools.md).

<a id="recipe-whatsapp"></a>
### WhatsApp channel — end to end

Reaches WhatsApp through an operator-run **WAHA (NOWEB engine)** sidecar; the adapter is **outbound-only** and
carries **no WhatsApp dependency of its own** (the WhatsApp stack lives entirely in the WAHA container). See the
*WhatsApp channel* section of [architecture.md](architecture/architecture.md) for the transport boundary.

```sh
# 1. create + start an isolated instance for the channel
marid instance add wabot
marid instance start wabot

# 2. define a restricted channel agent in the instance config (everything, sensitive-gated).
#    { "agent": { "wa": { "mode": "primary",
#        "permission": { "*": "ask", "read": "allow", "glob": "allow",
#                        "grep": "allow", "list": "allow", "task": "deny" } } } }

# 3. mint a channel token INTO THAT INSTANCE's store, bound to the agent (secret prints once)
XDG_DATA_HOME="$(marid instance path wabot)/data" \
  marid token create wa --scope channel:wa --agent wa

# 4. run the operator's WAHA NOWEB sidecar (packages/marid-whatsapp/waha.compose.yaml —
#    loopback 127.0.0.1:3000, NOWEB engine, image digest-pinned). Pair the linked-device
#    number once via WAHA (scan the QR); auth persists in the ./.waha-sessions volume.
export WAHA_API_KEY=…                              # required by the WAHA container

# 5. provide the WAHA URL + the operator allowlist via env (never flags — INV-002)
export MARID_WA_WAHA_URL=http://127.0.0.1:3000
export MARID_WA_ALLOW=11111111111@c.us            # your linked-device number's JID (…@c.us)
export MARID_WA_WAHA_API_KEY=$WAHA_API_KEY         # if WAHA has a key set

# 6. run the gateway against the instance
marid whatsapp start wabot --token <the mar_… secret> --agent wa
```

Only JIDs in `MARID_WA_ALLOW` are answered (deny-by-default, INV-001); everything else is a silent no-op. An
inbound message is an untrusted prompt (INV-004). Sensitive tool calls are gated by an **`APPROVE <token>`**
text reply (a strict single-use, JID-bound, TTL'd parser) rather than a button.

<a id="recipe-mirroring"></a>
### Cross-surface mirroring — attach a session

Mirroring lets one session appear live on more than one surface (e.g. watch a Telegram session from the web
UI). It is **operator-driven and admin-only**: you *attach* a session to a surface's token; that surface then
**views** it (view-via-binding) but can only **act** on sessions it owns (act-via-ownership) — no escalation.

```sh
# admin attaches session <ses_…> to the channel token "tg"
curl -s http://127.0.0.1:<port>/marid/attach \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'content-type: application/json' \
  -X POST -d '{"token":"tg","session":"ses_…"}'
# list / undo
curl -s "http://127.0.0.1:<port>/marid/bindings?token=tg" -H "Authorization: Bearer $ADMIN_TOKEN"
curl -s http://127.0.0.1:<port>/marid/detach -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -X POST -d '{"token":"tg","session":"ses_…"}'
```

Recovery across a dropped connection is **re-fetch on reconnect** (no event replay); a bound-but-not-owned
session resumes live only. Details: the *Channel gateway surface* section of
[api-event-contract.md](architecture/api-event-contract.md) and the
[gateway & mirroring diagram](architecture/diagrams/Marid/20-gateway-mirroring.png).

### Multiple isolated instances

```sh
marid instance add work && marid instance start work
marid instance add personal && marid instance start personal
marid instance list          # each on its own loopback port, fully isolated
```

Each instance has independent data, config, secrets, and sessions — a token minted into one cannot reach
another.

---

## Configuration

**Config layer.** Instances load config from their isolated tree; the distribution injects defaults (e.g.
`lsp:false`) that your file config overrides. Agents (tool/permission rulesets) live in the instance config —
this is where a channel's restricted agent is defined.

**Telegram gateway environment variables** (read by `marid telegram start`):

| Variable | Required | Purpose |
|---|:--:|---|
| `TELEGRAM_BOT_TOKEN` | ✅ | Bot token from @BotFather. Never logged (redacted). |
| `MARID_TG_ALLOW` | ✅ | Comma-separated numeric Telegram user IDs allowed to message the bot. |
| `TELEGRAM_API_URL` | | Custom Bot API base URL (self-hosted Bot API server). |
| `MARID_TG_CADENCE_MS` | | Edit-coalescing cadence for streamed replies (default respects Telegram rate limits). |
| `MARID_TG_PERMISSION_TIMEOUT_MS` | | How long an Approve/Deny prompt waits before timing out. |
| `MARID_TG_POLL_TIMEOUT_SEC` | | Long-poll timeout for inbound updates. |
| `TELEGRAM_TEXT_LIMIT` | | Max characters before a reply is split into multiple messages. |

**WhatsApp gateway environment variables** (read by `marid whatsapp start`):

| Variable | Required | Purpose |
|---|:--:|---|
| `MARID_WA_WAHA_URL` | ✅ | Base URL of the operator-run WAHA sidecar, e.g. `http://127.0.0.1:3000`. |
| `MARID_WA_ALLOW` | ✅ | Comma-separated operator JIDs allowed to message (e.g. `11111111111@c.us`). Invalid/empty → fail-fast at boot. |
| `MARID_WA_WAHA_API_KEY` | | WAHA API key (sent as `X-Api-Key`). Never logged (the WS URL that carries it is redacted). |
| `MARID_WA_SESSION` | | WAHA session name (default `default`). |
| `MARID_WA_CADENCE_MS` | | Edit-coalescing cadence for streamed replies. |
| `MARID_WA_PERMISSION_TIMEOUT_MS` | | How long an `APPROVE <token>` prompt waits before timing out. |
| `MARID_WA_APPROVAL_TTL_MS` | | Time-to-live of an approval token. |

Secrets always come from the environment, never CLI flags (INV-002).

---

## Data isolation & coexistence

Marid keeps **all** of its machine-global state in its own directory tree, namespaced under `marid`, so a
plain `marid` binary and a co-installed OpenCode never share auth, model selection, sessions, or config
(issue-6). This is separate from the *instance* isolation above — it applies to the base binary itself.

**Where Marid stores data.** The dirs follow the XDG layout on **every** OS (Marid uses the Linux-style
paths on macOS and Windows too — not `~/Library/Application Support` or `%AppData%`), rooted at your home dir:

| Tree | Path (an `XDG_*` env var wins if set) | Holds |
|---|---|---|
| Data | `$XDG_DATA_HOME/marid` → `<home>/.local/share/marid` | `auth.json`, gateway tokens (`marid/`), sessions DB (`opencode.db`), logs |
| State | `$XDG_STATE_HOME/marid` → `<home>/.local/state/marid` | `model.json` (last model selection) |
| Config | `$XDG_CONFIG_HOME/marid` → `<home>/.config/marid` | global `marid.json` |
| Cache | `$XDG_CACHE_HOME/marid` → `<home>/.cache/marid` | caches (regenerable) |
| Managed (MDM) | macOS `/Library/Application Support/marid` · Windows `%ProgramData%\marid` · Linux `/etc/marid` | enterprise-policy config |

`<home>` is `/home/you` (Linux), `/Users/you` (macOS), or `C:\Users\you` (Windows). The sessions DB file is
still named `opencode.db` — an internal name, now living inside the isolated marid dir (DEC-027).

**Config file name.** Marid reads **`marid.json`** / **`marid.jsonc`** at the global and project levels (and
writes `marid.json` when a command creates config, e.g. `marid mcp add`). A project-level **`opencode.json`**
is still read as a fallback so existing repos keep working; `marid.json` wins when both are present. At the
**global** level Marid reads only `~/.config/marid/` — it never falls back to `~/.config/opencode/`, which is
exactly what would re-import a co-installed OpenCode's provider/model bleed. Per-project **`.opencode/`** dirs
(agents / skills / plugins / commands) keep their upstream name for ecosystem compatibility (DEC-024).

**Kept `OPENCODE_*` env — and what still pierces isolation.** Marid deliberately keeps the `OPENCODE_*`
environment variable names (DEC-022) so third-party OpenCode plugins/extensions keep working. Most are
harmless, but five **data-layer** overrides, if you have them set globally, **redirect Marid's state back
outside** the marid dirs. Marid does not silently defeat them — it honors them (your setup keeps working) and
logs a WARN at boot naming each active one (the *value* is never logged — INV-002):

| Variable | Redirects |
|---|---|
| `OPENCODE_CONFIG_DIR` | global config dir |
| `OPENCODE_CONFIG` | global config file |
| `OPENCODE_CONFIG_CONTENT` | inline config content |
| `OPENCODE_AUTH_CONTENT` | inline auth credentials |
| `OPENCODE_DB` | sessions database path |

For full isolation, leave these unset (or point them inside the marid dirs).

**Upgrading from an OpenCode-shared v0.2.0.** The first time an isolated `marid` binary runs and finds no
marid data dir, it copies your existing pre-isolation data **once** — `auth.json`, gateway bearer tokens, the
sessions DB, `model.json`, Telegram pairing — from the old shared `opencode` dir into the marid dirs, then
writes a marker so it never repeats (issue-2 / DEC-025). Gateway tokens and Telegram pairing survive the
upgrade with no re-auth; regenerable caches/logs are skipped; the copy logs a count only (never file names or
contents). The co-installed OpenCode's dirs are left untouched.

**No auto-update.** The Marid binary does not check for or install updates — the OpenCode "vX available…"
popup and self-overwrite are disabled; updates come only through the signed release download (issue-1).

---

## Security model

Two layers, and they are **not** redundant:

- **`channel:` scope** gates *which routes* a token can reach and *pins its agent*. A channel token is denied
  the direct run-routes (`/shell`, `/command`), branch/mutate routes (`/fork`, `/revert`, message-part edits),
  and any attempt to switch agents or override tools/permissions per request.
- **Agent `permission` ruleset** gates *which tools run inside a prompt turn* (allow / ask / deny).

The distinction that makes both necessary: `/shell` and `/command` are direct run-routes that **bypass the
prompt turn entirely**, so the agent ruleset never sees them — a plain `client` token bound to a restricted
agent could still call `/shell` directly and escape the ruleset. The `channel:` scope is what closes that
route (INV-001, deny-by-default for untrusted ingress).

Other invariants that touch daily use: secrets are never committed or logged (INV-002); instructions inside
channel/upstream content are treated as **data, never executed** (INV-004). Full model:
[security threat model](architecture/security-threat-model.md).

---

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Every request `401`s | Missing/expired bearer token, or the token was created in a **different instance's** store. Recreate it with `XDG_DATA_HOME="$(marid instance path <name>)/data" marid token create …`. |
| Telegram gateway `401`s the instance | Same XDG mismatch — the `channel:` token must live in that instance's store. |
| Bot ignores your messages | Your numeric user ID isn't in `MARID_TG_ALLOW` (get it from @userinfobot). |
| Bot replies but never runs tools | The bound agent's `permission` ruleset denies/hides them, or `task` is denied by design — see [Telegram channel tools](execution/telegram-channel-tools.md). |
| WhatsApp gateway `401`s the instance | Same XDG mismatch as above, or `--agent` doesn't match the token's bound agent. |
| WhatsApp gateway won't start | `MARID_WA_WAHA_URL` unset, or `MARID_WA_ALLOW` empty/malformed (JIDs must look like `…@c.us`) — both fail fast at boot. |
| No WhatsApp replies | The WAHA session isn't paired/authorized yet (scan the QR in WAHA), the WS can't reach `MARID_WA_WAHA_URL`, or your JID isn't in `MARID_WA_ALLOW` (silent no-op, INV-001). |
| Can't find the server port | `marid serve` with `--port 0` picks an auto port (printed at startup); `marid instance status <name>` shows a running instance's port. |
| Web UI blank on connect | Ensure you're using a `client` (or `admin`) token, not a `channel:` token. |

---

## Where to go next

- **README** — [`../README.md`](../README.md): overview, install & verify, the five interfaces.
- **Design package** — [`docs/`](README.md): [charter](00-charter.md), [architecture](architecture/architecture.md),
  [API/event contract](architecture/api-event-contract.md), [ADRs](adrs/).
- **Diagrams** — [`architecture/diagrams/`](architecture/diagrams/README.md).
