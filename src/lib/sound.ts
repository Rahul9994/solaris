/**
 * Procedural sound design (WebAudio). Disabled by default; created only after a user gesture.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private nodes: AudioScheduledSourceNode[] = [];
  enabled = false;
  private lastHover = 0;

  private ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  private startAmbient() {
    const ctx = this.ctx!;
    this.ambient = ctx.createGain();
    this.ambient.gain.value = 0.0;
    this.ambient.connect(this.master!);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.7;
    filter.connect(this.ambient);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.035;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    this.nodes.push(lfo);
    for (const [f, type, g] of [
      [55, 'sine', 0.22],
      [82.4, 'triangle', 0.08],
      [110.3, 'sine', 0.07],
      [164.8, 'sine', 0.025],
    ] as [number, OscillatorType, number][]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(filter);
      o.start();
      this.nodes.push(o);
    }
    // brown noise "solar wind"
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    noise.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 300;
    nf.Q.value = 0.5;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(nf).connect(ng).connect(this.ambient);
    noise.start();
    this.nodes.push(noise);
    this.ambient.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3);
  }

  setEnabled(on: boolean) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    this.enabled = on;
    if (on) {
      ctx.resume();
      if (!this.ambient) this.startAmbient();
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.2);
    } else {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    }
  }

  private blip(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', slide = 0) {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  hover() {
    const now = performance.now();
    if (now - this.lastHover < 70) return;
    this.lastHover = now;
    this.blip(1320, 0.06, 0.025);
  }
  click() {
    this.blip(660, 0.09, 0.05, 'sine', 1.5);
  }
  select() {
    this.blip(440, 0.25, 0.05, 'triangle', 2);
    setTimeout(() => this.blip(880, 0.3, 0.03), 60);
  }
  whoosh() {
    if (!this.enabled || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = ctx.sampleRate * 1.6;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + 0.8);
    f.frequency.exponentialRampToValueAtTime(300, t + 1.6);
    const g = ctx.createGain();
    g.gain.value = 0.08;
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }
}

export const sfx = new SoundEngine();
