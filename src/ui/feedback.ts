/** Haptics (Android; iOS Safari has no vibrate API) and a soft synthesized chime. */
export function tap(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {}
}

let ctx: AudioContext | null = null;

/** Two soft sine notes — used once a day, when the day is closed. */
export function chime() {
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    [523.25, 783.99].forEach((freq, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.08, t + i * 0.18 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 1.6);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 1.7);
    });
  } catch {}
}
