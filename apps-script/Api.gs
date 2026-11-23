/**
 * Web app: pagina e funzioni chiamate dal browser.
 * Ruoli: Amministratore (tutto), Operatore (ruolino, anagrafica, licenze, scadenze),
 * Consultazione (sola lettura).
 */

function doGet() {
  var utente = utenteCorrente_();
  var t = HtmlService.createTemplateFromFile(utente ? 'Index' : 'NonAutorizzato');
  t.email = emailUtente_();
  return t.evaluate()
    .setTitle('Ruolino')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(nome) { return HtmlService.createHtmlOutputFromFile(nome).getContent(); }

function utenteCorrente_() {
  var email = emailUtente_();
  if (!email) return null;
  return leggi_('Utenti').filter(function (u) { return u.email.toLowerCase() === email; })[0] || null;
}

var LIVELLI = { Consultazione: 1, Operatore: 2, Amministratore: 3 };

function richiedi_(utente, ruolo) {
  if (!utente || (LIVELLI[utente.ruolo] || 0) < LIVELLI[ruolo]) {
    throw new Error('Operazione non consentita per il tuo profilo (' + (utente ? utente.ruolo : 'nessuno') + ').');
  }
}

/** Unico punto di ingresso dal browser. */
function api(azione, dati) {
  var utente = utenteCorrente_();
  if (!utente) return { errore: 'Utente non autorizzato.' };
  var f = AZIONI[azione];
  if (!f) return { errore: 'Azione sconosciuta: ' + azione };
  dati = dati || {};
  var token = dati._token;
  delete dati._token;
  try { migrazioni_(); } catch (e) { /* utente in sola lettura */ }
  if (!f.libera && !sessioneValida_(token, utente.email)) {
    return { errore: 'Inserisci la password per accedere.', login: true };
  }
  dati._token = token;
  var scrittura = f.ruolo !== 'Consultazione';
  var lock = null;
  try {
    richiedi_(utente, f.ruolo);
    if (scrittura) {
      lock = LockService.getScriptLock();
      lock.waitLock(20000);
    }
    var risultato = f.fn(dati, utente);
    return JSON.parse(JSON.stringify({ ok: risultato === undefined ? true : risultato }));
  } catch (e) {
    return { errore: e && e.message ? e.message : String(e) };
  } finally {
    if (lock) lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// Aggiornamenti dei dati dopo un cambio di versione (eseguiti una volta sola)
// ---------------------------------------------------------------------------
function migrazioni_() {
  var imp = impostazioni_();
  if (imp.migr_udp_gdg !== 'SI') {
    // Udp e Gdg come le guardie: il giorno dopo RC di smonto, senza ore
    leggi_('Codici').forEach(function (c) {
      if ((c.codice === 'Udp' || c.codice === 'Gdg') && !vero_(c.rc_dopo)) { c.rc_dopo = 'SI'; aggiorna_('Codici', c); }
    });
    salvaImpostazioni_({ migr_udp_gdg: 'SI' });
  }
}

// ---------------------------------------------------------------------------
// Accesso con password (oltre all'account Google)
// ---------------------------------------------------------------------------
var DURATA_SESSIONE = 6 * 60 * 60; // secondi (massimo consentito dalla cache di Google)
var TENTATIVI_MAX = 5, BLOCCO_SECONDI = 15 * 60;

function cifraPassword_(password, sale) {
  var d = sale + '|' + password;
  for (var i = 0; i < 300; i++) {
    d = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, d, Utilities.Charset.UTF_8));
  }
  return d;
}

function controllaRequisiti_(password) {
  password = String(password || '');
  if (password.length < 8) throw new Error('La password deve avere almeno 8 caratteri.');
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error('La password deve contenere lettere e numeri.');
}

function nuovaSessione_(email) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put('sess_' + token, email, DURATA_SESSIONE);
  return token;
}

function sessioneValida_(token, email) {
  if (!token) return false;
  return CacheService.getScriptCache().get('sess_' + token) === email;
}

function statoLogin_(d, utente) {
  return { email: utente.email, nome: utente.nome, haPassword: !!utente.password, attiva: sessioneValida_(d._token, utente.email) };
}

function login_(d, utente) {
  var cache = CacheService.getScriptCache(), chiave = 'tent_' + utente.email;
  var tentativi = Number(cache.get(chiave) || 0);
  if (tentativi >= TENTATIVI_MAX) throw new Error('Troppi tentativi sbagliati: accesso bloccato per 15 minuti.');
  if (!utente.password) throw new Error('Devi prima creare la tua password.');
  if (cifraPassword_(String(d.password || ''), utente.sale) !== utente.password) {
    cache.put(chiave, String(tentativi + 1), BLOCCO_SECONDI);
    registra_('Accesso: password errata (' + (tentativi + 1) + ')');
    throw new Error('Password errata' + (tentativi + 1 >= TENTATIVI_MAX ? ': accesso bloccato per 15 minuti.' : ' (tentativo ' + (tentativi + 1) + ' di ' + TENTATIVI_MAX + ').'));
  }
  cache.remove(chiave);
  return { token: nuovaSessione_(utente.email) };
}

function salvaPassword_(utente, password) {
  controllaRequisiti_(password);
  var u = leggi_('Utenti').filter(function (x) { return x.email.toLowerCase() === utente.email.toLowerCase(); })[0];
  u.sale = Utilities.getUuid();
  u.password = cifraPassword_(String(password), u.sale);
  aggiorna_('Utenti', u);
}

/** Primo accesso: l'utente crea la propria password. */
function creaPassword_(d, utente) {
  if (utente.password) throw new Error('La password esiste gia\': usa "Cambia password".');
  salvaPassword_(utente, d.password);
  registra_('Password creata');
  return { token: nuovaSessione_(utente.email) };
}

function cambiaPassword_(d, utente) {
  if (cifraPassword_(String(d.vecchia || ''), utente.sale) !== utente.password) throw new Error('La password attuale non e\' corretta.');
  salvaPassword_(utente, d.password);
  registra_('Password cambiata');
}

