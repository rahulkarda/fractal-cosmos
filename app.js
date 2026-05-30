// app.js — Cosmos Explorer main entry point
// Depends on globals: window.FractalRenderer, window.WorldGenerator, window.AudioEngine, window.CosmosUI

let canvas, renderer, worldGen, audio, ui;
let cx = -0.5, cy = 0, zoom = 250;
let isDragging = false, dragStartX = 0, dragStartY = 0, dragStartCx = 0, dragStartCy = 0;
let audioOn = false, renderPending = false, lastWorld = null, panelOpen = false;
let isJuliaMode = false, juliaDriftInterval = null;

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  setTimeout(function () {
    renderPending = false;
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
function toggleJulia() {
  if (!isJuliaMode) {
    isJuliaMode = true;
    renderer.setMode('julia', cx, cy);
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
  }
  scheduleRender();
}

document.addEventListener('DOMContentLoaded', function () {
  // 1. Create and append canvas
  canvas = document.createElement('canvas');
  canvas.id = 'cosmos-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);

  // 2. Instantiate systems
  renderer = new window.FractalRenderer(canvas);
  worldGen  = new window.WorldGenerator();
  audio     = new window.AudioEngine();
  ui        = new window.CosmosUI();
  ui.init();

  // 3. Hash restore — apply before initial render so shared URLs work
  var hashState = window.CosmosUI.parseHash();
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
});
