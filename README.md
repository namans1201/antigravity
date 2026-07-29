# antigravity

Particle-field experiments recreating an "antigravity" cursor interaction, where
particles scatter away from the pointer and settle back under a simulated pull.

This repository is organised as a set of parallel branches rather than a single
line of development. Each branch is a self-contained implementation of the same
idea with a different rendering strategy, particle behaviour and performance
profile. Nothing is merged between them on purpose, so each variant stays
readable on its own.

## Running any of the vanilla branches

The pages load sibling scripts over HTTP, so `file://` will not work. Serve the
folder and open the printed URL:

```bash
python3 -m http.server 5500
```

Then open http://localhost:5500

The `lovable-ripple-polychromatic-particles` branch is a Vite application and
uses `npm install` followed by `npm run dev` instead.

## Branches

There is no linear history here. The table below is the authoritative map of
what each branch holds.

| Branch | Head | Last commit | Ahead / behind default | Content |
| --- | --- | --- | --- | --- |
| `unoptimized-hover-based-polychromatic-particles` (default) | `66570b78` | 2026-02-24 | baseline | The original multi-colour hover implementation, 12 files. Vanilla HTML, CSS and JS built from `sim.js`, `main.js`, `chunk.js` and a reference stylesheet. No performance work applied. |
| `hover-based-polychromatic-particles` | `4785e8c1` | 2026-02-24 | 1 ahead, 1 behind | Same vanilla base, with hover tracking extended across a wider interaction radius. 2 files changed, 27 insertions, 22 deletions. Commit: "Extended Hovering". |
| `ripple-optimized-monochromatic-particles` | `7c80f3e3` | 2026-03-18 | 2 ahead, 1 behind | Builds on the extended-hover work, then switches to a single-colour ripple and adds a CSS paint worklet (`paint-worklet.js`). 5 files changed, 631 insertions, 891 deletions. The net deletion count reflects dropping the polychromatic path. |
| `lovable-ripple-polychromatic-particles` | `33f78684` | 2026-05-24 | 16 ahead, 2 behind | Full rewrite as a Vite plus React plus TypeScript application with Tailwind and shadcn/ui, 30 files. The effect lives in `src/components/ConfettiParticles.tsx`. Largest divergence in the repository: 40 files changed, 5677 insertions, 7460 deletions. Scaffolded from a Lovable template, then iterated on particle density and radius. |
| `claude-optimized-version` | `f21fbe8d` | 2026-05-24 | 1 ahead, 0 behind | Latest. Reduces the project to 5 files (`index.html`, `app.js`, `style.css`, `README.md`, `.gitignore`) by promoting the canonical implementation to the root and deleting dead code. 12 files changed, 166 insertions, 6835 deletions. |

**Latest branch: `claude-optimized-version`**, 2026-05-24, the most recent commit
in the repository. It is also the smallest and the easiest to read.

Note that the repository default branch is
`unoptimized-hover-based-polychromatic-particles`, which is the unoptimised
baseline rather than the newest work, so visitors land on the baseline first. To
make the tidied implementation the landing view, change the default branch to
`claude-optimized-version` in the repository settings.

## Choosing a branch

- Reading the algorithm for the first time: `claude-optimized-version`
- Comparing colour strategies: default versus `ripple-optimized-monochromatic-particles`
- Working in a React codebase: `lovable-ripple-polychromatic-particles`