function logout_(d) {
  if (d._token) CacheService.getScriptCache().remove('sess_' + d._token);
}

/** L'amministratore azzera la password: al prossimo accesso l'utente ne crea una nuova. */
function azzeraPassword_(d) {
  var emails = elenco_(d, 'email').map(function (e) { return e.toLowerCase(); });
  var righe = leggi_('Utenti');
  righe.forEach(function (u) { if (emails.indexOf(u.email.toLowerCase()) >= 0) { u.password = ''; u.sale = ''; aggiorna_('Utenti', u); } });
  registra_('Password azzerata: ' + emails.join(', '));
  return emails.length;
}

function utentePubblico_(u) {
  return { email: u.email, nome: u.nome, ruolo: u.ruolo, haPassword: !!u.password };
}

// ---------------------------------------------------------------------------
// Configurazione
// ---------------------------------------------------------------------------
function ordina_(arr, campo) {
  return arr.slice().sort(function (a, b) { return (numero_(a[campo]) || 0) - (numero_(b[campo]) || 0); });
}

function configurazione_() {
  var imp = impostazioni_();
  return {
    codici: ordina_(leggi_('Codici'), 'ordine'),
    contatori: ordina_(leggi_('Contatori'), 'ordine'),
    tipiScadenza: ordina_(leggi_('TipiScadenza'), 'ordine'),
    gradi: ordina_(leggi_('Gradi'), 'ordine'),
    orario: {
      lun: imp.ore_lun, mar: imp.ore_mar, mer: imp.ore_mer, gio: imp.ore_gio,
      ven: imp.ore_ven, sab: imp.ore_sab, dom: imp.ore_dom, festivi_zero: imp.festivi_zero
    },
    cartellaUrl: imp.cartella_id ? 'https://drive.google.com/drive/folders/' + imp.cartella_id : ''
  };
}

function mappa_(arr, chiave) {
  var m = {};
  arr.forEach(function (o) { m[o[chiave]] = o; });
  return m;
}

function militariOrdinati_() {
  var gradi = mappa_(leggi_('Gradi'), 'sigla');
  var ordStato = { EFF: 0, EXT: 1, PER: 2 };
  return leggi_('Militari').slice().sort(function (a, b) {
    return (ordStato[a.stato] || 0) - (ordStato[b.stato] || 0) ||
      (numero_(a.ordine) || 9999) - (numero_(b.ordine) || 9999) ||
      ((gradi[a.grado] && numero_(gradi[a.grado].ordine)) || 999) - ((gradi[b.grado] && numero_(gradi[b.grado].ordine)) || 999) ||
      a.cognome.localeCompare(b.cognome);
  });
}

function militareDa_(id) {
  var m = leggi_('Militari').filter(function (x) { return x.id === String(id); })[0];
  if (!m) throw new Error('Militare non trovato');
  return m;
}

function nomeMil_(m) { return (m.grado + ' ' + m.cognome + ' ' + m.nome).trim(); }

// ---------------------------------------------------------------------------
// Situazione e ruolino
// ---------------------------------------------------------------------------
function situazione_(d) {
  var giorno = d.data;
  var codici = mappa_(leggi_('Codici'), 'codice');
  var militari = militariOrdinati_().filter(function (m) { return inForza_(m, giorno); });
  var perMil = {};
  leggi_('Impieghi').forEach(function (i) {
    if (i.data === giorno && i.codice !== 'NOTA') (perMil[i.militare_id] = perMil[i.militare_id] || []).push(i);
  });
  var presenti = [], servizio = [], assenti = {}, fuori = {}, liberi = [];
  var festivo = festivo_(giorno);
  militari.forEach(function (m) {
    var lista = perMil[m.id] || [];
    var ass = lista.filter(function (i) { return codici[i.codice] && !vero_(codici[i.codice].presente_in_sede); })[0];
    var voce = { id: m.id, nome: nomeMil_(m), impieghi: lista.map(function (i) { return { codice: i.codice, localita: i.localita }; }) };
    if (!ass && festivo && !lista.length) {
      liberi.push(voce); // sabato, domenica e festivi: in sede solo chi ha un servizio o un'attivita'
    } else if (!ass) {
      presenti.push(voce);
      if (lista.some(function (i) { return codici[i.codice] && codici[i.codice].categoria === 'SER'; })) servizio.push(voce);
    } else {
      var gruppo = codici[ass.codice].categoria === 'FUO' ? fuori : assenti;
      (gruppo[ass.codice] = gruppo[ass.codice] || []).push({ id: m.id, nome: nomeMil_(m), localita: ass.localita });
    }
  });
  var sc = statoScadenze_(d.oggi || giorno);
  return {
    forza: militari.length, presenti: presenti, servizio: servizio, assenti: assenti, fuori: fuori,
    liberi: liberi, festivo: festivo,
    scadute: sc.scadute, inScadenza: sc.inScadenza, mancanti: sc.mancanti.length
  };
}

function ruolino_(d) {
  var giorni = giorniMese_(d.anno, d.mese);
  var dal = giorni[0].data, al = giorni[giorni.length - 1].data;
  var militari = militariOrdinati_().filter(function (m) { return inForza_(m, dal, al); });
  var ids = mappa_(militari, 'id');
  var impieghi = leggi_('Impieghi').filter(function (i) { return i.data >= dal && i.data <= al && ids[i.militare_id]; })
    .map(function (i) { return { id: i.id, m: i.militare_id, d: i.data, c: i.codice, l: i.localita, n: i.note }; });
  return { giorni: giorni, militari: militari, impieghi: impieghi };
}

function impieghiCella_(militareId, data) {
  return leggi_('Impieghi').filter(function (i) { return i.militare_id === String(militareId) && i.data === data; })
    .map(function (i) { return { id: i.id, m: i.militare_id, d: i.data, c: i.codice, l: i.localita, n: i.note, q: i.quantita,
      da: i.modificato_da, il: i.modificato_il }; });
}

