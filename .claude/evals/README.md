# Eval Harness

Eval-Driven Development (EDD) artifacts for the opencode project.

## Files

| File                  | Purpose                                       |
|-----------------------|-----------------------------------------------|
| `baseline.json`       | Baseline snapshot: version, SHA, capabilities |
| `opencode-core.md`    | Capability + regression eval definitions      |
| `*.log`               | Eval run history (appended per run)           |

## Running Evals

### Quick capability check (code graders)
```bash
# CAP-02: typecheck
cd packages/opencode && bun typecheck

# CAP-03: unit tests
cd packages/opencode && bun test --timeout 30000

# REG-01 through REG-05: grep-based structural checks
# See opencode-core.md for exact commands
```

### Full eval run
Paste each grader command from `opencode-core.md` and record PASS/FAIL.
Append a summary line to the eval's Run History section:
```
[2026-05-06 38b0cdc14] CAP: 9/10  REG: 5/5  Status: PASS
```

## Adding New Evals

1. Add a `### CAP-XX` or `### REG-XX` block to `opencode-core.md`
2. Include a code grader bash command where possible
3. Update `baseline.json` capabilities array if adding a new capability
4. Set target metric (pass@3 for capability, pass^3 for regression)

## Metrics Reference

| Metric  | Meaning                           | Target                   |
|---------|-----------------------------------|--------------------------|
| pass@1  | Succeeds on first attempt         | Capability baseline      |
| pass@3  | Succeeds at least once in 3 runs  | >= 0.90 for capabilities |
| pass^3  | Succeeds all 3 consecutive runs   | 1.00 for regressions     |
