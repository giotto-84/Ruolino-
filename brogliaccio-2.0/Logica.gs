/**
 * Logica pura del Ruolino (nessun servizio Google): date, festivita',
 * scadenze, ore di recupero, interpretazione dei codici del brogliaccio Excel.
 * Le date sono sempre stringhe 'aaaa-mm-gg'.
 */

var MESI = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio',
  'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
var GIORNI_SETT = ['D', 'L', 'M', 'M', 'G', 'V', 'S']; // indice = getUTCDay()

function pad2_(n) { return (n < 10 ? '0' : '') + n; }

function dataStr_(anno, mese, giorno) { return anno + '-' + pad2_(mese) + '-' + pad2_(giorno); }

function parseData_(s) {
  var p = String(s).split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
}

function formatData_(d) { return dataStr_(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()); }

function aggiungiGiorni_(s, n) {
  var d = parseData_(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatData_(d);
}

function giorniTra_(a, b) { return Math.round((parseData_(b) - parseData_(a)) / 86400000); }

function dataValida_(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function pasqua_(anno) {
  var a = anno % 19, b = Math.floor(anno / 100), c = anno % 100, d = Math.floor(b / 4), e = b % 4;
  var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  var mese = Math.floor((h + l - 7 * m + 114) / 31), giorno = ((h + l - 7 * m + 114) % 31) + 1;
  return dataStr_(anno, mese, giorno);
}

var _festivita = {};
function festivita_(anno) {
  if (!_festivita[anno]) {
    var fisse = [[1, 1], [1, 6], [4, 25], [5, 1], [6, 2], [8, 15], [11, 1], [12, 8], [12, 25], [12, 26]];
    var set = {};
    fisse.forEach(function (f) { set[dataStr_(anno, f[0], f[1])] = true; });
    var p = pasqua_(anno);
    set[p] = true;
    set[aggiungiGiorni_(p, 1)] = true;
    _festivita[anno] = set;
  }
  return _festivita[anno];
}

/** Giorno della settimana 1 = lunedi' ... 7 = domenica */
function giornoISO_(s) { var g = parseData_(s).getUTCDay(); return g === 0 ? 7 : g; }

var NOMI_GIORNI = ['', "lun", "mar", "mer", "gio", "ven", "sab", "dom"];

/** giorni = stringa di cifre ISO ammesse (es. '23456' = mar-sab); vuota = tutti i giorni */
function giornoAmmesso_(giorni, s) {
  giorni = String(giorni || '').replace(/[^1-7]/g, '');
  return !giorni || giorni.indexOf(String(giornoISO_(s))) >= 0;
}

function festivo_(s) {
  var d = parseData_(s), wd = d.getUTCDay();
  return wd === 0 || wd === 6 || !!festivita_(d.getUTCFullYear())[s];
}

function giorniMese_(anno, mese) {
  var n = new Date(Date.UTC(anno, mese, 0)).getUTCDate(), out = [];
  for (var g = 1; g <= n; g++) {
    var s = dataStr_(anno, mese, g);
    out.push({ data: s, giorno: g, sett: GIORNI_SETT[parseData_(s).getUTCDay()], festivo: festivo_(s) });
  }
  return out;
}

function aggiungiMesi_(s, mesi) {
  var d = parseData_(s), m = d.getUTCMonth() + mesi;
  var anno = d.getUTCFullYear() + Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  var ultimo = new Date(Date.UTC(anno, m + 1, 0)).getUTCDate();
  return dataStr_(anno, m + 1, Math.min(d.getUTCDate(), ultimo));
}

/** Stato di una scadenza: 'scaduta' | 'in_scadenza' | 'valida' | 'senza_data'. */
function statoScadenza_(dataScadenza, preavvisoGiorni, oggi) {
  if (!dataValida_(dataScadenza)) return 'senza_data';
  if (dataScadenza < oggi) return 'scaduta';
  if (giorniTra_(oggi, dataScadenza) <= (Number(preavvisoGiorni) || 0)) return 'in_scadenza';
  return 'valida';
}

function numero_(v) {
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function vero_(v) { return v === true || /^(si|sì|s|true|1|x|vero)$/i.test(String(v || '').trim()); }

/** Ore previste dall'orario per una data. orario = {lun..dom, festivi_zero} */
function oreDelGiorno_(orario, s) {
  if (vero_(orario.festivi_zero) && festivita_(parseData_(s).getUTCFullYear())[s]) return 0;
  var chiavi = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  return numero_(orario[chiavi[parseData_(s).getUTCDay()]]) || 0;
}

/**
 * Quantita' scalata da un impiego verso il contatore del suo codice.
 * dopoServizio = true se il giorno prima c'era un servizio con smonto (guardia):
 * l'RC di smonto non scala ore.
 */
function quantitaScalata_(impiego, codice, orario, dopoServizio) {
  var q = numero_(impiego.quantita);
  if (q !== null) return q;
  if (codice.codice === 'RC' && (dopoServizio || /^Smonto /.test(String(impiego.note || '')))) return 0;
  if (vero_(codice.scala_orario)) return oreDelGiorno_(orario, impiego.data);
  var qg = numero_(codice.quantita_giorno);
  return qg === null ? 1 : qg;
}

function inForza_(militare, dal, al) {
  al = al || dal;
  if (militare.data_ingresso && militare.data_ingresso > al) return false;
  if (militare.data_uscita && militare.data_uscita < dal) return false;
  if (militare.stato === 'PER' && !militare.data_uscita) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Interpretazione delle caselle del brogliaccio Excel
// ---------------------------------------------------------------------------
var NOMI_MESI = { GENNAIO: 1, FEBBRAIO: 2, MARZO: 3, APRILE: 4, MAGGIO: 5, GIUGNO: 6, LUGLIO: 7,
  AGOSTO: 8, SETTEMBRE: 9, OTTOBRE: 10, NOVEMBRE: 11, DICEMBRE: 12 };

var ALIAS_CODICI = {
  'GDG': 'Gdg', 'UDP': 'Udp', 'LIC': 'LIC ORD', 'REC FEST': 'RC FEST', 'POL': 'POL.',
  'EX BRAG': 'EX BRAG.', 'EX BRAGADIN': 'EX BRAG.', 'SMI': 'VISITA SMI', 'LIC CONC': 'LIC CONC.',
  'LIC STRA': 'LIC STRA.', 'LIC CONV.': 'LIC CONV', 'RIL.IMM': 'RIL. IMM',
  'GURDIA 4 UOMO': 'GUARDIA B (4)', 'GUARDIA 4 UOMO': 'GUARDIA B (4)', 'GUARDIA B(4)': 'GUARDIA B (4)'
};
var ALIAS_LOCALITA = { 'MALCO.': 'MALCONTENTA', 'MALCO': 'MALCONTENTA', 'RAV': 'RAVENNA', 'PESARO.': 'PESARO' };
var ALIAS_GRADI = { 'MAR.CA.': 'MAR. CA.', 'MAR CA': 'MAR. CA.', 'SERG.MAGG.': 'SERG. MAGG.' };

function pulisci_(t) { return String(t === null || t === undefined ? '' : t).replace(/\s+/g, ' ').trim(); }

function normalizzaGrado_(g) {
  var s = pulisci_(g || '?').toUpperCase();
  return ALIAS_GRADI[s] || s;
}

/** codiciNoti: elenco dei codici esistenti (es. ['LIC ORD','Gdg',...]) */
function creaInterprete_(codiciNoti) {
  var noti = {};
  codiciNoti.forEach(function (c) { noti[c.toUpperCase()] = c; });

  function norm(t) {
    var u = pulisci_(t).toUpperCase();
    u = ALIAS_CODICI[u] || u;
    return noti[u.toUpperCase()] || u;
  }
  function loc(t) { var u = pulisci_(t).toUpperCase(); return ALIAS_LOCALITA[u] || u; }
  function nota() { return noti['NOTA'] || 'NOTA'; }

  function voce(parte) {
    parte = pulisci_(parte);
    if (!parte) return null;
    var cod = norm(parte), m;
    if (noti[cod.toUpperCase()]) return { codice: noti[cod.toUpperCase()], localita: '' };
    if ((m = /^S\.\s?S\.(?:\s+|$)(.*)$/i.exec(parte))) return { codice: noti['S.S.'] || 'S.S.', localita: loc(m[1]) };
    if ((m = /^S\.?\s?I\.?(?:\s+|$)(.*)$/i.exec(parte))) return { codice: noti['S.I.'] || 'S.I.', localita: loc(m[1]) };
    if ((m = /^(.*?)\s*\(([^()]+)\)$/.exec(parte))) {
      var base = norm(m[1]);
      if (noti[base.toUpperCase()]) return { codice: noti[base.toUpperCase()], localita: loc(m[2]) };
    }
    return { codice: cod.slice(0, 30), localita: '' };
  }

  return {
    noti: noti,
    aggiungi: function (c) { noti[c.toUpperCase()] = c; },
    interpreta: function (valore) {
      var testo = pulisci_(valore);
      if (!testo) return { voci: [], nota: '' };
      var m = /\s+(?=IN DATA\b)|\s+-\s+|\s+(?=GIA'? INV\b)/i.exec(testo);
      var testa = m ? testo.slice(0, m.index) : testo;
      var notaTesto = m ? testo : '';
      if (/^(IN DATA|GIA'? INV)\b/i.test(testa)) return { voci: [{ codice: nota(), localita: '' }], nota: testo };
      if (/ IN DATA$/i.test(testa)) { testa = testa.slice(0, -8); notaTesto = testo; }
      var voci = testa.split('+').map(voce).filter(function (v) { return v; });
      if (!voci.length) return { voci: [{ codice: nota(), localita: '' }], nota: testo };
      return { voci: voci, nota: notaTesto };
    }
  };
}

/** Mappa colonna (0-based) -> data, dalle righe 1 (mesi) e 2 (giorni) del brogliaccio. */
function colonneDate_(riga1, riga2, anno, primaColonna) {
  var mese = null, out = {};
  for (var c = primaColonna; c < Math.max(riga1.length, riga2.length); c++) {
    var t = pulisci_(riga1[c]).toUpperCase();
    if (t && NOMI_MESI[t]) mese = NOMI_MESI[t];
    var g = Number(riga2[c]);
    if (mese && riga2[c] !== '' && !isNaN(g) && g >= 1 && g <= 31) {
      var s = dataStr_(anno, mese, g);
      if (parseData_(s).getUTCMonth() + 1 === mese) out[c] = s;
    }
  }
  return out;
}

if (typeof module !== 'undefined') {
  module.exports = {
    pasqua_: pasqua_, festivita_: festivita_, festivo_: festivo_, giorniMese_: giorniMese_,
    aggiungiMesi_: aggiungiMesi_, statoScadenza_: statoScadenza_, oreDelGiorno_: oreDelGiorno_,
    quantitaScalata_: quantitaScalata_, inForza_: inForza_, creaInterprete_: creaInterprete_,
    colonneDate_: colonneDate_, normalizzaGrado_: normalizzaGrado_, aggiungiGiorni_: aggiungiGiorni_,
    giornoISO_: giornoISO_, giornoAmmesso_: giornoAmmesso_
  };
}
