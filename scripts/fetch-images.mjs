// Scarica le immagini (pubblico dominio, free-exercise-db) degli esercizi usati dall'app.
// Uso: node scripts/fetch-images.mjs
import { readFileSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
const files = readdirSync('src/data').filter((f) => f.startsWith('exercises-'));
const ids = new Set();
for (const f of files) {
  for (const m of readFileSync(join('src/data', f), 'utf8').matchAll(/img: '([^']+)'/g)) ids.add(m[1]);
}
let ok = 0;
for (const id of ids) {
  for (const frame of [0, 1]) {
    const dir = join('public/exercises', id);
    const out = join(dir, `${frame}.jpg`);
    if (existsSync(out)) { ok++; continue; }
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}/${frame}.jpg`);
    if (!res.ok) { console.error(`MANCANTE ${id}/${frame}: ${res.status}`); continue; }
    mkdirSync(dir, { recursive: true });
    writeFileSync(out, Buffer.from(await res.arrayBuffer()));
    ok++;
  }
}
console.log(`${ids.size} esercizi, ${ok} immagini pronte`);
