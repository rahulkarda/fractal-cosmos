// autopilot.js — Auto-Pilot Explorer for Cosmos Fractal Viewer
// Pure vanilla JS, no imports. Exposes window.AutoPilot (class).

(function () {
  'use strict';

  const DESTINATIONS = [
    { cx: -0.7269,  cy:  0.1889,  targetZoom: 8e8,  name: 'Spiral Arms'     },
    { cx: -0.5,     cy:  0.5,     targetZoom: 2e6,  name: 'Seahorse Valley' },
    { cx:  0.0,     cy:  0.6500,  targetZoom: 5e7,  name: 'Elephant Valley' },
    { cx: -1.4012,  cy:  0.0,     targetZoom: 3e9,  name: 'Deep Tip'        },
    { cx: -0.1011,  cy:  0.9563,  targetZoom: 1e8,  name: 'Crown'           },
    { cx: -1.2568,  cy:  0.3786,  targetZoom: 6e7,  name: 'Mini Brot'       },
    { cx: -0.7436,  cy:  0.1319,  targetZoom: 2e10, name: 'Infinity Spiral' },
    { cx:  0.3001,  cy:  0.0200,  targetZoom: 4e6,  name: 'Island'          },
    { cx: -1.7686,  cy:  0.0042,  targetZoom: 9e7,  name: 'Antennas'        },
    { cx: -0.6180,  cy:  0.6623,  targetZoom: 5e8,  name: 'Dragon'          },
    { cx: -0.8683,  cy:  0.2320,  targetZoom: 3e7,  name: 'Starfish'        },
    { cx: -0.1592,  cy:  1.0317,  targetZoom: 7e6,  name: 'Tendrils'        },
  ];

  // Timing constants — generous so the viewer can breathe
  const DURATION_PULLBACK = 3500;   // ease back to overview
  const DURATION_PAN      = 3000;   // glide across
  const DURATION_ZOOM_IN  = 9000;   // slow cinematic zoom in
  const DURATION_HOVER    = 8000;   // long pause — read the world panel, enjoy the view

  const HOME_CX   = -0.5;
  const HOME_CY   =  0.0;
  const HOME_ZOOM =  300;

  // ---------------------------------------------------------------------------
  // Easing
  // ---------------------------------------------------------------------------

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // Extra-smooth ease for zoom: ease-in-out quintic so start/end are ultra-gentle
  function easeInOutQuint(t) {
    return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
  }

  function lerpLinear(a, b, t) {
    return a + (b - a) * t;
  }

  // Exponential zoom interpolation — the only correct way to interpolate zoom
  function lerpZoom(startZoom, targetZoom, t) {
    if (startZoom <= 0 || targetZoom <= 0) return lerpLinear(startZoom, targetZoom, t);
    return startZoom * Math.pow(targetZoom / startZoom, t);
  }

  // ---------------------------------------------------------------------------
  // AutoPilot
  // ---------------------------------------------------------------------------

  class AutoPilot {
    constructor(getState, setState, scheduleRender, getRenderer) {
      this.getState       = getState;
      this.setState       = setState;
      this.scheduleRender = scheduleRender;
      this.getRenderer    = getRenderer;   // () => renderer — for fast render during flight

      this.isRunning  = false;
      this._rafId     = null;
      this._destIndex = 0;
      this._phases    = [];
      this._phaseIdx  = 0;
      this._phase     = null;
    }

    start() {
      if (this.isRunning) return;
      this.isRunning  = true;
      this._destIndex = 0;
      this._beginDestination();
    }

    stop() {
      this.isRunning = false;
      if (this._rafId !== null) {
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
      }
      this._phase = null;
      window.dispatchEvent(new CustomEvent('cosmos:autopilotStatus', {
        detail: { active: false, destination: '' }
      }));
      // Trigger a full-quality re-render after stopping
      this.scheduleRender();
    }

    _beginDestination() {
      if (!this.isRunning) return;
      const dest = DESTINATIONS[this._destIndex % DESTINATIONS.length];

      window.dispatchEvent(new CustomEvent('cosmos:autopilotStatus', {
        detail: { active: true, destination: dest.name }
      }));

      const snap = this.getState();
      this._buildPhases(snap, dest);
      this._rafId = requestAnimationFrame((t) => this._tick(t));
    }

    _buildPhases(snap, dest) {
      this._phases = [
        {
          name: 'PULLBACK', startMs: null, duration: DURATION_PULLBACK,
          startCx: snap.cx, startCy: snap.cy, startZoom: snap.zoom,
          endCx: HOME_CX,   endCy: HOME_CY,   endZoom: HOME_ZOOM,
        },
        {
          name: 'PAN', startMs: null, duration: DURATION_PAN,
          startCx: HOME_CX,  startCy: HOME_CY,  startZoom: HOME_ZOOM,
          endCx:   dest.cx,  endCy:   dest.cy,  endZoom:   HOME_ZOOM,
        },
        {
          name: 'ZOOM_IN', startMs: null, duration: DURATION_ZOOM_IN,
          startCx: dest.cx, startCy: dest.cy, startZoom: HOME_ZOOM,
          endCx:   dest.cx, endCy:   dest.cy, endZoom:   dest.targetZoom,
        },
        {
          name: 'HOVER', startMs: null, duration: DURATION_HOVER,
          startCx: dest.cx, startCy: dest.cy, startZoom: dest.targetZoom,
          endCx:   dest.cx, endCy:   dest.cy, endZoom:   dest.targetZoom,
        },
      ];
      this._phaseIdx = 0;
      this._phase    = this._phases[0];
    }

    _tick(now) {
      if (!this.isRunning) return;
      this._rafId = requestAnimationFrame((t) => this._tick(t));

      const phase = this._phase;
      if (!phase) return;

      if (phase.startMs === null) {
        phase.startMs = now;

        // When HOVER begins: fire a full-quality render once so the viewer
        // sees crisp detail, then don't re-render during the hover pause.
        if (phase.name === 'HOVER') {
          this.scheduleRender();
        }
      }

      const elapsed = now - phase.startMs;
      const rawT    = Math.min(elapsed / phase.duration, 1.0);

      if (phase.name === 'HOVER') {
        // Hold still — no rendering needed until the phase ends
        if (rawT >= 1.0) this._advancePhase();
        return;
      }

      // Choose easing: quintic for zoom, cubic for panning
      let cx, cy, zoom;
      if (phase.name === 'ZOOM_IN') {
        const easedT = easeInOutQuint(rawT);
        cx   = phase.endCx;
        cy   = phase.endCy;
        zoom = lerpZoom(phase.startZoom, phase.endZoom, easedT);
      } else {
        const easedT = easeInOutCubic(rawT);
        cx   = lerpLinear(phase.startCx, phase.endCx, easedT);
        cy   = lerpLinear(phase.startCy, phase.endCy, easedT);
        zoom = lerpZoom(phase.startZoom, phase.endZoom, easedT);
      }

      this.setState(cx, cy, zoom);

      // During flight: use fast low-res render directly — bypasses the 40ms
      // debounce in scheduleRender so every RAF frame actually renders.
      const renderer = this.getRenderer ? this.getRenderer() : null;
      if (renderer && typeof renderer.renderFast === 'function') {
        renderer.renderFast(cx, cy, zoom);
        // Still call scheduleRender for coord HUD + trail updates (debounced,
        // so it fires at most every 40ms rather than every frame)
        this.scheduleRender();
      } else {
        this.scheduleRender();
      }

      if (rawT >= 1.0) this._advancePhase();
    }

    _advancePhase() {
      this._phaseIdx += 1;
      if (this._phaseIdx < this._phases.length) {
        this._phase = this._phases[this._phaseIdx];
      } else {
        this._destIndex = (this._destIndex + 1) % DESTINATIONS.length;
        cancelAnimationFrame(this._rafId);
        this._rafId = null;
        this._beginDestination();
      }
    }
  }

  window.AutoPilot = AutoPilot;
})();
