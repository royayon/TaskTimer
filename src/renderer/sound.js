// Web Audio API Synthesizer for Authentic Apple-style Timer Chimes
class SoundEngine {
  constructor() {
    this.audioCtx = null;
    this.activeRingerInterval = null;
    this.soundEnabled = true;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Play subtle tactile UI click (like Apple digital crown / button press)
  playTick() {
    if (!this.soundEnabled) return;
    this.init();
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, this.audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.03);

    gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.03);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start();
    osc.stop(this.audioCtx.currentTime + 0.03);
  }

  // Play Timer Sound by Key
  playTone(toneName = 'radar') {
    if (!this.soundEnabled) return;
    this.init();

    switch (toneName.toLowerCase()) {
      case 'radar':
        this.playRadar();
        break;
      case 'chimes':
        this.playChimes();
        break;
      case 'apex':
        this.playApex();
        break;
      case 'beacon':
        this.playBeacon();
        break;
      case 'silk':
        this.playSilk();
        break;
      case 'cosmic':
        this.playCosmic();
        break;
      case 'marimba':
        this.playMarimba();
        break;
      case 'custom':
        this.playCustomSound();
        break;
      case 'bell':
      default:
        this.playZenBell();
        break;
    }
  }

  // Apple "Radar" Alarm (Two rhythmic bursts)
  playRadar() {
    const t0 = this.audioCtx.currentTime;
    [0, 0.28].forEach((delay) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0 + delay); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, t0 + delay + 0.12); // A6

      gain.gain.setValueAtTime(0.001, t0 + delay);
      gain.gain.linearRampToValueAtTime(0.3, t0 + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.22);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.23);
    });
  }

  // Apple "Chimes" (Ascending melodic bell harmony)
  playChimes() {
    const t0 = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.12;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.8);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(start);
      osc.stop(start + 0.85);
    });
  }

  // Apple "Apex" (Modern crisp percussive synth alert)
  playApex() {
    const t0 = this.audioCtx.currentTime;
    const notes = [784, 1175]; // G5, D6
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.15;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(start);
      osc.stop(start + 0.55);
    });
  }

  // Apple "Beacon" (Clean metallic shimmer ping)
  playBeacon() {
    const t0 = this.audioCtx.currentTime;
    const osc1 = this.audioCtx.createOscillator();
    const osc2 = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1480, t0);
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1484, t0); // Slight beating shimmer

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.28, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc1.start(t0);
    osc2.start(t0);
    osc1.stop(t0 + 1.2);
    osc2.stop(t0 + 1.2);
  }

  // Zen Bell
  playZenBell() {
    const t0 = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, t0); // E5

    gain.gain.setValueAtTime(0.001, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(t0);
    osc.stop(t0 + 1.5);
  }

  // Apple "Silk" (Soft ambient warm chord)
  playSilk() {
    const t0 = this.audioCtx.currentTime;
    const freqs = [440, 554.37, 659.25, 880]; // A4 major chord
    freqs.forEach((f, i) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t0 + i * 0.04);
      gain.gain.setValueAtTime(0.001, t0 + i * 0.04);
      gain.gain.linearRampToValueAtTime(0.2, t0 + i * 0.04 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t0 + i * 0.04);
      osc.stop(t0 + 1.65);
    });
  }

  // Apple "Cosmic" (Ethereal shimmering harmonics)
  playCosmic() {
    const t0 = this.audioCtx.currentTime;
    const notes = [1046.50, 1318.51, 1567.98, 2093.00]; // C6, E6, G6, C7
    notes.forEach((freq, idx) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.08);
      gain.gain.setValueAtTime(0.001, t0 + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, t0 + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t0 + idx * 0.08);
      osc.stop(t0 + 1.45);
    });
  }

  // Apple "Marimba" (Wooden melodic acoustic bounce)
  playMarimba() {
    const t0 = this.audioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50, 783.99];
    notes.forEach((freq, i) => {
      const start = t0 + i * 0.09;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.3, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  // Custom User Audio File Playback
  playCustomSound() {
    try {
      const customData = localStorage.getItem('task_timer_custom_sound');
      if (customData) {
        if (!this.customAudio) {
          this.customAudio = new Audio();
        }
        this.customAudio.src = customData;
        this.customAudio.currentTime = 0;
        this.customAudio.play().catch(e => {
          console.warn('Custom audio playback failed, falling back to radar:', e);
          this.playRadar();
        });
        return;
      }
    } catch (e) {
      console.warn('Error reading custom audio:', e);
    }
    this.playRadar();
  }

  // Start continuous alarm ringing when timer expires
  startRinging(toneName = 'radar') {
    this.stopRinging();
    if (toneName === 'custom') {
      try {
        const customData = localStorage.getItem('task_timer_custom_sound');
        if (customData) {
          if (!this.customAudio) this.customAudio = new Audio();
          this.customAudio.src = customData;
          this.customAudio.loop = true;
          this.customAudio.currentTime = 0;
          this.customAudio.play().catch(() => this.playRadar());
          return;
        }
      } catch (e) {}
    }

    this.playTone(toneName);
    this.activeRingerInterval = setInterval(() => {
      this.playTone(toneName);
    }, 1600);
  }

  stopRinging() {
    if (this.customAudio) {
      try {
        this.customAudio.pause();
        this.customAudio.currentTime = 0;
        this.customAudio.loop = false;
      } catch (e) {}
    }
    if (this.activeRingerInterval) {
      clearInterval(this.activeRingerInterval);
      this.activeRingerInterval = null;
    }
  }
}

window.soundEngine = new SoundEngine();
