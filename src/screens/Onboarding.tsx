import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../db/db';
import { createProgram, saveProfile } from '../db/actions';
import { Chips, Stepper } from '../components/ui';
import { EQUIPMENT, LOCATION_PRESETS } from '../data/equipment';
import { GOALS, PARQ_QUESTIONS, WEEKDAYS_SHORT, ZONES, suggestedDays } from '../logic/goals';
import type { Goal, Location, Profile, Zone } from '../types';

const EMPTY: Profile = {
  id: 'me',
  name: '',
  age: 30,
  sex: 'M',
  heightCm: 170,
  weightKg: 70,
  parq: {},
  medicalClearance: false,
  injuries: [],
  injuryNotes: '',
  job: 'sedentario',
  sleepHours: 7,
  stress: 3,
  experience: 'nessuna',
  daysPerWeek: 3,
  trainingDays: [1, 3, 5],
  minutesPerSession: 60,
  location: 'palestra',
  equipment: LOCATION_PRESETS.palestra.equipment,
  goal: 'tonificazione',
  targetText: '',
  targetWeeks: 12,
  reminderTime: '18:30',
  createdAt: '',
};

const STEPS = ['Ciao', 'Chi sei', 'Salute', 'Dolori e stile di vita', 'Obiettivo', 'Tempo', 'Attrezzi', 'Riepilogo'];

