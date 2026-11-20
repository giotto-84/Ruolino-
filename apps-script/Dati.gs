/**
 * Archivio su Foglio Google: una scheda per tabella, prima riga = intestazioni.
 * Tutte le celle sono in formato testo, cosi' date e codici non vengono
 * trasformati da Fogli.
 */

var TABELLE = {
  Militari: ['id', 'grado', 'cognome', 'nome', 'incarico', 'patenti', 'telefono', 'stato',
    'data_ingresso', 'data_uscita', 'ordine', 'note'],
  Impieghi: ['id', 'militare_id', 'data', 'codice', 'localita', 'quantita', 'note',
    'modificato_da', 'modificato_il'],
  Codici: ['codice', 'descrizione', 'categoria', 'colore_sfondo', 'colore_testo', 'presente_in_sede',
    'contatore', 'quantita_giorno', 'scala_orario', 'ordine', 'attivo'],
  Contatori: ['nome', 'unita', 'ordine', 'attivo'],
  Spettanze: ['id', 'militare_id', 'contatore', 'anno', 'quantita', 'note'],
  Movimenti: ['id', 'militare_id', 'contatore', 'anno', 'data', 'quantita', 'note'],
  TipiScadenza: ['nome', 'validita_mesi', 'preavviso_giorni', 'obbligatoria', 'descrizione', 'ordine'],
  Scadenze: ['id', 'militare_id', 'tipo', 'data_esecuzione', 'data_scadenza', 'esito', 'note',
    'documento_nome', 'documento_url', 'documento_id'],
  Gradi: ['sigla', 'descrizione', 'ordine'],
  Impostazioni: ['chiave', 'valore'],
  Utenti: ['email', 'nome', 'ruolo'],
  Registro: ['quando', 'utente', 'azione']
};

var _db = null;
var _cache = {};

function db_() {
  if (!_db) {
    var id = PropertiesService.getScriptProperties().getProperty('DB_ID');
    _db = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  }
  return _db;
}

function foglio_(nome) {
  var sh = db_().getSheetByName(nome);
  if (!sh) throw new Error('Scheda "' + nome + '" mancante: eseguire setup dal menu Ruolino.');
  return sh;
}

/** Restituisce tutte le righe della tabella come oggetti (con _riga = numero di riga nel foglio). */
function leggi_(nome) {
  if (_cache[nome]) return _cache[nome];
  var sh = foglio_(nome), campi = TABELLE[nome], ultima = sh.getLastRow(), out = [];
  if (ultima >= 2) {
    var valori = sh.getRange(2, 1, ultima - 1, campi.length).getValues();
    for (var i = 0; i < valori.length; i++) {
      var r = valori[i];
      if (r.join('') === '') continue;
      var o = { _riga: i + 2 };
      for (var c = 0; c < campi.length; c++) o[campi[c]] = valoreTesto_(r[c]);
      out.push(o);
    }
  }
  _cache[nome] = out;
  return out;
}

function valoreTesto_(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Europe/Rome', 'yyyy-MM-dd');
  }
  return v === null || v === undefined ? '' : String(v);
}

function riga_(nome, o) {
  return TABELLE[nome].map(function (c) {
    var v = o[c];
    return v === null || v === undefined ? '' : String(v);
  });
}

function aggiungi_(nome, oggetti) {
  if (!oggetti.length) return;
  var sh = foglio_(nome), campi = TABELLE[nome];
  var r = sh.getLastRow() + 1;
  sh.getRange(r, 1, oggetti.length, campi.length)
    .setNumberFormat('@')
    .setValues(oggetti.map(function (o) { return riga_(nome, o); }));
  delete _cache[nome];
}

function aggiorna_(nome, oggetto) {
  if (!oggetto._riga) throw new Error('Riga sconosciuta');
  foglio_(nome).getRange(oggetto._riga, 1, 1, TABELLE[nome].length)
    .setNumberFormat('@').setValues([riga_(nome, oggetto)]);
  delete _cache[nome];
}

/** Elimina le righe che soddisfano la condizione. Restituisce quante. */
function elimina_(nome, condizione) {
  var tutte = leggi_(nome), da = tutte.filter(condizione);
  if (!da.length) return 0;
  if (da.length <= 15) {
    var sh = foglio_(nome);
    da.map(function (o) { return o._riga; }).sort(function (a, b) { return b - a; })
      .forEach(function (r) { sh.deleteRow(r); });
    delete _cache[nome];
  } else {
    riscrivi_(nome, tutte.filter(function (o) { return !condizione(o); }));
  }
  return da.length;
}

/** Sostituisce l'intero contenuto della tabella. */
function riscrivi_(nome, oggetti) {
  var sh = foglio_(nome), campi = TABELLE[nome], ultima = sh.getLastRow();
  if (ultima >= 2) sh.getRange(2, 1, ultima - 1, campi.length).clearContent();
  delete _cache[nome];
  aggiungi_(nome, oggetti);
}

function nuovoId_() {
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)).toUpperCase();
}

function impostazioni_() {
  var out = {};
  leggi_('Impostazioni').forEach(function (r) { out[r.chiave] = r.valore; });
  return out;
}

function salvaImpostazioni_(valori) {
  var righe = leggi_('Impostazioni');
  Object.keys(valori).forEach(function (k) {
    var r = righe.filter(function (x) { return x.chiave === k; })[0];
    if (r) { r.valore = valori[k]; aggiorna_('Impostazioni', r); righe = leggi_('Impostazioni'); }
    else { aggiungi_('Impostazioni', [{ chiave: k, valore: valori[k] }]); righe = leggi_('Impostazioni'); }
  });
}

function registra_(azione) {
  try {
    aggiungi_('Registro', [{
      quando: Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH:mm'),
      utente: emailUtente_(),
      azione: String(azione).slice(0, 300)
    }]);
  } catch (e) { /* il registro non deve bloccare l'operazione */ }
}

function emailUtente_() {
  return (Session.getActiveUser().getEmail() || '').toLowerCase();
}
