# Ruolino - controllo del personale

Web app su **Google Apps Script** per il ruolino del personale. I dati stanno in un Foglio Google privato sul Drive del proprietario.

* **Dati della forza**: presenti, di servizio, fuori sede, assenti, liberi nei festivi. Stampa con situazione nominativa.
* **Brogliaccio**: griglia mensile con codici e colori, inserimento rapido e per periodi, smonto automatico dopo guardie, Udp e Gdg, congedo che fa perdere la forza.
* **Elenco personale**, ordinato per grado.
* **Licenze e recuperi**: spettanze, goduto calcolato, riepilogo pluriennale, copia delle spettanze sull'anno nuovo.
* **Servizi**: conteggio di guardie, Udp e Gdg per militare, per distribuire i turni.
* **Scadenze** con allegati.
* **Configurazione**: codici e colori, orario, gradi, archivio degli anni passati.
* **Utenti**: accesso con nome utente e password, ruoli Amministratore, Operatore e Consultazione, uscita automatica dopo 30 minuti di inattività.

Il codice e la guida di installazione sono nella cartella [`apps-script/`](apps-script/LEGGIMI.md).

Prove della logica: `node --test apps-script/test/logica.test.js`.
