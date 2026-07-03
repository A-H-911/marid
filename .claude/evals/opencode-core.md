# EVAL DEFINITION: opencode-core

> Baseline capability and regression evals for the opencode monorepo.
> Run after any significant change to agent, session, tool, or provider modules.

---

## Capability Evals

### CAP-01: CLI boots and shows help
```bash
# Grader: code
cd packages/opencode && bun run src/index.ts --help 2>&1 | grep -q "opencode" && echo "PASS" || echo "FAIL"
```
Expected: exits 0, "opencode" present in output

### CAP-02: TypeScript typechecks clean
```bash
# Grader: code
cd packages/opencode && bun typecheck 2>&1 | grep -c "error TS" | xargs -I{} sh -c '[ "{}" = "0" ] && echo "PASS" || echo "FAIL"'
```
Expected: 0 type errors

### CAP-03: Unit tests pass
```bash
# Grader: code
cd packages/opencode && bun test --timeout 30000 2>&1 | tail -5
```
Expected: all tests pass, no failures

### CAP-04: HTTP server starts on port 4096
```bash
# Grader: code (manual — requires running server)
# Start: bun dev serve
# Check: curl -s http://localhost:4096/ | grep -q "opencode" && echo "PASS" || echo "FAIL"
```

### CAP-05: Tool registry contains required tools
```bash
# Grader: code
grep -r "id:" packages/opencode/src/tool/registry.ts | grep -E "read|write|edit|shell|glob|grep" && echo "PASS" || echo "FAIL"
```
Expected: read, write, edit, shell, glob, grep tools registered

### CAP-06: Session schema is valid Drizzle schema
```bash
# Grader: code
grep -q "sqliteTable" packages/opencode/src/session/session.sql.ts && echo "PASS" || echo "FAIL"
```

### CAP-07: Provider list includes Anthropic + OpenAI
```bash
# Grader: code
grep -q "anthropic" packages/opencode/src/provider/models.ts && \
grep -q "openai" packages/opencode/src/provider/models.ts && echo "PASS" || echo "FAIL"
```

### CAP-08: MCP module exports Service
```bash
# Grader: code
grep -q "export.*Service" packages/opencode/src/mcp/index.ts && echo "PASS" || echo "FAIL"
```

### CAP-09: App package builds (SolidJS UI)
```bash
# Grader: code
cd packages/app && bun run build 2>&1 | tail -3
```
Expected: build completes without error

### CAP-10: Plugin SDK exports public API
```bash
# Grader: code
grep -q "export" packages/plugin/src/index.ts && echo "PASS" || echo "FAIL"
```

---

## Regression Evals

### REG-01: Session table has required columns
```bash
# Grader: code
grep -q "project_id\|workspace_id\|parent_id\|title\|directory" \
  packages/opencode/src/session/session.sql.ts && echo "PASS" || echo "FAIL"
```

### REG-02: Agent.Service uses Effect Context pattern
```bash
# Grader: code
grep -q "Context.Service" packages/opencode/src/agent/agent.ts && echo "PASS" || echo "FAIL"
```

### REG-03: Server middleware chain intact
```bash
# Grader: code
grep -q "AuthMiddleware\|CorsMiddleware\|ErrorMiddleware" \
  packages/opencode/src/server/server.ts && echo "PASS" || echo "FAIL"
```

### REG-04: Conditional imports (#db, #pty, #hono) present in package.json
```bash
# Grader: code
node -e "const p=require('./packages/opencode/package.json'); \
  const i=p.imports; \
  console.log(i['#db'] && i['#pty'] && i['#hono'] ? 'PASS' : 'FAIL')"
```

### REG-05: No console.log in tool implementations
```bash
# Grader: code
count=$(grep -rn "console\.log" packages/opencode/src/tool/*.ts 2>/dev/null | grep -v "\.d\.ts" | wc -l)
[ "$count" = "0" ] && echo "PASS" || echo "FAIL ($count console.log found)"
```

---

## Success Metrics

| Eval type   | Target         |
|-------------|----------------|
| Capability  | pass@3 >= 0.90 |
| Regression  | pass^3 = 1.00  |

---

## Eval Run History

<!-- Append entries after each run:
[YYYY-MM-DD SHA] CAP: X/10  REG: X/5  Status: PASS|FAIL
-->
