---
status: Draft
version: 0.1.0
updated: 2026-07-12
owner: operator (STK-001)
---

# Marid — User Guide

The hands-on companion to the [README](../README.md). The README is the overview and quickstart; this guide
is the **full CLI reference, the concepts behind it, and worked recipes**. For *why* Marid is built the way it
is, see the design package in [`docs/`](README.md) (charter, architecture, ADRs) — that is the source of truth;
this guide describes how to *use* the result.

> **Draft.** Operator-owned; not yet ratified. Commands and flags below are grounded in the shipped CLI.

## Contents

- [Concepts](#concepts) — instances, tokens & scopes, agents, sessions, the event stream
- [CLI reference](#cli-reference) — every `marid` command and flag
- [Recipes](#recipes) — local TUI, API + SDK, web UI, Telegram bot, mirroring, multi-instance
- [Configuration](#configuration) — config layer + environment variables
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
| `channel:<name>` | untrusted ingress (Telegram) | **only** its bound agent, **only** its own sessions, a minimal deny-by-default route set; can never widen tools/permissions or reach privileged routes |

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

Secrets always come from the environment, never CLI flags (INV-002).

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
| Can't find the server port | `marid serve` with `--port 0` picks an auto port (printed at startup); `marid instance status <name>` shows a running instance's port. |
| Web UI blank on connect | Ensure you're using a `client` (or `admin`) token, not a `channel:` token. |

---

## Where to go next

- **README** — [`../README.md`](../README.md): overview, install & verify, the four interfaces.
- **Design package** — [`docs/`](README.md): [charter](00-charter.md), [architecture](architecture/architecture.md),
  [API/event contract](architecture/api-event-contract.md), [ADRs](adrs/).
- **Diagrams** — [`architecture/diagrams/`](architecture/diagrams/README.md).
