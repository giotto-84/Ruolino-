/**
 * File su Google Drive: importazione del brogliaccio Excel, esportazione del
 * ruolino in Excel, backup del Foglio.
 */

// ---------------------------------------------------------------------------
// Importazione brogliaccio Excel
// ---------------------------------------------------------------------------
/**
 * d = { anno, foglio, file: {nome, mime, base64} }
 * Il file Excel viene salvato nella cartella "Import" e convertito in Foglio
 * Google solo per leggerlo (la copia convertita viene poi cestinata).
 */
function importaBrogliaccio_(d) {
  var anno = Number(d.anno);
  if (!(anno >= 2000 && anno <= 2100)) throw new Error('Anno non valido');
  if (!d.file || !d.file.base64) throw new Error('Nessun file caricato');
  var imp = impostazioni_();
  var blob = Utilities.newBlob(Utilities.base64Decode(d.file.base64),
    d.file.mime || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', d.file.nome);
  var originale = DriveApp.getFolderById(imp.cartella_import).createFile(blob);
  var convertito = Drive.Files.create(
    { name: 'tmp-import ' + d.file.nome, mimeType: MimeType.GOOGLE_SHEETS, parents: [imp.cartella_import] },
    originale.getBlob()
  );
  try {
    var ss = SpreadsheetApp.openById(convertito.id);
    var nomeFoglio = d.foglio || 'BROGLIACCIO';
    var sh = ss.getSheetByName(nomeFoglio);
    if (!sh) {
      throw new Error('Foglio "' + nomeFoglio + '" non trovato. Fogli presenti: ' +
        ss.getSheets().map(function (s) { return s.getName(); }).join(', '));
    }
    var valori = sh.getDataRange().getValues();
    var rapporto = importaValori_(valori, anno);
    rapporto.push('File originale conservato in Drive: Ruolino - file / Import / ' + d.file.nome);
    registra_('Importato brogliaccio Excel ' + d.file.nome + ' anno ' + anno);
    return rapporto;
  } finally {
    DriveApp.getFileById(convertito.id).setTrashed(true);
  }
}

/** Importa da una matrice di valori (righe del foglio). Separata per poterla provare. */
function importaValori_(valori, anno) {
  if (valori.length < 3) throw new Error('Il foglio e\' vuoto');
  var colonne = colonneDate_(valori[0], valori[1], anno, 7);
  var cols = Object.keys(colonne);
  if (!cols.length) throw new Error('Non trovo le intestazioni dei mesi (riga 1) e dei giorni (riga 2).');
  var date = cols.map(function (c) { return colonne[c]; }).sort();
  var dal = date[0], al = date[date.length - 1];

  var interprete = creaInterprete_(leggi_('Codici').map(function (c) { return c.codice; }));
  var gradi = mappa_(leggi_('Gradi'), 'sigla');
  var gradiNuovi = [], codiciNuovi = {}, codiciRighe = [];
  var militari = leggi_('Militari');
  var esistenti = {};
  militari.forEach(function (m) { esistenti[(m.cognome + '|' + m.nome).toUpperCase()] = m; });
  var creati = 0, aggiornati = 0, ordine = 0, idsImportati = {}, nuoviImpieghi = [];
  var quando = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH:mm');
  var nuoviMilitari = [];

  for (var r = 2; r < valori.length; r++) {
    var riga = valori[r];
    var cognome = pulisci_(riga[2]).toUpperCase();
    if (!cognome) continue;
    ordine++;
    var nome = pulisci_(riga[3]).toUpperCase();
    var grado = normalizzaGrado_(riga[1]);
    if (!gradi[grado]) {
      gradi[grado] = { sigla: grado, descrizione: '', ordine: 999 };
      gradiNuovi.push(gradi[grado]);
    }
    var dati = {
      grado: grado, incarico: pulisci_(riga[4]), patenti: pulisci_(riga[5]),
      telefono: riga[6] === '' ? '' : pulisci_(riga[6]),
      stato: /EXTRA/i.test(String(riga[0])) ? 'EXT' : 'EFF', ordine: ordine
    };
    var m = esistenti[cognome + '|' + nome];
    if (m) { Object.keys(dati).forEach(function (k) { m[k] = dati[k]; }); aggiornati++; }
    else {
      m = Object.assign({ id: nuovoId_() + ordine, cognome: cognome, nome: nome, data_ingresso: '', data_uscita: '', note: '' }, dati);
      esistenti[cognome + '|' + nome] = m;
      nuoviMilitari.push(m);
      creati++;
    }
    idsImportati[m.id] = true;

    var perGiorno = {};
    cols.forEach(function (c) {
      var v = riga[c];
      if (v === '' || v === null || v === undefined) return;
      var res = interprete.interpreta(v);
      res.voci.forEach(function (voce) {
        if (!interprete.noti[voce.codice.toUpperCase()]) {
          interprete.aggiungi(voce.codice);
          codiciNuovi[voce.codice] = 0;
          codiciRighe.push({ codice: voce.codice, descrizione: '(importato da Excel - da verificare)', categoria: 'ALT',
            colore_sfondo: '#FFFFFF', colore_testo: '#000000', presente_in_sede: 'SI', contatore: '',
            quantita_giorno: 1, scala_orario: 'NO', ordine: 900, attivo: 'SI' });
        }
        if (codiciNuovi[voce.codice] !== undefined) codiciNuovi[voce.codice]++;
        var k = colonne[c] + '|' + voce.codice;
        if (perGiorno[k]) {
          if (res.nota && perGiorno[k].note.indexOf(res.nota) < 0) perGiorno[k].note = (perGiorno[k].note + ' | ' + res.nota).replace(/^ \| /, '');
          return;
        }
        perGiorno[k] = { id: nuovoId_() + nuoviImpieghi.length, militare_id: m.id, data: colonne[c], codice: voce.codice,
          localita: voce.localita.slice(0, 80), quantita: '', note: res.nota, modificato_da: 'importazione', modificato_il: quando };
      });
    });
    Object.keys(perGiorno).forEach(function (k) { nuoviImpieghi.push(perGiorno[k]); });
  }

  // Scrittura: militari, gradi, codici, impieghi (il periodo del file viene sostituito)
  riscrivi_('Militari', militari.concat(nuoviMilitari));
  aggiungi_('Gradi', gradiNuovi);
  aggiungi_('Codici', codiciRighe);
  var restanti = leggi_('Impieghi').filter(function (i) { return !(idsImportati[i.militare_id] && i.data >= dal && i.data <= al); });
  riscrivi_('Impieghi', restanti.concat(nuoviImpieghi));

  var out = ['Militari creati: ' + creati, 'Militari aggiornati: ' + aggiornati,
    'Giornate importate: ' + nuoviImpieghi.length + ' (dal ' + dal + ' al ' + al + ')'];
  var nc = Object.keys(codiciNuovi);
  if (nc.length) {
    out.push('Codici nuovi creati in categoria "Altro" (da verificare in Configurazione): ' +
      nc.map(function (c) { return c + ' (' + codiciNuovi[c] + ')'; }).join(', '));
  }
  if (gradiNuovi.length) out.push('Gradi nuovi: ' + gradiNuovi.map(function (g) { return g.sigla; }).join(', '));
  return out;
}

// ---------------------------------------------------------------------------
// Esportazione del ruolino mensile in Excel
// ---------------------------------------------------------------------------
function esportaRuolino_(anno, mese) {
  var dati = ruolino_({ anno: anno, mese: mese });
  var codici = mappa_(leggi_('Codici'), 'codice');
  var giorni = dati.giorni;
  var celle = {};
  dati.impieghi.forEach(function (i) { (celle[i.m + '|' + i.d] = celle[i.m + '|' + i.d] || []).push(i); });
  var titolo = 'Ruolino ' + MESI[mese] + ' ' + anno;

  var tmp = SpreadsheetApp.create(titolo);
  try {
    var sh = tmp.getSheets()[0];
    sh.setName(MESI[mese] + ' ' + anno);
    var intest = ['N.', 'GRADO', 'COGNOME', 'NOME', 'INCARICO'];
    var righe = [intest.concat(giorni.map(function (g) { return g.sett + ' ' + g.giorno; }))];
    var sfondi = [righe[0].map(function (x, i) { return i >= 5 && giorni[i - 5].festivo ? '#D9D9D9' : '#EEF0EC'; })];
    var testi = [righe[0].map(function () { return '#000000'; })];
    var n = 0;
    dati.militari.forEach(function (m) {
      var r = [m.stato === 'EFF' ? ++n : 'EXTRA', m.grado, m.cognome, m.nome, m.incarico];
      var sf = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFFFFF'], tx = ['#000000', '#000000', '#000000', '#000000', '#000000'];
      giorni.forEach(function (g) {
        var lista = (celle[m.id + '|' + g.data] || []).filter(function (i) { return i.c !== 'NOTA'; });
        r.push(lista.map(function (i) { return i.c + (i.l ? ' ' + i.l : ''); }).join(' + '));
        var c = lista.length && codici[lista[0].c];
        sf.push(c ? c.colore_sfondo : (g.festivo ? '#D9D9D9' : '#FFFFFF'));
        tx.push(c ? c.colore_testo : '#000000');
      });
      righe.push(r); sfondi.push(sf); testi.push(tx);
    });
    var range = sh.getRange(1, 1, righe.length, righe[0].length);
    range.setValues(righe).setBackgrounds(sfondi).setFontColors(testi)
      .setFontSize(8).setBorder(true, true, true, true, true, true, '#999999', SpreadsheetApp.BorderStyle.SOLID)
      .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
    sh.getRange(1, 1, 1, righe[0].length).setFontWeight('bold');
    sh.getRange(2, 1, righe.length - 1, 5).setHorizontalAlignment('left').setFontSize(9);
    sh.setColumnWidths(1, 5, 90);
    sh.setColumnWidths(6, giorni.length, 62);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(5);

    var leg = tmp.insertSheet('Legenda');
    var cod = ordina_(leggi_('Codici'), 'ordine').filter(function (c) { return vero_(c.attivo); });
    leg.getRange(1, 1, cod.length + 1, 2).setValues([['Codice', 'Descrizione']].concat(cod.map(function (c) { return [c.codice, c.descrizione]; })));
    leg.getRange(2, 1, cod.length, 1).setBackgrounds(cod.map(function (c) { return [c.colore_sfondo]; }))
      .setFontColors(cod.map(function (c) { return [c.colore_testo]; })).setFontWeight('bold');
    leg.setColumnWidth(2, 320);
    SpreadsheetApp.flush();

    var url = 'https://docs.google.com/spreadsheets/d/' + tmp.getId() + '/export?format=xlsx';
    var xlsx = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } })
      .getBlob().setName(titolo + '.xlsx');
    var file;
    try {
      file = DriveApp.getFolderById(impostazioni_().cartella_esportazioni).createFile(xlsx);
    } catch (e) {
      file = DriveApp.createFile(xlsx); // utenti in sola lettura: nel proprio Drive
    }
    return { url: file.getUrl(), nome: file.getName() };
  } finally {
    DriveApp.getFileById(tmp.getId()).setTrashed(true);
  }
}

// ---------------------------------------------------------------------------
// Backup (attivato ogni notte dalla configurazione iniziale)
// ---------------------------------------------------------------------------
function backupGiornaliero() {
  var imp = impostazioni_();
  var cartella = DriveApp.getFolderById(imp.cartella_backup);
  var nome = 'Ruolino backup ' + Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH.mm');
  var copia = DriveApp.getFileById(db_().getId()).makeCopy(nome, cartella);
  // conserva gli ultimi 30 backup
  var files = [], it = cartella.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(30).forEach(function (f) { f.setTrashed(true); });
  return { url: copia.getUrl(), nome: nome };
}
