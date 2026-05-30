FRACTAL COSMOS — Infinite Universe Explorer
===========================================

HOW TO RUN
----------
1. Open index.html directly in any modern browser (Chrome, Firefox, Edge, Safari).
   No web server, no Node.js, and no build step are required.
   All five scripts (worldgen.js, audio.js, fractal.js, ui.js, app.js) and the
   patch file (patches.js) are loaded as plain <script> tags.

2. A splash screen appears on first load.  Click anywhere on it to dismiss
   the splash and begin exploring the fractal.

FILES
-----
  index.html   — Entry point.  Load this in your browser.
  fractal.js   — Mandelbrot renderer (Canvas 2D ImageData).
  worldgen.js  — Procedural world data generator (seeded PRNG).
  audio.js     — Web Audio biome soundscapes.
  ui.js        — HUD: coordinate display, world panel, discovery flash.
  app.js       — Main controller: input handling, render loop.
  patches.js   — Integration fixes (see KNOWN ISSUES below).
  styles.css   — Visual styling (must be present alongside index.html).


CONTROLS
--------

  Mouse / Trackpad
  ----------------
  Scroll wheel up       Zoom in  (centred on cursor position)
  Scroll wheel down     Zoom out (centred on cursor position)
  Click and drag        Pan the view
  Double-click          Zoom in x3 (centred on click position)
  Right-click           Zoom out x3 (centred on click position)

  Keyboard
  --------
  R                     Reset view to the default starting position
  M                     Toggle background music on / off
  + or =                Zoom in (step)
  - or _                Zoom out (step)


WORLD DISCOVERY
---------------
Zoom in deep enough (past zoom level 500,000) to trigger a World Discovery.
A flash effect fires and the World Panel slides in from the right, showing:
  - World name and biome type
  - Population
  - Civilization name
  - Resources (three materials)
  - Danger level bar
  - World history

The biome also triggers a matching ambient soundscape (crystal, organic,
mechanical, void, or radiant) if music is enabled with M.

Pan or zoom out to dismiss the World Panel and discover a new world elsewhere.


BROWSER COMPATIBILITY
---------------------
Requires a browser with:
  - Canvas 2D API         (all modern browsers)
  - Web Audio API         (all modern browsers; note: mobile browsers may
                           require a user gesture before audio plays — the
                           M key press counts as one)
  - ES6 classes           (Chrome 49+, Firefox 45+, Safari 10+, Edge 14+)

Tested in: Chrome 120+, Firefox 121+, Safari 17+.


KNOWN ISSUES (patched by patches.js)
--------------------------------------
1. CRITICAL — window.CosmosUI constructor mismatch
   ui.js exports `window.CosmosUI` as a pre-constructed singleton object, but
   app.js calls `new window.CosmosUI()`.  patches.js wraps the singleton so
   that `new window.CosmosUI()` returns the existing instance instead of
   throwing "TypeError: window.CosmosUI is not a constructor".

2. UI — #controls-hint overwrite
   ui.js builds a structured <span>/<br> hint element inside init().
   app.js then overwrites it with a flat textContent string, destroying the
   formatted layout.  patches.js seals the textContent setter on that element
   so app.js's assignment becomes a no-op.

3. UI — Missing civilization and resources in World Panel
   showWorldPanel() only renders a fixed set of stat keys (population,
   temperature, atmosphere, age, gravity, discovered).  The worldgen module
   also returns `civilization` (string) and `resources` (array of 3 strings)
   which were silently dropped.  patches.js wraps showWorldPanel to append
   those two rows after the original render.

4. AUDIO — Music toggle breaks after first stop
   AudioEngine.stop() called ctx.suspend(), leaving the AudioContext in a
   suspended state.  Toggling music back on called init() which returned
   early because isInitialized was still true, so no sound was produced.
   patches.js patches stop() to call ctx.close() and reset isInitialized to
   false, so the next init() creates a fresh AudioContext correctly.
