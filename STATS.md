# Stats

Marid is a **private, single-operator distribution** — there is no npm channel and no public marketing
funnel, so the upstream OpenCode download-stats table does not apply here and has been removed.

Marid's releases **are** public (DEC-010), so real numbers are available on demand: the GitHub Releases API
reports per-asset download counts for every `v*` tag —

```sh
gh api repos/A-H-911/marid/releases --jq '.[] | {tag: .tag_name, downloads: ([.assets[].download_count] | add)}'
```

An automated single-operator usage/download-stats mechanism (pulling the above on a schedule and appending
here) is **not yet built** — tracked in the [deferred-work register](docs/execution/deferred-work-register.md).
