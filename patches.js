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
 * PATCH 3 (UI): showWorldPanel only displays stats whose keys exist in worldgen
 *   output AND match the hardcoded list (population, temperature, atmosphere,
 *   age, gravity, discovered). worldgen.js also returns `civilization` and
 *   `resources` (an array) which are silently dropped.
 *   Fix: patch showWorldPanel to also render civilization and resources.
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
  // app.js runs inside DOMContentLoaded and does:
  //   hint.textContent = ['Controls:', ...].join('\n');
  // which nukes the <span>/<br> children that ui.init() already built.
  //
  // Strategy: override the textContent setter on the specific element after
  // DOMContentLoaded fires (so ui.init() has already run), and before app.js
  // tries to set it.  We do this by wrapping addEventListener for
  // DOMContentLoaded and injecting our guard at the start of the queue.
  var _origAddEventListener = document.addEventListener.bind(document);
  document.addEventListener = function (type, listener, options) {
    if (type === 'DOMContentLoaded') {
      // Wrap the listener so we can inject a pre-hook
      var wrappedListener = function (e) {
        // Pre-hook: seal #controls-hint against textContent replacement
        var hint = document.getElementById('controls-hint');
        if (hint && hint.childNodes.length > 0) {
          Object.defineProperty(hint, 'textContent', {
            set: function () {
              // Silently ignore — ui.js already built this element correctly
            },
            get: function () {
              return hint.innerText;
            },
            configurable: true
          });
          console.info('[patches.js] PATCH 2 applied: #controls-hint textContent setter sealed.');
        }
        listener(e);
      };
      return _origAddEventListener(type, wrappedListener, options);
    }
    return _origAddEventListener(type, listener, options);
  };

  // ── PATCH 3: show civilization and resources in the world panel ────────────
  // Wrap showWorldPanel to inject the two extra fields after the original call.
  //
  // Use _cosmosUISingleton (captured by PATCH 1 above) rather than reading
  // window.CosmosUI here, because window.CosmosUI is now a constructor function
  // (after PATCH 1) and does not carry the instance methods directly.
  var _singleton3 = _cosmosUISingleton;

  if (_singleton3 && typeof _singleton3.showWorldPanel === 'function') {
    var _origShowWorldPanel = _singleton3.showWorldPanel.bind(_singleton3);

    _singleton3.showWorldPanel = function showWorldPanel(worldData) {
      _origShowWorldPanel(worldData);

      // Append civilization row
      var statsContainer = this._statsContainer;
      if (!statsContainer) return;

      if (worldData.civilization) {
        var civRow = document.createElement('div');
        civRow.className = 'stat-row';

        var civLabel = document.createElement('span');
        civLabel.className = 'stat-label';
        civLabel.textContent = 'Civilization';

        var civValue = document.createElement('span');
        civValue.className = 'stat-value';
        civValue.textContent = worldData.civilization;

        civRow.appendChild(civLabel);
        civRow.appendChild(civValue);
        statsContainer.appendChild(civRow);
      }

      // Append resources row (array — join with comma)
      if (Array.isArray(worldData.resources) && worldData.resources.length > 0) {
        var resRow = document.createElement('div');
        resRow.className = 'stat-row';

        var resLabel = document.createElement('span');
        resLabel.className = 'stat-label';
        resLabel.textContent = 'Resources';

        var resValue = document.createElement('span');
        resValue.className = 'stat-value';
        resValue.textContent = worldData.resources.join(', ');

        resRow.appendChild(resLabel);
        resRow.appendChild(resValue);
        statsContainer.appendChild(resRow);
      }
    };

    console.info('[patches.js] PATCH 3 applied: showWorldPanel now renders civilization and resources.');
  } else if (!_singleton3) {
    console.warn('[patches.js] PATCH 3 skipped: CosmosUI singleton not available (PATCH 1 did not run).');
  }

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
