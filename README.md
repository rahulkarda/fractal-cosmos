# FRACTAL COSMOS 🌌

**An infinite procedural universe hidden inside mathematics.**

Live demo → **[rahulkarda.github.io/fractal-cosmos](https://rahulkarda.github.io/fractal-cosmos/)**

![Fractal Cosmos](https://img.shields.io/badge/built%20with-vanilla%20JS-blue?style=flat-square) ![GitHub Pages](https://img.shields.io/badge/deployed-GitHub%20Pages-brightgreen?style=flat-square) ![Zero dependencies](https://img.shields.io/badge/dependencies-zero-orange?style=flat-square)

---

## What is this?

FRACTAL COSMOS renders the **Mandelbrot set** pixel-by-pixel using the Canvas 2D API — no WebGL, no libraries, zero dependencies. Zoom deep enough and the app "discovers" a procedurally generated **alien world** at your coordinates, complete with a name, civilization, biome, lore, and matching ambient audio.

Every point in the infinite fractal hides a unique world. The same coordinates always generate the same world.

---

## Features

| Feature | How to use |
|---|---|
| **Infinite zoom** | Scroll to zoom, drag to pan |
| **Julia Set mode** | Press `J` — cycles through 5 stunning presets |
| **5 color themes** | Press `1`–`5` (Deep Space / Fire Storm / Acid Neon / Cosmic Rose / Golden Hour) |
| **Auto-Pilot Explorer** | Press `A` — flies itself through 12 beautiful destinations cinematically |
| **Zoom History Trail** | Minimap (bottom-right) draws your path through fractal space in real time |
| **World Discovery** | Zoom past 500,000× to reveal a procedurally generated alien world |
| **Generative audio** | Press `M` — 5 biome soundscapes built with the Web Audio API |
| **Bookmarks** | Press `B` to save a view, click to return |
| **Screenshot** | Press `S` to download the current view as PNG |
| **Share URL** | URL hash updates with coordinates — paste to share the exact view |

---

## Controls

| Key / Action | Effect |
|---|---|
| `Scroll` | Zoom in / out toward cursor |
| `Drag` | Pan |
| `Double-click` | Zoom in ×3 |
| `Right-click` | Zoom out ×3 |
| `R` | Reset to default view |
| `J` | Toggle Julia Set mode |
| `A` | Toggle Auto-Pilot Explorer |
| `M` | Toggle generative music |
| `1` – `5` | Switch color theme |
| `B` | Save bookmark |
| `S` | Screenshot (PNG download) |
| `+` / `=` | Zoom in |
| `-` / `_` | Zoom out |

---

## How it works

**Rendering** — Each pixel is mapped to a complex number `c`. The Mandelbrot iteration `z = z² + c` runs up to 256 times. Escaped pixels use smooth (continuous) coloring to eliminate banding: `smoothIter = iter + 1 - log(log|z|) / log(2)`. The result is mapped to HSL with a theme-specific hue offset.

**Julia Sets** — In Julia mode, `z` starts at the pixel coordinate and `c` is fixed. The same renderer handles both modes. 5 hand-picked constants expose the most visually striking Julia sets.

**World Generation** — A seeded PRNG (mulberry32) derives a deterministic alien world from the fractal coordinates. Same coords → same world, always.

**Auto-Pilot** — Uses `requestAnimationFrame` with `easeInOutCubic` for smooth camera movement and exponential zoom interpolation across 4 flight phases per destination: pull-back → pan → zoom-in → hover.

**Audio** — Entirely synthesized via the Web Audio API. Oscillators, filters, LFOs, and a convolution reverb — no audio files loaded.

---

## Run locally

No server needed. Just open `index.html` in any modern browser:

```bash
git clone https://github.com/rahulkarda/fractal-cosmos.git
cd fractal-cosmos
open index.html   # macOS
# or double-click index.html on Windows/Linux
```

---

## Interesting coordinates to explore

| Location | X | Y | Zoom |
|---|---|---|---|
| Seahorse Valley | -0.7463 | 0.1102 | 1e6 |
| Elephant Valley | 0.3001 | 0.0200 | 5e5 |
| Infinity Spiral | -0.7436 | 0.1319 | 2e9 |
| Mini Brot | -1.7686 | 0.0042 | 1e8 |
| Dragon | -0.6180 | 0.6623 | 5e7 |

Or press `A` and let the auto-pilot take you there.

---

*Built with imagination and zero dependencies.*
