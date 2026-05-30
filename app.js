// app.js — Cosmos Explorer main entry point
// Depends on globals: window.FractalRenderer, window.WorldGenerator, window.AudioEngine, window.CosmosUI

let canvas, renderer, worldGen, audio, ui;
let cx = -0.5, cy = 0, zoom = 250;
let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartCx = 0, dragStartCy = 0;
let audioOn = false, renderPending = false, lastWorld = null, panelOpen = false;
let isJuliaMode = false, juliaDriftInterval = null;
let savedMandelbrot = null; // stash Mandelbrot view when entering Julia mode

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setTimeout(function () {
    renderPending = false;
    if (!renderer || !ui) return; // guard: called before init completes
    renderer.render(cx, cy, zoom);
    ui.updateCoords(cx, cy, zoom);
    checkWorldDiscovery();
  }, 40);
}

function checkWorldDiscovery() {
  if (zoom > 5e5) {
    var world = worldGen.generate(cx, cy, zoom);
    if (!panelOpen) {
      panelOpen = true;
      ui.flashDiscovery();
      ui.showWorldPanel(world);
      if (audioOn && audio.isInitialized) {
        audio.playBiome(world.biome);
      }
    }
  } else if (panelOpen) {
    panelOpen = false;
    ui.hideWorldPanel();
  }
}

// ── Julia mode toggle (shared logic) ──────────────────────────────────────
// Beautiful pre-chosen Julia constants to cycle through
var JULIA_PRESETS = [
  { r: -0.7,    i:  0.27015 },  // classic spiral
  { r: -0.4,    i:  0.6     },  // dendrite
  { r:  0.285,  i:  0.01    },  // island
  { r: -0.8,    i:  0.156   },  // rabbit
  { r:  0.0,    i:  0.8     },  // san marco
];
var juliaPresetIndex = 0;

function toggleJulia() {
  if (!isJuliaMode) {
    isJuliaMode = true;
    // Save current Mandelbrot view so we can restore it later
    savedMandelbrot = { cx: cx, cy: cy, zoom: zoom };
    // Pick next preset constant
    var preset = JULIA_PRESETS[juliaPresetIndex % JULIA_PRESETS.length];
    juliaPresetIndex++;
    renderer.setMode('julia', preset.r, preset.i);
    // Reset to full view so Julia set is visible — Julia lives in [-2,2]x[-2,2]
    cx = 0; cy = 0; zoom = Math.min(canvas.width, canvas.height) / 4.5;
    // Start slow drift toward current view center every 8 seconds
    juliaDriftInterval = setInterval(function () {
      renderer.juliaC.r += (cx - renderer.juliaC.r) * 0.05;
      renderer.juliaC.i += (cy - renderer.juliaC.i) * 0.05;
      scheduleRender();
    }, 8000);
  } else {
    isJuliaMode = false;
    if (juliaDriftInterval !== null) {
      clearInterval(juliaDriftInterval);
      juliaDriftInterval = null;
    }
    renderer.setMode('mandelbrot');
    // Restore saved Mandelbrot view
    if (savedMandelbrot) {
      cx = savedMandelbrot.cx;
      cy = savedMandelbrot.cy;
      zoom = savedMandelbrot.zoom;
    }
  }
  scheduleRender();
}

