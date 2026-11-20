# Ruolino - versione web su Google (Fogli + Drive)

Web app condivisibile con un link. I dati restano **sul tuo Google Drive**:

* un **Foglio Google** fa da archivio (una scheda per militari, ruolino, licenze, scadenze...);
* una cartella **"Ruolino - file"** contiene:
  * `Documenti`: allegati delle scadenze (attestati, certificati, idoneità);
  * `Import`: brogliacci Excel caricati;
  * `Esportazioni`: ruolini mensili in Excel;
  * `Backup`: copia automatica ogni notte, conservate le ultime 30.

Possono entrare **solo le persone che aggiungi** nella pagina *Utenti*, con il loro account Google.
Quando aggiungi un utente, il Foglio e la cartella vengono condivisi automaticamente:

| Ruolo | Cosa può fare | Condivisione |
|---|---|---|
| Amministratore | Tutto: configurazione, codici e colori, utenti, importazione | Modifica |
| Operatore | Ruolino, anagrafica, licenze, scadenze con allegati | Modifica |
| Consultazione | Solo lettura | Sola lettura |

> **Attenzione ai dati personali.** Nomi, telefoni e documenti del personale saranno su Google Drive.
> Verifica che le disposizioni del reparto lo consentano. Usa un account dedicato, con verifica in due passaggi attiva.

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
7. **Pubblica la web app.** Nell'editor Apps Script: *Esegui il deployment → Nuovo deployment*.
   Clicca l'ingranaggio e scegli **App web**, poi imposta:
   * *Esegui come*: **Utente che accede all'app web**;
   * *Chi ha accesso*: **Chiunque abbia un account Google**, oppure solo gli utenti della tua organizzazione se usi Google Workspace.

   Clicca *Esegui il deployment* e copia l'**URL dell'app web**: è il link da condividere.
8. **Aggiungi gli utenti.** Apri il link e vai su **Utenti → + Aggiungi utente**: email Google, nome e ruolo.
   Poi manda il link alle persone. Al primo accesso ognuno dovrà autorizzare l'app, come al punto 6.
9. **Importa il brogliaccio.** Vai su **Importa Excel**, scegli il file `.xlsx` e indica l'anno → *Importa*.
   L'esito elenca i codici sconosciuti, che puoi sistemare in *Configurazione → Codici e colori*.

## Uso

* **Ruolino**: scegli un codice in *Inserimento rapido* e clicca (o trascina) sulle caselle.
  Senza codice scelto, il clic apre il dettaglio della casella, con località, ore e note.
  *Esporta Excel* salva il mese su Drive, nella cartella `Esportazioni`.
* **Scadenze**: clicca su una casella per registrare o rinnovare (↻). Nel modulo puoi **allegare un PDF o una foto**:
  il file finisce su Drive in `Documenti` e la graffetta 📎 lo apre.
* **Licenze**: inserisci a mano la spettanza di ogni persona. Il goduto viene calcolato dal ruolino.
  RC e RC FEST scalano le *Ore di recupero* secondo l'orario: lun-gio 8 ore, ven 4 ore, sabato, domenica e festivi 0
  (modificabile in *Configurazione → Orario di lavoro*).
* **Configurazione**: codici con colori, tipi di scadenza, contatori, gradi, orario, *Backup ora*.
* Il link **Drive ↗** nel menu apre la cartella dei file.

## Aggiornare il programma

Quando cambia il codice: incolla i file aggiornati nell'editor, poi
*Esegui il deployment → Gestisci deployment → modifica (matita) → Versione: Nuova versione → Esegui il deployment*.
Il link resta lo stesso.

## Note

* Ogni modifica viene annotata nella pagina *Registro*. Il Foglio conserva comunque la propria cronologia delle versioni.
* Operatori e amministratori, avendo il Foglio condiviso in modifica, potrebbero anche aprirlo e modificarlo a mano.
  È meglio usare sempre la web app, perché il Foglio fa da archivio dei dati.
* La versione per la rete interna (cartella principale del repository) resta disponibile come alternativa offline.
* Per provare la logica: `node --test apps-script/test/`.
