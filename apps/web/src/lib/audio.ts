// Web Audio API procedural sound engine — no external files, no CDN
type SoundType = 'blip' | 'questComplete' | 'levelUp' | 'error' | 'coin' | 'achievement' | 'hover' | 'tick' | 'welcome';

/** Sonido de los avisos dentro de la app (aparte de los efectos del juego). Encendido de base. */
const ALERT_KEY = 'lq_alert_sound';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private _enabled = false;
  private _alerts = true;

  load(): void {
    try {
      this._enabled = localStorage.getItem('lq_audio') === '1';
      this._alerts = localStorage.getItem(ALERT_KEY) !== '0';
    } catch { /* sin storage: valores de base */ }
    // El navegador solo deja sonar audio tras un toque: el primero prepara el contexto,
    // así un aviso que llega más tarde (incluso con la pestaña en segundo plano) suena.
    // (iPhone solo lo acepta al soltar el dedo: por eso también touchend y click.)
    const unlock = () => { try { this.getCtx(); } catch { /* sin Web Audio */ } };
    for (const type of ['pointerdown', 'touchend', 'click', 'keydown']) window.addEventListener(type, unlock, { once: true, capture: true });
  }

  get alertSound(): boolean {
    return this._alerts;
  }

  setAlertSound(on: boolean): void {
    this._alerts = on;
    try { localStorage.setItem(ALERT_KEY, on ? '1' : '0'); } catch { /* sin storage */ }
    if (on) this.chime();
  }

  /**
   * Campana suave de los avisos: dos notas de seno con caída larga (una sola y más
   * baja si el aviso es de poca importancia). No depende del interruptor de efectos.
   */
  chime(soft = false): void {
    if (!this._alerts) return;
    let ctx: AudioContext;
    try { ctx = this.getCtx(); } catch { return; }
    if (ctx.state !== 'running') return;
    const notes: Array<[number, number, number]> = soft ? [[784, 0, 0.07]] : [[880, 0, 0.11], [1318.5, 0.16, 0.08]];
    for (const [freq, delay, vol] of notes) {
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1.45);
    }
  }

  get enabled(): boolean {
    return this._enabled;
  }

  toggle(): boolean {
    this._enabled = !this._enabled;
    localStorage.setItem('lq_audio', this._enabled ? '1' : '0');
    if (this._enabled) {
      void this.ctx?.resume();
      setTimeout(() => this.play('welcome'), 50);
    }
    return this._enabled;
  }

  private getCtx(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(
    freq: number,
    type: OscillatorType,
    duration: number,
    vol = 0.25,
    delay = 0,
    pitchEnd?: number,
  ): void {
    if (!this._enabled) return;
    const ctx = this.getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + delay);
    if (pitchEnd !== undefined) osc.frequency.linearRampToValueAtTime(pitchEnd, now + delay + duration);
    gain.gain.setValueAtTime(0, now + delay);
    gain.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + delay + duration);
    osc.start(now + delay);
    osc.stop(now + delay + duration + 0.01);
  }

  play(sound: SoundType): void {
    if (!this._enabled) return;
    switch (sound) {
      case 'hover':      this.tone(440, 'sine', 0.04, 0.05); break;
      case 'blip':       this.tone(520, 'square', 0.08, 0.12); break;
      case 'tick':       this.tone(900, 'square', 0.025, 0.04); break;
      case 'coin':
        this.tone(880, 'sine', 0.1, 0.18, 0);
        this.tone(1320, 'sine', 0.08, 0.14, 0.07);
        break;
      case 'error':
        this.tone(220, 'square', 0.15, 0.22, 0);
        this.tone(185, 'square', 0.18, 0.18, 0.1);
        break;
      case 'questComplete':
        this.tone(523, 'square', 0.14, 0.22, 0);
        this.tone(659, 'square', 0.14, 0.22, 0.11);
        this.tone(784, 'square', 0.16, 0.26, 0.22);
        break;
      case 'levelUp':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 'square', 0.16, 0.28, i * 0.1));
        break;
      case 'achievement':
        this.tone(1047, 'sine', 0.5, 0.3, 0);
        this.tone(1319, 'sine', 0.4, 0.18, 0.06);
        this.tone(1568, 'sine', 0.35, 0.12, 0.12);
        break;
      case 'welcome':
        [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 'square', 0.18, 0.22, i * 0.11));
        break;
    }
  }
}

export const audio = new AudioEngine();
