/**
 * FractalRenderer — Mandelbrot / Julia set renderer using Canvas 2D ImageData.
 * Exposed as window.FractalRenderer for browser consumption.
 */

window.FractalRenderer = class FractalRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // Render mode: 'mandelbrot' | 'julia'
    this.mode   = 'mandelbrot';

    // Fixed complex constant used in Julia-set mode
    this.juliaC = { r: -0.7, i: 0.27 };

    // Active colour theme — defaults to the first theme (Deep Space)
    this.theme  = FractalRenderer.getColorThemes()[0];
  }

  // ---------------------------------------------------------------------------
  // Mode control
  // ---------------------------------------------------------------------------

  /**
   * Switch between render modes.
   *
   * @param {'mandelbrot'|'julia'} mode
   * @param {number} [juliaR] - Real part of c for Julia mode.
   * @param {number} [juliaI] - Imaginary part of c for Julia mode.
   */
  setMode(mode, juliaR, juliaI) {
    this.mode = mode;

    if (mode === 'julia') {
      this.juliaC = {
        r: (juliaR !== undefined) ? juliaR : this.juliaC.r,
        i: (juliaI !== undefined) ? juliaI : this.juliaC.i,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Theme control
  // ---------------------------------------------------------------------------

  /**
   * Return an array of five named colour themes.
   *
   * Each theme object has:
   *   { name, hueStart, hueStep, saturation, interior }
   *
   * @returns {Array<{name:string, hueStart:number, hueStep:number, saturation:number, interior:string}>}
   */
  static getColorThemes() {
    return [
      { name: 'Deep Space',   hueStart: 240, hueStep:  8, saturation:  85, interior: '#050510' },
      { name: 'Fire Storm',   hueStart:   0, hueStep:  5, saturation:  90, interior: '#0a0000' },
      { name: 'Acid Neon',    hueStart: 120, hueStep: 12, saturation: 100, interior: '#001a00' },
      { name: 'Cosmic Rose',  hueStart: 300, hueStep:  6, saturation:  80, interior: '#0d0005' },
      { name: 'Golden Hour',  hueStart:  45, hueStep:  4, saturation:  75, interior: '#0a0800' },
    ];
  }

  /**
   * Activate a colour theme by index (0–4).
   *
   * @param {number} index
   */
  setTheme(index) {
    const themes = FractalRenderer.getColorThemes();

    if (index < 0 || index >= themes.length) {
      throw new RangeError(`Theme index ${index} is out of range (0–${themes.length - 1}).`);
    }

    this.theme = themes[index];
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse a CSS hex colour string to an { r, g, b } object (0–255 each).
   * Supports both 3-digit (#RGB) and 6-digit (#RRGGBB) forms.
   *
   * @param {string} hex
   * @returns {{ r: number, g: number, b: number }}
   */
  hexToRgb(hex) {
    // Normalise shorthand (#RGB → #RRGGBB)
    const normalised = hex.replace(
      /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/,
      '#$1$1$2$2$3$3'
    );

    const result = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(normalised);

    if (!result) {
      throw new TypeError(`Invalid hex colour: "${hex}"`);
    }

    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  /**
   * Render the fractal centred at (cx, cy) with the given zoom level.
   * All pixels are written synchronously via a single ImageData buffer.
   *
   * In Mandelbrot mode the standard iteration z = z^2 + c is used, where
   * c is derived from the pixel coordinate and z starts at 0.
   *
   * In Julia mode z starts at the pixel coordinate and c is fixed as
   * this.juliaC for every pixel.
   *
   * @param {number} cx   - Real part of the viewport centre in fractal space.
   * @param {number} cy   - Imaginary part of the viewport centre in fractal space.
   * @param {number} zoom - Pixels per unit in fractal space.
   */
  render(cx, cy, zoom) {
    const MAX_ITER = 256;
    const width    = this.canvas.width;
    const height   = this.canvas.height;

    const imageData = this.ctx.createImageData(width, height);
    const data      = imageData.data;

    const halfW = width  / 2;
    const halfH = height / 2;

    // Pre-resolve Julia constant and interior colour outside the hot loop
    const isJulia      = (this.mode === 'julia');
    const juliaCRe     = this.juliaC.r;
    const juliaCIm     = this.juliaC.i;
    const interiorRgb  = this.hexToRgb(this.theme.interior);
    const hueStart     = this.theme.hueStart;
    const hueStep      = this.theme.hueStep;
    const saturation   = this.theme.saturation;

    for (let py = 0; py < height; py++) {
      for (let px = 0; px < width; px++) {

        // Map pixel to complex plane
        const pixRe = cx + (px - halfW) / zoom;
        const pixIm = cy + (py - halfH) / zoom;

        // Choose starting z and constant c according to render mode
        let zr, zi, cRe, cIm;

        if (isJulia) {
          // Julia: z starts at pixel coord; c is fixed
          zr   = pixRe;
          zi   = pixIm;
          cRe  = juliaCRe;
          cIm  = juliaCIm;
        } else {
          // Mandelbrot: z starts at 0; c is the pixel coord
          zr   = 0;
          zi   = 0;
          cRe  = pixRe;
          cIm  = pixIm;
        }

        // Iterate z = z^2 + c
        let iter = 0;

        while (iter < MAX_ITER) {
          const zr2 = zr * zr;
          const zi2 = zi * zi;

          if (zr2 + zi2 > 4) {
            break;
          }

          const newZr = zr2 - zi2 + cRe;
          zi = 2 * zr * zi + cIm;
          zr = newZr;
          iter++;
        }

        // Convert to RGB and write pixel
        let r, g, b;

        if (iter === MAX_ITER) {
          // Interior of the set — use theme's interior colour
          r = interiorRgb.r;
          g = interiorRgb.g;
          b = interiorRgb.b;
        } else {
          // Smooth (continuous) colouring to eliminate banding.
          // Clamp modulus to at least 2.0 before taking log — the escape threshold
          // guarantees modulus > 2 in practice, but floating-point edge cases near
          // the boundary can produce values just below 2, causing log(log(modulus))
          // to go negative-infinity or NaN.  The clamp is a no-op for well-escaped
          // points and prevents all NaN propagation without changing any colours.
          const modulus    = Math.max(2.0, Math.sqrt(zr * zr + zi * zi));
          const smoothIter = iter + 1 - Math.log(Math.log(modulus)) / Math.log(2);

          // Guard against NaN smoothIter (defensive — should not occur after the
          // modulus clamp above, but protects against future escape-threshold changes)
          const h = isNaN(smoothIter) ? hueStart : (hueStart + smoothIter * hueStep) % 360;
          const s = saturation;
          // Keep lightness in a visible range regardless of iteration count
          const l = isNaN(smoothIter) ? 50 : (45 + 20 * Math.sin(smoothIter * 0.15));

          [r, g, b] = hslToRgb(h, s, l);
        }

        const idx    = (py * width + px) * 4;
        data[idx]     = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 255;
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  // Low-quality render for smooth animation: draws every other pixel at 32 iters,
  // then scales up with drawImage. Fast enough for 60fps during autopilot flight.
  renderFast(cx, cy, zoom) {
    const MAX_ITER = 48;
    const scale   = 3; // render at 1/3 resolution then upscale
    const w = Math.ceil(this.canvas.width  / scale);
    const h = Math.ceil(this.canvas.height / scale);

    const offscreen = document.createElement('canvas');
    offscreen.width  = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d');
    const imageData = octx.createImageData(w, h);
    const data      = imageData.data;

    const halfW = w / 2, halfH = h / 2;
    const zoomedOut = zoom / scale;

    const isJulia    = (this.mode === 'julia');
    const juliaCRe   = this.juliaC.r;
    const juliaCIm   = this.juliaC.i;
    const interior   = this.hexToRgb(this.theme.interior);
    const hueStart   = this.theme.hueStart;
    const hueStep    = this.theme.hueStep;
    const saturation = this.theme.saturation;

    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const pixRe = cx + (px - halfW) / zoomedOut;
        const pixIm = cy + (py - halfH) / zoomedOut;
        let zr, zi, cRe, cIm;
        if (isJulia) { zr = pixRe; zi = pixIm; cRe = juliaCRe; cIm = juliaCIm; }
        else         { zr = 0;     zi = 0;     cRe = pixRe;    cIm = pixIm;    }
        let iter = 0;
        while (iter < MAX_ITER) {
          const zr2 = zr * zr, zi2 = zi * zi;
          if (zr2 + zi2 > 4) break;
          const nzr = zr2 - zi2 + cRe;
          zi = 2 * zr * zi + cIm;
          zr = nzr;
          iter++;
        }
        let r, g, b;
        if (iter === MAX_ITER) {
          r = interior.r; g = interior.g; b = interior.b;
        } else {
          const modulus    = Math.max(2.0, Math.sqrt(zr * zr + zi * zi));
          const smoothIter = iter + 1 - Math.log(Math.log(modulus)) / Math.log(2);
          const h2 = isNaN(smoothIter) ? hueStart : (hueStart + smoothIter * hueStep) % 360;
          const l  = isNaN(smoothIter) ? 50 : (45 + 20 * Math.sin(smoothIter * 0.15));
          [r, g, b] = hslToRgb(h2, saturation, l);
        }
        const idx = (py * w + px) * 4;
        data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
      }
    }
    octx.putImageData(imageData, 0, 0);
    this.ctx.drawImage(offscreen, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Return a string hash derived from the supplied coordinates, suitable for
   * use as a deterministic world seed.
   *
   * @param {number} cx
   * @param {number} cy
   * @returns {string}
   */
  worldAtCoord(cx, cy) {
    const raw = `${cx.toFixed(10)},${cy.toFixed(10)}`;
    let hash  = 0;

    for (let i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.charCodeAt(i);
      hash |= 0; // coerce to 32-bit integer
    }

    // Return as an unsigned hex string
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
};

// ---------------------------------------------------------------------------
// Utility — HSL to sRGB conversion (all values in [0,360/100/100] → [0,255])
// ---------------------------------------------------------------------------

/**
 * Convert HSL colour values to an [r, g, b] triple in the 0–255 range.
 *
 * @param {number} h - Hue in degrees [0, 360).
 * @param {number} s - Saturation as a percentage [0, 100].
 * @param {number} l - Lightness as a percentage [0, 100].
 * @returns {[number, number, number]}
 */
function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;

  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

  return [
    Math.round(f(0) * 255),
    Math.round(f(8) * 255),
    Math.round(f(4) * 255),
  ];
}
