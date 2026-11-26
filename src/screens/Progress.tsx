import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { getExercise } from '../data/exercises';
import { LineChart } from '../components/LineChart';
import { Sheet, Stepper, TopBar, fmt, formatDate } from '../components/ui';
import { startOfWeek } from '../logic/progression';
import { ZONES } from '../logic/goals';
import type { BodyLog, Checkin, ExerciseState, Photo, Session } from '../types';

const TABS = ['Corpo', 'Forza', 'Costanza', 'Foto'] as const;

export function Progress() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Corpo');
  return (
    <div className="stack">
      <TopBar title="Progressi" back={false} />
      <div className="seg" role="group" aria-label="Sezione progressi">
        {TABS.map((t) => (
          <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Corpo' && <Body />}
      {tab === 'Forza' && <Strength />}
      {tab === 'Costanza' && <Consistency />}
      {tab === 'Foto' && <Photos />}
    </div>
  );
}

const MEASURES: { key: keyof BodyLog; label: string; unit: string }[] = [
  { key: 'weightKg', label: 'Peso', unit: 'kg' },
  { key: 'waistCm', label: 'Vita', unit: 'cm' },
  { key: 'chestCm', label: 'Petto', unit: 'cm' },
  { key: 'hipsCm', label: 'Fianchi', unit: 'cm' },
  { key: 'armCm', label: 'Braccio', unit: 'cm' },
  { key: 'thighCm', label: 'Coscia', unit: 'cm' },
];

function Body() {
  const profile = useLiveQuery(() => db.profile.get('me'));
  const logs = useLiveQuery(() => db.body.orderBy('date').toArray(), [], [] as BodyLog[]);
  const checkins = useLiveQuery(() => db.checkins.orderBy('date').reverse().toArray(), [], [] as Checkin[]);
  const [open, setOpen] = useState(false);
  const [metric, setMetric] = useState<keyof BodyLog>('weightKg');
  if (!profile) return null;

  const weights = logs.filter((l) => l.weightKg);
  const current = weights.at(-1)?.weightKg ?? profile.weightKg;
  const delta = current - (weights[0]?.weightKg ?? profile.weightKg);
  const bmi = current / (profile.heightCm / 100) ** 2;
  const m = MEASURES.find((x) => x.key === metric)!;
  const points = logs.filter((l) => l[metric] !== undefined).map((l) => ({ date: l.date, value: l[metric] as number }));
  const available = MEASURES.filter((x) => logs.some((l) => l[x.key] !== undefined));

  return (
    <>
      <div className="stat-grid">
        <div className="stat"><div className="num">{fmt(current)}</div><div className="lbl">kg oggi</div></div>
        <div className="stat"><div className="num">{delta > 0 ? '+' : ''}{fmt(delta)}</div><div className="lbl">kg dall’inizio</div></div>
        <div className="stat"><div className="num">{fmt(bmi)}</div><div className="lbl">BMI</div></div>
      </div>
      <button className="btn primary block" onClick={() => setOpen(true)}>Registra peso e misure</button>
      <p className="tiny muted">Pesati sempre nelle stesse condizioni: al mattino, a digiuno, dopo il bagno. Il peso oscilla di giorno in giorno: conta la tendenza.</p>

      {available.length > 0 && (
        <section className="card">
          <div className="chips" style={{ marginBottom: 10 }}>
            {available.map((x) => (
              <button key={x.key} className="chip" aria-pressed={metric === x.key} onClick={() => setMetric(x.key)}>{x.label}</button>
            ))}
          </div>
          {points.length > 0 && (
            <LineChart
              points={points}
              unit={m.unit}
              label={m.label}
              target={metric === 'weightKg' ? profile.targetWeightKg : undefined}
            />
          )}
        </section>
      )}

      {checkins.length > 0 && (
        <section>
          <h2>Controlli periodici</h2>
          {checkins.map((c) => (
            <details key={c.id} className="card" style={{ marginBottom: 10 }}>
              <summary><strong>Settimana {c.week}</strong> <span className="muted small">{formatDate(c.date, { day: 'numeric', month: 'long' })}</span></summary>
              <ul className="bullets small" style={{ marginTop: 8 }}>{c.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
              {c.notes && <p className="small muted">Note: {c.notes}</p>}
            </details>
          ))}
        </section>
      )}

      <MeasureSheet open={open} onClose={() => setOpen(false)} last={logs.at(-1)} fallbackWeight={profile.weightKg} />
    </>
  );
}

export function MeasureSheet({ open, onClose, last, fallbackWeight }: { open: boolean; onClose: () => void; last?: BodyLog; fallbackWeight: number }) {
  const [v, setV] = useState<Partial<BodyLog>>({});
  const value = (k: keyof BodyLog) => (v[k] ?? last?.[k] ?? (k === 'weightKg' ? fallbackWeight : 0)) as number;
  return (
    <Sheet open={open} onClose={onClose} label="Registra misure">
      <h2 style={{ marginTop: 0 }}>Peso e misure</h2>
      <p className="small muted">Usa un metro da sarta, senza stringere. Lascia a 0 le misure che non vuoi prendere.</p>
      <div className="stack">
        {MEASURES.map((x) => (
          <div key={x.key} className="row spread">
            <span><strong>{x.label}</strong> <span className="muted small">({x.unit})</span></span>
            <Stepper label={x.label} value={value(x.key)} step={x.key === 'weightKg' ? 0.1 : 0.5} onChange={(n) => setV((p) => ({ ...p, [x.key]: n }))} />
          </div>
        ))}
        <button
          className="btn primary block"
          onClick={async () => {
            const entry: BodyLog = { date: new Date().toISOString() };
            for (const x of MEASURES) {
              const n = value(x.key);
              if (n > 0) (entry[x.key] as number) = n;
            }
            await db.body.add(entry);
            setV({});
            onClose();
          }}
        >
          Salva misure
        </button>
      </div>
    </Sheet>
  );
}

function Strength() {
  const states = useLiveQuery(() => db.states.toArray(), [], [] as ExerciseState[]);
  const withHistory = states.filter((s) => s.history.length > 0);
  if (withHistory.length === 0) {
    return <div className="note">Qui vedrai come crescono i tuoi carichi. Completa il primo allenamento per iniziare.</div>;
  }
  return (
    <ul className="list card">
      {withHistory.map((s) => {
        const ex = getExercise(s.exerciseId);
        const first = s.history[0];
        const last = s.history.at(-1)!;
        const val = (h: typeof first) =>
          ex.kind === 'carico' ? `${fmt(h.weight)} kg × ${h.bestReps}` : ex.kind === 'tempo' ? `${h.seconds ?? 0} s` : `${h.bestReps} rip.`;
        return (
          <li key={s.exerciseId}>
            <Link className="list-item" to={`/esercizi/${ex.id}`}>
              <span className="grow">
                <strong>{ex.name}</strong>
                <span className="small muted">
                  {s.history.length === 1 ? `Primo: ${val(first)}` : `${val(first)} → ${val(last)}`} · {s.history.length} sedute
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Consistency() {
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [] as Session[]);
  const profile = useLiveQuery(() => db.profile.get('me'));
  if (!profile) return null;
  const weeks = 8;
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() - (weeks - 1) * 7);
  const doneDays = new Set(sessions.map((s) => new Date(s.date).toDateString()));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  const today = new Date();
  const month = sessions.filter((s) => new Date(s.date).getMonth() === today.getMonth() && new Date(s.date).getFullYear() === today.getFullYear());
  const rpes = sessions.slice(-10).map((s) => s.rpe);
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : undefined;
  const painful = sessions.filter((s) => s.pain.length).slice(-5).reverse();
  const minutes = sessions.reduce((a, s) => a + s.durationMin, 0);

  return (
    <>
      <div className="stat-grid">
        <div className="stat"><div className="num">{sessions.length}</div><div className="lbl">allenamenti</div></div>
        <div className="stat"><div className="num">{month.length}</div><div className="lbl">questo mese</div></div>
        <div className="stat"><div className="num">{Math.round(minutes / 60)}</div><div className="lbl">ore totali</div></div>
      </div>
      <section className="card">
        <h3>Ultime 8 settimane</h3>
        <div className="cal" style={{ margin: '8px 0 4px' }} role="img" aria-label={`${sessions.length} allenamenti registrati`}>
          {cells.map((d) => (
            <span
              key={d.toISOString()}
              title={formatDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}
              className={doneDays.has(d.toDateString()) ? 'on' : d > today ? '' : profile.trainingDays.includes(d.getDay()) ? 'planned' : ''}
            />
          ))}
        </div>
        <div className="tiny muted">Ogni riga è una settimana, da lunedì a domenica. Verde: allenamento fatto. Bordo: giorno previsto.</div>
      </section>
      {avgRpe !== undefined && (
        <div className="card small">
          Fatica media negli ultimi allenamenti: <span className="num" style={{ fontSize: 20 }}>{fmt(avgRpe)}/10</span>
          <div className="muted">{avgRpe >= 8.5 ? 'Molto alta: cura sonno e recupero.' : avgRpe <= 5 ? 'Bassa: puoi spingere un po’ di più.' : 'Nella zona giusta.'}</div>
        </div>
      )}
      {painful.length > 0 && (
        <section className="card small">
          <h3>Dolori segnalati</h3>
          <ul className="bullets">
            {painful.map((s) => (
              <li key={s.id}>{formatDate(s.date)}: {s.pain.map((z) => ZONES.find((x) => x.id === z)?.label).join(', ')}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

async function compress(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function Photos() {
  const photos = useLiveQuery(() => db.photos.orderBy('date').toArray(), [], [] as Photo[]);
  const [pose, setPose] = useState<Photo['pose']>('fronte');
  const [busy, setBusy] = useState(false);
  const ofPose = photos.filter((p) => p.pose === pose);
  const first = ofPose[0];
  const last = ofPose.at(-1);

  return (
    <>
      <p className="small muted">
        Le foto mostrano cambiamenti che la bilancia non vede. Scattale ogni 4 settimane, stessa luce, stessa posizione. Restano solo su questo telefono.
      </p>
      <div className="seg" role="group" aria-label="Posa">
        {(['fronte', 'lato', 'schiena'] as const).map((p) => (
          <button key={p} aria-pressed={pose === p} onClick={() => setPose(p)}>{p[0].toUpperCase() + p.slice(1)}</button>
        ))}
      </div>
      <label className="btn primary block" style={{ cursor: 'pointer' }}>
        {busy ? 'Salvataggio…' : 'Aggiungi foto'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setBusy(true);
            try {
              await db.photos.add({ date: new Date().toISOString(), pose, dataUrl: await compress(f) });
            } finally {
              setBusy(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      {first && last && first !== last && (
        <section className="card">
          <h3>Prima e dopo</h3>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            {[first, last].map((p) => (
              <figure key={p.id} style={{ margin: 0, flex: 1 }}>
                <img src={p.dataUrl} alt={`Foto ${pose} del ${formatDate(p.date)}`} style={{ borderRadius: 8, aspectRatio: '3/4', objectFit: 'cover', width: '100%' }} />
                <figcaption className="tiny muted center">{formatDate(p.date, { day: 'numeric', month: 'short', year: 'numeric' })}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
      {ofPose.length > 0 ? (
        <div className="photo-grid">
          {ofPose.slice().reverse().map((p) => (
            <button
              key={p.id}
              style={{ border: 0, padding: 0, background: 'none', cursor: 'pointer' }}
              onClick={async () => { if (confirm('Eliminare questa foto?')) await db.photos.delete(p.id!); }}
              aria-label={`Foto del ${formatDate(p.date)}: tocca per eliminare`}
            >
              <img src={p.dataUrl} alt="" />
              <span className="tiny muted">{formatDate(p.date)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="note">Nessuna foto «{pose}» ancora. Scatta la prima oggi: tra qualche settimana ti farà piacere confrontarla.</div>
      )}
    </>
  );
}
