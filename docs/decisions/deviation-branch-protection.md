---
status: Superseded
version: v0.1
updated: 2026-07-17
owner: operator (STK-001)
---

# Deviation: branch protection not enforceable on the current GitHub plan

> **SUPERSEDED 2026-07-03 by [DEC-010](open-decision-register.md) (Approved) — resolved; kept as history.**
> The operator chose the third option below: **make the repository public**. Branch protection is live on
> `main` + `develop` (17 required status checks), closing WBS-0.3's protection DoD, and the "private
> distribution" premise this document reasons from was itself amended — "private" now means single-operator
> *usage*, not a closed repo. The blocking question below is answered; nothing here is actionable.
> Deferred-work item 6 closed **Done** 2026-07-17.

Filed per `docs/handoff/follow-up-prompts.md` § Deviation — reality contradicts an approved artifact.
Surfaced during WBS-0.3 (PH-0), immediately after WBS-0.1 completed. **No workaround was applied; stopped
for operator decision (INV-005).**

## What the plan says

- `docs/architecture/upstream-sync-strategy.md` (Approved, gate 9), Git Flow table: `main` and `develop`
  are **"Protected: PR-only, required checks green, no force push."**
- `docs/planning/roadmap.md` WBS-0.3 DoD: **"Required checks enforced on main/develop."**
- DEC-007 (branching-model adaptation) assumes these protections are applicable.

## What I found (evidence)

`A-H-911/marid` is a **private repo on the GitHub Free plan**. Both API mechanisms for branch protection
are gated behind a paid plan:

| Attempt | Endpoint | Result |
|---|---|---|
| Classic branch protection | `PUT /repos/A-H-911/marid/branches/{main,develop}/protection` | `HTTP 403 — Upgrade to GitHub Pro or make this repository public to enable this feature.` |
| Repository ruleset | `POST /repos/A-H-911/marid/rulesets` | `HTTP 403 — Upgrade to GitHub Pro or make this repository public to enable this feature.` |

Making the repo public is a non-starter (charter: private distribution; CON-004/OQ-004). So enforcement
requires a plan change.

> **Overtaken by DEC-010 (Approved, 2026-07-03):** this premise did not survive. The repo **was** made
> public — the charter's "private" was clarified to mean single-operator *usage* on a private network, not
> a closed repository, so the "non-starter" reasoning above no longer holds.

**Scope of the gap:** enforcement only. GitHub Actions still runs on PRs on Free private repos (within the
free-minute allowance), so CI can be built (WBS-0.3 CI skeleton) regardless. What cannot be *enforced*
today: PR-required merges, blocked force-pushes, and blocked branch deletion on `main`/`develop`.

**Unaffected / already done (WBS-0.1):** repo created (private), remotes wired (`origin`=marid,
`upstream`=anomalyco fetch-only, push disabled), and the baseline tag
`upstream-baseline/2026-07-03-eb3476660` pushed. `main`, `develop`, and the tag are all at `eb3476660`.

## Options

| # | Option | Cost | Effect | Trade-off |
|---|---|---|---|---|
| 1 | **Upgrade A-H-911 to GitHub Pro** | ~$4/mo | Classic protection + rulesets unlock immediately; repo stays on the personal account | Recurring personal cost; no structural change |
| 2 | **Move `marid` to a GitHub org on a paid plan (Team)** | ~$4/user/mo | Protected branches/rulesets for private repos + org controls, room for future collaborators | Re-do remote wiring (new URL); more setup than needed for a solo MVP |
| 3 | **Defer enforcement; rely on discipline + CI-on-PR (interim)** | $0 | Nothing blocks direct/force push or deletion; mitigated by policy: agent uses feature-branch + PR for everything (INV-003 already forbids silent pushes), CI runs on PRs | Weakest guarantee; a slip isn't mechanically prevented |

## Recommendation

**Option 1 (GitHub Pro)** — the minimal in-place unblock. Cheapest, no topology change, and it satisfies
the sync-strategy protection spec exactly. Escalate to **Option 2** only if org-level features or
collaborators become a requirement (revisit at PH-5 distribution).

Until the plan is upgraded, proceed under **Option 3 as an explicit, time-boxed interim**: every change to
`main`/`develop` goes through a `feature/*` (or `sync/*`) branch and a PR — which is already how the
gate-12 planning-package import and all WBS work are structured — so the *practice* holds even while the
*enforcement* is absent. Apply protection (and add required status checks once the CI skeleton exists) the
moment the plan allows.

## On resolution

Record the operator's choice as **DEC-010** in `docs/decisions/open-decision-register.md` (or fold into
DEC-007), then: if Option 1/2, apply the ruleset (PR rule w/ 0 approvals for solo + `non_fast_forward` +
`deletion`) on `main`/`develop` and, after CI lands, add required status checks — closing WBS-0.3's
protection DoD.

~~**STOP — awaiting operator decision on the plan/enforcement option before any further protection action.**~~

> **Answered 2026-07-03 (DEC-010, Approved):** the operator chose **make the repository public**. Rulesets
> were then applied to `main` + `develop` and grew to the current **17 required status checks**; WBS-0.3's
> protection DoD is closed. No further action is pending from this document.