// ---------------------------------------------------------------------------
// Perdita della forza (congedo, trasferimento...)
// ---------------------------------------------------------------------------
function codicePerdeForza_(codice) {
  var c = mappa_(leggi_('Codici'), 'codice')[codice];
  return !!(c && vero_(c.perde_forza));
}

/** Dal giorno `data` il militare non e' piu' in forza (ultimo giorno in forza = giorno prima). */
function perditaForza_(m, data, codice) {
  m.data_uscita = aggiungiGiorni_(data, -1);
  m.stato = 'PER';
  aggiorna_('Militari', m);
  registra_(nomeMil_(m) + ': perso dalla forza dal ' + data + ' (' + codice + ')');
}

/** Elimina impieghi e, se tra questi c'era il codice che ha fatto perdere la forza, rimette il militare in forza. */
function eliminaImpieghi_(condizione) {
  var tolti = leggi_('Impieghi').filter(condizione);
  if (!tolti.length) return 0;
  elimina_('Impieghi', condizione);
  var perde = {};
  leggi_('Codici').forEach(function (c) { if (vero_(c.perde_forza)) perde[c.codice] = true; });
  var rcDopo = {};
  leggi_('Codici').forEach(function (c) { if (vero_(c.rc_dopo)) rcDopo[c.codice] = true; });
  tolti.forEach(function (i) {
    if (!rcDopo[i.codice]) return;
    var dopo = aggiungiGiorni_(i.data, 1), nota = notaSmonto_(i.codice, i.data);
    elimina_('Impieghi', function (x) { return x.militare_id === i.militare_id && x.data === dopo && x.codice === 'RC' && x.note === nota; });
  });
  tolti.forEach(function (i) {
    if (!perde[i.codice]) return;
    var m = leggi_('Militari').filter(function (x) { return x.id === i.militare_id; })[0];
    if (m && m.stato === 'PER' && m.data_uscita === aggiungiGiorni_(i.data, -1)) {
      m.data_uscita = ''; m.stato = 'EFF';
      aggiorna_('Militari', m);
      registra_(nomeMil_(m) + ': rimesso in forza (cancellato ' + i.codice + ' del ' + i.data + ')');
    }
  });
  return tolti.length;
}

// ---------------------------------------------------------------------------
// Servizi con smonto (guardie): il giorno dopo RC
// ---------------------------------------------------------------------------
function notaSmonto_(codice, data) {
  var p = data.split('-');
  return 'Smonto ' + codice + ' del ' + p[2] + '/' + p[1] + '/' + p[0];
}

function verificaGiorno_(cod, data) {
  if (giornoAmmesso_(cod.giorni, data)) return;
  var ammessi = String(cod.giorni).replace(/[^1-7]/g, '').split('').map(function (g) { return NOMI_GIORNI[g]; }).join(', ');
  throw new Error(cod.codice + ' si puo\' inserire solo nei giorni: ' + ammessi + ' (il ' + data.split('-').reverse().join('/') + ' e\' ' +
    NOMI_GIORNI[giornoISO_(data)] + '). I giorni si cambiano in Configurazione > Codici.');
}

/** Mette RC il giorno successivo al servizio (sostituendo gli altri codici di quel giorno). */
function aggiungiSmonto_(m, data, codice, utente) {
  var dopo = aggiungiGiorni_(data, 1);
  if (!inForza_(m, dopo) || !mappa_(leggi_('Codici'), 'codice')['RC']) return;
  var nota = notaSmonto_(codice, data);
  eliminaImpieghi_(function (i) { return i.militare_id === m.id && i.data === dopo && i.codice !== 'RC'; });
  var quando = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH:mm');
  var es = leggi_('Impieghi').filter(function (i) { return i.militare_id === m.id && i.data === dopo && i.codice === 'RC'; })[0];
  if (es) { es.note = nota; es.quantita = '0'; es.modificato_da = utente.email; es.modificato_il = quando; aggiorna_('Impieghi', es); }
  else aggiungi_('Impieghi', [{ id: nuovoId_(), militare_id: m.id, data: dopo, codice: 'RC', localita: '', quantita: '0',
    note: nota, modificato_da: utente.email, modificato_il: quando }]);
}

function cellaSalva_(d, utente) {
  if (!dataValida_(d.data)) throw new Error('Data non valida');
  var m = militareDa_(d.militare_id);
  var cod = mappa_(leggi_('Codici'), 'codice')[d.codice];
  if (!cod) throw new Error('Codice sconosciuto');
  if (d.al && !codicePerdeForza_(d.codice)) {
    // stesso codice fino alla data indicata
    periodo_({ militari: [m.id], codice: d.codice, localita: d.localita, note: d.note, dal: d.data, al: d.al,
      escludiFestivi: d.escludiFestivi, sostituisci: d.sostituisci }, utente);
    return impieghiCella_(m.id, d.data);
  }
  verificaGiorno_(cod, d.data);
  if (d.sostituisci || codicePerdeForza_(d.codice)) {
    eliminaImpieghi_(function (i) { return i.militare_id === m.id && i.data === d.data && i.codice !== d.codice; });
  }
  var esistente = leggi_('Impieghi').filter(function (i) { return i.militare_id === m.id && i.data === d.data && i.codice === d.codice; })[0];
  var quando = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH:mm');
  var campi = { localita: String(d.localita || '').trim().toUpperCase(), modificato_da: utente.email, modificato_il: quando };
  if (d.note !== undefined) campi.note = d.note;
  if (d.quantita !== undefined) campi.quantita = d.quantita;
  if (esistente) {
    Object.keys(campi).forEach(function (k) { esistente[k] = campi[k]; });
    aggiorna_('Impieghi', esistente);
  } else {
    aggiungi_('Impieghi', [Object.assign({ id: nuovoId_(), militare_id: m.id, data: d.data, codice: d.codice, note: '', quantita: '' }, campi)]);
  }
  registra_(d.data + ' ' + nomeMil_(m) + ': ' + d.codice + (campi.localita ? ' ' + campi.localita : ''));
  if (codicePerdeForza_(d.codice)) perditaForza_(militareDa_(m.id), d.data, d.codice);
  if (vero_(cod.rc_dopo)) aggiungiSmonto_(m, d.data, d.codice, utente);
  return impieghiCella_(m.id, d.data);
}

