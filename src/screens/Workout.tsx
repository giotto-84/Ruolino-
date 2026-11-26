import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, activeProgram } from '../db/db';
import { finishSession, getStateFor, swapExercise, type FinishResult } from '../db/actions';
import { alternatives, cooldown, warmup } from '../logic/generator';
import { effectiveTarget, fmtKg, isDeloadWeek } from '../logic/progression';
import { ZONES } from '../logic/goals';
import { getExercise } from '../data/exercises';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { Chips, ExerciseImage, Icon, Sheet, Thumb } from '../components/ui';
import { Ring, mmss, useCountdown } from '../components/Timers';
import type { DayPlan, ExerciseLog, Profile, Program, Zone } from '../types';

const DRAFT_KEY = 'giotto-draft';

interface Draft {
  programId: number;
  dayId: string;
  startedAt: string;
  entries: ExerciseLog[];
  phase: number;
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}
function saveDraft(d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable: the workout still works, only without crash recovery */
  }
}

type PhaseDef = { kind: 'warmup' } | { kind: 'ex'; i: number } | { kind: 'finisher' } | { kind: 'cooldown' } | { kind: 'feedback' };

export function Workout() {
  const { day: dayParam } = useParams();
  const profile = useLiveQuery(() => db.profile.get('me'));
  const program = useLiveQuery(() => activeProgram());
  if (!profile || !program) return null;
  const day = program.days[Number(dayParam) % program.days.length];
  if (!day) return <p>Allenamento non trovato.</p>;
  return <WorkoutRunner key={day.id} profile={profile} program={program} day={day} />;
}

