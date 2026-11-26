import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Exercise } from '../types';
import { imageUrl, PATTERN_LABEL } from '../data/exercises';

export function TopBar({ title, back = true, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="back" onClick={() => nav(-1)} aria-label="Indietro">
          <Icon name="back" />
        </button>
      )}
      <h1 style={{ fontSize: back ? 32 : 40 }}>{title}</h1>
      {right}
    </header>
  );
}

const PATHS: Record<string, ReactNode> = {
  home: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  plan: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  book: (
    <>
      <path d="M2 7h3v10H2zM19 7h3v10h-3zM5 9h2v6H5zM17 9h2v6h-2zM7 12h10" />
    </>
  ),
  chart: <path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  play: <path d="M8 5v14l11-7z" />,
  video: (
    <>
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3" />
    </>
  ),
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
};

export function Icon({ name, size = 22 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 999,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 10) / 10));
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(clamp(value - step))} aria-label={`Diminuisci ${label}`}>
        −
      </button>
      <input
        inputMode="decimal"
        aria-label={label}
        value={Number.isFinite(value) ? String(value).replace('.', ',') : ''}
        onChange={(e) => {
          const v = parseFloat(e.target.value.replace(',', '.'));
          onChange(Number.isFinite(v) ? v : 0);
        }}
        onBlur={() => onChange(clamp(value))}
      />
      <button type="button" onClick={() => onChange(clamp(value + step))} aria-label={`Aumenta ${label}`}>
        +
      </button>
    </div>
  );
}

export function Chips<T extends string | number>({
  options,
  value,
  onChange,
  multi = false,
}: {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (v: T[]) => void;
  multi?: boolean;
}) {
  return (
    <div className="chips">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            className="chip"
            aria-pressed={on}
            onClick={() => {
              if (!multi) onChange([o.value]);
              else onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value]);
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 6 }}>
          <span />
          <button className="back" onClick={onClose} aria-label="Chiudi">
            <Icon name="close" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Two-frame demonstration image (start / end position) that alternates automatically. */
export function ExerciseImage({ ex }: { ex: Exercise }) {
  const [failed, setFailed] = useState(false);
  const a = imageUrl(ex, 0);
  const b = imageUrl(ex, 1);
  if (!a || failed) {
    return (
      <div className="ex-img placeholder">
        <span>
          {ex.name}
          <br />
          <span className="small muted" style={{ fontStyle: 'normal', fontFamily: 'var(--body)', fontWeight: 500 }}>
            Immagine non disponibile: guarda il video
          </span>
        </span>
      </div>
    );
  }
  return (
    <div className="ex-img">
      <img src={a} alt={`${ex.name}: posizione di partenza`} onError={() => setFailed(true)} />
      <img className="flip" src={b} alt={`${ex.name}: posizione finale`} />
    </div>
  );
}

export function Thumb({ ex }: { ex: Exercise }) {
  const src = imageUrl(ex, 0);
  return <div className={`thumb${src ? '' : ' placeholder'}`}>{src && <img src={src} alt="" loading="lazy" />}</div>;
}

export function PatternTag({ ex }: { ex: Exercise }) {
  return <span className="tag blue">{PATTERN_LABEL[ex.pattern]}</span>;
}

export function formatDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  return new Date(iso).toLocaleDateString('it-IT', opts);
}

export function fmt(n: number | undefined, digits = 1): string {
  if (n === undefined || !Number.isFinite(n)) return '–';
  return (Number.isInteger(n) ? String(n) : n.toFixed(digits)).replace('.', ',');
}
