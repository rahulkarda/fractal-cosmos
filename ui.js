(function () {
  'use strict';

  const BIOME_COLORS = {
    crystal:    '#88eeff',
    organic:    '#44ff88',
    mechanical: '#ff8844',
    void:       '#8844ff',
    radiant:    '#ffdd44',
  };

  const THEME_COLORS = [
    '#88eeff',
    '#44ff88',
    '#ff8844',
    '#8844ff',
    '#ffdd44',
  ];

  class CosmosUI {
    constructor() {
      this._coordXSpan    = null;
      this._coordYSpan    = null;
      this._coordZoomSpan = null;
      this._worldPanel    = null;
      this._planetName    = null;
      this._biomeBadge    = null;
      this._statsContainer = null;
      this._dangerFill    = null;
      this._historyText   = null;
      this._flashDiv      = null;

      // Julia mode toggle button
      this._juliaModeBtn  = null;
      this._isJuliaMode   = false;

      // Bookmark panel
      this._bookmarkPanel = null;
      this._bookmarkList  = null;
      this._bookmarks     = [];

      // Theme switcher
      this._themeSwitcher = null;

      // Minimap
      this._minimapCanvas = null;
      this._minimapCtx    = null;
      this._trail         = [];
      this._minimapBg     = null;
    }

    init() {
      // ── #coords ──────────────────────────────────────────────────
      const coords = document.createElement('div');
      coords.id = 'coords';

      const xLabel = document.createElement('span');
      xLabel.className = 'label';
      xLabel.textContent = 'X COORD';

      this._coordXSpan = document.createElement('span');
      this._coordXSpan.className = 'value';
      this._coordXSpan.textContent = '0.000';

      const yLabel = document.createElement('span');
      yLabel.className = 'label';
      yLabel.textContent = 'Y COORD';

      this._coordYSpan = document.createElement('span');
      this._coordYSpan.className = 'value';
      this._coordYSpan.textContent = '0.000';

      const zoomLabel = document.createElement('span');
      zoomLabel.className = 'label';
      zoomLabel.textContent = 'ZOOM';

      this._coordZoomSpan = document.createElement('span');
      this._coordZoomSpan.className = 'value';
      this._coordZoomSpan.textContent = '1.0x';

      coords.appendChild(xLabel);
      coords.appendChild(this._coordXSpan);
      coords.appendChild(yLabel);
      coords.appendChild(this._coordYSpan);
      coords.appendChild(zoomLabel);
      coords.appendChild(this._coordZoomSpan);

      document.body.appendChild(coords);

      // ── #world-panel ─────────────────────────────────────────────
      const panel = document.createElement('div');
      panel.id = 'world-panel';
      this._worldPanel = panel;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-btn';
      closeBtn.textContent = '×';
      closeBtn.addEventListener('click', () => this.hideWorldPanel());
      panel.appendChild(closeBtn);

      const panelTitle = document.createElement('div');
      panelTitle.className = 'panel-title';
      panelTitle.textContent = 'World Details';
      panel.appendChild(panelTitle);

      this._planetName = document.createElement('div');
      this._planetName.className = 'planet-name';
      panel.appendChild(this._planetName);

      this._biomeBadge = document.createElement('span');
      this._biomeBadge.className = 'biome-badge';
      panel.appendChild(this._biomeBadge);

      // Stats section — pre-build rows for known stats
      this._statsContainer = document.createElement('div');
      this._statsContainer.id = 'stats-container';

      // We will build rows dynamically in showWorldPanel, but
      // pre-create the danger row since it has a nested bar.
      panel.appendChild(this._statsContainer);

      // Danger bar (rendered after stats)
      const dangerLabel = document.createElement('span');
      dangerLabel.className = 'label';
      dangerLabel.textContent = 'DANGER LEVEL';
      panel.appendChild(dangerLabel);

      const dangerBar = document.createElement('div');
      dangerBar.className = 'danger-bar';

      this._dangerFill = document.createElement('div');
      this._dangerFill.className = 'danger-fill';
      this._dangerFill.style.width = '0%';
      this._dangerFill.style.background = 'var(--danger)';
      dangerBar.appendChild(this._dangerFill);
      panel.appendChild(dangerBar);

      // History text
      this._historyText = document.createElement('p');
      this._historyText.className = 'history-text';
      panel.appendChild(this._historyText);

      document.body.appendChild(panel);

      // ── #discovery-flash ─────────────────────────────────────────
      const flash = document.createElement('div');
      flash.id = 'discovery-flash';
      this._flashDiv = flash;
      document.body.appendChild(flash);

      // ── #controls-hint ───────────────────────────────────────────
      const hint = document.createElement('div');
      hint.id = 'controls-hint';

      const lines = [
        'SCROLL — zoom',
        'DRAG   — pan',
        'CLICK  — inspect world',
      ];
      lines.forEach((line) => {
        const span = document.createElement('span');
        span.textContent = line;
        const br = document.createElement('br');
        hint.appendChild(span);
        hint.appendChild(br);
      });

      document.body.appendChild(hint);

      // ── Julia mode toggle ─────────────────────────────────────────
      this._buildJuliaModeToggle();

      // ── Theme switcher ────────────────────────────────────────────
      this._buildThemeSwitcher();

      // ── Bookmark panel ────────────────────────────────────────────
      this._buildBookmarkPanel();

      // ── Autopilot status listener ─────────────────────────────────
      window.addEventListener('cosmos:autopilotStatus', (e) => {
        this.updateAutopilotStatus(e.detail.active, e.detail.destination);
      });
    }

    // ── Julia Mode Toggle ─────────────────────────────────────────────

    _buildJuliaModeToggle() {
      const btn = document.createElement('button');
      btn.id = 'julia-mode-btn';
      btn.textContent = 'JULIA';

      Object.assign(btn.style, {
        position:        'fixed',
        top:             '16px',
        right:           '16px',
        zIndex:          '1000',
        padding:         '6px 14px',
        background:      'rgba(0,0,0,0.45)',
        backdropFilter:  'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border:          '1px solid rgba(255,255,255,0.18)',
        borderRadius:    '6px',
        color:           'rgba(255,255,255,0.85)',
        fontSize:        '11px',
        letterSpacing:   '0.08em',
        fontFamily:      'inherit',
        cursor:          'pointer',
        userSelect:      'none',
      });

      btn.addEventListener('click', () => {
        this._isJuliaMode = !this._isJuliaMode;
        btn.textContent = this._isJuliaMode ? 'MANDELBROT' : 'JULIA';
        window.dispatchEvent(new CustomEvent('cosmos:toggleJulia'));
      });

      this._juliaModeBtn = btn;
      document.body.appendChild(btn);
    }

    // ── Theme Switcher ────────────────────────────────────────────────

    _buildThemeSwitcher() {
      const switcher = document.createElement('div');
      switcher.id = 'theme-switcher';

      Object.assign(switcher.style, {
        position:       'fixed',
        bottom:         '24px',
        left:           '50%',
        transform:      'translateX(-50%)',
        zIndex:         '1000',
        display:        'flex',
        flexDirection:  'row',
        alignItems:     'center',
        gap:            '12px',
        padding:        '8px 16px',
        background:     'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border:         '1px solid rgba(255,255,255,0.18)',
        borderRadius:   '20px',
      });

      THEME_COLORS.forEach((color, index) => {
        const circle = document.createElement('button');

        Object.assign(circle.style, {
          width:        '20px',
          height:       '20px',
          borderRadius: '50%',
          background:   color,
          border:       '2px solid rgba(255,255,255,0.25)',
          cursor:       'pointer',
          padding:      '0',
          flexShrink:   '0',
          transition:   'transform 0.15s ease, border-color 0.15s ease',
        });

        circle.setAttribute('aria-label', 'Theme ' + (index + 1));
        circle.title = 'Theme ' + (index + 1);

        circle.addEventListener('mouseenter', () => {
          circle.style.transform = 'scale(1.25)';
          circle.style.borderColor = 'rgba(255,255,255,0.7)';
        });
        circle.addEventListener('mouseleave', () => {
          circle.style.transform = 'scale(1)';
          circle.style.borderColor = 'rgba(255,255,255,0.25)';
        });

        circle.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('cosmos:setTheme', { detail: { index } }));
        });

        switcher.appendChild(circle);
      });

      this._themeSwitcher = switcher;
      document.body.appendChild(switcher);
    }

    // ── Bookmark Panel ────────────────────────────────────────────────

    _buildBookmarkPanel() {
      const panel = document.createElement('div');
      panel.id = 'bookmark-panel';

      Object.assign(panel.style, {
        position:        'fixed',
        bottom:          '80px',
        left:            '16px',
        zIndex:          '1000',
        minWidth:        '160px',
        maxWidth:        '220px',
        padding:         '8px 10px',
        background:      'rgba(0,0,0,0.45)',
        backdropFilter:  'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border:          '1px solid rgba(255,255,255,0.18)',
        borderRadius:    '8px',
        color:           'rgba(255,255,255,0.75)',
        fontSize:        '10px',
        letterSpacing:   '0.06em',
        fontFamily:      'inherit',
      });

      const title = document.createElement('div');
      title.textContent = 'BOOKMARKS';
      Object.assign(title.style, {
        fontSize:      '9px',
        letterSpacing: '0.12em',
        color:         'rgba(255,255,255,0.45)',
        marginBottom:  '6px',
        userSelect:    'none',
      });
      panel.appendChild(title);

      const list = document.createElement('div');
      list.id = 'bookmark-list';
      panel.appendChild(list);

      this._bookmarkPanel = panel;
      this._bookmarkList  = list;
      document.body.appendChild(panel);
    }

    addBookmark(cx, cy, zoom, label) {
      const bookmark = {
        cx:    cx,
        cy:    cy,
        zoom:  zoom,
        label: label || (Number(cx).toFixed(3) + ', ' + Number(cy).toFixed(3)),
      };

      this._bookmarks.unshift(bookmark);

      // Keep only the last 5
      if (this._bookmarks.length > 5) {
        this._bookmarks.length = 5;
      }

      this.renderBookmarks();
    }

    renderBookmarks() {
      if (!this._bookmarkList) return;

      // Clear existing items
      while (this._bookmarkList.firstChild) {
        this._bookmarkList.removeChild(this._bookmarkList.firstChild);
      }

      if (this._bookmarks.length === 0) {
        const empty = document.createElement('div');
        empty.textContent = 'No bookmarks yet';
        Object.assign(empty.style, {
          color:     'rgba(255,255,255,0.3)',
          fontSize:  '9px',
          fontStyle: 'italic',
        });
        this._bookmarkList.appendChild(empty);
        return;
      }

      this._bookmarks.forEach((bookmark) => {
        const item = document.createElement('button');

        // Truncate label to 22 chars
        const displayLabel = bookmark.label.length > 22
          ? bookmark.label.slice(0, 19) + '...'
          : bookmark.label;

        item.textContent = displayLabel;
        item.title = bookmark.label + '  (zoom ' + Number(bookmark.zoom).toFixed(1) + 'x)';

        Object.assign(item.style, {
          display:       'block',
          width:         '100%',
          marginBottom:  '4px',
          padding:       '4px 6px',
          background:    'rgba(255,255,255,0.06)',
          border:        '1px solid rgba(255,255,255,0.1)',
          borderRadius:  '4px',
          color:         'rgba(255,255,255,0.75)',
          fontSize:      '10px',
          letterSpacing: '0.04em',
          fontFamily:    'inherit',
          cursor:        'pointer',
          textAlign:     'left',
          whiteSpace:    'nowrap',
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          transition:    'background 0.12s ease',
        });

        item.addEventListener('mouseenter', () => {
          item.style.background = 'rgba(255,255,255,0.14)';
        });
        item.addEventListener('mouseleave', () => {
          item.style.background = 'rgba(255,255,255,0.06)';
        });

        item.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('cosmos:gotoBookmark', { detail: bookmark }));
        });

        this._bookmarkList.appendChild(item);
      });
    }

    // ── Screenshot capture ────────────────────────────────────────────

    captureScreenshot(canvas) {
      if (!canvas) return;
      try {
        const dataURL = canvas.toDataURL('image/png');
        const timestamp = Date.now();
        const filename = 'cosmos-' + timestamp + '.png';

        const a = document.createElement('a');
        a.href = dataURL;
        a.download = filename;
        a.style.display = 'none';

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (err) {
        // Canvas may be tainted (cross-origin); fail silently
        console.warn('CosmosUI.captureScreenshot: could not export canvas —', err);
      }
    }

    // ── Share URL helpers ─────────────────────────────────────────────

    static parseHash() {
      const hash = window.location.hash;
      if (!hash || hash.length < 2) return null;

      // Strip leading '#' and parse key=value pairs
      const raw = hash.slice(1);
      const params = {};
      raw.split('&').forEach((part) => {
        const eqIdx = part.indexOf('=');
        if (eqIdx === -1) return;
        const key = decodeURIComponent(part.slice(0, eqIdx));
        const val = decodeURIComponent(part.slice(eqIdx + 1));
        params[key] = val;
      });

      if (params.cx === undefined || params.cy === undefined || params.zoom === undefined) {
        return null;
      }

      const cx   = parseFloat(params.cx);
      const cy   = parseFloat(params.cy);
      const zoom = parseFloat(params.zoom);

      if (isNaN(cx) || isNaN(cy) || isNaN(zoom)) return null;

      return { cx, cy, zoom };
    }

    // ── Existing methods ──────────────────────────────────────────────

    updateCoords(cx, cy, zoom) {
      if (this._coordXSpan)    this._coordXSpan.textContent    = Number(cx).toFixed(3);
      if (this._coordYSpan)    this._coordYSpan.textContent    = Number(cy).toFixed(3);
      if (this._coordZoomSpan) {
        let zoomStr;
        if (zoom < 1000) {
          zoomStr = Number(zoom).toFixed(1) + 'x';
        } else {
          zoomStr = Number(zoom).toExponential(2) + 'x';
        }
        this._coordZoomSpan.textContent = zoomStr;
      }

      // Update URL hash for easy sharing / bookmarking
      const hashStr = '#cx=' + encodeURIComponent(Number(cx).toFixed(6))
        + '&cy=' + encodeURIComponent(Number(cy).toFixed(6))
        + '&zoom=' + encodeURIComponent(Number(zoom).toFixed(6));
      // Use replaceState-style update via location.replace to avoid polluting history
      try {
        history.replaceState(null, '', hashStr);
      } catch (_) {
        // Fallback for environments without history API
        window.location.hash = hashStr;
      }
    }

    showWorldPanel(worldData) {
      if (!this._worldPanel) return;

      // Planet name
      this._planetName.textContent = worldData.name || 'Unknown';

      // Biome badge
      const biome = (worldData.biome || '').toLowerCase();
      const biomeColor = BIOME_COLORS[biome] || '#ffffff';
      this._biomeBadge.textContent = worldData.biome || 'Unknown';
      this._biomeBadge.style.color = biomeColor;

      // Clear and rebuild stats rows
      while (this._statsContainer.firstChild) {
        this._statsContainer.removeChild(this._statsContainer.firstChild);
      }

      // Only include keys that worldgen actually returns, so rows are never silently empty
      const statsToShow = [
        { label: 'Population',   key: 'population'   },
        { label: 'Civilization', key: 'civilization' },
        { label: 'Danger',       key: 'dangerLevel'  },
      ];

      statsToShow.forEach(function (stat) {
        if (worldData[stat.key] === undefined) return;
        const row = document.createElement('div');
        row.className = 'stat-row';

        const labelEl = document.createElement('span');
        labelEl.className = 'stat-label';
        labelEl.textContent = stat.label;

        const valueEl = document.createElement('span');
        valueEl.className = 'stat-value';
        valueEl.textContent = String(worldData[stat.key]);

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        this._statsContainer.appendChild(row);
      }, this);

      // Resources row — worldgen returns this as an array
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
        this._statsContainer.appendChild(resRow);
      }

      // Danger bar
      const dangerLevel = Number(worldData.dangerLevel) || 0;
      this._dangerFill.style.width = (dangerLevel * 10) + '%';

      // History
      this._historyText.textContent = worldData.history || '';

      // Open panel
      this._worldPanel.classList.add('open');
    }

    hideWorldPanel() {
      if (this._worldPanel) {
        this._worldPanel.classList.remove('open');
      }
    }

    flashDiscovery() {
      if (!this._flashDiv) return;
      this._flashDiv.style.opacity = '0.35';
      setTimeout(() => {
        this._flashDiv.style.opacity = '0';
      }, 150);
    }

    // ── Minimap trail widget ──────────────────────────────────────────

    initMinimap() {
      // Container
      const container = document.createElement('div');
      container.id = 'minimap-container';
      Object.assign(container.style, {
        position:       'fixed',
        bottom:         '20px',
        left:           '180px',
        zIndex:         '1000',
        background:     'rgba(5,5,16,0.85)',
        border:         '1px solid rgba(0,212,255,0.25)',
        borderRadius:   '8px',
        padding:        '8px',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      });

      // Label
      const label = document.createElement('div');
      label.textContent = 'TRAIL';
      Object.assign(label.style, {
        fontFamily:    "'Orbitron', monospace",
        fontSize:      '9px',
        color:         'rgba(0,212,255,0.5)',
        letterSpacing: '0.2em',
        marginBottom:  '4px',
      });

      // Canvas
      const mc = document.createElement('canvas');
      mc.id = 'minimap-canvas';
      mc.width = 160;
      mc.height = 120;
      mc.style.display = 'block';
      mc.style.borderRadius = '4px';

      container.appendChild(label);
      container.appendChild(mc);
      document.body.appendChild(container);

      this._minimapCanvas = mc;
      this._minimapCtx = mc.getContext('2d');
      this._trail = [];

      // Render low-quality Mandelbrot thumbnail into this._minimapBg
      this._renderMinimapBg();
    }

    _renderMinimapBg() {
      const W = 160;
      const H = 120;
      const MAX_ITER = 40;
      const imageData = this._minimapCtx.createImageData(W, H);
      const data = imageData.data;

      for (let py = 0; py < H; py++) {
        for (let px = 0; px < W; px++) {
          const re0 = -2.5 + (px / W) * 3.5;
          const im0 = -1.2 + (py / H) * 2.4;

          let re = 0;
          let im = 0;
          let iter = 0;

          while (iter < MAX_ITER) {
            const re2 = re * re;
            const im2 = im * im;
            if (re2 + im2 > 4) break;
            const newRe = re2 - im2 + re0;
            im = 2 * re * im + im0;
            re = newRe;
            iter++;
          }

          const idx = (py * W + px) * 4;

          if (iter === MAX_ITER) {
            // Inside set: #050510 = rgb(5,5,16)
            data[idx]     = 5;
            data[idx + 1] = 5;
            data[idx + 2] = 16;
            data[idx + 3] = 255;
          } else {
            // Outside: hsl(240 + iter*9, 80%, 50%)
            const h = 240 + iter * 9;
            const rgb = hslToRgbMinimap(h, 80, 50);
            data[idx]     = rgb[0];
            data[idx + 1] = rgb[1];
            data[idx + 2] = rgb[2];
            data[idx + 3] = 255;
          }
        }
      }

      this._minimapBg = imageData;

      // Draw the initial background
      this._minimapCtx.putImageData(imageData, 0, 0);
    }

    addTrailPoint(cx, cy, zoom) {
      if (!this._minimapCanvas) return;
      this._trail.push({ cx, cy, zoom });
      if (this._trail.length > 300) this._trail.shift();
      this._drawMinimap();
    }

    _drawMinimap() {
      const ctx = this._minimapCtx;
      const W = this._minimapCanvas.width;   // 160
      const H = this._minimapCanvas.height;  // 120

      // 1. Draw background
      if (this._minimapBg) ctx.putImageData(this._minimapBg, 0, 0);

      // coord-to-pixel helpers
      const toPixX = (cx) => (cx - (-2.5)) / 3.5 * W;
      const toPixY = (cy) => (cy - (-1.2)) / 2.4 * H;

      // 2. Draw trail line
      if (this._trail.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0,212,255,0.55)';
        ctx.lineWidth = 1.5;
        const first = this._trail[0];
        ctx.moveTo(toPixX(first.cx), toPixY(first.cy));
        for (let i = 1; i < this._trail.length; i++) {
          ctx.lineTo(toPixX(this._trail[i].cx), toPixY(this._trail[i].cy));
        }
        ctx.stroke();
      }

      // 3. Draw trail dots (every 5th point to avoid clutter)
      for (let i = 0; i < this._trail.length; i += 5) {
        const p = this._trail[i];
        const px = toPixX(p.cx);
        const py = toPixY(p.cy);
        const radius = Math.max(1, 3 - Math.log10(Math.max(1, p.zoom)) / 4);
        let color;
        if (p.zoom < 1e4) color = '#00d4ff';
        else if (p.zoom < 1e8) color = '#8b5cf6';
        else color = '#ffd700';
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // 4. Current position: white cross
      if (this._trail.length > 0) {
        const last = this._trail[this._trail.length - 1];
        const lx = toPixX(last.cx);
        const ly = toPixY(last.cy);
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx - 5, ly); ctx.lineTo(lx + 5, ly);
        ctx.moveTo(lx, ly - 5); ctx.lineTo(lx, ly + 5);
        ctx.stroke();
      }
    }

    // ── Autopilot status bar ──────────────────────────────────────────

    updateAutopilotStatus(active, destination) {
      let bar = document.getElementById('autopilot-status');
      if (!bar) {
        bar = document.createElement('div');
        bar.id = 'autopilot-status';
        Object.assign(bar.style, {
          position:      'fixed',
          top:           '16px',
          left:          '50%',
          transform:     'translateX(-50%)',
          zIndex:        '1001',
          padding:       '6px 20px',
          background:    'rgba(5,5,16,0.88)',
          border:        '1px solid rgba(0,212,255,0.45)',
          borderRadius:  '20px',
          fontFamily:    "'Orbitron', monospace",
          fontSize:      '11px',
          letterSpacing: '0.15em',
          color:         '#00d4ff',
          display:       'none',
          pointerEvents: 'none',
        });
        document.body.appendChild(bar);
      }
      if (active) {
        bar.textContent = '✦ AUTO-PILOT  —  ' + destination;
        bar.style.display = 'block';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  // ── HSL to RGB helper (used by _renderMinimapBg) ──────────────────

  function hslToRgbMinimap(h, s, l) {
    h = ((h % 360) + 360) % 360;
    s /= 100;
    l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;

    let r = 0, g = 0, b = 0;

    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  window.CosmosUI = new CosmosUI();
})();
