# Ruolino - versione web su Google (Fogli + Drive)

Web app condivisibile con un link. I dati restano **sul tuo Google Drive**:

* un **Foglio Google** fa da archivio (una scheda per militari, ruolino, licenze, scadenze...);
* una cartella **"Ruolino - file"** contiene:
  * `Documenti`: allegati delle scadenze (attestati, certificati, idoneità);
  * `Import`: brogliacci Excel caricati;
  * `Esportazioni`: ruolini mensili in Excel;
  * `Backup`: copia automatica ogni notte, conservate le ultime 30.

**Sicurezza.** La web app gira con l'account del proprietario. Il Foglio e la cartella **non sono condivisi con nessuno**: i colleghi vedono i dati solo attraverso l'app.
Si entra con **nome utente e password del Ruolino**, senza bisogno di un account Google. Le password sono cifrate e stanno nelle proprietà dello script, non nel Foglio.

| Ruolo | Cosa può fare |
|---|---|
| Amministratore | Tutto: configurazione, codici e colori, utenti, importazione |
| Operatore | Brogliaccio, elenco personale, licenze, scadenze con allegati |
| Consultazione | Solo lettura |

> **Attenzione ai dati personali.** Nomi, telefoni e documenti del personale stanno sul Google Drive del proprietario.
> Verifica che le disposizioni del reparto lo consentano. Attiva la verifica in due passaggi sull'account Google.

## Installazione (circa 15 minuti, una sola volta)

1. **Crea il Foglio.** Su Google Drive: *Nuovo → Fogli Google*. Chiamalo per esempio `Ruolino - dati`.
2. **Apri l'editor degli script.** Nel Foglio: *Estensioni → Apps Script*.
3. **Copia i file.** Nell'editor, rinomina il file `Codice.gs` in `Logica` e incolla il contenuto di `Logica.gs`.
   Poi crea gli altri file con il pulsante **+** e incolla il contenuto di ciascuno:
   * **Script**: `Dati`, `Setup`, `Api`, `File` (incolla i rispettivi file `.gs`);
   * **HTML**: `Index`, `App`, `Stile`, `NonAutorizzato` (incolla i rispettivi file `.html`).

   I nomi devono essere esattamente questi, senza estensione.
4. **Manifest.** Apri *Impostazioni progetto* (ingranaggio a sinistra) e spunta *Mostra il file manifest "appsscript.json"*.
   Torna all'editor, apri `appsscript.json` e sostituiscine il contenuto con quello del file `appsscript.json` di questa cartella.
5. **Salva** con l'icona del dischetto.
6. **Configurazione iniziale.** Torna al Foglio e ricarica la pagina. Compare il menu **Ruolino**: scegli **Configurazione iniziale**.
   Google chiede di autorizzare lo script. Compare l'avviso "Google non ha verificato questa app", che è normale per uno script personale:
   clicca *Avanzate → Vai a Ruolino (non sicuro) → Consenti*.
   Lo script crea le schede, i codici con i colori, i tipi di scadenza, le cartelle su Drive e il backup notturno.
   Il tuo account diventa Amministratore.
7. **La tua password.** Nel Foglio usa il menu **Ruolino → Imposta la mia password di amministratore**.
   Scegli il nome utente (ti viene proposto il tuo indirizzo email) e una password di almeno 8 caratteri, con lettere e numeri.
8. **Pubblica la web app.** Nell'editor Apps Script: *Esegui il deployment → Nuovo deployment*.
   Clicca l'ingranaggio e scegli **App web**, poi imposta:
   * *Esegui come*: **Me**;
   * *Chi ha accesso*: **Chiunque**.

   Clicca *Esegui il deployment* e copia l'**URL dell'app web**: è il link da condividere.
   Chi apre il link vede solo la pagina di accesso.
9. **Aggiungi gli utenti.** Entra nella web app e vai su **Utenti → + Aggiungi utente**: nome utente, nome, ruolo e una **password provvisoria**.
   Comunica nome utente e password provvisoria all'interessato: al primo accesso dovrà sceglierne una personale.
10. **Importa il brogliaccio.** Vai su **Importa Excel**, scegli il file `.xlsx` e indica l'anno → *Importa*.
   L'esito elenca i codici sconosciuti, che puoi sistemare in *Configurazione → Codici e colori*.

## Uso

* **Ruolino**: scegli un codice in *Inserimento rapido* e clicca (o trascina) sulle caselle.
  Senza codice scelto, il clic apre il dettaglio della casella, con località, ore e note.
  *Esporta Excel* salva il mese su Drive, nella cartella `Esportazioni`.
* **Scadenze**: clicca su una casella per registrare o rinnovare (↻). Nel modulo puoi **allegare un PDF o una foto**:
  il file finisce su Drive in `Documenti` e la graffetta 📎 lo scarica.
* **Licenze**: inserisci a mano la spettanza di ogni persona. Il goduto viene calcolato dal ruolino.
  RC e RC FEST scalano le *Ore di recupero* secondo l'orario: lun-gio 8 ore, ven 4 ore, sabato, domenica e festivi 0
  (modificabile in *Configurazione → Orario di lavoro*).
* **Servizi**: quante guardie, Udp e Gdg ha fatto ognuno nel mese o nell'anno, con chi ne ha fatti di meno in verde.
* **Dati della forza → Stampa**: foglio A4 con riepilogo e situazione nominativa di tutto il personale.
* **Licenze → Copia spettanze dall'anno precedente**: a gennaio riporta le spettanze dell'anno prima, solo dove mancano.
* **Configurazione → Archivio anni**: sposta in un Foglio separato il brogliaccio di un anno chiuso. L'anno resta consultabile e i residui non cambiano.
* Dopo **30 minuti di inattività** l'app chiude la sessione. Assegnare una nuova password chiude le sessioni aperte di quell'utente.
* **Configurazione**: codici con colori, tipi di scadenza, contatori, gradi, orario, *Backup ora*.
* **Password dimenticata:** l'amministratore seleziona l'utente in *Utenti* e preme **Nuova password provvisoria**.

## Aggiornare il programma

Quando cambia il codice: incolla i file aggiornati nell'editor, poi
*Esegui il deployment → Gestisci deployment → modifica (matita) → Versione: Nuova versione → Esegui il deployment*.
Il link resta lo stesso.

## Note

* Per velocità l'app tiene le tabelle in una memoria temporanea di Google, che si aggiorna da sola a ogni modifica fatta dall'app.
  Se modifichi qualcosa **a mano nel Foglio**, la memoria di quella scheda si svuota da sola. Se qualcosa non torna, usa il menu del Foglio **Ruolino → Svuota memoria temporanea**.
* **Scadenze ad anno solare** (es. PEFO): vanno fatte ogni anno e scadono il 31 dicembre dell'anno in cui sono state fatte. Si imposta per ogni tipo in *Configurazione → Tipi di scadenza*.
* Ogni modifica viene annotata nella pagina *Registro*. Il Foglio conserva comunque la propria cronologia delle versioni.
* Il Foglio e la cartella restano privati: **non condividerli**. Chi avesse accesso al Foglio potrebbe modificare dati e programma.
* Per provare la logica: `node --test apps-script/test/logica.test.js`.
