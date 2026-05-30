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

  // Duration constants (ms) for each flight phase.
  const DURATION_PULLBACK = 2500;
  const DURATION_PAN      = 2000;
  const DURATION_ZOOM_IN  = 5000;
  const DURATION_HOVER    = 3000;

  // Home position used during PULLBACK and as PAN start.
  const HOME_CX   = -0.5;
  const HOME_CY   =  0.0;
  const HOME_ZOOM =  300;

  // ---------------------------------------------------------------------------
  // Easing helpers
  // ---------------------------------------------------------------------------

  function easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function lerpLinear(a, b, t) {
    return a + (b - a) * t;
  }

  // Exponential zoom interpolation: startZoom * (targetZoom/startZoom)^t
  function lerpZoom(startZoom, targetZoom, t) {
    if (startZoom <= 0 || targetZoom <= 0) return lerpLinear(startZoom, targetZoom, t);
    return startZoom * Math.pow(targetZoom / startZoom, t);
  }

  // ---------------------------------------------------------------------------
  // AutoPilot class
  // ---------------------------------------------------------------------------

  class AutoPilot {
    /**
     * @param {() => {cx: number, cy: number, zoom: number}} getState
     *   Returns the current viewport state from app.js globals.
     * @param {(cx: number, cy: number, zoom: number) => void} setState
     *   Writes cx, cy, zoom back into app.js globals.
     * @param {() => void} scheduleRender
     *   Triggers a debounced render (app.js scheduleRender).
     */
    constructor(getState, setState, scheduleRender) {
      this.getState      = getState;
      this.setState      = setState;
      this.scheduleRender = scheduleRender;

      this.isRunning  = false;
      this._rafId     = null;
      this._destIndex = 0;
      this._phase     = null; // current phase descriptor object
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

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
    }

    // -------------------------------------------------------------------------
    // Internal: destination sequencing
    // -------------------------------------------------------------------------

    _beginDestination() {
      if (!this.isRunning) return;

      const dest = DESTINATIONS[this._destIndex % DESTINATIONS.length];

      // Announce this destination to any UI listeners.
      window.dispatchEvent(new CustomEvent('cosmos:autopilotStatus', {
        detail: { active: true, destination: dest.name }
      }));

      // Capture the state at the moment we start this destination.
      const snap = this.getState();

      // Build the phase sequence for this destination.
      this._buildPhases(snap, dest);

      // Kick off the RAF loop.
      this._rafId = requestAnimationFrame((t) => this._tick(t));
    }

    // -------------------------------------------------------------------------
    // Internal: phase construction
    // -------------------------------------------------------------------------

    /**
     * Builds a sequential list of phase descriptors.
     * Each phase has:
     *   { name, startMs, duration, startCx, startCy, startZoom,
     *     endCx, endCy, endZoom }
     * startMs is filled in lazily on first entry into each phase.
     */
    _buildPhases(snap, dest) {
      // Phase A — PULLBACK: animate from current position back to home view.
      const phaseA = {
        name:      'PULLBACK',
        startMs:   null,           // set when phase first becomes active
        duration:  DURATION_PULLBACK,
        startCx:   snap.cx,
        startCy:   snap.cy,
        startZoom: snap.zoom,
        endCx:     HOME_CX,
        endCy:     HOME_CY,
        endZoom:   HOME_ZOOM,
      };

      // Phase B — PAN: slide from home to destination cx/cy at overview zoom.
      const phaseB = {
        name:      'PAN',
        startMs:   null,
        duration:  DURATION_PAN,
        startCx:   HOME_CX,
        startCy:   HOME_CY,
        startZoom: HOME_ZOOM,
        endCx:     dest.cx,
        endCy:     dest.cy,
        endZoom:   HOME_ZOOM,
      };

      // Phase C — ZOOM_IN: zoom in exponentially to target depth.
      const phaseC = {
        name:      'ZOOM_IN',
        startMs:   null,
        duration:  DURATION_ZOOM_IN,
        startCx:   dest.cx,
        startCy:   dest.cy,
        startZoom: HOME_ZOOM,
        endCx:     dest.cx,
        endCy:     dest.cy,
        endZoom:   dest.targetZoom,
      };

      // Phase D — HOVER: hold still at destination.
      const phaseD = {
        name:      'HOVER',
        startMs:   null,
        duration:  DURATION_HOVER,
        startCx:   dest.cx,
        startCy:   dest.cy,
        startZoom: dest.targetZoom,
        endCx:     dest.cx,
        endCy:     dest.cy,
        endZoom:   dest.targetZoom,
      };

      this._phases    = [phaseA, phaseB, phaseC, phaseD];
      this._phaseIdx  = 0;
      this._phase     = this._phases[0];
    }

    // -------------------------------------------------------------------------
    // Internal: RAF tick
    // -------------------------------------------------------------------------

    _tick(now) {
      if (!this.isRunning) return;

      // Re-schedule next frame immediately so we keep looping.
      this._rafId = requestAnimationFrame((t) => this._tick(t));

      const phase = this._phase;
      if (!phase) return;

      // Record phase start time on first entry.
      if (phase.startMs === null) {
        phase.startMs = now;
      }

      const elapsed = now - phase.startMs;
      const rawT    = Math.min(elapsed / phase.duration, 1.0);

      // Compute eased progress (HOVER uses no easing — it holds position).
      let cx, cy, zoom;

      if (phase.name === 'HOVER') {
        cx   = phase.endCx;
        cy   = phase.endCy;
        zoom = phase.endZoom;
      } else if (phase.name === 'ZOOM_IN') {
        // cx/cy hold; zoom interpolates exponentially with easing.
        const easedT = easeInOutCubic(rawT);
        cx   = phase.endCx;
        cy   = phase.endCy;
        zoom = lerpZoom(phase.startZoom, phase.endZoom, easedT);
      } else {
        // PULLBACK and PAN: linear interpolate cx/cy, zoom with easing.
        const easedT = easeInOutCubic(rawT);
        cx   = lerpLinear(phase.startCx, phase.endCx, easedT);
        cy   = lerpLinear(phase.startCy, phase.endCy, easedT);
        zoom = lerpZoom(phase.startZoom, phase.endZoom, easedT);
      }

      this.setState(cx, cy, zoom);
      this.scheduleRender();

      // Advance phase when complete.
      if (rawT >= 1.0) {
        this._phaseIdx += 1;

        if (this._phaseIdx < this._phases.length) {
          // Move to the next phase in the sequence.
          this._phase = this._phases[this._phaseIdx];
        } else {
          // All phases for this destination are done — move to next destination.
          this._destIndex = (this._destIndex + 1) % DESTINATIONS.length;

          // Cancel the current RAF before _beginDestination restarts it.
          cancelAnimationFrame(this._rafId);
          this._rafId = null;

          this._beginDestination();
        }
      }
    }
  }

  // Expose on window so app.js (and other scripts loaded after this one) can
  // instantiate it.
  window.AutoPilot = AutoPilot;

})();
