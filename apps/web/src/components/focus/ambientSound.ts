// Sonidos ambiente del Modo enfoque, sintetizados con Web Audio (sin archivos).

export const AMBIENT_SOUNDS = [
  { id: 'none', label: 'Silencio' },
  { id: 'rain', label: 'Lluvia' },
  { id: 'waves', label: 'Olas' },
  { id: 'forest', label: 'Bosque' },
  { id: 'fire', label: 'Fogata' },
] as const;

export type AmbientSoundId = (typeof AMBIENT_SOUNDS)[number]['id'];

export interface AmbientAudioController {
  stop: () => void;
  setVolume: (value: number) => void;
}

function createNoiseBuffer(ctx: AudioContext, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let last = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }

  return buffer;
}

export function createAmbientSound(type: AmbientSoundId, ctx: AudioContext, volume: number): AmbientAudioController | null {
  if (type === 'none') return null;

  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const cleanup: Array<() => void> = [];

  const setVolume = (value: number) => {
    master.gain.setTargetAtTime(value, ctx.currentTime, 0.15);
  };

  const addLoopingNoise = (filterType: BiquadFilterType, frequency: number, gainValue: number, q = 0.7) => {
    const source = ctx.createBufferSource();
    source.buffer = createNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;

    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();

    cleanup.push(() => {
      source.stop();
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    });
  };

  if (type === 'rain') {
    addLoopingNoise('bandpass', 1800, 0.3, 0.9);
    addLoopingNoise('highpass', 900, 0.08, 0.3);
  }

  if (type === 'waves') {
    addLoopingNoise('lowpass', 500, 0.28, 0.5);

    const swell = ctx.createOscillator();
    const swellGain = ctx.createGain();
    swell.type = 'sine';
    swell.frequency.value = 0.12;
    swellGain.gain.value = 0.06;
    swell.connect(swellGain);
    swellGain.connect(master.gain);
    swell.start();

    cleanup.push(() => {
      swell.stop();
      swell.disconnect();
      swellGain.disconnect();
    });
  }

  if (type === 'forest') {
    addLoopingNoise('bandpass', 1200, 0.12, 0.8);
    addLoopingNoise('highpass', 2500, 0.03, 0.2);

    const chirpTimer = window.setInterval(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200 + Math.random() * 900, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 1200, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.035, ctx.currentTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 0.2);

      window.setTimeout(() => {
        osc.disconnect();
        gain.disconnect();
      }, 250);
    }, 3200);

    cleanup.push(() => window.clearInterval(chirpTimer));
  }

  if (type === 'fire') {
    addLoopingNoise('lowpass', 700, 0.22, 0.5);
    addLoopingNoise('bandpass', 80, 0.12, 1.1);

    const crackleTimer = window.setInterval(() => {
      const source = ctx.createBufferSource();
      source.buffer = createNoiseBuffer(ctx, 0.15);

      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1800 + Math.random() * 1200;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.08);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      source.stop(ctx.currentTime + 0.1);

      window.setTimeout(() => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      }, 160);
    }, 1400);

    cleanup.push(() => window.clearInterval(crackleTimer));
  }

  return {
    stop: () => {
      cleanup.forEach((fn) => fn());
      master.disconnect();
    },
    setVolume,
  };
}

/** Aviso corto de fin de sesión (dos notas suaves). */
export function playChime(ctx: AudioContext) {
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + i * 0.22;
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}
