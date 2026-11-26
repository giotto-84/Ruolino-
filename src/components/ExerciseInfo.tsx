import { Link } from 'react-router-dom';
import type { Exercise } from '../types';
import { EXERCISE_BY_ID, videoUrl } from '../data/exercises';
import { EQUIPMENT_NAME } from '../data/equipment';
import { ExerciseImage, Icon, PatternTag } from './ui';

const LEVEL = ['', 'Facile', 'Intermedio', 'Avanzato'];

export function ExerciseInfo({ ex, compact = false }: { ex: Exercise; compact?: boolean }) {
  const easier = ex.easier ? EXERCISE_BY_ID[ex.easier] : undefined;
  const harder = ex.harder ? EXERCISE_BY_ID[ex.harder] : undefined;
  const equipment = ex.equipment.map((req) => req.split('|').map((r) => EQUIPMENT_NAME[r]).join(' o '));

  return (
    <div className="stack">
      <ExerciseImage ex={ex} />
      <div className="row wrap">
        <PatternTag ex={ex} />
        <span className="tag">{LEVEL[ex.level]}</span>
        {ex.kind === 'corpo_libero' && <span className="tag">Corpo libero</span>}
      </div>
      <a className="btn secondary block" href={videoUrl(ex)} target="_blank" rel="noopener noreferrer">
        <Icon name="video" /> Guarda i video su YouTube
      </a>

      <div>
        <strong>Muscoli principali:</strong> {ex.muscles.join(', ')}
        {ex.secondary?.length ? <div className="small muted">Aiutano anche: {ex.secondary.join(', ')}</div> : null}
      </div>
      {equipment.length > 0 && (
        <div className="small">
          <strong>Ti serve:</strong> {equipment.join(', ')}
        </div>
      )}

      {ex.machineSetup && (
        <div className="card flat">
          <h3>Come regolare la macchina</h3>
          <ul className="bullets small">
            {ex.machineSetup.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
          <p className="tiny muted" style={{ margin: 0 }}>
            Ogni macchina è un po’ diversa: c’è quasi sempre un adesivo con le istruzioni. Se hai dubbi, chiedi all’istruttore di sala.
          </p>
        </div>
      )}

      <div>
        <h3>Posizione di partenza</h3>
        <ul className="bullets">
          {ex.setup.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      <div>
        <h3>Esecuzione</h3>
        <ol className="steps">
          {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>

      <div className="note">
        <strong>Respirazione:</strong> {ex.breathing}
      </div>

      <div>
        <h3>Errori da evitare</h3>
        <ul className="bullets">
          {ex.errors.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>

      {ex.tip && <div className="note ok">{ex.tip}</div>}

      {!compact && (easier || harder) && (
        <div className="card flat stack small">
          {easier && (
            <div>
              Troppo difficile? Prova <Link to={`/esercizi/${easier.id}`}>{easier.name}</Link>.
            </div>
          )}
          {harder && (
            <div>
              Quando diventa facile: <Link to={`/esercizi/${harder.id}`}>{harder.name}</Link>.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