function cellaElimina_(d) {
  var m = militareDa_(d.militare_id);
  var ids = d.ids || (d.id ? [d.id] : null);
  var n = eliminaImpieghi_(function (i) {
    return i.militare_id === m.id && i.data === d.data && (!ids || ids.indexOf(i.id) >= 0);
  });
  if (n) registra_(d.data + ' ' + nomeMil_(m) + ': cancellati ' + n + ' codici');
  return impieghiCella_(m.id, d.data);
}

function periodo_(d, utente) {
  if (codicePerdeForza_(d.codice)) {
    // congedo/trasferimento: vale dal giorno indicato in avanti
    if (!dataValida_(d.dal)) throw new Error('Data non valida');
    (d.militari || []).forEach(function (id) {
      cellaSalva_({ militare_id: id, data: d.dal, codice: d.codice, localita: d.localita, note: d.note || '', sostituisci: true }, utente);
    });
    return (d.militari || []).length;
  }
  if (!dataValida_(d.al)) throw new Error('Indicare la data finale del periodo');
  if (!dataValida_(d.dal) || d.al < d.dal) throw new Error('Date non valide');
  if (giorniTra_(d.dal, d.al) > 366) throw new Error('Periodo troppo lungo (massimo un anno)');
  if (!d.militari || !d.militari.length) throw new Error('Scegliere almeno un militare');
  var militari = d.militari.map(militareDa_);
  var cod = mappa_(leggi_('Codici'), 'codice')[d.codice];
  if (!cod) throw new Error('Codice sconosciuto');
  var giorni = [];
  for (var g = d.dal; g <= d.al; g = aggiungiGiorni_(g, 1)) {
    if (!(d.escludiFestivi && festivo_(g)) && giornoAmmesso_(cod.giorni, g)) giorni.push(g);
  }
  var chiavi = {};
  militari.forEach(function (m) { giorni.forEach(function (g) { if (inForza_(m, g)) chiavi[m.id + '|' + g] = true; }); });
  eliminaImpieghi_(function (i) {
    return chiavi[i.militare_id + '|' + i.data] && (d.sostituisci || i.codice === d.codice);
  });
  var quando = Utilities.formatDate(new Date(), 'Europe/Rome', 'yyyy-MM-dd HH:mm');
  var nuovi = Object.keys(chiavi).map(function (k) {
    var p = k.split('|');
    return { id: nuovoId_() + Math.random().toString(36).slice(2, 4).toUpperCase(), militare_id: p[0], data: p[1],
      codice: d.codice, localita: String(d.localita || '').toUpperCase(), quantita: '', note: d.note || '',
      modificato_da: utente.email, modificato_il: quando };
  });
  aggiungi_('Impieghi', nuovi);
  if (vero_(cod.rc_dopo)) {
    nuovi.forEach(function (n) {
      if (!chiavi[n.militare_id + '|' + aggiungiGiorni_(n.data, 1)]) aggiungiSmonto_(militareDa_(n.militare_id), n.data, d.codice, utente);
    });
  }
  registra_('Periodo ' + d.dal + ' / ' + d.al + ' ' + d.codice + ' a ' +
    militari.map(function (m) { return m.cognome; }).join(', ') + ' (' + nuovi.length + ' giorni)');
  return nuovi.length;
}

/** Cancella i codici di uno o piu' militari in un periodo (al vuoto = fino in fondo). */
function periodoElimina_(d) {
  if (!dataValida_(d.dal)) throw new Error('Data iniziale non valida');
  if (d.al && (!dataValida_(d.al) || d.al < d.dal)) throw new Error('Data finale non valida');
  if (!d.militari || !d.militari.length) throw new Error('Scegliere almeno un militare');
  var militari = d.militari.map(militareDa_), ids = mappa_(militari, 'id');
  var n = eliminaImpieghi_(function (i) {
    return ids[i.militare_id] && i.data >= d.dal && (!d.al || i.data <= d.al) && (!d.codice || i.codice === d.codice);
  });
  registra_('Cancellati ' + n + ' codici' + (d.codice ? ' ' + d.codice : '') + ' dal ' + d.dal + (d.al ? ' al ' + d.al : ' in avanti') +
    ' a ' + militari.map(function (m) { return m.cognome; }).join(', '));
  return n;
}

function elenco_(d, campo, plurale) {
  var v = d[plurale || campo + 's'] || (d[campo] ? [d[campo]] : []);
  if (!v.length) throw new Error('Nessun elemento selezionato');
  return v.map(String);
}

// ---------------------------------------------------------------------------
// Militari
// ---------------------------------------------------------------------------
function militareSalva_(d) {
  if (!String(d.cognome || '').trim()) throw new Error('Il cognome e\' obbligatorio');
  var campi = {};
  TABELLE.Militari.forEach(function (c) { if (c !== 'id' && d[c] !== undefined) campi[c] = String(d[c]).trim(); });
  campi.cognome = campi.cognome.toUpperCase();
  if (campi.nome) campi.nome = campi.nome.toUpperCase();
  if (d.id) {
    var m = militareDa_(d.id);
    Object.keys(campi).forEach(function (k) { m[k] = campi[k]; });
    aggiorna_('Militari', m);
    registra_('Modificato militare ' + nomeMil_(m));
    return m.id;
  }
  var nuovo = Object.assign({ id: nuovoId_(), stato: 'EFF' }, campi);
  aggiungi_('Militari', [nuovo]);
  registra_('Nuovo militare ' + nomeMil_(nuovo));
  return nuovo.id;
}

function militareElimina_(d) {
  var militari = elenco_(d, 'id').map(militareDa_), ids = mappa_(militari, 'id');
  ['Impieghi', 'Spettanze', 'Movimenti', 'Scadenze'].forEach(function (t) {
    elimina_(t, function (x) { return !!ids[x.militare_id]; });
  });
  elimina_('Militari', function (x) { return !!ids[x.id]; });
  registra_('Eliminati militari: ' + militari.map(nomeMil_).join(', '));
  return militari.length;
}

