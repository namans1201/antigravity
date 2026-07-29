# antigravity - branch `ripple-optimized-monochromatic-particles`

A single-colour ripple variant with a CSS paint worklet, and the most
performance-oriented of the vanilla implementations.

For the full map of all five branches, see the README on the default branch,
`unoptimized-hover-based-polychromatic-particles`.

## What this branch changes

- 2 commits ahead, 1 commit behind the default branch
- 5 files changed, 631 insertions, 891 deletions
- Commits: "Extended Hovering", then "New fix"

Two behavioural differences from the default branch:

1. **Monochromatic particles.** The multi-colour path is removed, which accounts
   for much of the net deletion count.
2. **Ripple interaction** rather than a pure hover scatter, so pointer movement
   propagates outward as a wave.

It also adds a file the other vanilla branches do not have:

```
paint-worklet.js     CSS Paint API worklet used for rendering
```

Total file count is 12.

## Lineage

Built on top of `hover-based-polychromatic-particles`, so it inherits the
extended pointer radius from that branch and then changes the colour strategy and
the interaction model.

**This is not the latest branch.** Its tip is 2026-03-18. The newest work is on
`claude-optimized-version` (2026-05-24).

## Run

```bash
python3 -m http.server 5500
```

Then open http://localhost:5500

The CSS Paint API is required for the worklet. It is supported in Chromium-based
browsers; in Firefox and Safari the worklet layer will not render, though the
particle simulation still runs.
