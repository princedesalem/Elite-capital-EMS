const fs = require('fs'), path = require('path');
const cp1252Map = [0x20AC,0x81,0x201A,0x0192,0x201E,0x2026,0x2020,0x2021,0x02C6,0x2030,0x0160,0x2039,0x0152,0x8D,0x017D,0x8F,0x90,0x2018,0x2019,0x201C,0x201D,0x2022,0x2013,0x2014,0x02DC,0x2122,0x0161,0x203A,0x0153,0x9D,0x017E,0x0178];
const rev = {};
cp1252Map.forEach((cp, i) => { rev[cp] = 0x80 + i; });

function encode1252(s) {
  const b = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) b.push(c);
    else if (c in rev) b.push(rev[c]);
    else if (c <= 0xFF) b.push(c);
    else return null;
  }
  return Buffer.from(b);
}

function tryFix(s) {
  const b = encode1252(s);
  if (!b) return null;
  const r = b.toString('utf8');
  if (r === s || r.includes('\ufffd')) return null;
  return r;
}

function walk(d) {
  const out = [];
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (f.isDirectory()) out.push(...walk(path.join(d, f.name)));
    else if (f.name.endsWith('.jsx') || f.name.endsWith('.js')) out.push(path.join(d, f.name));
  }
  return out;
}

let fixed = 0;
for (const f of walk('/app/src')) {
  const s = fs.readFileSync(f, 'utf8');
  if (!s.includes('\u00c3') && !s.includes('\u00e2') && !s.includes('\u00c2')) continue;
  const r = tryFix(s);
  if (r) {
    fs.writeFileSync(f, r, 'utf8');
    fixed++;
    console.log('Fixed:', path.basename(f));
  }
}
console.log('Total fixed:', fixed);