/** Giorni con un servizio che prevede smonto (guardie): chiave militare|data. */
function giorniServizio_() {
  var rc = {}, out = {};
  leggi_('Codici').forEach(function (c) { if (vero_(c.rc_dopo)) rc[c.codice] = true; });
  leggi_('Impieghi').forEach(function (i) { if (rc[i.codice]) out[i.militare_id + '|' + i.data] = true; });
  return out;
}

function scalato_(i, c, orario, servizi) {
  return quantitaScalata_(i, c, orario, !!servizi[i.militare_id + '|' + aggiungiGiorni_(i.data, -1)]);
}

function situazioneContatori_(militareId, anno) {
  var codici = mappa_(leggi_('Codici'), 'codice');
  var orario = configurazione_().orario;
  var a = String(anno), out = {}, servizi = giorniServizio_();
  leggi_('Contatori').forEach(function (c) { out[c.nome] = { spettante: null, goduto: 0 }; });
  leggi_('Spettanze').forEach(function (s) {
    if (s.anno === a && out[s.contatore] && (!militareId || s.militare_id === militareId)) {
      if (militareId) out[s.contatore].spettante = numero_(s.quantita);
    }
  });
  leggi_('Impieghi').forEach(function (i) {
    if (i.militare_id !== militareId || i.data.slice(0, 4) !== a) return;
    var c = codici[i.codice];
    if (c && c.contatore && out[c.contatore]) out[c.contatore].goduto += scalato_(i, c, orario, servizi);
  });
  leggi_('Movimenti').forEach(function (mv) {
    if (mv.militare_id === militareId && mv.anno === a && out[mv.contatore]) out[mv.contatore].goduto += numero_(mv.quantita) || 0;
  });
  return out;
}

function militareScheda_(d) {
  var m = militareDa_(d.id);
  var oggi = d.oggi;
  var dal = aggiungiGiorni_(oggi, -30), al = aggiungiGiorni_(oggi, 60);
  var tipi = mappa_(leggi_('TipiScadenza'), 'nome');
  var scadenze = leggi_('Scadenze').filter(function (s) { return s.militare_id === m.id; })
    .sort(function (a, b) { return (a.tipo + b.data_scadenza).localeCompare(b.tipo + a.data_scadenza); });
  var ultime = {};
  scadenze.forEach(function (s) { if (!ultime[s.tipo] || s.data_scadenza > ultime[s.tipo].data_scadenza) ultime[s.tipo] = s; });
  scadenze.forEach(function (s) {
    s.stato = ultime[s.tipo] === s ? statoScadenza_(s.data_scadenza, tipi[s.tipo] ? tipi[s.tipo].preavviso_giorni : 30, oggi) : 'storico';
  });
  return {
    militare: m,
    contatori: situazioneContatori_(m.id, d.anno),
    scadenze: scadenze,
    movimenti: leggi_('Movimenti').filter(function (x) { return x.militare_id === m.id; }),
    impieghi: leggi_('Impieghi').filter(function (i) { return i.militare_id === m.id && i.data >= dal && i.data <= al; })
      .sort(function (a, b) { return a.data.localeCompare(b.data); })
  };
}

// ---------------------------------------------------------------------------
// Licenze
// ---------------------------------------------------------------------------
function licenze_(d) {
  var a = String(d.anno);
  var codici = mappa_(leggi_('Codici'), 'codice');
  var orario = configurazione_().orario;
  var militari = militariOrdinati_().filter(function (m) { return inForza_(m, a + '-01-01', a + '-12-31'); });
  var spett = {}, goduto = {}, servizi = giorniServizio_();
  leggi_('Spettanze').forEach(function (s) { if (s.anno === a) spett[s.militare_id + '|' + s.contatore] = numero_(s.quantita); });
  leggi_('Impieghi').forEach(function (i) {
    var c = codici[i.codice];
    if (!c || !c.contatore || i.data.slice(0, 4) !== a) return;
    var k = i.militare_id + '|' + c.contatore;
    goduto[k] = (goduto[k] || 0) + scalato_(i, c, orario, servizi);
  });
  leggi_('Movimenti').forEach(function (mv) {
    if (mv.anno !== a) return;
    var k = mv.militare_id + '|' + mv.contatore;
    goduto[k] = (goduto[k] || 0) + (numero_(mv.quantita) || 0);
  });
  return { militari: militari, spettanze: spett, goduto: goduto };
}

function spettanzaSalva_(d) {
  var m = militareDa_(d.militare_id), a = String(d.anno);
  var es = leggi_('Spettanze').filter(function (s) { return s.militare_id === m.id && s.contatore === d.contatore && s.anno === a; })[0];
  if (String(d.quantita).trim() === '') {
    if (es) elimina_('Spettanze', function (s) { return s.id === es.id; });
  } else {
    if (numero_(d.quantita) === null) throw new Error('Quantita\' non valida');
    if (es) { es.quantita = numero_(d.quantita); es.note = d.note || ''; aggiorna_('Spettanze', es); }
    else aggiungi_('Spettanze', [{ id: nuovoId_(), militare_id: m.id, contatore: d.contatore, anno: a, quantita: numero_(d.quantita), note: d.note || '' }]);
  }
  registra_('Spettanza ' + d.contatore + ' ' + a + ' ' + nomeMil_(m) + ': ' + d.quantita);
}

