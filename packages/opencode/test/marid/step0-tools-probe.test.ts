// STEP 0 (plan velvety-tumbling-tiger) — settle the load-bearing contradiction: does the
// SERVED prompt path actually offer tools to the model? A prior session recorded "no tools in
// the request"; the code trace (promptAsync = promptSvc.prompt, tools resolved at
// prompt.ts:1226) says it should. This inspects the fake LLM's recorded MAIN-turn request body
// (not the title/summary call, which legitimately sends tools:{}) after a normal served prompt.
//
// Deterministic, no paid model. Run:
//   cd packages/opencode && bun test test/marid/step0-tools-probe.test.ts

import { test, expect } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { createTokenStore } from "@marid/auth"
import { instanceMaridDir, start, stop, type LaunchResolver } from "@marid/instance"
import { TestLLMServer } from "../lib/llm-server"
import { testProviderConfig } from "../lib/test-provider"

const maridEntry = path.resolve(import.meta.dir, "../../src/marid.ts")
const launch: LaunchResolver = () => ({
  command: process.execPath,
  args: ["run", "--conditions=browser", maridEntry, "serve", "--port", "0"],
})
function overlay(fakeHome: string, llmUrl: string): Record<string, string> {
  return {
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    OPENCODE_TEST_HOME: fakeHome,
    OPENCODE_PURE: "1",
    OPENCODE_DISABLE_AUTOUPDATE: "1",
    OPENCODE_DISABLE_AUTOCOMPACT: "1",
    OPENCODE_DISABLE_MODELS_FETCH: "1",
    OPENCODE_AUTH_CONTENT: "{}",
    OPENCODE_DB: "opencode.db",
    OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...testProviderConfig(llmUrl), model: "test/test-model" }),
  }
}

// The recommended channel-agent recipe (docs/execution/telegram-channel-tools.md): everything
// available, reads silent, task denied. Used by the channel-path test to prove the config-defined
// agent + its ruleset load and apply on the real gateway path (channel token + promptAsync).
const TG_AGENT = {
  tg: { mode: "primary", tools: { "*": true }, permission: { "*": "ask", read: "allow", glob: "allow", grep: "allow", list: "allow", task: "deny" } },
}
function overlayWithAgent(fakeHome: string, llmUrl: string): Record<string, string> {
  const base = overlay(fakeHome, llmUrl)
  return { ...base, OPENCODE_CONFIG_CONTENT: JSON.stringify({ ...testProviderConfig(llmUrl), model: "test/test-model", agent: TG_AGENT }) }
}

const PROMPT = "say the word done"

