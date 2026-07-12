---
status: Approved
version: 1.0.0
updated: 2026-07-12
owner: operator (STK-001)
---

# Telegram channel — tool calling, MCP, and file sending (operator setup)

> **⚠ KNOWN GAP (2026-07-12, pending fix):** the config below is correct, but the Telegram **gateway** currently
> drives turns via `sdk.session.promptAsync` (`gateway.ts:165`), and that route empirically resolves **zero
> tools** for a channel token (isolated by `test/marid/step0-tools-probe.test.ts`; corroborates the prior
> `telegram.test.ts` note). The **sync** `session.prompt` route DOES resolve the full toolset for a channel token
> + this agent config (ruleset applied, `task` hidden). So tool calling is **not yet live** on the gateway path —
> a Marid-side gateway route change (or an upstream `promptAsync` fix) is required and is operator-gated. File
> sending (below) is implemented and green independent of this.

How to give the Telegram bot **full TUI/Web capability parity** — every built-in tool and every MCP tool —
gated per-tool by an **allow / ask / deny** policy, plus outbound file sending. This is **configuration**, not new
code: the channel routes through the same server/session/tool path as the TUI and Web (`session.promptAsync`
is the same `promptSvc.prompt`, just forked), so tools resolve normally — verified deterministically by
`packages/opencode/test/marid/step0-tools-probe.test.ts` (the served main-turn request carries the full toolset).
The **only** gate is the channel agent's `permission` ruleset. `ask` surfaces the already-built Approve/Deny
**inline keyboard** (`marid-telegram/src/permission.ts`); the operator authorizes each sensitive call from chat.

## 1. Define a restricted channel agent (instance opencode config)

Recommended default — **"everything, sensitive-gated"**: every tool available; reads run silently; everything
that mutates / executes / reaches out prompts:

```json
{
  "agent": {
    "tg": {
      "mode": "primary",
      "permission": {
        "*": "ask",
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "task": "deny"
      }
    }
  }
}
```

Then bind a channel token and start the gateway against this agent:

```
marid token create --scope channel:telegram --agent tg
marid telegram start <instance> --token <tok> --agent tg
```

`marid-auth` pins the agent to the token and rejects any prompt that tries to widen tools/permission
(`channelAgentDenial`, `middleware.ts`), so the config ruleset is the single source of truth.

## 2. How the ruleset behaves (gotchas)

- **`edit` covers `edit` / `write` / `apply_patch`** — there is no separate `write` key.
- **`"*": "ask"` hides nothing** — every built-in + MCP tool is offered; non-read tools prompt. Tighten any
  tool to `deny` (which also hides it) or loosen to `allow` per exact name or glob.
- **`task` is `deny` on purpose (security).** A subagent spawned via `task` inherits only the parent's **deny**
  rules (`agent/subagent-permissions.ts`), NOT its `ask` rules — so an approved `task` spawn would run a
  permissive subagent unrestricted. Denying `task` closes that escalation. Leave it `deny` unless you add a
  mechanism that makes subagents inherit the channel's `ask` gating (separate change).

## 3. MCP tools

MCP tools flow through the **same** ruleset (`Permission.visibleTools(mcp.tools(), ruleset)`), matched by their
tool name with wildcards. Configure MCP servers in the instance config as usual; under `"*": "ask"` every MCP
tool is available and prompts by default. Allow/deny specific ones by name or glob, e.g.:

```json
"permission": { "*": "ask", "someserver_read_doc": "allow", "someserver_delete_*": "deny", "task": "deny" }
```

(MCP tool names follow opencode's `mcp.tools()` ids — inspect them once your servers are configured.)

## 4. File sending (outbound)

When a **tool returns a media attachment** (a `data:` URL), the gateway decodes the bytes and uploads them to
Telegram as multipart (image mime → photo, else document; filename = caption) — `marid-telegram/src/{media,
bot-api,gateway}.ts`. No public URL/relay is needed. Note: this covers tool-produced media attachments; sending
an arbitrary file the agent merely wrote to disk would need a dedicated "attach this path" tool (future work).

## Security notes (INV-001 / INV-004)

- **INV-001 (least-privilege):** `ask` = per-call operator approval, the strongest form of least-privilege for an
  untrusted channel. Do **not** set `"*": "allow"` for a channel (silent full access to untrusted ingress) without
  a recorded ADR + explicit sign-off.
- **INV-004 (untrusted content):** a Telegram sender's text is an agent prompt that can request tool calls. The
  operator **allowlist** (who may message) plus per-call `ask` are the gates — **read what you approve**: a
  crafted message can produce a plausible-looking `bash` command. Reads are silent but read-only.
- **WhatsApp (PH-7):** the same tool/permission model is server-side and channel-agnostic, so a WhatsApp channel
  inherits this policy mechanism unchanged; only its own media-send adapter is channel-specific (PH-7 work).
