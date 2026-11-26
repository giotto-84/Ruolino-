import { useEffect, useRef, useState } from 'react';

let audio: AudioContext | null = null;

/** Short beep + vibration: works with the phone in hand during a set. */
export function signal(times = 2) {
  try {
    navigator.vibrate?.(times > 1 ? [200, 120, 200] : 200);
  } catch {
    /* not supported */
  }
  try {
    audio ??= new AudioContext();
    for (let i = 0; i < times; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.15;
      o.connect(g).connect(audio.destination);
      const t = audio.currentTime + i * 0.25;
      o.start(t);
      o.stop(t + 0.15);
    }
  } catch {
    /* audio blocked */
  }
}

/** Countdown that survives screen-lock/tab switch by tracking the end timestamp. */
export function useCountdown(onDone?: () => void) {
  const [end, setEnd] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [now, setNow] = useState(Date.now());
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (end === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= end) {
        setEnd(null);
        signal();
        done.current?.();
      }
    }, 250);
    return () => clearInterval(id);
  }, [end]);

  const left = end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
  return {
    running: end !== null,
    left,
    total,
    start: (seconds: number) => {
      // unlock audio on user gesture (iOS)
      try {
        audio ??= new AudioContext();
        void audio.resume();
      } catch {
        /* ignore */
      }
      setTotal(seconds);
      setNow(Date.now());
      setEnd(Date.now() + seconds * 1000);
    },
    add: (seconds: number) => {
      setEnd((e) => (e === null ? e : e + seconds * 1000));
      setTotal((t) => t + seconds);
    },
    stop: () => setEnd(null),
  };
}

export function Ring({ left, total, size = 74 }: { left: number; total: number; size?: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? left / total : 0;
  return (
    <svg className="ring" viewBox="0 0 74 74" width={size} height={size} aria-hidden="true">
      <circle className="track" cx="37" cy="37" r={r} />
      <circle
        className="fill"
        cx="37"
        cy="37"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - frac)}
        transform="rotate(-90 37 37)"
      />
    </svg>
  );
}

export function mmss(s: number): string {
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, '0')}` : String(ss);
}