export function Onboarding() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const editing = params.has('modifica');
  const [p, setP] = useState<Profile>(EMPTY);
  const [step, setStep] = useState(editing ? 1 : 0);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    db.profile.get('me').then((existing) => {
      if (existing) {
        setP(existing);
        const risk = Object.values(existing.parq).some(Boolean);
        if (risk && !existing.medicalClearance) {
          setBlocked(true);
          setStep(2);
        }
      }
    });
  }, []);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const parqQs = PARQ_QUESTIONS.filter((q) => !q.onlyF || p.sex === 'F');
  const parqAnswered = parqQs.every((q) => q.id in p.parq);
  const parqRisk = parqQs.some((q) => p.parq[q.id]);

  const canNext = (() => {
    switch (step) {
      case 0: return p.name.trim().length > 0;
      case 1: return p.age >= 14 && p.age <= 99 && p.heightCm > 100 && p.weightKg > 30;
      case 2: return parqAnswered;
      case 5: return p.trainingDays.length > 0;
      case 6: return p.equipment.length > 0;
      default: return true;
    }
  })();

  const next = async () => {
    if (step === 2 && parqRisk && !p.medicalClearance) {
      await saveProfile({ ...p, createdAt: p.createdAt || new Date().toISOString() });
      setBlocked(true);
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
    window.scrollTo(0, 0);
  };

  const finish = async () => {
    setBusy(true);
    const profile: Profile = {
      ...p,
      name: p.name.trim(),
      daysPerWeek: p.trainingDays.length,
      createdAt: p.createdAt || new Date().toISOString(),
    };
    await saveProfile(profile);
    if (!editing) {
      await db.body.add({ date: new Date().toISOString(), weightKg: profile.weightKg, waistCm: profile.waistCm });
    }
    const old = await db.programs.toArray();
    const variant = old.length ? Math.max(...old.map((o) => o.variant)) : 0;
    await createProgram(profile, variant);
    nav('/scheda', { replace: true });
  };

  if (blocked) {
    return (
      <div className="stack" style={{ paddingTop: 'calc(24px + env(safe-area-inset-top))' }}>
        <h1>Prima di iniziare, parla con il tuo medico</h1>
        <div className="note danger">
          Hai risposto «sì» ad almeno una domanda sulla salute. Non significa che non puoi allenarti, ma un medico deve
          valutare quali attività sono sicure per te.
        </div>
        <p>Cosa fare:</p>
        <ol className="steps">
          <li>Prenota una visita dal tuo medico di base o da un medico dello sport.</li>
          <li>Porta con te le risposte che hai dato (le trovi qui sotto).</li>
          <li>Chiedi un certificato o un via libera per l’attività fisica non agonistica, con eventuali limitazioni.</li>
        </ol>
        <div className="card flat">
          <h3>Le tue risposte «sì»</h3>
          <ul className="bullets small">
            {parqQs.filter((q) => p.parq[q.id]).map((q) => <li key={q.id}>{q.text}</li>)}
          </ul>
        </div>
        <label className="option" style={{ alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={p.medicalClearance}
            onChange={(e) => set('medicalClearance', e.target.checked)}
            style={{ width: 24, height: 24 }}
          />
          <span>Il mio medico mi ha dato il via libera per allenarmi</span>
        </label>
        <button
          className="btn primary block"
          disabled={!p.medicalClearance}
          onClick={async () => {
            await saveProfile(p);
            setBlocked(false);
            setStep(3);
          }}
        >
          Continua
        </button>
        <button className="btn ghost block" onClick={() => { setBlocked(false); setStep(2); }}>
          Rivedi le risposte
        </button>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 'calc(16px + env(safe-area-inset-top))' }}>
      <div className="row spread small muted">
        <span>{STEPS[step]}</span>
        <span>{step + 1} di {STEPS.length}</span>
      </div>
      <div className="progress-bar" aria-hidden="true">
        {STEPS.map((_, i) => <i key={i} className={i <= step ? 'on' : ''} />)}
      </div>

      <div className="stack">
        {step === 0 && (
          <>
            <div className="hero-title">Giotto<br />PT</div>
            <p>
              Sarò il tuo personal trainer. Ti faccio qualche domanda per costruire una scheda adatta a te, poi ti spiego
              ogni esercizio passo passo e tengo traccia dei tuoi progressi.
            </p>
            <p className="muted small">Ci vogliono circa 5 minuti. I tuoi dati restano solo su questo telefono.</p>
            <label className="field">
              <span>Come ti chiami?</span>
              <input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="given-name" />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Parlami di te</h1>
            <div className="field"><span>Sesso</span>
              <Chips options={[{ value: 'M', label: 'Uomo' }, { value: 'F', label: 'Donna' }]} value={[p.sex]} onChange={([v]) => set('sex', v as Profile['sex'])} />
            </div>
            <div className="row spread"><span className="field"><span>Età</span></span><Stepper label="età" value={p.age} onChange={(v) => set('age', v)} min={14} max={99} /></div>
            <div className="row spread"><span className="field"><span>Altezza (cm)</span></span><Stepper label="altezza" value={p.heightCm} onChange={(v) => set('heightCm', v)} min={120} max={230} /></div>
            <div className="row spread"><span className="field"><span>Peso (kg)</span></span><Stepper label="peso" value={p.weightKg} step={0.5} onChange={(v) => set('weightKg', v)} min={30} max={250} /></div>
            <div className="row spread">
              <span className="field"><span>Giro vita (cm)</span><span className="tiny muted" style={{ fontWeight: 400 }}>Facoltativo: metro all’altezza dell’ombelico</span></span>
              <Stepper label="giro vita" value={p.waistCm ?? 0} onChange={(v) => set('waistCm', v || undefined)} min={0} max={200} />
            </div>
            <div className="field"><span>Esperienza con l’allenamento</span>
              <Chips
                options={[{ value: 'nessuna', label: 'Mai fatto' }, { value: 'poca', label: 'Qualche volta, tempo fa' }]}
                value={[p.experience]}
                onChange={([v]) => set('experience', v as Profile['experience'])}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>La tua salute</h1>
            <p className="small muted">
              Sono le domande del questionario PAR-Q, usato in tutto il mondo prima di iniziare un’attività fisica. Rispondi con sincerità.
            </p>
            {parqQs.map((q) => (
              <div key={q.id} className="card flat">
                <div>{q.text}</div>
                <div className="yesno">
                  {[false, true].map((v) => (
                    <button
                      key={String(v)}
                      type="button"
                      className="chip"
                      aria-pressed={p.parq[q.id] === v}
                      onClick={() => set('parq', { ...p.parq, [q.id]: v })}
                    >
                      {v ? 'Sì' : 'No'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <h1>Dolori e stile di vita</h1>
            <div className="field"><span>Hai dolori o vecchi infortuni in qualche zona?</span>
              <Chips multi options={ZONES.map((z) => ({ value: z.id, label: z.label }))} value={p.injuries} onChange={(v) => set('injuries', v as Zone[])} />
              {p.injuries.length > 0 && (
                <p className="tiny muted" style={{ marginTop: 6 }}>Eviterò gli esercizi che caricano queste zone quando esiste un’alternativa.</p>
              )}
            </div>
            <label className="field"><span>Vuoi aggiungere dettagli? (interventi, diagnosi…)</span>
              <textarea className="input" value={p.injuryNotes} onChange={(e) => set('injuryNotes', e.target.value)} />
            </label>
            <div className="field"><span>Il tuo lavoro</span>
              <Chips
                options={[{ value: 'sedentario', label: 'Seduto quasi sempre' }, { value: 'misto', label: 'Un po’ e un po’' }, { value: 'attivo', label: 'Sempre in piedi o in movimento' }]}
                value={[p.job]}
                onChange={([v]) => set('job', v as Profile['job'])}
              />
            </div>
            <div className="row spread"><span className="field"><span>Ore di sonno a notte</span></span><Stepper label="ore di sonno" value={p.sleepHours} step={0.5} onChange={(v) => set('sleepHours', v)} min={3} max={12} /></div>
            <div className="field"><span>Livello di stress (1 = rilassato, 5 = molto stressato)</span>
              <Chips options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: String(n) }))} value={[p.stress]} onChange={([v]) => set('stress', v as Profile['stress'])} />
            </div>
            {(p.sleepHours < 6 || p.stress >= 4) && (
              <div className="note warn">Sonno e stress influenzano molto i risultati: terrò le prime settimane più leggere.</div>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h1>Cosa vuoi ottenere?</h1>
            {(Object.keys(GOALS) as Goal[]).map((g) => (
              <button key={g} type="button" className="option" aria-pressed={p.goal === g} onClick={() => set('goal', g)}>
                <span><strong>{GOALS[g].label}</strong><span className="small muted">{GOALS[g].description}</span></span>
              </button>
            ))}
            <label className="field"><span>Descrivi il risultato che vorresti raggiungere</span>
              <input className="input" placeholder="Es. entrare nei jeans di due anni fa, fare 10 piegamenti" value={p.targetText} onChange={(e) => set('targetText', e.target.value)} />
            </label>
            {(p.goal === 'dimagrimento' || p.goal === 'massa') && (
              <div className="row spread"><span className="field"><span>Peso obiettivo (kg)</span></span>
                <Stepper label="peso obiettivo" value={p.targetWeightKg ?? p.weightKg} step={0.5} onChange={(v) => set('targetWeightKg', v)} min={35} max={250} />
              </div>
            )}
            <div className="row spread"><span className="field"><span>In quante settimane?</span></span>
              <Stepper label="settimane" value={p.targetWeeks} step={4} onChange={(v) => set('targetWeeks', v)} min={4} max={52} />
            </div>
            {p.targetWeightKg && p.goal === 'dimagrimento' && p.weightKg - p.targetWeightKg > p.weightKg * 0.01 * p.targetWeeks && (
              <div className="note warn">
                Perdere {(p.weightKg - p.targetWeightKg).toFixed(1).replace('.', ',')} kg in {p.targetWeeks} settimane è più dell’1% a settimana: è rischioso.
                Un obiettivo realistico è circa {Math.round(((p.weightKg - p.targetWeightKg) / (p.weightKg * 0.007)) / 4) * 4} settimane.
              </div>
            )}
          </>
        )}

        {step === 5 && (
          <>
            <h1>Quanto tempo hai?</h1>
            <div className="field"><span>Quanti giorni a settimana?</span>
              <Chips
                options={[2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
                value={[p.trainingDays.length]}
                onChange={([n]) => setP((prev) => ({ ...prev, daysPerWeek: n, trainingDays: suggestedDays(n) }))}
              />
              {p.experience === 'nessuna' && p.trainingDays.length > 4 && (
                <p className="tiny muted" style={{ marginTop: 6 }}>Per chi inizia, 3 giorni bastano e lasciano tempo per recuperare.</p>
              )}
            </div>
            <div className="field"><span>Quali giorni? (tra un giorno e l’altro ti consiglio un giorno di riposo)</span>
              <Chips
                multi
                options={[1, 2, 3, 4, 5, 6, 0].map((d) => ({ value: d, label: WEEKDAYS_SHORT[d] }))}
                value={p.trainingDays}
                onChange={(v) => set('trainingDays', [...v].sort())}
              />
            </div>
            <div className="field"><span>Quanto può durare un allenamento?</span>
              <Chips
                options={[30, 45, 60, 75, 90].map((n) => ({ value: n, label: `${n} min` }))}
                value={[p.minutesPerSession]}
                onChange={([v]) => set('minutesPerSession', v)}
              />
            </div>
            <label className="field"><span>A che ora ti alleni di solito? (per i promemoria)</span>
              <input className="input" type="time" value={p.reminderTime} onChange={(e) => set('reminderTime', e.target.value)} />
            </label>
          </>
        )}

        {step === 6 && (
          <>
            <h1>Dove ti alleni?</h1>
            {(Object.keys(LOCATION_PRESETS) as Location[]).map((l) => (
              <button
                key={l}
                type="button"
                className="option"
                aria-pressed={p.location === l}
                onClick={() => setP((prev) => ({ ...prev, location: l, equipment: LOCATION_PRESETS[l].equipment }))}
              >
                <span><strong>{LOCATION_PRESETS[l].label}</strong><span className="small muted">{LOCATION_PRESETS[l].description}</span></span>
              </button>
            ))}
            <h2>Cosa hai a disposizione</h2>
            <p className="small muted">Togli quello che manca e aggiungi quello che hai: la scheda userà solo questi attrezzi.</p>
            {EQUIPMENT.map((g) => (
              <div key={g.id} className="field">
                <span>{g.name}</span>
                <Chips multi options={g.items.map((i) => ({ value: i.id, label: i.name }))} value={p.equipment} onChange={(v) => set('equipment', v)} />
              </div>
            ))}
          </>
        )}

        {step === 7 && (
          <>
            <h1>Tutto pronto, {p.name}</h1>
            <div className="card stack small">
              <div><strong>Obiettivo:</strong> {GOALS[p.goal].label}{p.targetText ? ` — «${p.targetText}»` : ''}</div>
              <div><strong>Allenamenti:</strong> {p.trainingDays.length} a settimana ({p.trainingDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')}), {p.minutesPerSession} minuti</div>
              <div><strong>Luogo:</strong> {LOCATION_PRESETS[p.location].label}, {p.equipment.length} attrezzi</div>
              {p.injuries.length > 0 && <div><strong>Zone da proteggere:</strong> {p.injuries.join(', ')}</div>}
              <div><strong>BMI:</strong> {(p.weightKg / (p.heightCm / 100) ** 2).toFixed(1).replace('.', ',')} <span className="muted">(indicativo: non distingue muscolo e grasso)</span></div>
            </div>
            <div className="note">
              Ti preparo un programma di 8 settimane: le prime due sono di adattamento, l’ultima è di scarico. Ogni 4 settimane facciamo il punto insieme.
            </div>
            <p className="tiny muted">
              Giotto PT non sostituisce il parere di un medico. Se senti dolore acuto, capogiri o fiato corto anomalo, fermati.
            </p>
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        {step > 0 && (
          <button className="btn" onClick={() => { setStep((s) => s - 1); window.scrollTo(0, 0); }}>Indietro</button>
        )}
        {step < STEPS.length - 1 ? (
          <button className="btn primary grow" disabled={!canNext} onClick={next}>Avanti</button>
        ) : (
          <button className="btn primary grow" disabled={busy} onClick={finish}>{editing ? 'Aggiorna la scheda' : 'Crea la mia scheda'}</button>
        )}
      </div>
    </div>
  );
}
