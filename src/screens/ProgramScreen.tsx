import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, activeProgram } from '../db/db';
import { createProgram } from '../db/actions';
import { getExercise } from '../data/exercises';
import { GOALS } from '../logic/goals';
import { fmtKg, programWeek } from '../logic/progression';
import { Thumb, TopBar } from '../components/ui';
import type { ExerciseState } from '../types';

export function ProgramScreen() {
  const nav = useNavigate();
  const profile = useLiveQuery(() => db.profile.get('me'));
  const program = useLiveQuery(() => activeProgram());
  const states = useLiveQuery(() => db.states.toArray(), [], [] as ExerciseState[]);
  if (!profile || !program) return null;
  const byId = Object.fromEntries(states.map((s) => [s.exerciseId, s]));
  const g = GOALS[program.goal];

  const regenerate = async () => {
    if (!confirm('Creo una nuova scheda con esercizi diversi? I tuoi progressi e i carichi raggiunti restano salvati.')) return;
    await createProgram(profile, program.variant + 1);
  };

  return (
    <div className="stack">
      <TopBar title="La tua scheda" back={false} />
      <div className="card small">
        <div><strong>{program.splitName}</strong>, obiettivo «{g.label.toLowerCase()}»</div>
        <div className="muted">
          Settimana {Math.min(programWeek(program), program.weeks)} di {program.weeks}. Recupero tra le serie: {g.restMain} secondi negli esercizi principali.
        </div>
      </div>

      <details className="card small">
        <summary><strong>Come funziona la progressione</strong></summary>
        <ul className="bullets" style={{ marginTop: 8 }}>
          <li>Ogni esercizio ha un intervallo di ripetizioni, per esempio 10–15.</li>
          <li>Quando completi <strong>tutte le serie</strong> arrivando al numero più alto, la volta dopo aumento il peso.</li>
          <li>Negli esercizi a corpo libero, raggiunto l’obiettivo ti propongo la variante più difficile.</li>
          <li>Se segnali dolore o una fatica di 9–10, il carico resta uguale.</li>
          <li>Le prime 2 settimane hanno una serie in meno per abituarti; l’ultima è di scarico.</li>
        </ul>
      </details>

      {program.days.map((d, i) => (
        <section key={d.id} className="card">
          <div className="row spread">
            <div>
              <h3>{d.name}</h3>
              <div className="small muted">{d.focus}</div>
            </div>
            {i === program.nextDay && <span className="tag green">Prossimo</span>}
          </div>
          <ul className="list" style={{ marginTop: 8 }}>
            {d.exercises.map((p) => {
              const ex = getExercise(p.exerciseId);
              const st = byId[p.exerciseId];
              return (
                <li key={p.exerciseId}>
                  <Link className="list-item" to={`/esercizi/${ex.id}`}>
                    <Thumb ex={ex} />
                    <span className="grow">
                      <strong>{ex.name}</strong>
                      <span className="small muted">
                        {p.sets} × {ex.kind === 'tempo' ? `${st?.seconds ?? p.seconds} s` : ex.kind === 'corpo_libero' ? `${st?.reps ?? p.repMax} rip.` : `${p.repMin}–${p.repMax}`}
                        {ex.kind === 'carico' && st ? `, ${fmtKg(st.weight)}${(ex.increment ?? 0) < 0 ? ' di assistenza' : ''}` : ''}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {d.finisher && (
              <li className="list-item" style={{ cursor: 'default' }}>
                <Thumb ex={getExercise(d.finisher.exerciseId)} />
                <span className="grow">
                  <strong>Cardio: {getExercise(d.finisher.exerciseId).name}</strong>
                  <span className="small muted">{d.finisher.minutes} minuti</span>
                </span>
              </li>
            )}
          </ul>
          <button className="btn secondary block" style={{ marginTop: 10 }} onClick={() => nav(`/allenamento/${i}`)}>
            Inizia questo allenamento
          </button>
        </section>
      ))}

      <button className="btn block" onClick={regenerate}>Crea una scheda con esercizi diversi</button>
      <p className="tiny muted center">Per cambiare giorni, durata o attrezzi vai su Profilo.</p>
    </div>
  );
}
