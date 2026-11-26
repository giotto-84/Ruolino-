import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, activeProgram } from '../db/db';
import { createProgram } from '../db/actions';
import { buildCheckinReport, type CheckinReport } from '../logic/checkin';
import { checkinDue, programWeek } from '../logic/progression';
import { Chips, TopBar, fmt } from '../components/ui';
import { MeasureSheet } from './Progress';
import type { BodyLog } from '../types';

export function CheckinScreen() {
  const nav = useNavigate();
  const profile = useLiveQuery(() => db.profile.get('me'));
  const program = useLiveQuery(() => activeProgram());
  const body = useLiveQuery(() => db.body.orderBy('date').toArray(), [], [] as BodyLog[]);
  const checkins = useLiveQuery(() => (program?.id ? db.checkins.where('programId').equals(program.id).toArray() : []), [program?.id], []);
  const [measures, setMeasures] = useState(false);
  const [energy, setEnergy] = useState(0);
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState<CheckinReport | null>(null);
  if (!profile || !program) return null;

  const week = checkinDue(program, checkins.map((c) => c.week)) ?? Math.min(programWeek(program) - 1, program.weeks);
  const final = week >= program.weeks;
  const todayMeasured = body.some((b) => new Date(b.date).toDateString() === new Date().toDateString());

  const run = async () => {
    const [sessions, states] = await Promise.all([db.sessions.toArray(), db.states.toArray()]);
    const r = buildCheckinReport(profile, program, sessions, body, states);
    const summary = [
      `Allenamenti: ${r.sessionsDone} su ${r.sessionsPlanned} (${Math.round(r.adherence * 100)}%).`,
      r.weightDelta !== undefined ? `Peso: ${r.weightDelta > 0 ? '+' : ''}${fmt(r.weightDelta)} kg dall’inizio.` : '',
      r.waistDelta !== undefined ? `Vita: ${r.waistDelta > 0 ? '+' : ''}${fmt(r.waistDelta)} cm.` : '',
      `Energia percepita: ${energy}/5.`,
      ...r.advice,
    ].filter(Boolean);
    await db.checkins.add({ programId: program.id!, date: new Date().toISOString(), week, energy, notes, summary });
    if (r.boostCardio) {
      await db.programs.put({
        ...program,
        days: program.days.map((d) => (d.finisher ? { ...d, finisher: { ...d.finisher, minutes: Math.min(30, d.finisher.minutes + 5) } } : d)),
      });
    }
    setReport(r);
    window.scrollTo(0, 0);
  };

  if (report) {
    return (
      <div className="stack">
        <TopBar title={`Resoconto settimana ${week}`} />
        <div className="stat-grid">
          <div className="stat"><div className="num">{Math.round(report.adherence * 100)}%</div><div className="lbl">costanza</div></div>
          <div className="stat"><div className="num">{report.weightDelta !== undefined ? `${report.weightDelta > 0 ? '+' : ''}${fmt(report.weightDelta)}` : '–'}</div><div className="lbl">kg</div></div>
          <div className="stat"><div className="num">{report.improved.length}</div><div className="lbl">esercizi migliorati</div></div>
        </div>
        <div className={`note ${report.onTrack === 'sì' ? 'ok' : report.onTrack === 'no' ? 'warn' : ''}`}>
          <strong>
            {report.onTrack === 'sì' ? 'Sei sulla strada giusta.' : report.onTrack === 'quasi' ? 'Ci siamo quasi.' : report.onTrack === 'no' ? 'Serve qualche aggiustamento.' : 'Ecco come stai andando.'}
          </strong>
        </div>
        <ul className="bullets">{report.advice.map((a, i) => <li key={i}>{a}</li>)}</ul>
        {report.improved.length > 0 && (
          <section className="card small">
            <h3>Dove sei migliorato</h3>
            <ul className="list">
              {report.improved.map((x) => (
                <li key={x.name} className="list-item" style={{ cursor: 'default' }}>
                  <span className="grow"><strong>{x.name}</strong><span className="muted">{x.from} → {x.to}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {final ? (
          <>
            <div className="note">Il programma di {program.weeks} settimane è finito. La nuova scheda cambia gli esercizi per dare uno stimolo nuovo, mantenendo i carichi che hai raggiunto.</div>
            <button
              className="btn primary block"
              onClick={async () => {
                await createProgram(profile, program.variant + 1);
                nav('/scheda');
              }}
            >
              Crea la nuova scheda
            </button>
            <Link className="btn block" to="/benvenuto?modifica=1">Prima voglio cambiare obiettivo o attrezzi</Link>
          </>
        ) : (
          <Link className="btn primary block" to="/">Continua il programma</Link>
        )}
      </div>
    );
  }

  return (
    <div className="stack">
      <TopBar title={final ? 'Controllo finale' : `Controllo delle ${week} settimane`} />
      <p>Ogni 4 settimane confrontiamo dove sei con dove vuoi arrivare e, se serve, ricalibriamo il piano.</p>
      <section className="card stack">
        <h3>1. Pesati e prendi le misure</h3>
        {todayMeasured ? <div className="note ok">Misure di oggi registrate.</div> : <button className="btn secondary block" onClick={() => setMeasures(true)}>Registra peso e misure</button>}
        <p className="small muted" style={{ margin: 0 }}>Facoltativo ma utile: scatta le foto di confronto dalla sezione Progressi → Foto.</p>
      </section>
      <section className="card stack">
        <h3>2. Come ti senti?</h3>
        <div className="field">
          <span>Energia nella vita di tutti i giorni (1 = a terra, 5 = al massimo)</span>
          <Chips options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={energy ? [energy] : []} onChange={([v]) => setEnergy(v)} />
        </div>
        <label className="field">
          <span>Qualcosa da segnalare?</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Es. dormo meglio, il ginocchio non fa più male…" />
        </label>
      </section>
      <button className="btn primary block" disabled={!energy} onClick={run}>Vedi il resoconto</button>
      <MeasureSheet open={measures} onClose={() => setMeasures(false)} last={body.at(-1)} fallbackWeight={profile.weightKg} />
    </div>
  );
}
