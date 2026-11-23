/**
 * Configurazione iniziale: crea le schede del Foglio, i dati di partenza,
 * le cartelle su Google Drive e il backup notturno.
 * Si esegue UNA volta dal menu "Ruolino > Configurazione iniziale".
 */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Ruolino')
    .addItem('Configurazione iniziale', 'setup')
    .addItem('Apri la web app', 'apriWebApp_')
    .addItem('Backup ora', 'backupGiornaliero')
    .addToUi();
}

function apriWebApp_() {
  var url = ScriptApp.getService().getUrl();
  var html = url
    ? '<p>Indirizzo della web app:</p><p><a href="' + url + '" target="_blank">' + url + '</a></p>'
    : '<p>La web app non e\' ancora pubblicata: Estensioni &gt; Apps Script &gt; Esegui il deployment.</p>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(520).setHeight(140), 'Ruolino');
}

var GRADI_INIZIALI = [
  ['COL.', 'Colonnello'], ['TEN. COL.', 'Tenente Colonnello'], ['MAGG.', 'Maggiore'], ['CAP.', 'Capitano'],
  ['TEN.', 'Tenente'], ['S. TEN.', 'Sottotenente'], ['1° LGT.', 'Primo Luogotenente'], ['LGT.', 'Luogotenente'],
  ['1° MAR.', 'Primo Maresciallo'], ['MAR. CA.', 'Maresciallo Capo'], ['MAR. ORD.', 'Maresciallo Ordinario'],
  ['MAR.', 'Maresciallo'], ['SERG. MAGG. CA.', 'Sergente Maggiore Capo'], ['SERG. MAGG.', 'Sergente Maggiore'],
  ['SERG.', 'Sergente'], ['GRD. A.', 'Graduato Aiutante'], ['1° GRD', 'Primo Graduato'],
  ['GRD. SC', 'Graduato Scelto'], ['GRD', 'Graduato'], ['C.M. CA. SC.', 'Caporal Maggiore Capo Scelto'],
  ['C.M. CA.', 'Caporal Maggiore Capo'], ['C.M. SC.', 'Caporal Maggiore Scelto'],
  ['CM VFP4', 'Caporal Maggiore VFP4'], ['C.M.', 'Caporal Maggiore'], ['SOL.', 'Soldato']
];

var CONTATORI_INIZIALI = [['Licenza ordinaria', 'GG'], ["Festivita' soppresse", 'GG'], ['Ore di recupero', 'ORE']];

