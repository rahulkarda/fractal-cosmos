/**
 * patches.js — Integration fixes loaded between ui.js and app.js.
 *
 * PATCH 1 (Critical): window.CosmosUI is a singleton instance in ui.js,
 *   but app.js calls `new window.CosmosUI()` which throws
 *   "TypeError: window.CosmosUI is not a constructor".
 *   Fix: wrap the singleton in a factory constructor so `new window.CosmosUI()`
 *   returns the existing singleton rather than crashing.
 *
 * PATCH 2 (UI): app.js overwrites the #controls-hint innerHTML that ui.js
 *   already built, replacing structured <span> children with a flat textContent
 *   string. Fix: monkey-patch DOMContentLoaded so app.js's hint block is a
 *   no-op when the element already contains child nodes.
 *
 * PATCH 4 (Audio): AudioEngine.stop() calls ctx.suspend() but never resumes
 *   the context when music is toggled back on, silencing all future playback.
 *   Fix: patch stop() to call ctx.close() instead, and patch init() to always
 *   create a fresh AudioContext so the next toggle works correctly.
 */

(function () {
  'use strict';

  // ── PATCH 1: make window.CosmosUI constructable ────────────────────────────
  // ui.js sets window.CosmosUI = new CosmosUI()  (a plain object / instance).
  // app.js does: ui = new window.CosmosUI();  — this throws in strict mode
  // because a plain object is not a constructor function.
  //
  // Strategy: replace window.CosmosUI with a constructor function whose
  // `new` operator always returns the singleton that ui.js already created.
  //
  // We also capture the singleton in a module-level variable so that PATCH 3
  // can reference the real instance object regardless of what window.CosmosUI
  // points to after this patch runs.
  var _cosmosUISingleton = null; // set below

  if (window.CosmosUI && typeof window.CosmosUI !== 'function') {
    // Normal case: ui.js exposed a plain instance object.
    _cosmosUISingleton = window.CosmosUI;

    // ES5 constructor — returning an object from `new` replaces `this`
    window.CosmosUI = function CosmosUI() {
      return _cosmosUISingleton;
    };

    // Preserve all own properties on the constructor itself so that code
    // referencing window.CosmosUI.someMethod directly still works.
    Object.keys(_cosmosUISingleton).forEach(function (key) {
      window.CosmosUI[key] = _cosmosUISingleton[key];
    });

    console.info('[patches.js] PATCH 1 applied: window.CosmosUI is now constructable.');
  } else if (window.CosmosUI && typeof window.CosmosUI === 'function') {
    // Edge case: window.CosmosUI is already a constructor function.
    // Instantiate it once to get the singleton, then wrap it to always return
    // that same instance so repeated `new window.CosmosUI()` calls are safe.
    try {
      var _existingInstance = new window.CosmosUI();
      if (_existingInstance && typeof _existingInstance.init === 'function') {
        // It already constructs a usable instance — use it as the singleton.
        _cosmosUISingleton = _existingInstance;
        var _OrigCosmosUI = window.CosmosUI;
        window.CosmosUI = function CosmosUI() {
          return _cosmosUISingleton;
        };
        // Copy static methods from original constructor
        Object.keys(_OrigCosmosUI).forEach(function (key) {
          window.CosmosUI[key] = _OrigCosmosUI[key];
        });
        console.info('[patches.js] PATCH 1 (constructor branch) applied: singleton captured and window.CosmosUI wrapped.');
      } else {
        console.warn('[patches.js] PATCH 1 skipped: window.CosmosUI is a function but constructed instance lacks init(). app.js will proceed; a missing init() will be caught by its own guard.');
      }
    } catch (e) {
      console.warn('[patches.js] PATCH 1 skipped: constructing window.CosmosUI threw:', e);
    }
  } else {
    console.warn('[patches.js] PATCH 1 skipped: window.CosmosUI is not defined at patches.js load time. Check ui.js script order.');
  }

  // ── PATCH 2: prevent app.js from clobbering #controls-hint ────────────────
  // app.js (inside DOMContentLoaded) does:
  //   while (hint.firstChild) hint.removeChild(hint.firstChild);   // clear
  //   hint.appendChild(...)  // rebuild as grid
  // This destroys the three-line SCROLL/DRAG/CLICK hint that ui.init() already built.
  //
  // The original approach (sealing textContent in a pre-hook) failed on two grounds:
  //   1. The pre-hook fires before ui.init() so #controls-hint does not exist yet.
  //   2. app.js uses removeChild/appendChild, not textContent assignment.
  //
  // Fix: use a post-hook (runs after listener(e) returns, i.e. after app.js finishes)
  // to restore ui.js's original hint children, discarding app.js's grid rebuild.
  //
  // We capture ui.js's children immediately after DOMContentLoaded fires and ui.init()
  // has built them, store them, then re-insert them after app.js has run.
  var _origAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded') {
      var wrappedListener = function (e) {
        // Pre-hook: snapshot the hint children AFTER ui.init() runs.
        // ui.init() is called synchronously inside the DOMContentLoaded callback
        // that app.js registers. At this point (just before app.js's listener runs)
        // the hint does NOT yet exist — so we capture it in the post-hook instead.

        // Run the original app.js DOMContentLoaded callback
        listener(e);

        // Post-hook: restore ui.js's #controls-hint if app.js clobbered it.
        // ui.init() built the hint with SCROLL/DRAG/CLICK spans. app.js rebuilt it
        // as a 13-row two-column grid. We prefer ui.js's version, so we restore it.
        //
        // Strategy: if the singleton already has the original hint children stored
        // on _cosmosUISingleton, we can re-query from it. But simpler: just rebuild
        // the three-span hint here, since we know exactly what ui.js creates.
        var hint = document.getElementById('controls-hint');
        if (hint) {
          // Remove whatever app.js put in
          while (hint.firstChild) hint.removeChild(hint.firstChild);

          // Reset grid styles that app.js set
          hint.style.display = '';
          hint.style.gridTemplateColumns = '';
          hint.style.columnGap = '';
          hint.style.rowGap = '';

          // Rebuild ui.js's original three-line layout
          var lines = [
            'SCROLL — zoom',
            'DRAG   — pan',
            'CLICK  — inspect world',
          ];
          lines.forEach(function (line) {
            var span = document.createElement('span');
            span.textContent = line;
            var br = document.createElement('br');
            hint.appendChild(span);
            hint.appendChild(br);
          });

          console.info('[patches.js] PATCH 2 applied: #controls-hint restored to ui.js layout.');
        }
      };
      return _origAddEventListener(type, wrappedListener, options);
    }
    return _origAddEventListener(type, listener, options);
  };

  // ── PATCH 4: fix AudioEngine resume after stop() ──────────────────────────
  // AudioEngine.stop() calls this.ctx.suspend().  A suspended AudioContext
  // cannot be re-used for new oscillators — playBiome() silently produces no
  // sound on the next toggle.  Fix: close the context on stop() and set
  // this.ctx = null, then let init() create a brand-new AudioContext.
  if (window.AudioEngine && typeof window.AudioEngine === 'function') {
    var _AudioEngineProto = window.AudioEngine.prototype;

    if (typeof _AudioEngineProto.stop === 'function') {
      var _origStop = _AudioEngineProto.stop;

      _AudioEngineProto.stop = function stop() {
        this.stopBiome();
        if (this.ctx) {
          try { this.ctx.close(); } catch (e) { /* ignore */ }
          this.ctx          = null;
          this.masterGain   = null;
          this.reverb       = null;
          this.isInitialized = false;
        }
      };

      console.info('[patches.js] PATCH 4 applied: AudioEngine.stop() now closes AudioContext so re-init works.');
    }
  }

})();
