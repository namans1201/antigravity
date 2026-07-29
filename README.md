# antigravity - branch `hover-based-polychromatic-particles`

An incremental variant of the default branch that widens the pointer
interaction radius, so particles respond to the cursor from further away.

For the full map of all five branches, see the README on the default branch,
`unoptimized-hover-based-polychromatic-particles`.

## What this branch changes

- 1 commit ahead, 1 commit behind the default branch
- 2 files changed, 27 insertions, 22 deletions
- Commit: "Extended Hovering"

A small, focused change. The file layout is the same 11-file vanilla structure as
the default branch, and particles remain multi-coloured (polychromatic). Only the
hover detection distance and its falloff differ.

## Position in the repository

This branch is the base that `ripple-optimized-monochromatic-particles` was
built from. That branch takes this extended-hover behaviour and then switches to
a single-colour ripple.

**This is not the latest branch.** The most recent work is on
`claude-optimized-version` (2026-05-24). This branch's tip is from 2026-02-24.

Because it is 1 commit behind the default branch, it is missing a change that
exists there, so it is not a strict superset.

## Run

```bash
python3 -m http.server 5500
```

Then open http://localhost:5500