// codice, descrizione, categoria, sfondo, testo, presente in sede, contatore
var CODICI_INIZIALI = [
  ['GUARDIA A', 'Guardia A (lun-dom, il giorno dopo RC)', 'SER', '#FFFF00', '#000000', 'SI', ''],
  ['GUARDIA B', 'Guardia B (mar-sab, il giorno dopo RC)', 'SER', '#FFFF00', '#000000', 'SI', ''],
  ['GUARDIA B (4)', 'Guardia B - quarto uomo', 'SER', '#FFFF00', '#000000', 'SI', ''],
  ['Udp', 'Ufficiale/Sottufficiale di picchetto (il giorno dopo RC)', 'SER', '#FFFF00', '#000000', 'SI', ''],
  ['Gdg', 'Graduato di giornata (il giorno dopo RC)', 'SER', '#FFFF00', '#000000', 'SI', ''],
  ['RC', 'Recupero compensativo', 'ASS', '#FFFF00', '#000000', 'NO', 'Ore di recupero'],
  ['RC FEST', 'Recupero festivo', 'ASS', '#833C0B', '#FFFFFF', 'NO', 'Ore di recupero'],
  ['LIC ORD', 'Licenza ordinaria', 'ASS', '#833C0B', '#FFFFFF', 'NO', 'Licenza ordinaria'],
  ['LIC FEST', "Licenza festivita' soppresse", 'ASS', '#833C0B', '#FFFFFF', 'NO', "Festivita' soppresse"],
  ['LIC CONC.', 'Licenza per concorso', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['LIC CONV', 'Licenza di convalescenza', 'ASS', '#FFFF00', '#000000', 'NO', ''],
  ['LIC STRA.', 'Licenza straordinaria', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['LIC SANGUE', 'Licenza donazione sangue', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['GMF', 'Licenza per gravi motivi familiari', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['RMD', 'Riposo medico domiciliare', 'ASS', '#7030A0', '#FFFFFF', 'NO', ''],
  ['PERM', 'Permesso', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['CONGEDO', 'Congedo (da quel giorno non e\' piu\' in forza)', 'ASS', '#9CC2E5', '#000000', 'NO', ''],
  ['S.S.', 'Operazione Strade Sicure', 'FUO', '#00B050', '#000000', 'NO', ''],
  ['S.I.', 'Servizio isolato', 'FUO', '#92D050', '#000000', 'NO', ''],
  ['LEONTE', 'Operazione Leonte (Libano)', 'FUO', '#FFC000', '#000000', 'NO', ''],
  ['EX BRAG.', 'Esercitazione Bragadin', 'FUO', '#FFFFFF', '#000000', 'NO', ''],
  ['RECON', 'Corso esploratori', 'FUO', '#92D050', '#000000', 'NO', ''],
  ['APRM', 'Corso droni', 'FUO', '#FFFFFF', '#000000', 'NO', ''],
  ['VM', 'Visita medica', 'ATT', '#92D050', '#000000', 'SI', ''],
  ['VISITA SMI', 'Visita SMI', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['ECG', 'Elettrocardiogramma', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['PRELIEVI', 'Prelievi', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['RIL. IMM', 'Rilievo immunitario / vaccinazione', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['PEFO 3000', 'PEFO - 3000 metri', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['PEFO ZAV', 'PEFO - zavorrata', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['POL.', 'Poligono / tiri', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['PAT OBBLIGATORIA', 'Patente obbligatoria', 'ATT', '#8EAADB', '#000000', 'SI', ''],
  ['BLS-D', 'Corso BLS-D', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['HACCP', 'Corso HACCP', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['C-IED', 'Corso C-IED', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['CORSO LAV', 'Corso lavoratori (sicurezza)', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['CORSO PREPOSTO', 'Corso preposto', 'ATT', '#FFFFFF', '#000000', 'SI', ''],
  ['NOTA', 'Solo annotazione (nessun impiego)', 'ALT', '#FFFFFF', '#555555', 'SI', '']
];

// nome, validita' mesi, preavviso giorni, obbligatoria
var TIPI_SCADENZA_INIZIALI = [
  ["Idoneita' al servizio", 12, 30, 'SI'], ['PEFO', 12, 30, 'SI'], ['Tiri', 6, 30, 'SI'],
  ['Visita medica periodica', 12, 30, 'NO'], ['BLS-D', 24, 60, 'NO'], ['Patente militare', '', 60, 'NO']
];

var ORARIO_INIZIALE = { ore_lun: 8, ore_mar: 8, ore_mer: 8, ore_gio: 8, ore_ven: 4, ore_sab: 0, ore_dom: 0, festivi_zero: 'SI' };

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet() || db_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('DB_ID', ss.getId());
  _db = ss;

  Object.keys(TABELLE).forEach(function (nome) {
    var sh = ss.getSheetByName(nome) || ss.insertSheet(nome);
    var campi = TABELLE[nome];
    sh.getRange(1, 1, 1, campi.length).setValues([campi]).setFontWeight('bold').setBackground('#e3ebe0');
    sh.getRange(1, 1, sh.getMaxRows(), campi.length).setNumberFormat('@');
    sh.setFrozenRows(1);
  });
  var vuota = ss.getSheetByName('Foglio1') || ss.getSheetByName('Sheet1');
  if (vuota && ss.getSheets().length > 1) ss.deleteSheet(vuota);

  if (!leggi_('Gradi').length) {
    aggiungi_('Gradi', GRADI_INIZIALI.map(function (g, i) { return { sigla: g[0], descrizione: g[1], ordine: (i + 1) * 10 }; }));
  }
  if (!leggi_('Contatori').length) {
    aggiungi_('Contatori', CONTATORI_INIZIALI.map(function (c, i) { return { nome: c[0], unita: c[1], ordine: (i + 1) * 10, attivo: 'SI' }; }));
  }
  if (!leggi_('Codici').length) {
    aggiungi_('Codici', CODICI_INIZIALI.map(function (c, i) {
      var ore = c[6] === 'Ore di recupero';
      return { codice: c[0], descrizione: c[1], categoria: c[2], colore_sfondo: c[3], colore_testo: c[4],
        presente_in_sede: c[5], contatore: c[6], quantita_giorno: 1, scala_orario: ore ? 'SI' : 'NO',
        ordine: (i + 1) * 10, attivo: 'SI', perde_forza: c[0] === 'CONGEDO' ? 'SI' : 'NO',
        rc_dopo: ['GUARDIA A', 'GUARDIA B', 'Udp', 'Gdg'].indexOf(c[0]) >= 0 ? 'SI' : 'NO', giorni: c[0] === 'GUARDIA B' ? '23456' : '' };
    }));
  }
  if (!leggi_('TipiScadenza').length) {
    aggiungi_('TipiScadenza', TIPI_SCADENZA_INIZIALI.map(function (t, i) {
      return { nome: t[0], validita_mesi: t[1], preavviso_giorni: t[2], obbligatoria: t[3], descrizione: '', ordine: (i + 1) * 10 };
    }));
  }

  // Cartelle su Drive, accanto al Foglio
  var imp = impostazioni_();
  var radice;
  try { radice = imp.cartella_id && DriveApp.getFolderById(imp.cartella_id); } catch (e) { radice = null; }
  if (!radice) {
    var file = DriveApp.getFileById(ss.getId());
    var padri = file.getParents();
    var padre = padri.hasNext() ? padri.next() : DriveApp.getRootFolder();
    radice = padre.createFolder('Ruolino - file');
  }
  var cartelle = { cartella_id: radice.getId() };
  ['Documenti', 'Import', 'Esportazioni', 'Backup'].forEach(function (n) {
    var it = radice.getFoldersByName(n);
    cartelle['cartella_' + n.toLowerCase()] = (it.hasNext() ? it.next() : radice.createFolder(n)).getId();
  });
  var orario = {};
  Object.keys(ORARIO_INIZIALE).forEach(function (k) { if (imp[k] === undefined) orario[k] = ORARIO_INIZIALE[k]; });
  salvaImpostazioni_(Object.assign(cartelle, orario));

  // Il proprietario e' amministratore
  var me = emailUtente_();
  if (me && !leggi_('Utenti').some(function (u) { return u.email === me; })) {
    aggiungi_('Utenti', [{ email: me, nome: 'Amministratore', ruolo: 'Amministratore' }]);
  }

  // Backup ogni notte
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'backupGiornaliero') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('backupGiornaliero').timeBased().everyDays(1).atHour(2).create();

  registra_('Configurazione iniziale eseguita');
  try {
    SpreadsheetApp.getUi().alert('Configurazione completata.\n\nOra pubblica la web app: ' +
      'Estensioni > Apps Script > Esegui il deployment > Nuovo deployment (vedi LEGGIMI).');
  } catch (e) { /* eseguito dall'editor */ }
}
