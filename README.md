# antigravity - branch `lovable-ripple-polychromatic-particles`

A complete rewrite of the antigravity effect as a modern React application. This
is the largest divergence in the repository: the other four branches are vanilla
HTML, CSS and JavaScript, and this one is a full Vite build.

For the full map of all five branches, see the README on the default branch,
`unoptimized-hover-based-polychromatic-particles`.

## What this branch changes

- 16 commits ahead, 2 commits behind the default branch
- 40 files changed, 5677 insertions, 7460 deletions
- 30 tracked files, against 12 on the default branch

The entire vanilla implementation is replaced. `style.css` and the multi-entry
HTML pages are deleted, and the effect is reimplemented as a React component.

## Stack

- Vite
- React with TypeScript
- Tailwind CSS
- shadcn/ui primitives, plus Sonner for toasts
- Scaffolded from a Lovable template

## Where the effect lives

```
src/
  components/
    ConfettiParticles.tsx     the particle effect itself
    Navbar.tsx
    ui/                       sonner, toast, toaster, tooltip
  pages/
    Index.tsx                 hosts the effect
    NotFound.tsx
  hooks/use-toast.ts
  index.css                   Tailwind layers and theme
  main.tsx
tailwind.config.ts
vite.config.ts
```

## Development history on this branch

The 16 commits trace the effect being rebuilt from scratch rather than ported:
"Investigated hover effect", "Build confetti hover effect", "Add confetti mouse
effect", "Add confetti hover effect", "Replicated hover effect", "Replicated
antigravity hover", then two density passes, "Increase particle density and
radius", and finally "Clean up UI components and update configurations".

## Run

Unlike the other branches, this one does not work with a plain static file
server.

```bash
npm install
npm run dev
```

## Status

**This is not the latest branch.** Its tip is 2026-05-24 13:29, about two hours
before `claude-optimized-version` at 15:14.

It is 2 commits behind the default branch, so it does not contain everything
there. Given that it shares almost no files with the other branches, merging it
is not meaningful; treat it as a parallel React port rather than a step in a
sequence.