/** Salva molte spettanze in una volta: voci = [{militare_id, contatore, anno, quantita}] (quantita vuota = elimina). */
function spettanzeSalva_(d) {
  var voci = d.voci || [];
  if (!voci.length) throw new Error('Nessuna spettanza da salvare');
  var contatori = mappa_(leggi_('Contatori'), 'nome'), militari = mappa_(leggi_('Militari'), 'id');
  var righe = leggi_('Spettanze'), indice = {};
  righe.forEach(function (s, i) { indice[s.militare_id + '|' + s.contatore + '|' + s.anno] = i; });
  var cambiate = 0, tolte = {};
  voci.forEach(function (v) {
    var a = String(v.anno);
    if (!militari[v.militare_id]) throw new Error('Militare non trovato');
    if (!contatori[v.contatore]) throw new Error('Contatore sconosciuto: ' + v.contatore);
    if (!/^\d{4}$/.test(a)) throw new Error('Anno non valido: ' + a);
    var k = v.militare_id + '|' + v.contatore + '|' + a, q = String(v.quantita === undefined ? '' : v.quantita).trim();
    if (q === '') { if (indice[k] !== undefined) { tolte[indice[k]] = true; cambiate++; } return; }
    if (numero_(q) === null) throw new Error('Quantita\' non valida per ' + nomeMil_(militari[v.militare_id]) + ': ' + q);
    if (indice[k] !== undefined) { righe[indice[k]].quantita = numero_(q); delete tolte[indice[k]]; }
    else { righe.push({ id: nuovoId_() + righe.length, militare_id: v.militare_id, contatore: v.contatore, anno: a, quantita: numero_(q), note: '' }); indice[k] = righe.length - 1; }
    cambiate++;
  });
  riscrivi_('Spettanze', righe.filter(function (x, i) { return !tolte[i]; }));
  registra_('Spettanze modificate in blocco: ' + cambiate);
  return cambiate;
}

/** Riepilogo pluriennale di un contatore: per militare e anno spettante, goduto, residuo; piu' il residuo totale. */
function licenzeRiepilogo_(d) {
  var cont = mappa_(leggi_('Contatori'), 'nome')[d.contatore];
  if (!cont) throw new Error('Contatore sconosciuto');
  var codici = mappa_(leggi_('Codici'), 'codice'), orario = configurazione_().orario;
  var annoCorrente = Number(d.oggi ? String(d.oggi).slice(0, 4) : new Date().getFullYear());
  var spett = {}, goduto = {}, anni = {}, servizi = giorniServizio_();
  anni[annoCorrente] = true;
  leggi_('Spettanze').forEach(function (s) {
    if (s.contatore !== cont.nome) return;
    spett[s.militare_id + '|' + s.anno] = numero_(s.quantita); anni[s.anno] = true;
  });
  leggi_('Impieghi').forEach(function (i) {
    var c = codici[i.codice];
    if (!c || c.contatore !== cont.nome) return;
    var a = i.data.slice(0, 4), k = i.militare_id + '|' + a;
    goduto[k] = (goduto[k] || 0) + scalato_(i, c, orario, servizi); anni[a] = true;
  });
  leggi_('Movimenti').forEach(function (mv) {
    if (mv.contatore !== cont.nome) return;
    var k = mv.militare_id + '|' + mv.anno;
    goduto[k] = (goduto[k] || 0) + (numero_(mv.quantita) || 0); anni[mv.anno] = true;
  });
  var elenco = Object.keys(anni).map(Number).filter(function (a) { return a >= 2000 && a <= annoCorrente + 1; }).sort();
  var dal = elenco[0] + '-01-01', al = elenco[elenco.length - 1] + '-12-31';
  var militari = militariOrdinati_().filter(function (m) { return inForza_(m, dal, al) || d.anchePersi; });
  return { contatore: cont, anni: elenco, militari: militari, spettanze: spett, goduto: goduto };
}

function movimentoSalva_(d) {
  var m = militareDa_(d.militare_id);
  if (numero_(d.quantita) === null) throw new Error('Quantita\' non valida');
  aggiungi_('Movimenti', [{ id: nuovoId_(), militare_id: m.id, contatore: d.contatore, anno: String(d.anno),
    data: d.data, quantita: numero_(d.quantita), note: d.note || '' }]);
  registra_('Movimento ' + d.contatore + ' ' + nomeMil_(m) + ': ' + d.quantita + ' ' + (d.note || ''));
}

function movimentoElimina_(d) {
  var ids = elenco_(d, 'id');
  var n = elimina_('Movimenti', function (x) { return ids.indexOf(x.id) >= 0; });
  registra_('Eliminati ' + n + ' movimenti manuali');
  return n;
}

// ---------------------------------------------------------------------------
// Scadenze
// ---------------------------------------------------------------------------
function statoScadenze_(oggi) {
  var tipi = ordina_(leggi_('TipiScadenza'), 'ordine');
  var tipiMap = mappa_(tipi, 'nome');
  var militari = militariOrdinati_().filter(function (m) { return inForza_(m, oggi); });
  var mil = mappa_(militari, 'id');
  var ultime = {};
  leggi_('Scadenze').forEach(function (s) {
    var k = s.militare_id + '|' + s.tipo;
    var cur = ultime[k];
    if (!cur || (s.data_scadenza || s.data_esecuzione) > (cur.data_scadenza || cur.data_esecuzione)) ultime[k] = s;
  });
  var scadute = [], inScadenza = [], mancanti = [];
  Object.keys(ultime).forEach(function (k) {
    var s = ultime[k], m = mil[s.militare_id];
    if (!m) return;
    s.stato = statoScadenza_(s.data_scadenza, tipiMap[s.tipo] ? tipiMap[s.tipo].preavviso_giorni : 30, oggi);
    var voce = { id: s.id, militare: nomeMil_(m), militare_id: m.id, tipo: s.tipo, data_scadenza: s.data_scadenza };
    if (s.stato === 'scaduta') scadute.push(voce);
    if (s.stato === 'in_scadenza') inScadenza.push(voce);
  });
  tipi.forEach(function (t) {
    if (!vero_(t.obbligatoria)) return;
    militari.forEach(function (m) { if (!ultime[m.id + '|' + t.nome]) mancanti.push({ militare: nomeMil_(m), tipo: t.nome }); });
  });
  var perData = function (a, b) { return a.data_scadenza.localeCompare(b.data_scadenza); };
  return { tipi: tipi, militari: militari, ultime: ultime, scadute: scadute.sort(perData),
    inScadenza: inScadenza.sort(perData), mancanti: mancanti };
}

function scadenze_(d) {
  var s = statoScadenze_(d.oggi);
  return { tipi: s.tipi, militari: s.militari, ultime: s.ultime };
}

