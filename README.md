# Ruolino - controllo del personale

Programma per gestire il ruolino giornaliero del personale (il "brogliaccio"),
la situazione della forza, licenze e recuperi, scadenze (idoneità, PEFO, tiri...).
Gira su un PC dell'ufficio ed è consultabile dagli altri PC della **rete interna**
tramite browser (Chrome, Edge, Firefox). **Non è pubblicato su Internet.**

## Cosa fa

| Pagina | Funzione |
|---|---|
| **Situazione** | Forza del giorno: presenti in sede, di servizio, fuori sede, assenti (con motivo). Scadenze scadute o imminenti. |
| **Ruolino** | Griglia mensile militari × giorni, come il foglio BROGLIACCIO. Colori per codice, sabati/domeniche/festivi evidenziati, totale presenti per giorno, esportazione in Excel e stampa A3. |
| **Inserimento rapido** | Nel ruolino si sceglie un codice e si clicca (o si trascina) sulle caselle. Senza codice scelto, il clic apre il dettaglio della casella (più codici, località, note). |
| **Inserisci periodo** | Stesso codice a uno o più militari per un intervallo di date (es. licenza dal 10 al 20), con opzione "escludi festivi". |
| **Militari** | Anagrafica: grado, incarico, patenti, telefono, stato (effettivo / extra / perso dalla forza), date di ingresso e uscita. |
| **Licenze** | Per ogni militare e anno si inserisce a mano la spettanza (licenza ordinaria, festività soppresse, ore di recupero...). Il goduto viene calcolato dal ruolino, il residuo in automatico. Sono possibili movimenti manuali (es. ore di recupero maturate). |
| **Scadenze** | Tabella militari × tipi di scadenza con colori: scaduta / in scadenza / valida / mancante. I tipi di scadenza si aggiungono liberamente (Configurazione → Tipi di scadenza), con validità in mesi e giorni di preavviso. |
| **Configurazione** | Codici di impiego con **colore di sfondo e testo scelti da voi**, categoria (servizio, fuori sede, assenza...), se il militare conta come presente in sede, e da quale contatore scala (es. LIC ORD → licenza ordinaria). Gradi, contatori e tipi di scadenza. |
| **Importa Excel** | Carica il brogliaccio Excel esistente (anagrafica e tutti i codici giornalieri). |
| **Registro** | Chi ha modificato cosa e quando. |

### Utenti e permessi
Gli utenti si creano dal menu **Utenti** (solo amministratori). A ogni utente si assegna un gruppo:

* **Amministratori**: possono fare tutto, compresi anagrafica, configurazione e importazione.
* **Operatori**: aggiornano ruolino, licenze e scadenze. Non modificano anagrafica e configurazione.
* **Consultazione**: possono solo leggere.

## Installazione (una volta sola)

1. Installare **Python 3.10 o successivo** sul PC che farà da server (su Windows spuntare "Add Python to PATH").
2. Copiare questa cartella sul PC.
3. Fare doppio clic su **`avvia_ruolino.bat`** (Windows) oppure eseguire `./avvia_ruolino.sh` (Linux).
   Il primo avvio installa i componenti e chiede di creare l'utente amministratore.

**PC senza Internet:** su un PC collegato a Internet eseguire
`pip download -r requirements.txt -d pacchetti`, poi copiare la cartella `pacchetti`
dentro la cartella del programma. L'installazione userà quei file.

## Uso quotidiano

* Avviare con `avvia_ruolino.bat`. La finestra mostra l'indirizzo da usare sugli altri PC
  (es. `http://192.168.1.10:8000`) e va lasciata aperta.
* Se gli altri PC non si collegano, consentire la porta 8000 nel firewall di Windows del PC server.
* Per usarlo solo sul PC locale: `avvia_ruolino.bat --solo-questo-pc`.

### Importare il file Excel esistente
Menu **Importa Excel** → scegliere il file, indicare l'anno (es. 2026) → *Importa*.
In alternativa, da riga di comando:

```
.venv\Scripts\python manage.py importa_excel "RUOLINO.xlsx" --anno 2026
```

L'importazione:

* uniforma i codici scritti in modi diversi ("Gdg"/"GDG", "S.I. MALCO."/"S.I. MALCONTENTA"...);
* separa il codice dalle note ("LIC ORD IN DATA 12/08/26 INV..." diventa codice LIC ORD e nota);
* mette la località in un campo separato (S.S. VENEZIA, S.I. ROMA, RC FEST (LONDRA)...).

I codici sconosciuti vengono creati nella categoria "Altro" ed elencati alla fine
dell'importazione, così si possono sistemare in Configurazione.
Se un militare ha stesso cognome e nome di uno già presente, i suoi dati vengono aggiornati.
Il file Excel viene solo letto e non viene conservato.

## Dati e sicurezza

* **Tutti i dati** (database, chiave segreta, backup) stanno nella cartella `dati/`
  accanto al programma. Questa cartella **non viene mai caricata sul repository** (vedi `.gitignore`):
  il repository contiene solo il programma, senza nominativi né telefoni.
* Ad ogni avvio viene fatto un **backup automatico** in `dati/backup/` (si conservano le ultime 30 copie).
  Si consiglia di copiare periodicamente `dati/` su un supporto esterno.
  Backup manuale: `.venv\Scripts\python manage.py backup_db`.
* La cartella dei dati si può spostare impostando la variabile d'ambiente `RUOLINO_DATI`.
* Proteggere con le autorizzazioni di Windows l'accesso alla cartella del programma sul PC server.

## Note tecniche
Django 5.2 (LTS), database SQLite, server `waitress`. Test automatici: `python manage.py test personale`.
