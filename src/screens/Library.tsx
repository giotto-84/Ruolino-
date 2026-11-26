import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { EXERCISES, PATTERN_LABEL } from '../data/exercises';
import { canDo } from '../logic/generator';
import { Thumb, TopBar } from '../components/ui';
import type { Pattern } from '../types';

const GROUPS: { label: string; patterns: Pattern[] }[] = [
  { label: 'Gambe e glutei', patterns: ['squat', 'hinge', 'affondo', 'glutei', 'estensione_gamba', 'flessione_gamba', 'polpacci'] },
  { label: 'Petto', patterns: ['spinta_orizzontale', 'spinta_inclinata'] },
  { label: 'Schiena', patterns: ['tirata_orizzontale', 'tirata_verticale'] },
  { label: 'Spalle', patterns: ['spinta_verticale', 'alzate_laterali', 'deltoide_posteriore'] },
  { label: 'Braccia', patterns: ['bicipiti', 'tricipiti'] },
  { label: 'Addome', patterns: ['core', 'core_anti_rotazione'] },
  { label: 'Cardio', patterns: ['cardio'] },
  { label: 'Riscaldamento e stretching', patterns: ['mobilita', 'stretching'] },
];

export function Library() {
  const profile = useLiveQuery(() => db.profile.get('me'));
  const [q, setQ] = useState('');
  const [group, setGroup] = useState(0);
  const [onlyMine, setOnlyMine] = useState(true);
  const equipment = useMemo(() => new Set(profile?.equipment ?? []), [profile]);

  const term = q.trim().toLowerCase();
  const list = EXERCISES.filter((e) =>
    term
      ? e.name.toLowerCase().includes(term) || e.muscles.some((m) => m.toLowerCase().includes(term))
      : GROUPS[group].patterns.includes(e.pattern),
  ).filter((e) => !onlyMine || canDo(e, equipment));

  return (
    <div className="stack">
      <TopBar title="Esercizi" back={false} />
      <input className="input" type="search" placeholder="Cerca per nome o muscolo" value={q} onChange={(e) => setQ(e.target.value)} />
      {!term && (
        <div className="chips">
          {GROUPS.map((g, i) => (
            <button key={g.label} className="chip" aria-pressed={group === i} onClick={() => setGroup(i)}>{g.label}</button>
          ))}
        </div>
      )}
      <label className="row small">
        <input type="checkbox" checked={onlyMine} onChange={(e) => setOnlyMine(e.target.checked)} style={{ width: 20, height: 20 }} />
        Solo quelli che posso fare con i miei attrezzi
      </label>
      <ul className="list card">
        {list.map((e) => (
          <li key={e.id}>
            <Link className="list-item" to={`/esercizi/${e.id}`}>
              <Thumb ex={e} />
              <span className="grow">
                <strong>{e.name}</strong>
                <span className="small muted">{PATTERN_LABEL[e.pattern]} · {e.muscles.slice(0, 2).join(', ')}</span>
              </span>
            </Link>
          </li>
        ))}
        {list.length === 0 && <li className="small muted" style={{ padding: 12 }}>Nessun esercizio trovato. Prova a togliere il filtro sugli attrezzi.</li>}
      </ul>
    </div>
  );
}
