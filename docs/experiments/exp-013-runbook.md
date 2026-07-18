---
experiment: EXP-013
hypothesis: HYP-013
status: RUNBOOK (written, not run — native Android manual tier, NEVER a gate)
version: v1.0
updated: 2026-07-17
owner: operator (STK-001)
---

# EXP-013 — native WhatsApp Android render check via mobilewright (runbook)

**Status: RUNBOOK — written, not run.** The occasional, manual render check that drives the **native**
WhatsApp Android app (via mobilewright / mobile-mcp on an emulator or wired device) to confirm a Marid reply
displays correctly on a real client — including whether an optional list message actually renders. It is
**not executed** in WBS-7.6: it needs Android tooling not present on the dev machine (no adb / emulator /
SDK / mobile-mcp), it shares EXP-012's burner ban exposure, and it is **never a gate** (ADR-0014 tier 4).

Validates (when run) [HYP-013](../research/hypothesis-register.md): *mobilewright drives the native
WhatsApp Android app repeatably enough for an occasional manual render check (incl. whether an optional
list message actually displays).*

## Preconditions

- Android emulator or a wired device with the native WhatsApp app, logged into the **burner** number from
  [EXP-012](exp-012-runbook.md) (the same throwaway session; same ban acceptance, RISK-013/022/020).
- adb + mobile-mcp / mobilewright on the driving host (DEP-017 — Apache-2.0).
- The EXP-012 live loop running (WAHA pinned image + `marid whatsapp start` + operator peer).

## Procedure

1. From the operator's real WhatsApp, trigger a reply that contains formatting and a media attachment.
2. Drive the native app with mobilewright: wait for the reply bubble, read its rendered content, and assert
   text + image render (the native analog of EXP-009's Telegram-Web-Playwright render tier).
3. **List-message question (the one native-only unknown):** WAHA can send a list/interactive message on the
   NOWEB engine, but whether the recipient's WhatsApp **renders** it is client-dependent. ADR-0015 chose the
   `APPROVE <token>` text protocol over buttons/lists precisely because render reliability is unverified —
   this step is where that would be checked if ever needed. It does **not** change the shipped design.

## What it does NOT cover / accepted ceilings

- Native-app render is **client-version dependent** and manual; there is no deterministic assertion and no
  CI. mobilewright/emulator flakiness must never block a merge.
- The `APPROVE <token>` text UX is the **shipped** permission surface regardless of this check's outcome
  (ADR-0015 rests on render-reliability, not on price — WAHA collapsed Plus→Core on 2026-06-21, so lists are
  no longer a paid feature, but their client-render reliability is still the reason buttons/lists are out).

## Result

Not run (no Android tooling on the dev machine; operator-deferred as a later manual check, matching the
EXP-010 native-Telegram deferral). A FAIL here does **not** block MS-008.
