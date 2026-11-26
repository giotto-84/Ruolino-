import { useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { EXERCISE_BY_ID } from '../data/exercises';
import { ExerciseInfo } from '../components/ExerciseInfo';
import { LineChart } from '../components/LineChart';
import { TopBar } from '../components/ui';

export function ExerciseDetail() {
  const { id = '' } = useParams();
  const ex = EXERCISE_BY_ID[id];
  const state = useLiveQuery(() => db.states.get(id), [id]);
  if (!ex) return <TopBar title="Esercizio non trovato" />;

  const history = state?.history ?? [];
  const points =
    ex.kind === 'carico'
      ? history.map((h) => ({ date: h.date, value: h.weight }))
      : ex.kind === 'tempo'
        ? history.map((h) => ({ date: h.date, value: h.seconds ?? 0 }))
        : history.map((h) => ({ date: h.date, value: h.bestReps }));
  const unit = ex.kind === 'carico' ? 'kg' : ex.kind === 'tempo' ? 's' : 'rip.';

  return (
    <div className="stack">
      <TopBar title={ex.name} />
      <ExerciseInfo ex={ex} />
      {points.length > 0 && (
        <section className="card">
          <h3>I tuoi progressi</h3>
          <LineChart
            points={points}
            unit={unit}
            label={ex.kind === 'carico' ? `Carico su ${ex.name}` : `Migliore serie su ${ex.name}`}
          />
        </section>
      )}
    </div>
  );
}