document.addEventListener('DOMContentLoaded', function () {
  try {
    // 1. Create and append canvas
    canvas = document.createElement('canvas');
    canvas.id = 'cosmos-canvas';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    // 2. Instantiate systems — guard each constructor so a missing/broken script
    //    produces a clear diagnostic rather than a silent blank canvas.
    if (typeof window.FractalRenderer !== 'function') {
      throw new Error('FractalRenderer is not available (check fractal.js load order)');
    }
    renderer = new window.FractalRenderer(canvas);

    if (typeof window.WorldGenerator !== 'function') {
      throw new Error('WorldGenerator is not available (check worldgen.js load order)');
    }
    worldGen = new window.WorldGenerator();

    if (typeof window.AudioEngine !== 'function') {
      throw new Error('AudioEngine is not available (check audio.js load order)');
    }
    audio = new window.AudioEngine();

    if (typeof window.CosmosUI !== 'function') {
      throw new Error('CosmosUI is not available (check ui.js / patches.js load order)');
    }
    ui = new window.CosmosUI();

    if (typeof ui.init !== 'function') {
      throw new Error('CosmosUI instance is missing init() — patches.js PATCH 1 may not have applied correctly');
    }
    ui.init();

    // 3. Hash restore — apply before initial render so shared URLs work
    // Parse URL hash inline — avoids dependency on CosmosUI static method
    var hashState = (function() {
      var hash = window.location.hash;
      if (!hash || hash.length < 2) return null;
      var raw = hash.slice(1);
      var params = {};
      raw.split('&').forEach(function(part) {
        var eqIdx = part.indexOf('=');
        if (eqIdx === -1) return;
        params[decodeURIComponent(part.slice(0, eqIdx))] = decodeURIComponent(part.slice(eqIdx + 1));
      });
      if (params.cx === undefined || params.cy === undefined || params.zoom === undefined) return null;
      var pcx = parseFloat(params.cx), pcy = parseFloat(params.cy), pzoom = parseFloat(params.zoom);
      if (isNaN(pcx) || isNaN(pcy) || isNaN(pzoom)) return null;
      return { cx: pcx, cy: pcy, zoom: pzoom };
    })();

    if (hashState && hashState.cx !== undefined && hashState.cy !== undefined && hashState.zoom !== undefined) {
      cx   = hashState.cx;
      cy   = hashState.cy;
      zoom = hashState.zoom;
    }

    // 4. Initial render
    renderer.render(cx, cy, zoom);
    ui.updateCoords(cx, cy, zoom);

    // ── Canvas: wheel (zoom centred on cursor) ──────────────────────────────
    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var factor = e.deltaY < 0 ? 1.6 : 0.625;
      cx += (e.clientX - canvas.width  / 2) / zoom * (1 - 1 / factor);
      cy += (e.clientY - canvas.height / 2) / zoom * (1 - 1 / factor);
      zoom = Math.min(1e14, Math.max(60, zoom * factor));
      scheduleRender();
    }, { passive: false });

    // ── Canvas: mouse drag ──────────────────────────────────────────────────
    canvas.addEventListener('mousedown', function (e) {
      isDragging = true;
      dragStartX  = e.clientX;
      dragStartY  = e.clientY;
      dragStartCx = cx;
      dragStartCy = cy;
    });

    canvas.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      cx = dragStartCx - (e.clientX - dragStartX) / zoom;
      cy = dragStartCy - (e.clientY - dragStartY) / zoom;
      scheduleRender();
    });

    canvas.addEventListener('mouseup', function () {
      isDragging = false;
    });

    canvas.addEventListener('mouseleave', function () {
      isDragging = false;
    });

    // ── Canvas: double-click zoom in x3 centred on cursor ──────────────────
    canvas.addEventListener('dblclick', function (e) {
      var factor = 3;
      cx += (e.clientX - canvas.width  / 2) / zoom * (1 - 1 / factor);
      cy += (e.clientY - canvas.height / 2) / zoom * (1 - 1 / factor);
      zoom = Math.min(1e14, zoom * factor);
      scheduleRender();
    });

    // ── Canvas: right-click zoom out x3 centred on click ───────────────────
    canvas.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      var factor = 3;
      // Zoom out: divide zoom by factor, adjust centre so click point stays fixed
      cx += (e.clientX - canvas.width  / 2) / zoom * (1 - factor);
      cy += (e.clientY - canvas.height / 2) / zoom * (1 - factor);
      zoom = Math.max(60, zoom / factor);
      scheduleRender();
    });

    // ── Window: keyboard shortcuts ──────────────────────────────────────────
    window.addEventListener('keydown', function (e) {
      // Ignore numpad digit keys (location 3) for theme switching
      var isNumpad = (e.location === 3);

      switch (e.key) {
        case 'r':
        case 'R':
          cx = -0.5;
          cy = 0;
          zoom = 250;
          panelOpen = false;
          ui.hideWorldPanel();
          scheduleRender();
          break;

        case 'm':
        case 'M':
          if (!audioOn) {
            audioOn = true;
            if (!audio.isInitialized) {
              audio.init();
            }
            audio.playBiome('void');
          } else {
            audioOn = false;
            audio.stop();
          }
          break;

        case '+':
        case '=':
          zoom = Math.min(1e14, zoom * 1.5);
          scheduleRender();
          break;

        case '-':
        case '_':
          zoom = Math.max(60, zoom * 0.667);
          scheduleRender();
          break;

        // Julia mode toggle
        case 'j':
        case 'J':
          toggleJulia();
          break;

        // Bookmarks
        case 'b':
        case 'B': {
          var label = cx.toFixed(4) + ', ' + cy.toFixed(4);
          ui.addBookmark(cx, cy, zoom, label);
          break;
        }

        // Screenshot
        case 's':
        case 'S':
          ui.captureScreenshot(canvas);
          break;

        // Color themes: digit keys 1-5 (not numpad)
        case '1':
          if (!isNumpad) { renderer.setTheme(0); scheduleRender(); }
          break;
        case '2':
          if (!isNumpad) { renderer.setTheme(1); scheduleRender(); }
          break;
        case '3':
          if (!isNumpad) { renderer.setTheme(2); scheduleRender(); }
          break;
        case '4':
          if (!isNumpad) { renderer.setTheme(3); scheduleRender(); }
          break;
        case '5':
          if (!isNumpad) { renderer.setTheme(4); scheduleRender(); }
          break;

        default:
          break;
      }
    });

    // ── Window: resize ──────────────────────────────────────────────────────
    window.addEventListener('resize', function () {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      scheduleRender();
    });

    // ── Custom events from UI / other modules ──────────────────────────────

    // Julia mode toggle event
    window.addEventListener('cosmos:toggleJulia', function () {
      toggleJulia();
    });

    // Color theme event
    window.addEventListener('cosmos:setTheme', function (e) {
      var index = e.detail && e.detail.index !== undefined ? e.detail.index : 0;
      renderer.setTheme(index);
      scheduleRender();
    });

    // Bookmark save event (detail carries cx/cy/zoom/label if caller wants to override)
    // cosmos:gotoBookmark restores a saved view
    window.addEventListener('cosmos:gotoBookmark', function (e) {
      if (!e.detail) return;
      if (e.detail.cx   !== undefined) cx   = e.detail.cx;
      if (e.detail.cy   !== undefined) cy   = e.detail.cy;
      if (e.detail.zoom !== undefined) zoom = e.detail.zoom;
      scheduleRender();
    });

    // ── Controls hint (bottom-right) ────────────────────────────────────────
    var hint = document.getElementById('controls-hint');
    if (!hint) {
      hint = document.createElement('div');
      hint.id = 'controls-hint';
      document.body.appendChild(hint);
    }
    hint.textContent = [
      'Controls:',
      'Scroll          — zoom in / out',
      'Drag            — pan',
      'Double-click    — zoom in x3',
      'Right-click     — zoom out x3',
      'R               — reset view',
      'M               — toggle music',
      '+ / =           — zoom in',
      '- / _           — zoom out',
      'J               — toggle Julia mode',
      '1-5             — color themes',
      'B               — save bookmark',
      'S               — screenshot'
    ].join('\n');
  } catch(err) {
    console.error('COSMOS INIT ERROR:', err);
  }
});
