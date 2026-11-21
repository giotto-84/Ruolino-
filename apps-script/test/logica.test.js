// Prove della logica pura: node --test apps-script/test/logica.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'Logica.gs'), 'utf8'), ctx);
const L = ctx.module.exports;
// gli oggetti creati nel contesto vm vanno copiati per i confronti profondi
const P = (x) => JSON.parse(JSON.stringify(x));

test('pasqua e festivita', () => {
  assert.strictEqual(L.pasqua_(2026), '2026-04-05');
  assert.ok(L.festivita_(2026)['2026-04-06']);
  assert.ok(L.festivo_('2026-06-02'));
  assert.ok(L.festivo_('2026-11-22')); // domenica
  assert.ok(!L.festivo_('2026-11-20'));
});

test('giorni del mese', () => {
  const g = L.giorniMese_(2026, 2);
  assert.strictEqual(g.length, 28);
  assert.strictEqual(g[0].sett, 'D');
});

test('aggiungi mesi e stato scadenze', () => {
  assert.strictEqual(L.aggiungiMesi_('2026-08-31', 6), '2027-02-28');
  assert.strictEqual(L.aggiungiMesi_('2026-11-15', 12), '2027-11-15');
  assert.strictEqual(L.statoScadenza_('2027-02-28', 30, '2027-03-01'), 'scaduta');
  assert.strictEqual(L.statoScadenza_('2027-02-28', 30, '2027-02-10'), 'in_scadenza');
  assert.strictEqual(L.statoScadenza_('2027-02-28', 30, '2026-09-10'), 'valida');
  assert.strictEqual(L.statoScadenza_('', 30, '2026-09-10'), 'senza_data');
});

test('ore di recupero secondo orario', () => {
  const orario = { lun: 8, mar: 8, mer: 8, gio: 8, ven: 4, sab: 0, dom: 0, festivi_zero: 'SI' };
  const rc = { scala_orario: 'SI', quantita_giorno: 1 };
  assert.strictEqual(L.quantitaScalata_({ data: '2026-08-10' }, rc, orario), 8); // lunedi
  assert.strictEqual(L.quantitaScalata_({ data: '2026-08-14' }, rc, orario), 4); // venerdi
  assert.strictEqual(L.quantitaScalata_({ data: '2026-08-15' }, rc, orario), 0); // ferragosto
  assert.strictEqual(L.quantitaScalata_({ data: '2026-12-08' }, rc, orario), 0); // festivo di martedi
  assert.strictEqual(L.quantitaScalata_({ data: '2026-08-13', quantita: '3' }, rc, orario), 3);
  assert.strictEqual(L.quantitaScalata_({ data: '2026-08-13' }, { scala_orario: 'NO', quantita_giorno: '1' }, orario), 1);
});

test('in forza', () => {
  assert.ok(L.inForza_({ stato: 'EFF' }, '2026-08-10'));
  assert.ok(!L.inForza_({ stato: 'EFF', data_uscita: '2026-08-05' }, '2026-08-10'));
  assert.ok(L.inForza_({ stato: 'PER', data_uscita: '2026-08-05' }, '2026-08-01', '2026-08-31'));
  assert.ok(!L.inForza_({ stato: 'PER', data_uscita: '' }, '2026-08-10'));
});

test('interpretazione codici del brogliaccio', () => {
  const i = L.creaInterprete_(['LIC ORD', 'RC', 'RC FEST', 'Gdg', 'Udp', 'S.I.', 'S.S.', 'APRM', 'PRELIEVI', 'GUARDIA B (4)', 'NOTA', 'EX BRAG.']);
  let r = i.interpreta('LIC ORD IN DATA 12/08/26 INV LIC ORD GG 5');
  assert.deepStrictEqual(P(r.voci.map(v => v.codice)), ['LIC ORD']);
  assert.match(r.nota, /12\/08\/26/);
  r = i.interpreta('S.I. MALCO.');
  assert.deepStrictEqual(P([r.voci[0].codice, r.voci[0].localita]), ['S.I.', 'MALCONTENTA']);
  r = i.interpreta('SI ROMA');
  assert.deepStrictEqual(P([r.voci[0].codice, r.voci[0].localita]), ['S.I.', 'ROMA']);
  r = i.interpreta('S.S. VENEZIA');
  assert.deepStrictEqual(P([r.voci[0].codice, r.voci[0].localita]), ['S.S.', 'VENEZIA']);
  r = i.interpreta('RC FEST (LONDRA)');
  assert.deepStrictEqual(P([r.voci[0].codice, r.voci[0].localita]), ['RC FEST', 'LONDRA']);
  assert.strictEqual(i.interpreta('GDG').voci[0].codice, 'Gdg');
  assert.deepStrictEqual(P(i.interpreta('APRM + PRELIEVI').voci.map(v => v.codice)), ['APRM', 'PRELIEVI']);
  assert.strictEqual(i.interpreta('GUARDIA B (4)').voci[0].codice, 'GUARDIA B (4)');
  assert.strictEqual(i.interpreta('IN DATA 06/08/26 IMMESSO IN T.').voci[0].codice, 'NOTA');
  assert.strictEqual(i.interpreta('EX\nBRAG.').voci[0].codice, 'EX BRAG.');
  assert.strictEqual(i.interpreta('Gdg - GIA INV RC').voci[0].codice, 'Gdg');
  assert.strictEqual(i.interpreta('RC FEST IN DATA ').voci[0].codice, 'RC FEST');
});

test('colonne delle date', () => {
  const r1 = ['NUM', '', '', '', '', '', '', 'AGOSTO', '', 'SETTEMBRE'];
  const r2 = ['', '', '', '', '', '', '', 30, 31, 1];
  assert.deepStrictEqual(P(L.colonneDate_(r1, r2, 2026, 7)), { 7: '2026-08-30', 8: '2026-08-31', 9: '2026-09-01' });
});

test('giorni ammessi (guardia B mar-sab)', () => {
  assert.strictEqual(L.giornoISO_('2026-11-23'), 1); // lunedi
  assert.strictEqual(L.giornoISO_('2026-11-22'), 7); // domenica
  assert.ok(L.giornoAmmesso_('23456', '2026-11-24')); // martedi
  assert.ok(L.giornoAmmesso_('23456', '2026-11-28')); // sabato
  assert.ok(!L.giornoAmmesso_('23456', '2026-11-29')); // domenica
  assert.ok(!L.giornoAmmesso_('23456', '2026-11-23')); // lunedi
  assert.ok(L.giornoAmmesso_('', '2026-11-29'));
});