function scadenzaSalva_(d) {
  var m = militareDa_(d.militare_id);
  var tipo = mappa_(leggi_('TipiScadenza'), 'nome')[d.tipo];
  if (!tipo) throw new Error('Tipo di scadenza sconosciuto');
  if (!dataValida_(d.data_esecuzione) && !dataValida_(d.data_scadenza)) throw new Error('Indicare la data di esecuzione o di scadenza');
  var scad = d.data_scadenza;
  if (!dataValida_(scad) && dataValida_(d.data_esecuzione) && numero_(tipo.validita_mesi)) {
    scad = aggiungiMesi_(d.data_esecuzione, numero_(tipo.validita_mesi));
  }
  var rec = d.id ? leggi_('Scadenze').filter(function (s) { return s.id === d.id; })[0] : null;
  var campi = { militare_id: m.id, tipo: d.tipo, data_esecuzione: d.data_esecuzione || '', data_scadenza: scad || '',
    esito: d.esito || '', note: d.note || '' };
  if (d.file && d.file.base64) {
    var cartella = DriveApp.getFolderById(impostazioni_().cartella_documenti);
    var nomeFile = m.cognome + ' ' + m.nome + ' - ' + d.tipo + ' - ' + (d.data_esecuzione || scad) + ' - ' + d.file.nome;
    var f = cartella.createFile(Utilities.newBlob(Utilities.base64Decode(d.file.base64), d.file.mime || 'application/octet-stream', nomeFile));
    campi.documento_nome = d.file.nome; campi.documento_url = f.getUrl(); campi.documento_id = f.getId();
  }
  if (rec) { Object.keys(campi).forEach(function (k) { rec[k] = campi[k]; }); aggiorna_('Scadenze', rec); }
  else aggiungi_('Scadenze', [Object.assign({ id: nuovoId_(), documento_nome: '', documento_url: '', documento_id: '' }, campi)]);
  registra_('Scadenza ' + d.tipo + ' ' + nomeMil_(m) + ': ' + (scad || '-') + (campi.documento_id ? ' (con documento)' : ''));
}

function scadenzaElimina_(d) {
  var ids = elenco_(d, 'id');
  var lista = leggi_('Scadenze').filter(function (x) { return ids.indexOf(x.id) >= 0; });
  lista.forEach(function (s) {
    if (s.documento_id) { try { DriveApp.getFileById(s.documento_id).setTrashed(true); } catch (e) { /* gia' rimosso */ } }
  });
  elimina_('Scadenze', function (x) { return ids.indexOf(x.id) >= 0; });
  registra_('Eliminate ' + lista.length + ' scadenze: ' + lista.map(function (s) { return s.tipo; }).join(', '));
  return lista.length;
}

// ---------------------------------------------------------------------------
// Configurazione (codici, contatori, tipi scadenza, gradi, orario)
// ---------------------------------------------------------------------------
var CHIAVI_CONFIG = { Codici: 'codice', Contatori: 'nome', TipiScadenza: 'nome', Gradi: 'sigla' };

function configSalva_(d) {
  var tab = d.tabella, chiave = CHIAVI_CONFIG[tab];
  if (!chiave) throw new Error('Tabella non valida');
  var o = d.oggetto || {};
  var valore = String(o[chiave] || '').trim();
  if (!valore) throw new Error('Il campo "' + chiave + '" e\' obbligatorio');
  var righe = leggi_(tab);
  var doppio = righe.filter(function (r) { return r[chiave] === valore && r[chiave] !== d.originale; })[0];
  if (doppio) throw new Error('Esiste gia\' "' + valore + '"');
  var es = d.originale ? righe.filter(function (r) { return r[chiave] === d.originale; })[0] : null;
  var rec = es || {};
  TABELLE[tab].forEach(function (c) { if (o[c] !== undefined) rec[c] = Array.isArray(o[c]) ? o[c].join('') : String(o[c]).trim(); });
  rec[chiave] = valore;
  if (es) aggiorna_(tab, rec); else aggiungi_(tab, [rec]);
  // rinomina a cascata
  if (es && d.originale && d.originale !== valore) rinomina_(tab, d.originale, valore);
  registra_('Configurazione ' + tab + ': salvato ' + valore);
}

function rinomina_(tab, vecchio, nuovo) {
  var regole = {
    Codici: [['Impieghi', 'codice']],
    Contatori: [['Codici', 'contatore'], ['Spettanze', 'contatore'], ['Movimenti', 'contatore']],
    TipiScadenza: [['Scadenze', 'tipo']],
    Gradi: [['Militari', 'grado']]
  }[tab] || [];
  regole.forEach(function (r) {
    var righe = leggi_(r[0]), cambiate = false;
    righe.forEach(function (x) { if (x[r[1]] === vecchio) { x[r[1]] = nuovo; cambiate = true; } });
    if (cambiate) riscrivi_(r[0], righe);
  });
}

function configElimina_(d) {
  var tab = d.tabella, chiave = CHIAVI_CONFIG[tab];
  var valori = elenco_(d, 'valore', 'valori');
  var usi = {
    Codici: function (v) { return leggi_('Impieghi').some(function (i) { return i.codice === v; }); },
    Contatori: function (v) { return leggi_('Spettanze').some(function (s) { return s.contatore === v; }); },
    TipiScadenza: function (v) { return leggi_('Scadenze').some(function (s) { return s.tipo === v; }); },
    Gradi: function (v) { return leggi_('Militari').some(function (m) { return m.grado === v; }); }
  }[tab];
  if (!usi) throw new Error('Tabella non valida');
  var usati = valori.filter(usi), liberi = valori.filter(function (v) { return usati.indexOf(v) < 0; });
  if (!liberi.length) throw new Error((usati.length > 1 ? 'Sono' : 'E\'') + ' gia\' in uso, non si possono eliminare (si possono disattivare o rinominare): ' + usati.join(', '));
  elimina_(tab, function (r) { return liberi.indexOf(r[chiave]) >= 0; });
  registra_('Configurazione ' + tab + ': eliminati ' + liberi.join(', '));
  return { eliminati: liberi, usati: usati };
}

