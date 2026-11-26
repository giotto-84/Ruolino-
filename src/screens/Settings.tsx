import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { importBackup, saveBackup } from '../db/backup';
import { buildReminderIcs } from '../logic/ics';
import { GOALS, WEEKDAYS_SHORT } from '../logic/goals';
import { LOCATION_PRESETS } from '../data/equipment';
import { TopBar, formatDate } from '../components/ui';

export function Settings() {
  const profile = useLiveQuery(() => db.profile.get('me'));
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'danger'; text: string } | null>(null);
  if (!profile) return null;

  const downloadIcs = () => {
    const ics = buildReminderIcs(profile.trainingDays, profile.reminderTime);
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'promemoria-giotto-pt.ics';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stack">
      <TopBar title="Profilo" back={false} />
      <section className="card small stack">
        <h3>{profile.name}</h3>
        <div>{profile.age} anni, {profile.heightCm} cm, {profile.weightKg} kg all’inizio</div>
        <div>Obiettivo: {GOALS[profile.goal].label}</div>
        <div>{profile.trainingDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')} alle {profile.reminderTime}, {profile.minutesPerSession} minuti</div>
        <div>{LOCATION_PRESETS[profile.location].label}</div>
        <div className="muted">Con Giotto PT dal {formatDate(profile.createdAt, { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <Link className="btn secondary block" to="/benvenuto?modifica=1">Modifica anamnesi, obiettivo e attrezzi</Link>
        <p className="tiny muted" style={{ margin: 0 }}>Alla fine ricreo la scheda con i nuovi dati. I progressi restano.</p>
      </section>

      <section className="card stack">
        <h3>Promemoria</h3>
        <p className="small" style={{ margin: 0 }}>
          Aggiungi gli allenamenti al calendario del telefono: riceverai un avviso 15 minuti prima, nei giorni {profile.trainingDays.map((d) => WEEKDAYS_SHORT[d]).join(', ')} alle {profile.reminderTime}.
        </p>
        <button className="btn secondary block" onClick={downloadIcs}>Aggiungi al calendario</button>
        <p className="tiny muted" style={{ margin: 0 }}>Su iPhone tocca il file scaricato e poi «Aggiungi tutto». Se cambi giorni o orario, scarica di nuovo il promemoria ed elimina quello vecchio dal calendario.</p>
      </section>

      <section className="card stack">
        <h3>Backup e cambio telefono</h3>
        <p className="small" style={{ margin: 0 }}>
          I dati sono salvati solo su questo telefono. Crea un backup ogni tanto e conservalo (iCloud Drive, e-mail, WhatsApp a te stesso). Sul nuovo telefono apri Giotto PT e usa «Ripristina».
        </p>
        <button
          className="btn primary block"
          onClick={async () => {
            try {
              const how = await saveBackup();
              setMsg({ tone: 'ok', text: how === 'shared' ? 'Backup pronto: salvalo dove preferisci.' : 'Backup scaricato nella cartella Download.' });
            } catch {
              setMsg(null);
            }
          }}
        >
          Crea backup
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>Ripristina da backup</button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!confirm('Il ripristino sostituisce tutti i dati attuali con quelli del backup. Continuare?')) return;
            try {
              await importBackup(JSON.parse(await f.text()));
              setMsg({ tone: 'ok', text: 'Dati ripristinati.' });
            } catch (err) {
              setMsg({ tone: 'danger', text: err instanceof SyntaxError ? 'Il file è danneggiato o non è un backup.' : (err as Error).message });
            }
          }}
        />
        {msg && <div className={`note ${msg.tone}`} role="status">{msg.text}</div>}
      </section>

      <section className="card stack small">
        <h3>Informazioni</h3>
        <p style={{ margin: 0 }}>
          Immagini degli esercizi: Free Exercise DB (pubblico dominio). I video si aprono su YouTube con una ricerca: scegli canali di istruttori qualificati.
        </p>
        <p style={{ margin: 0 }} className="muted">
          Giotto PT dà indicazioni generali e non sostituisce medico, fisioterapista o nutrizionista.
        </p>
        <button
          className="btn block"
          style={{ color: 'var(--red)' }}
          onClick={async () => {
            if (!confirm('Eliminare tutti i dati da questo telefono? Se non hai un backup non potrai recuperarli.')) return;
            await db.delete();
            location.reload();
          }}
        >
          Elimina tutti i dati
        </button>
      </section>
    </div>
  );
}
