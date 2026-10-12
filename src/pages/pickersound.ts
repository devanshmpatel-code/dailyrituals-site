// The soft crackle of a wooden wick, made with the Web Audio API (no audio files): short bursts of filtered noise at random
// intervals, now and then a little cluster or a slightly deeper pop, over a faint hush of air that swells with the breath.
// It is only ever started from a tap on the sound toggle, and it is silent until a candle is lit.

export interface Crackle {
  /** lit: whether a candle is burning (crackles only then); k: how full the breath is, 0 to 1 */
  set(lit: boolean, k: number): void;
  /** called with the strength of each louder pop, so the flame can duck with it */
  onPop: ((s: number) => void) | null;
  suspend(): void; resume(): void; close(): void;
}

export function createCrackle(): Crackle | null {
  const AC: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!AC) return null;
  let ac: AudioContext;
  try { ac = new AC(); } catch { return null; }
  const master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
  // one second of white noise, shared by every burst and the hush
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // the hush of the flame: noise through a low band, very quiet
  const bed = ac.createBufferSource(); bed.buffer = buf; bed.loop = true;
  const bedF = ac.createBiquadFilter(); bedF.type = 'lowpass'; bedF.frequency.value = 520; bedF.Q.value = 0.4;
  const bedG = ac.createGain(); bedG.gain.value = 0.0;
  bed.connect(bedF).connect(bedG).connect(master); bed.start();

  let lit = false, timer = 0, closed = false, k = 0.5;
  const api: Crackle = { onPop: null, set, suspend, resume, close };

  const burst = (at: number, gain: number, freq: number, q: number, len: number) => {
    const s = ac.createBufferSource(); s.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    s.connect(f).connect(g).connect(master); s.start(at, Math.random() * 0.9, len + 0.02);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
  };
  const next = () => {
    timer = 0; if (closed || !lit) return;
    const now = ac.currentTime + 0.01, r = Math.random();
    if (r < 0.07) { // a pop: a little deeper and longer, the wood splitting
      const s = 0.6 + Math.random() * 0.4; burst(now, 0.22 * s, 650 + Math.random() * 500, 0.9, 0.09 + Math.random() * 0.05);
      burst(now + 0.004, 0.12 * s, 2600 + Math.random() * 1600, 1.2, 0.03); api.onPop?.(s);
    } else if (r < 0.22) { // a cluster of tiny ticks
      const n = 3 + ((Math.random() * 4) | 0); let t = now;
      for (let i = 0; i < n; i++) { burst(t, 0.03 + Math.random() * 0.07, 1800 + Math.random() * 3600, 1 + Math.random(), 0.008 + Math.random() * 0.02); t += 0.012 + Math.random() * 0.04; }
    } else burst(now, 0.025 + Math.random() * 0.09, 1400 + Math.random() * 3800, 0.8 + Math.random() * 1.4, 0.01 + Math.random() * 0.035);
    timer = window.setTimeout(next, 70 + Math.random() ** 2 * 1100);
  };
  function set(l: boolean, kk: number) {
    k = kk;
    if (l !== lit) {
      lit = l; master.gain.cancelScheduledValues(ac.currentTime); master.gain.setTargetAtTime(l ? 0.9 : 0, ac.currentTime, l ? 0.25 : 0.12);
      if (l && !timer) timer = window.setTimeout(next, 120); if (!l && timer) { clearTimeout(timer); timer = 0; }
    }
    bedG.gain.setTargetAtTime(lit ? 0.01 + 0.018 * k : 0, ac.currentTime, 0.3);
  }
  function suspend() { if (timer) { clearTimeout(timer); timer = 0; } ac.suspend().catch(() => {}); }
  function resume() { ac.resume().catch(() => {}); if (lit && !timer) timer = window.setTimeout(next, 120); }
  function close() { closed = true; if (timer) clearTimeout(timer); try { bed.stop(); } catch { /* already stopped */ } ac.close().catch(() => {}); }
  void k;
  return api;
}
