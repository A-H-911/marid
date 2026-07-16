# Screenshots — capture guide

The README references three screenshots that live in this folder. They're **real captures** the operator
provides (run the interface, screenshot it, drop the PNG here with the exact filename below).

| File | What to capture | Suggested width |
|---|---|---|
| `tui-v3.png` | The **TUI** (`marid`) in an **active session** — a prompt sent and the agent responding (tool calls / streamed output visible). A dark terminal reads best. | ~1600 px |
| `web-v3.png` | The **web UI** (`marid serve`, then open the web app) — a session view. | ~1600 px |
| `telegram.png` *(dropped — not required; add only if a live capture becomes available)* | A **Telegram** conversation with the bot — a prompt and its streamed reply. Phone-shaped. | ~720 px |

Notes:
- PNG, reasonable file size (crop tight, no desktop chrome you don't want public).
- **Don't capture secrets** — no visible bearer tokens, bot tokens, provider keys, or private paths.
- Filenames carry a `-v3` suffix so GitHub's camo image cache picks up refreshed assets. `tui-v3.png` + `web-v3.png` are present (captured 2026-07-16); Telegram is not required.
