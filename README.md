# antigravity - branch `claude-optimized-version`

**This is the latest branch in the repository** (2026-05-24 15:14) and the
cleanest implementation of the antigravity particle effect.

For the full map of all five branches, see the README on the default branch,
`unoptimized-hover-based-polychromatic-particles`.

## What this branch is

A cleanup pass that promotes the canonical implementation to the repository root
and deletes everything unused. The project is reduced to 5 files:

```
index.html      markup and canvas host
app.js          the whole particle simulation
style.css       layout and visual styling
README.md
.gitignore
```

Compared with the 12-file default branch, the multi-entry structure
(`sim.html`, `sim.js`, `home.html`, `main.js`, `chunk.js`,
`antigravity.html`, `antigravity.css`, `antigravity_reference.css`) is gone.
There is now one page and one script.

## Changes relative to the default branch

- 1 commit ahead, 0 commits behind
- 12 files changed, 166 insertions, 6835 deletions
- Commit: "Clean up: promote canonical version to root, drop dead bloat"

Being 0 behind means this branch contains everything on the default branch, so
merging it in would be a fast-forward with no conflicts.

## Run

```bash
python3 -m http.server 5500
```

Then open http://localhost:5500

Serving over HTTP is required. Opening `index.html` through `file://` will not
load the sibling scripts.

## Why start here

If you are reading this codebase for the first time, read this branch. The
particle logic is identical in behaviour to the default branch but lives in one
file with the dead code removed.
