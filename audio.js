window.AudioEngine = class AudioEngine {
  constructor() {
    this.isInitialized = false;
    this.currentBiome = null;
    this.ctx = null;
    this.masterGain = null;
    this.reverb = null;
    this.activeNodes = [];
  }

  init() {
    if (this.isInitialized) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.ctx.destination);

    // Reverb using convolver with 2-second exponential decay impulse response
    this.reverb = this.ctx.createConvolver();
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 3);
        data[i] = (Math.random() * 2 - 1) * decay;
      }
    }

    this.reverb.buffer = impulse;
    this.reverb.connect(this.masterGain);

    this.isInitialized = true;
  }

  _createOscillator(type, frequency) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    return osc;
  }

  _createGain(value) {
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = value;
    return gainNode;
  }

  playBiome(biomeName) {
    if (!this.isInitialized) this.init();

    // Fade out over 1s then stop, then start new biome
    if (this.currentBiome) {
      if (this.masterGain) {
        this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1);
      }
      const timeout = setTimeout(() => {
        this.stopBiome();
        this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.currentBiome = biomeName;
        this._startBiome(biomeName);
      }, 1000);
      this.activeNodes.push({ _intervalId: timeout, _isTimeout: true });
    } else {
      this.currentBiome = biomeName;
      this._startBiome(biomeName);
    }
  }

  _startBiome(biomeName) {
    switch (biomeName) {
      case 'crystal':
        this._playCrystal();
        break;
      case 'organic':
        this._playOrganic();
        break;
      case 'mechanical':
        this._playMechanical();
        break;
      case 'void':
        this._playVoid();
        break;
      case 'radiant':
        this._playRadiant();
        break;
      default:
        console.warn('Unknown biome:', biomeName);
    }
  }

  _playCrystal() {
    const frequencies = [523.25, 659.25, 783.99];

    const playBurst = () => {
      if (this.currentBiome !== 'crystal') return;
      const now = this.ctx.currentTime;
      frequencies.forEach((freq) => {
        const osc = this._createOscillator('sine', freq);
        const gainNode = this._createGain(0);

        osc.connect(gainNode);
        gainNode.connect(this.reverb);

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.start(now);
        osc.stop(now + 0.65);

        this.activeNodes.push(osc);
        this.activeNodes.push(gainNode);
      });

      // Schedule next burst at a random interval between 1 and 3 seconds
      const delay = 1000 + Math.random() * 2000;
      const timeout = setTimeout(playBurst, delay);
      this.activeNodes.push({ _intervalId: timeout, _isTimeout: true });
    };

    playBurst();
  }

  _playOrganic() {
    const frequencies = [55, 110];
    const now = this.ctx.currentTime;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.connect(this.reverb);
    this.activeNodes.push(filter);

    frequencies.forEach((freq) => {
      const osc = this._createOscillator('sawtooth', freq);
      // Center gain between 0.2 and 0.5 is 0.35; LFO swings +/- 0.15
      const gainNode = this._createGain(0.35);

      const lfo = this._createOscillator('sine', 0.2);
      const lfoGain = this._createGain(0.15);

      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      osc.connect(gainNode);
      gainNode.connect(filter);

      osc.start(now);
      lfo.start(now);

      this.activeNodes.push(osc);
      this.activeNodes.push(gainNode);
      this.activeNodes.push(lfo);
      this.activeNodes.push(lfoGain);
    });
  }

  _playMechanical() {
    const now = this.ctx.currentTime;
    const osc = this._createOscillator('square', 80);
    const gainNode = this._createGain(0);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 200;

    osc.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(this.reverb);

    osc.start(now);

    this.activeNodes.push(osc);
    this.activeNodes.push(gainNode);
    this.activeNodes.push(filter);

    // Pattern: on 200ms, off 150ms, on 200ms, off 400ms
    const pattern = [
      { on: true, duration: 200 },
      { on: false, duration: 150 },
      { on: true, duration: 200 },
      { on: false, duration: 400 },
    ];
    let step = 0;

    const runPattern = () => {
      if (this.currentBiome !== 'mechanical') return;
      const current = pattern[step % pattern.length];
      gainNode.gain.setValueAtTime(current.on ? 0.4 : 0, this.ctx.currentTime);
      step++;
      const timeout = setTimeout(runPattern, current.duration);
      this.activeNodes.push({ _intervalId: timeout, _isTimeout: true });
    };

    runPattern();
  }

  _playVoid() {
    const frequencies = [40, 80.2];
    const now = this.ctx.currentTime;

    frequencies.forEach((freq, index) => {
      const osc = this._createOscillator('sine', freq);
      if (index === 1) {
        osc.detune.value = 12; // slight detune for width
      }

      const gainNode = this._createGain(0.25);

      // Very slow amplitude LFO at 0.05hz
      const lfo = this._createOscillator('sine', 0.05);
      const lfoGain = this._createGain(0.1);

      lfo.connect(lfoGain);
      lfoGain.connect(gainNode.gain);

      osc.connect(gainNode);
      gainNode.connect(this.reverb);

      osc.start(now);
      lfo.start(now);

      this.activeNodes.push(osc);
      this.activeNodes.push(gainNode);
      this.activeNodes.push(lfo);
      this.activeNodes.push(lfoGain);
    });
  }

  _playRadiant() {
    const frequencies = [440, 554.37, 659.25];

    const scheduleChord = () => {
      if (this.currentBiome !== 'radiant') return;

      const now = this.ctx.currentTime;
      frequencies.forEach((freq) => {
        const osc = this._createOscillator('sine', freq);
        const gainNode = this._createGain(0);

        osc.connect(gainNode);
        gainNode.connect(this.reverb);

        // Quick attack, medium sustain, release
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gainNode.gain.setValueAtTime(0.35, now + 0.85);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

        osc.start(now);
        osc.stop(now + 1.35);

        this.activeNodes.push(osc);
        this.activeNodes.push(gainNode);
      });

      // Repeat every 1.5 seconds
      const timeout = setTimeout(scheduleChord, 1500);
      this.activeNodes.push({ _intervalId: timeout, _isTimeout: true });
    };

    scheduleChord();
  }

  stopBiome() {
    this.currentBiome = null;

    this.activeNodes.forEach((node) => {
      if (!node) return;

      if (node._isTimeout) {
        try { clearTimeout(node._intervalId); } catch (e) { /* ignore */ }
      } else if (node._isInterval) {
        try { clearInterval(node._intervalId); } catch (e) { /* ignore */ }
      } else {
        if (typeof node.stop === 'function') {
          try { node.stop(); } catch (e) { /* ignore - may already be stopped */ }
        }
        if (typeof node.disconnect === 'function') {
          try { node.disconnect(); } catch (e) { /* ignore */ }
        }
      }
    });

    this.activeNodes = [];
  }

  setVolume(v) {
    if (this.masterGain) {
      this.masterGain.gain.value = v;
    }
  }

  stop() {
    this.stopBiome();
    if (this.ctx) {
      this.ctx.suspend();
    }
  }
};
