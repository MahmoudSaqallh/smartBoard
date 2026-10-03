/**
 * Subtle completion chime via Web Audio. Browsers only allow audio after a
 * user gesture, so `primeAudio` is called from the Start button; if audio is
 * unavailable or blocked, the chime is silently skipped.
 */
let context: AudioContext | null = null;

export function primeAudio(): void {
  try {
    if (!context) {
      const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
    }
    if (context.state === "suspended") void context.resume();
  } catch {
    context = null;
  }
}

export function playChime(): void {
  if (!context || context.state !== "running") return;
  try {
    const start = context.currentTime;
    [880, 1320].forEach((frequency, i) => {
      const osc = context!.createOscillator();
      const gain = context!.createGain();
      const t = start + i * 0.18;
      osc.type = "sine";
      osc.frequency.value = frequency;
      // Soft attack and release: noticeable, not alarming.
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(context!.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  } catch {
    // Audio failures must never affect the board.
  }
}
