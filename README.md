# Gravity Recreated Effect

A recreation of the Antigravity landing page hero, featuring an interactive confetti particle field that reacts to the cursor. Move the mouse and the particles are pushed away with a soft gravity-like return; the rest of the page sits on top as a static hero section.

## What's inside

- **`ConfettiParticles`** — a canvas-based field of ~500 colored shapes (circles, rectangles, lines, dots) that respond to mouse movement with a configurable push force, friction, and return-to-origin spring.
- **`Navbar`** — minimal top navigation styled to match the Antigravity look.
- **`Index` page** — hero section layered above the particle canvas with a headline and call-to-action buttons.

## Tech stack

- Vite + React 18 + TypeScript
- Tailwind CSS
- A small set of shadcn/ui components (toaster, sonner, tooltip)
- React Router

## Prerequisites

- Node.js 18+ and npm

## Getting started

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd gravity-recreated-effect

# Install dependencies
npm install

# Start the dev server (http://localhost:8080)
npm run dev
```

## Available scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the Vite dev server            |
| `npm run build`     | Production build into `dist/`        |
| `npm run build:dev` | Development-mode build               |
| `npm run preview`   | Preview the production build locally |
| `npm run lint`      | Run ESLint                           |

## Project structure

```
src/
├── components/
│   ├── ConfettiParticles.tsx   # Interactive canvas particle field
│   ├── Navbar.tsx              # Top navigation
│   └── ui/                     # shadcn/ui primitives (toaster, sonner, tooltip)
├── hooks/
│   └── use-toast.ts
├── lib/
│   └── utils.ts                # cn() className helper
├── pages/
│   ├── Index.tsx               # Landing page
│   └── NotFound.tsx            # 404 route
├── App.tsx
├── main.tsx
└── index.css
```

## Tweaking the effect

The particle behavior is controlled by a few constants at the top of `src/components/ConfettiParticles.tsx`:

- `COLORS` — palette used for the particles
- `MOUSE_RADIUS` — how close the cursor must be to push a particle
- `PUSH_FORCE` — strength of the push away from the cursor
- `RETURN_SPEED` — spring force pulling each particle back to its origin
- `FRICTION` — velocity damping per frame
- The particle count (currently `500`) inside `initParticles`

## Building for production

```sh
npm run build
npm run preview
```

The build output is written to `dist/` and can be deployed to any static host (Vercel, Netlify, GitHub Pages, S3, etc.).