function WorkoutRunner({ profile, program, day }: { profile: Profile; program: Program; day: DayPlan }) {
  const nav = useNavigate();
  const [entries, setEntries] = useState<ExerciseLog[] | null>(null);
  const [phase, setPhase] = useState(0);
  const [startedAt, setStartedAt] = useState(new Date().toISOString());
  const [result, setResult] = useState<FinishResult | null>(null);
  const [firstTime, setFirstTime] = useState<Set<string>>(new Set());
  const rest = useCountdown();

  // Build today's log from the plan and the saved progression state (or resume a draft).
  useEffect(() => {
    (async () => {
      const draft = loadDraft();
      if (draft && draft.programId === program.id && draft.dayId === day.id) {
        setEntries(draft.entries);
        setPhase(draft.phase);
        setStartedAt(draft.startedAt);
        return;
      }
      const fresh = new Set<string>();
      const built: ExerciseLog[] = [];
      for (const planned of day.exercises) {
        const target = effectiveTarget(planned, program, profile);
        const st = await getStateFor(planned, profile);
        if (st.history.length === 0) fresh.add(planned.exerciseId);
        const ex = getExercise(planned.exerciseId);
        built.push({
          exerciseId: planned.exerciseId,
          target,
          sets: Array.from({ length: target.sets }, () => ({
            weight: st.weight,
            reps: ex.kind === 'corpo_libero' ? (st.reps ?? target.repMax) : target.repMin,
            seconds: ex.kind === 'tempo' ? (st.seconds ?? target.seconds) : undefined,
            done: false,
          })),
        });
      }
      setFirstTime(fresh);
      setEntries(built);
    })();
  }, [day, program, profile]);

  useEffect(() => {
    if (entries && program.id) saveDraft({ programId: program.id, dayId: day.id, startedAt, entries, phase });
  }, [entries, phase, program.id, day.id, startedAt]);

  const phases: PhaseDef[] = useMemo(() => {
    const list: PhaseDef[] = [{ kind: 'warmup' }];
    (entries ?? []).forEach((_, i) => list.push({ kind: 'ex', i }));
    if (day.finisher) list.push({ kind: 'finisher' });
    list.push({ kind: 'cooldown' }, { kind: 'feedback' });
    return list;
  }, [entries, day.finisher]);

  if (!entries) return null;

  if (result) return <Summary result={result} />;

  const cur = phases[Math.min(phase, phases.length - 1)];
  const go = (delta: number) => {
    rest.stop();
    setPhase((p) => Math.max(0, Math.min(phases.length - 1, p + delta)));
    window.scrollTo(0, 0);
  };

  const quit = () => {
    if (confirm('Vuoi interrompere l’allenamento? Quello che hai registrato finora andrà perso.')) {
      saveDraft(null);
      nav('/');
    }
  };

  const save = async (rpe: number, pain: Zone[], notes: string) => {
    const session = {
      date: new Date().toISOString(),
      programId: program.id!,
      dayId: day.id,
      dayName: day.name,
      entries: entries.filter((e) => e.sets.some((s) => s.done)),
      rpe,
      pain,
      notes,
      durationMin: Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 60000)),
      deload: isDeloadWeek(program),
    };
    const r = await finishSession(session, profile);
    saveDraft(null);
    setResult(r);
    window.scrollTo(0, 0);
  };

  return (
    <div style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))', paddingBottom: rest.running ? 120 : 0 }}>
      <div className="row spread">
        <button className="btn ghost small" onClick={quit}>Esci</button>
        <span className="small muted">{day.name}</span>
      </div>
      <div className="phase" aria-label={`Passo ${phase + 1} di ${phases.length}`}>
        {phases.map((_, i) => <i key={i} className={i < phase ? 'done' : i === phase ? 'on' : ''} />)}
      </div>

      {cur.kind === 'warmup' && (
        <GuidedList
          title="Riscaldamento"
          intro="Prepara muscoli e articolazioni: riduce il rischio di farti male e ti fa rendere di più."
          items={warmup(profile, day)}
          onDone={() => go(1)}
        />
      )}

      {cur.kind === 'ex' && (
        <ExerciseStep
          key={cur.i}
          entry={entries[cur.i]}
          index={cur.i}
          count={entries.length}
          profile={profile}
          firstTime={firstTime.has(entries[cur.i].exerciseId)}
          onChange={(e) => setEntries((all) => all!.map((x, j) => (j === cur.i ? e : x)))}
          onSetDone={(restSec) => rest.start(restSec)}
          onPrev={() => go(-1)}
          onNext={() => go(1)}
        />
      )}

      {cur.kind === 'finisher' && day.finisher && (
        <GuidedList
          title="Cardio finale"
          intro={`${day.finisher.minutes} minuti a intensità moderata: respiro accelerato, ma riesci a dire frasi brevi.`}
          items={[{ exerciseId: day.finisher.exerciseId, seconds: day.finisher.minutes * 60 }]}
          onDone={() => go(1)}
        />
      )}

      {cur.kind === 'cooldown' && (
        <GuidedList
          title="Defaticamento"
          intro="Allungamenti dolci, senza molleggiare. Devi sentire tirare, mai dolore."
          items={cooldown(day)}
          onDone={() => go(1)}
        />
      )}

      {cur.kind === 'feedback' && <Feedback onSave={save} onBack={() => go(-1)} />}

      {rest.running && (
        <div className="timer" role="timer" aria-live="off">
          <div className="timer-inner">
            <div style={{ position: 'relative' }}>
              <Ring left={rest.left} total={rest.total} />
            </div>
            <div className="grow">
              <div className="tiny" style={{ opacity: 0.8 }}>Recupero</div>
              <div className="count">{mmss(rest.left)}</div>
            </div>
            <button className="btn" onClick={() => rest.add(15)}>+15s</button>
            <button className="btn" onClick={rest.stop}>Salta</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GuidedList({
  title,
  intro,
  items,
  onDone,
}: {
  title: string;
  intro: string;
  items: { exerciseId: string; seconds: number }[];
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [info, setInfo] = useState(false);
  const item = items[i];
  const ex = getExercise(item.exerciseId);
  const timer = useCountdown(() => {
    if (i < items.length - 1) {
      setI(i + 1);
      setTimeout(() => timer.start(items[i + 1].seconds), 600);
    }
  });
  const last = i === items.length - 1;

  return (
    <div className="stack">
      <h1>{title}</h1>
      <p className="muted">{intro}</p>
      <div className="card stack">
        <div className="row spread small muted">
          <span>{i + 1} di {items.length}</span>
          <button className="btn ghost small" onClick={() => setInfo(true)}><Icon name="info" /> Come si fa</button>
        </div>
        <h3>{ex.name}</h3>
        <ExerciseImage ex={ex} />
        <p className="small">{ex.steps[0]}</p>
        <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
          <div style={{ position: 'relative', color: 'var(--ink)' }}>
            <Ring left={timer.running ? timer.left : item.seconds} total={item.seconds} size={96} />
          </div>
          <div className="big-target">{mmss(timer.running ? timer.left : item.seconds)}</div>
        </div>
        {timer.running ? (
          <button className="btn block" onClick={timer.stop}>Pausa</button>
        ) : (
          <button className="btn secondary block" onClick={() => timer.start(timer.left || item.seconds)}>
            <Icon name="play" /> Avvia
          </button>
        )}
      </div>
      <div className="row">
        {!last && (
          <button className="btn grow" onClick={() => { timer.stop(); setI(i + 1); }}>Prossimo</button>
        )}
        <button className="btn primary grow" onClick={() => { timer.stop(); onDone(); }}>
          {last ? 'Fatto, avanti' : 'Salta tutto'}
        </button>
      </div>
      <ul className="list">
        {items.map((it, j) => {
          const e = getExercise(it.exerciseId);
          return (
            <li key={j} className="list-item" style={{ opacity: j < i ? 0.5 : 1, cursor: 'default' }}>
              <Thumb ex={e} />
              <span className="grow">
                <strong>{e.name}</strong>
                <span className="small muted">{mmss(it.seconds)}{it.seconds >= 60 ? ' min' : ' secondi'}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <Sheet open={info} onClose={() => setInfo(false)} label={ex.name}>
        <h2 style={{ marginTop: 0 }}>{ex.name}</h2>
        <ExerciseInfo ex={ex} compact />
      </Sheet>
    </div>
  );
}

function ExerciseStep({
  entry,
  index,
  count,
  profile,
  firstTime,
  onChange,
  onSetDone,
  onPrev,
  onNext,
}: {
  entry: ExerciseLog;
  index: number;
  count: number;
  profile: Profile;
  firstTime: boolean;
  onChange: (e: ExerciseLog) => void;
  onSetDone: (restSec: number) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  const ex = getExercise(entry.exerciseId);
  const [info, setInfo] = useState(firstTime);
  const [swap, setSwap] = useState(false);
  const [activeTimed, setActiveTimed] = useState<number | null>(null);
  const setTimer = useCountdown(() => {
    if (activeTimed !== null) toggle(activeTimed, true);
  });
  const t = entry.target;
  const assisted = (ex.increment ?? 0) < 0;
  const allDone = entry.sets.every((s) => s.done);

  const update = (i: number, patch: Partial<ExerciseLog['sets'][number]>) =>
    onChange({ ...entry, sets: entry.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  function toggle(i: number, force?: boolean) {
    const done = force ?? !entry.sets[i].done;
    const sets = entry.sets.map((s, j) => {
      if (j === i) return { ...s, done };
      // carry a changed weight forward to the next sets not yet done
      if (j > i && done && !s.done && ex.kind === 'carico') return { ...s, weight: entry.sets[i].weight };
      return s;
    });
    onChange({ ...entry, sets });
    setActiveTimed(null);
    if (done && i < entry.sets.length - 1) onSetDone(t.restSec);
  }

  const targetText =
    ex.kind === 'tempo'
      ? `${t.sets} × ${entry.sets[0]?.seconds ?? t.seconds} s`
      : `${t.sets} × ${ex.kind === 'corpo_libero' ? entry.sets[0]?.reps ?? t.repMax : `${t.repMin}–${t.repMax}`}`;

  return (
    <div className="stack">
      <div className="small muted">Esercizio {index + 1} di {count}</div>
      <h1>{ex.name}</h1>
      <ExerciseImage ex={ex} />
      <div className="row">
        <button className="btn secondary grow small" onClick={() => setInfo(true)}><Icon name="info" /> Come si fa</button>
        <button className="btn grow small" onClick={() => setSwap(true)}><Icon name="swap" /> Cambia</button>
      </div>

      <div className="card">
        <div className="row spread">
          <div>
            <div className="big-target">{targetText}</div>
            <div className="small muted">
              {ex.kind === 'tempo' ? 'serie × secondi' : ex.kind === 'corpo_libero' ? 'serie × ripetizioni' : 'serie × ripetizioni'}
              {ex.kind === 'carico' && entry.sets[0] && ` con ${fmtKg(entry.sets[0].weight)}${assisted ? ' di assistenza' : ''}`}
            </div>
          </div>
          <div className="tag yellow">Recupero {mmss(t.restSec)}{t.restSec >= 60 ? ' min' : ' s'}</div>
        </div>

        {firstTime && ex.kind === 'carico' && (
          <div className="note warn" style={{ marginTop: 12 }}>
            Prima volta: il peso è un punto di partenza. Nella prima serie, se arrivi a {t.repMax} ripetizioni e potresti farne ancora 4–5, aumentalo. Se non arrivi a {t.repMin}, diminuiscilo.
          </div>
        )}

        <div style={{ marginTop: 10 }}>
          {entry.sets.map((s, i) => (
            <div className="set-row" key={i}>
              <span className="idx">{i + 1}</span>
              {ex.kind === 'carico' ? (
                <label>
                  <input
                    inputMode="decimal"
                    value={String(s.weight).replace('.', ',')}
                    onChange={(e) => update(i, { weight: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                    aria-label={`Serie ${i + 1}: ${assisted ? 'assistenza' : 'peso'} in kg`}
                  />
                  <span className="unit">{assisted ? 'kg assist.' : 'kg'}</span>
                </label>
              ) : ex.kind === 'tempo' ? (
                <button
                  className="btn small"
                  onClick={() => {
                    setActiveTimed(i);
                    setTimer.start(s.seconds ?? 30);
                  }}
                  disabled={s.done}
                >
                  {activeTimed === i && setTimer.running ? mmss(setTimer.left) : <><Icon name="play" size={18} /> Via</>}
                </button>
              ) : (
                <span className="small muted">corpo libero</span>
              )}
              <label>
                <input
                  inputMode="numeric"
                  value={ex.kind === 'tempo' ? String(s.seconds ?? '') : String(s.reps)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 0;
                    update(i, ex.kind === 'tempo' ? { seconds: v } : { reps: v });
                  }}
                  aria-label={`Serie ${i + 1}: ${ex.kind === 'tempo' ? 'secondi' : 'ripetizioni'}`}
                />
                <span className="unit">{ex.kind === 'tempo' ? 'secondi' : 'ripetizioni'}</span>
              </label>
              <button
                className="check"
                aria-pressed={s.done}
                aria-label={`Serie ${i + 1} ${s.done ? 'completata' : 'da completare'}`}
                onClick={() => toggle(i)}
              >
                <Icon name="check" />
              </button>
            </div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8, marginBottom: 0 }}>
          Scrivi quante ripetizioni hai fatto davvero prima di spuntare la serie. Il peso aumenta solo quando arrivi al massimo in tutte le serie.
        </p>
      </div>

      <div className="row">
        <button className="btn" onClick={onPrev}>Indietro</button>
        <button className={`btn grow ${allDone ? 'primary' : ''}`} onClick={onNext}>
          {index === count - 1 ? 'Ho finito gli esercizi' : 'Prossimo esercizio'}
        </button>
      </div>

      <Sheet open={info} onClose={() => setInfo(false)} label={ex.name}>
        <h2 style={{ marginTop: 0 }}>{ex.name}</h2>
        <ExerciseInfo ex={ex} compact />
      </Sheet>

      <Sheet open={swap} onClose={() => setSwap(false)} label="Cambia esercizio">
        <h2 style={{ marginTop: 0 }}>Cambia esercizio</h2>
        <p className="small muted">Macchina occupata, attrezzo mancante o fastidio? Scegli un’alternativa che lavora sugli stessi muscoli.</p>
        <ul className="list">
          {alternatives(ex.id, profile).map((alt) => (
            <li key={alt.id} className="list-item" style={{ cursor: 'default' }}>
              <Thumb ex={alt} />
              <span className="grow">
                <strong>{alt.name}</strong>
                <span className="row" style={{ marginTop: 6 }}>
                  <button
                    className="btn small"
                    onClick={async () => {
                      const st = await getStateFor({ ...t, exerciseId: alt.id }, profile);
                      onChange({
                        exerciseId: alt.id,
                        target: { ...t, exerciseId: alt.id, seconds: alt.kind === 'tempo' ? t.seconds ?? 30 : undefined },
                        sets: entry.sets.map(() => ({
                          weight: st.weight,
                          reps: alt.kind === 'corpo_libero' ? st.reps ?? t.repMax : t.repMin,
                          seconds: alt.kind === 'tempo' ? st.seconds ?? 30 : undefined,
                          done: false,
                        })),
                      });
                      setSwap(false);
                    }}
                  >
                    Solo oggi
                  </button>
                  <button
                    className="btn small secondary"
                    onClick={async () => {
                      await swapExercise(ex.id, alt.id, profile);
                      const st = await getStateFor({ ...t, exerciseId: alt.id }, profile);
                      onChange({
                        exerciseId: alt.id,
                        target: { ...t, exerciseId: alt.id },
                        sets: entry.sets.map(() => ({
                          weight: st.weight,
                          reps: alt.kind === 'corpo_libero' ? st.reps ?? t.repMax : t.repMin,
                          seconds: alt.kind === 'tempo' ? st.seconds ?? 30 : undefined,
                          done: false,
                        })),
                      });
                      setSwap(false);
                    }}
                  >
                    Sempre
                  </button>
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  );
}

const RPE_TEXT: Record<number, string> = {
  1: 'Riposo',
  2: 'Molto facile',
  3: 'Facile',
  4: 'Abbastanza facile',
  5: 'Moderato',
  6: 'Impegnativo ma ok',
  7: 'Duro',
  8: 'Molto duro',
  9: 'Quasi al limite',
  10: 'Al limite assoluto',
};

function Feedback({ onSave, onBack }: { onSave: (rpe: number, pain: Zone[], notes: string) => Promise<void>; onBack: () => void }) {
  const [rpe, setRpe] = useState(0);
  const [painAny, setPainAny] = useState<boolean | null>(null);
  const [pain, setPain] = useState<Zone[]>([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="stack">
      <h1>Com’è andata?</h1>
      <div className="field">
        <span>Quanto è stato faticoso, da 1 a 10?</span>
        <div className="rpe" role="group" aria-label="Fatica percepita">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} aria-pressed={rpe === n} onClick={() => setRpe(n)}>{n}</button>
          ))}
        </div>
        <div className="small muted" style={{ marginTop: 6 }}>{rpe ? RPE_TEXT[rpe] : 'Tocca un numero'}</div>
      </div>
      <div className="field">
        <span>Hai sentito dolore (non la normale fatica muscolare)?</span>
        <Chips
          options={[{ value: 'no', label: 'No' }, { value: 'si', label: 'Sì' }]}
          value={painAny === null ? [] : [painAny ? 'si' : 'no']}
          onChange={([v]) => { setPainAny(v === 'si'); if (v === 'no') setPain([]); }}
        />
      </div>
      {painAny && (
        <div className="field">
          <span>Dove?</span>
          <Chips multi options={ZONES.map((z) => ({ value: z.id, label: z.label }))} value={pain} onChange={(v) => setPain(v as Zone[])} />
          <div className="note warn" style={{ marginTop: 10 }}>
            Per gli esercizi che coinvolgono questa zona non aumenterò il carico. Se il dolore è forte o dura più di qualche giorno, rivolgiti a un medico o a un fisioterapista.
          </div>
        </div>
      )}
      <label className="field">
        <span>Note (facoltativo)</span>
        <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. leg press occupata, dormito poco…" />
      </label>
      <div className="row">
        <button className="btn" onClick={onBack}>Indietro</button>
        <button
          className="btn primary grow"
          disabled={!rpe || painAny === null || busy}
          onClick={async () => { setBusy(true); await onSave(rpe, pain, notes); }}
        >
          Salva allenamento
        </button>
      </div>
    </div>
  );
}

function Summary({ result }: { result: FinishResult }) {
  const tone = { up: 'ok', same: '', down: 'warn', swap: 'ok' } as const;
  return (
    <div className="stack" style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
      <div className="hero-title">Allenamento salvato</div>
      <p>Ecco cosa cambia dalla prossima volta:</p>
      {result.results.map(({ exerciseId, result: r }) => (
        <div key={exerciseId} className={`note ${tone[r.tone]}`}>
          <strong>{getExercise(exerciseId).name}</strong>
          <div>{r.message}</div>
        </div>
      ))}
      {result.results.length === 0 && <div className="note">Non hai registrato serie completate in questa seduta.</div>}
      <Link to="/" className="btn primary block">Torna a Oggi</Link>
    </div>
  );
}
