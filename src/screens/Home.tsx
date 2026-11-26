import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, activeProgram } from '../db/db';
import { checkinDue, isDeloadWeek, programWeek, sessionsThisWeek, todayStatus } from '../logic/progression';
import { WEEKDAYS } from '../logic/goals';
import { formatDate } from '../components/ui';
import { getExercise } from '../data/exercises';
import type { Session } from '../types';

function estimateMinutes(day: { exercises: { sets: number; restSec: number }[]; finisher?: { minutes: number } }) {
  const work = day.exercises.reduce((m, e) => m + (e.sets * (40 + e.restSec)) / 60 + 1, 0);
  return Math.round((work + 12 + (day.finisher?.minutes ?? 0)) / 5) * 5;
}

function WeekBarbell({ planned, done, todayIdx }: { planned: number; done: number; todayIdx: number }) {
  const plates = Array.from({ length: Math.max(planned, done) }, (_, i) => i);
  return (
    <div>
      <div className="barbell" role="img" aria-label={`Questa settimana: ${done} allenamenti su ${planned}`}>
        <div className="bar end" />
        <div className="collar" />
        <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
          {plates.map((i) => (
            <div key={i} className={`plate p${i % 5}${i < done ? ' done' : ''}${i === todayIdx ? ' today' : ''}`} />
          ))}
        </div>
        <div className="bar mid" />
      </div>
      <div className="small muted">
        <span className="num" style={{ fontSize: 20, color: 'var(--ink)' }}>{done}/{planned}</span> allenamenti questa settimana
      </div>
    </div>
  );
}

export function Home() {
  const nav = useNavigate();
  const profile = useLiveQuery(() => db.profile.get('me'));
  const program = useLiveQuery(() => activeProgram());
  const sessions = useLiveQuery(() => db.sessions.orderBy('date').toArray(), [], [] as Session[]);
  const checkins = useLiveQuery(() => (program?.id ? db.checkins.where('programId').equals(program.id).toArray() : []), [program?.id], []);

  if (!profile || !program) return null;

  const status = todayStatus(profile, sessions);
  const week = programWeek(program);
  const deload = isDeloadWeek(program);
  const day = program.days[program.nextDay % program.days.length];
  const thisWeek = sessionsThisWeek(sessions);
  const due = checkinDue(program, checkins.map((c) => c.week));
  const last = sessions.slice(-3).reverse();
  const today = sessions.find((s) => new Date(s.date).toDateString() === new Date().toDateString());
  const programDone = week > program.weeks;

  return (
    <div style={{ paddingTop: 'calc(18px + env(safe-area-inset-top))' }} className="stack">
      <div className="row spread small">
        <span>Ciao {profile.name}</span>
        <span className="muted">
          {programDone ? 'Programma concluso' : `Settimana ${week} di ${program.weeks}`}
          {week <= 2 && ' · adattamento'}
          {deload && ' · scarico'}
        </span>
      </div>

      {due !== null && (
        <Link to="/checkin" className="note warn" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <strong>È ora del controllo delle {due} settimane.</strong> Pesati, prendi le misure e vediamo come stai andando.
        </Link>
      )}
      {programDone && due === null && (
        <Link to="/checkin" className="note" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <strong>Hai completato il programma.</strong> Fai il controllo finale per ricevere la nuova scheda.
        </Link>
      )}

      {status.kind === 'allenamento' && (
        <section>
          <div className="small muted">Oggi ti aspetta</div>
          <div className="hero-title">{day.name}</div>
          <p className="muted">
            {day.focus} · {day.exercises.length} esercizi · circa {estimateMinutes(day)} min
          </p>
          {status.trainedYesterday && (
            <div className="note warn" style={{ marginBottom: 12 }}>Ti sei allenato anche ieri: se ti senti ancora indolenzito, riduci i carichi oggi.</div>
          )}
          {deload && (
            <div className="note" style={{ marginBottom: 12 }}>Settimana di scarico: una serie in meno per esercizio, per far recuperare il corpo e ripartire più forte.</div>
          )}
          <button className="btn primary block" onClick={() => nav(`/allenamento/${program.nextDay}`)}>Inizia l’allenamento</button>
        </section>
      )}

      {status.kind === 'riposo' && (
        <section>
          <div className="small muted">Oggi</div>
          <div className="hero-title">Riposo</div>
          <p>I muscoli si rinforzano mentre riposi, non mentre ti alleni. Oggi puoi fare una camminata di 20–30 minuti e un po’ di stretching.</p>
          <p className="muted small">
            Prossimo allenamento: <strong>{WEEKDAYS[status.nextTraining.getDay()].toLowerCase()}</strong> — {day.name}.
          </p>
          <button className="btn secondary block" onClick={() => nav(`/allenamento/${program.nextDay}`)}>
            Mi alleno lo stesso
          </button>
          {status.trainedYesterday && <p className="tiny muted" style={{ marginTop: 6 }}>Hai già fatto un allenamento ieri: meglio recuperare.</p>}
        </section>
      )}

      {status.kind === 'fatto' && today && (
        <section>
          <div className="small muted">Oggi</div>
          <div className="hero-title">Fatto!</div>
          <p>
            Hai completato «{today.dayName}» in {today.durationMin} {today.durationMin === 1 ? 'minuto' : 'minuti'}. Ora recupera: idratati, mangia bene e dormi.
          </p>
          <p className="muted small">Prossimo allenamento: {WEEKDAYS[status.nextTraining.getDay()].toLowerCase()} — {day.name}.</p>
        </section>
      )}

      <section className="card">
        <WeekBarbell
          planned={profile.trainingDays.length}
          done={thisWeek.length}
          todayIdx={status.kind === 'allenamento' ? thisWeek.length : -1}
        />
      </section>

      <section>
        <h2>Prossimo allenamento</h2>
        <div className="card">
          <h3>{day.name}</h3>
          <ul className="list">
            {day.exercises.map((e) => {
              const ex = getExercise(e.exerciseId);
              return (
                <li key={e.exerciseId}>
                  <Link className="list-item" to={`/esercizi/${ex.id}`}>
                    <span className="grow">
                      <strong>{ex.name}</strong>
                      <span className="small muted">
                        {e.sets} serie × {e.seconds ? `${e.seconds} secondi` : `${e.repMin}–${e.repMax} ripetizioni`}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {last.length > 0 && (
        <section>
          <h2>Ultimi allenamenti</h2>
          <ul className="list card">
            {last.map((s) => (
              <li key={s.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="grow">
                  <strong>{s.dayName}</strong>
                  <span className="small muted">
                    {formatDate(s.date, { weekday: 'long', day: 'numeric', month: 'long' })} · {s.durationMin} min · fatica {s.rpe}/10
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