function orarioSalva_(d) {
  var v = {};
  ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].forEach(function (g) {
    var n = numero_(d[g]);
    if (n === null || n < 0 || n > 24) throw new Error('Ore non valide per ' + g);
    v['ore_' + g] = n;
  });
  v.festivi_zero = vero_(d.festivi_zero) ? 'SI' : 'NO';
  salvaImpostazioni_(v);
  registra_('Modificato orario di lavoro');
}

// ---------------------------------------------------------------------------
// Utenti (con condivisione automatica di Foglio e cartella Drive)
// ---------------------------------------------------------------------------
function condividi_(email, ruolo, togli) {
  var file = DriveApp.getFileById(db_().getId());
  var cartella = DriveApp.getFolderById(impostazioni_().cartella_id);
  var proprietario = file.getOwner() && file.getOwner().getEmail().toLowerCase();
  if (email === proprietario) return;
  [file, cartella].forEach(function (x) {
    try { x.removeEditor(email); } catch (e) { /* non presente */ }
    try { x.removeViewer(email); } catch (e) { /* non presente */ }
    if (!togli) {
      if (ruolo === 'Consultazione') x.addViewer(email); else x.addEditor(email);
    }
  });
}

function utenteSalva_(d) {
  var email = String(d.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Email non valida');
  if (!LIVELLI[d.ruolo]) throw new Error('Ruolo non valido');
  var es = leggi_('Utenti').filter(function (u) { return u.email.toLowerCase() === email; })[0];
  if (es && es.email === emailUtente_() && d.ruolo !== 'Amministratore') throw new Error('Non puoi togliere a te stesso il ruolo di amministratore');
  condividi_(email, d.ruolo, false);
  if (es) { es.nome = d.nome || ''; es.ruolo = d.ruolo; aggiorna_('Utenti', es); }
  else aggiungi_('Utenti', [{ email: email, nome: d.nome || '', ruolo: d.ruolo }]);
  registra_('Utente ' + email + ': ' + d.ruolo);
}

function utenteElimina_(d) {
  var emails = elenco_(d, 'email').map(function (e) { return e.toLowerCase(); });
  if (emails.indexOf(emailUtente_()) >= 0) throw new Error('Non puoi eliminare te stesso');
  emails.forEach(function (e) { condividi_(e, '', true); });
  elimina_('Utenti', function (u) { return emails.indexOf(u.email.toLowerCase()) >= 0; });
  registra_('Rimossi utenti: ' + emails.join(', '));
  return emails.length;
}

// ---------------------------------------------------------------------------
// Elenco azioni
// ---------------------------------------------------------------------------
var AZIONI = {
  statoLogin: { ruolo: 'Consultazione', libera: true, fn: statoLogin_ },
  login: { ruolo: 'Consultazione', libera: true, fn: login_ },
  creaPassword: { ruolo: 'Consultazione', libera: true, fn: creaPassword_ },
  cambiaPassword: { ruolo: 'Consultazione', fn: cambiaPassword_ },
  logout: { ruolo: 'Consultazione', fn: logout_ },
  azzeraPassword: { ruolo: 'Amministratore', fn: azzeraPassword_ },
  avvio: { ruolo: 'Consultazione', fn: function (d, u) { return { utente: utentePubblico_(u), config: configurazione_() }; } },
  situazione: { ruolo: 'Consultazione', fn: situazione_ },
  ruolino: { ruolo: 'Consultazione', fn: ruolino_ },
  cella: { ruolo: 'Consultazione', fn: function (d) { return impieghiCella_(d.militare_id, d.data); } },
  cellaSalva: { ruolo: 'Operatore', fn: cellaSalva_ },
  cellaElimina: { ruolo: 'Operatore', fn: cellaElimina_ },
  periodo: { ruolo: 'Operatore', fn: periodo_ },
  periodoElimina: { ruolo: 'Operatore', fn: periodoElimina_ },
  militari: { ruolo: 'Consultazione', fn: function () { return militariOrdinati_(); } },
  militareScheda: { ruolo: 'Consultazione', fn: militareScheda_ },
  militareSalva: { ruolo: 'Operatore', fn: militareSalva_ },
  militareElimina: { ruolo: 'Amministratore', fn: militareElimina_ },
  licenze: { ruolo: 'Consultazione', fn: licenze_ },
  spettanzaSalva: { ruolo: 'Operatore', fn: spettanzaSalva_ },
  spettanzeSalva: { ruolo: 'Operatore', fn: spettanzeSalva_ },
  licenzeRiepilogo: { ruolo: 'Consultazione', fn: licenzeRiepilogo_ },
  movimentoSalva: { ruolo: 'Operatore', fn: movimentoSalva_ },
  movimentoElimina: { ruolo: 'Operatore', fn: movimentoElimina_ },
  scadenze: { ruolo: 'Consultazione', fn: scadenze_ },
  scadenzaSalva: { ruolo: 'Operatore', fn: scadenzaSalva_ },
  scadenzaElimina: { ruolo: 'Operatore', fn: scadenzaElimina_ },
  configSalva: { ruolo: 'Amministratore', fn: configSalva_ },
  configElimina: { ruolo: 'Amministratore', fn: configElimina_ },
  orarioSalva: { ruolo: 'Amministratore', fn: orarioSalva_ },
  importa: { ruolo: 'Amministratore', fn: function (d) { return importaBrogliaccio_(d); } },
  esporta: { ruolo: 'Consultazione', fn: function (d) { return esportaRuolino_(d.anno, d.mese); } },
  backupOra: { ruolo: 'Amministratore', fn: function () { return backupGiornaliero(); } },
  utenti: { ruolo: 'Amministratore', fn: function () { return leggi_('Utenti').map(utentePubblico_); } },
  utenteSalva: { ruolo: 'Amministratore', fn: utenteSalva_ },
  utenteElimina: { ruolo: 'Amministratore', fn: utenteElimina_ },
  registro: { ruolo: 'Operatore', fn: function () { return leggi_('Registro').slice(-500).reverse(); } }
};