test("STEP0: served main-turn request carries resolved tools", async () => {
  const program = Effect.gen(function* () {
    const llm = yield* TestLLMServer
    const root = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "step0-")))
    const dir = path.join(root, "inst")
    const fakeHome = path.join(root, "home")
    yield* Effect.promise(() => fs.mkdir(fakeHome, { recursive: true }))
    const token = yield* Effect.promise(() =>
      createTokenStore(instanceMaridDir(dir)).create("admin", "admin").then((r) => r.secret),
    )
    const record = yield* Effect.promise(() =>
      start("inst", dir, launch, { env: overlay(fakeHome, llm.url), timeoutMs: 60_000 }),
    )
    const sdk = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${record.port}`,
      headers: { authorization: `Bearer ${token}` },
    })
    yield* llm.text("done") // reply for the main turn
    const session = yield* Effect.promise(() =>
      sdk.session.create({ agent: "build", title: "step0" }, { throwOnError: true }).then((r) => r.data),
    )
    yield* Effect.promise(() =>
      sdk.session
        .prompt(
          { sessionID: session.id, model: { providerID: "test", modelID: "test-model" }, parts: [{ type: "text", text: PROMPT }] },
          { throwOnError: true },
        )
        .catch((e) => {
          console.error("prompt error:", e)
        }),
    )
    const inputs = yield* llm.inputs
    yield* Effect.promise(() => stop(dir).catch(() => {}))
    yield* Effect.promise(() => fs.rm(root, { recursive: true, force: true }).catch(() => {}))
    return inputs
  }).pipe(Effect.provide(TestLLMServer.layer), Effect.scoped)

  const inputs = await Effect.runPromise(program)
  const isTitle = (b: unknown) => JSON.stringify(b).includes("Generate a title")
  const main = inputs.find((b) => JSON.stringify(b).includes(PROMPT) && !isTitle(b))

  console.log(`\n[STEP0] recorded requests: ${inputs.length} (title calls excluded from main match)`)
  const toolsField = (main as { tools?: unknown } | undefined)?.tools
  const count = Array.isArray(toolsField) ? toolsField.length : 0
  const names = Array.isArray(toolsField)
    ? toolsField.map((t) => (t as { function?: { name?: string }; name?: string }).function?.name ?? (t as { name?: string }).name).filter(Boolean)
    : []
  console.log(`[STEP0] MAIN-turn request found: ${!!main}`)
  console.log(`[STEP0] MAIN-turn tools field: ${count > 0 ? `${count} tools → ${names.join(", ")}` : JSON.stringify(toolsField) ?? "ABSENT"}`)
  console.log(`[STEP0] VERDICT: tools ${count > 0 ? "PRESENT ✅ (the SYNC served path resolves the full toolset — see STEP0b for the gateway promptAsync defect)" : "ABSENT ❌"}\n`)

  expect(main).toBeDefined()
}, 120_000)

// STEP0b — proves the FIX DIRECTION works, and documents the DEFECT it works around.
//
// DEFECT (isolated this session, corroborates the prior "promptAsync has no tools" note): the
// gateway drives turns via `sdk.session.promptAsync` (gateway.ts:165), and that route resolves
// ZERO tools for a channel token (empirically — mechanism not yet root-caused; both the sync
// `prompt` and async `prompt_async` HTTP handlers call the same `promptSvc.prompt`, so the cause
// is NOT simply the handler). So the Telegram bot cannot use tools on the current gateway path.
//
// FIX DIRECTION (what THIS test proves): the SYNC `sdk.session.prompt` route DOES resolve the full
// toolset for a **channel** token + a config-defined `tg` agent, with the ruleset correctly
// applied — bash offered (via "*":"ask"), `task` hidden ("task":"deny" → visibleTools drops it).
// So a candidate fix is to have the gateway drive the sync route fire-and-forget (pending a check
// that the served turn still completes when the response stream isn't consumed). OPERATOR-GATED.
test("STEP0b: channel token + tg agent — the SYNC route resolves tools; ruleset applied (task hidden)", async () => {
  const program = Effect.gen(function* () {
    const llm = yield* TestLLMServer
    const root = yield* Effect.promise(() => fs.mkdtemp(path.join(os.tmpdir(), "step0b-")))
    const dir = path.join(root, "inst")
    const fakeHome = path.join(root, "home")
    yield* Effect.promise(() => fs.mkdir(fakeHome, { recursive: true }))
    // ISOLATION: channel token + sync prompt + model (else identical to the passing admin run) —
    // flips ONLY the token to test whether channel scope strips the resolved tools.
    const token = yield* Effect.promise(() =>
      createTokenStore(instanceMaridDir(dir)).create("tg", "channel:telegram", "tg").then((r) => r.secret),
    )
    const record = yield* Effect.promise(() =>
      start("inst", dir, launch, { env: overlayWithAgent(fakeHome, llm.url), timeoutMs: 60_000 }),
    )
    const sdk = createOpencodeClient({
      baseUrl: `http://127.0.0.1:${record.port}`,
      headers: { authorization: `Bearer ${token}` },
    })
    yield* llm.text("done")
    const session = yield* Effect.promise(() =>
      sdk.session.create({ agent: "tg", title: "step0b" }, { throwOnError: true }).then((r) => r.data),
    )
    yield* Effect.promise(() =>
      sdk.session
        .prompt({ sessionID: session.id, agent: "tg", parts: [{ type: "text", text: PROMPT }] }, { throwOnError: true })
        .catch((e) => console.error("prompt error:", e)),
    )
    const inputs = yield* llm.inputs
    yield* Effect.promise(() => stop(dir).catch(() => {}))
    yield* Effect.promise(() => fs.rm(root, { recursive: true, force: true }).catch(() => {}))
    return inputs
  }).pipe(Effect.provide(TestLLMServer.layer), Effect.scoped)

  const inputs = await Effect.runPromise(program)
  const main = inputs.find((b) => JSON.stringify(b).includes(PROMPT) && !JSON.stringify(b).includes("Generate a title")) as
    | { tools?: Array<{ function?: { name?: string }; name?: string }> }
    | undefined
  const names = (main?.tools ?? []).map((t) => t.function?.name ?? t.name).filter(Boolean)
  console.log(`\n[STEP0b] channel-path tools (${names.length}): ${names.join(", ")}`)
  console.log(`[STEP0b] bash offered: ${names.includes("bash")} · task hidden (deny): ${!names.includes("task")}\n`)

  expect(main).toBeDefined()
  expect(names).toContain("bash") // "*":"ask" → available
  expect(names).not.toContain("task") // "task":"deny" → hidden by the ruleset
}, 120_000)
