# Giotto PT

Personal trainer per chi parte da zero: una web app installabile sul telefono (PWA) che funziona offline e salva i dati solo sul dispositivo.

## Cosa fa

- **Anamnesi iniziale**: dati personali, questionario di salute PAR-Q (con blocco e invito al medico in caso di risposte a rischio), dolori e infortuni, stile di vita, obiettivo, tempo a disposizione e attrezzi.
- **Scheda su misura** di 8 settimane, generata da regole fisse: 2 settimane di adattamento, settimana di scarico finale, esercizi scelti in base agli attrezzi disponibili ed evitando quelli che caricano le zone doloranti.
- **107 esercizi spiegati in italiano**: preparazione, regolazione delle macchine, esecuzione passo passo, respirazione, errori comuni, varianti più facili e più difficili. Ogni esercizio ha le immagini delle posizioni (dove disponibili) e un link ai video su YouTube.
- **Allenamento guidato**: riscaldamento a tempo, registrazione di carichi e ripetizioni, timer di recupero con suono e vibrazione, cardio finale, stretching, valutazione della fatica e dei dolori.
- **Progressione automatica**: il peso aumenta quando si completano tutte le serie al massimo delle ripetizioni. Nel corpo libero si passa alla variante più difficile. Niente aumenti in presenza di dolore o di fatica 9–10.
- **Progressi**: peso e misure con grafici, carichi per esercizio, calendario della costanza, foto prima e dopo.
- **Controllo ogni 4 settimane**, con resoconto rispetto all'obiettivo e ricalibrazione del piano. Nuova scheda a fine programma.
- **Promemoria** tramite file calendario `.ics` (avviso 15 minuti prima negli giorni di allenamento).
- **Backup** in un file JSON da condividere e ripristinare su un altro telefono.

## Sviluppo

```bash
npm install
npm run dev      # server di sviluppo
npm test         # test della logica (generatore, progressione, calendario)
npm run build    # build di produzione in dist/
```

Script utili:

- `node scripts/fetch-images.mjs` scarica le immagini degli esercizi nuovi aggiunti alla libreria.
- `node scripts/make-icons.mjs` rigenera le icone PNG da `public/icon.svg` (richiede Playwright).

## Pubblicazione

Il workflow `.github/workflows/deploy.yml` pubblica l'app su GitHub Pages a ogni push su `main`.
Prima volta: *Settings → Pages → Source: GitHub Actions*.

## Crediti

Immagini degli esercizi: [Free Exercise DB](https://github.com/yuhonas/free-exercise-db), pubblico dominio (Unlicense).
