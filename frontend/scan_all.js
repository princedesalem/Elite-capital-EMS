// Scan complet de TOUS les fichiers source (jsx/js/ts/css/html) pour mojibake
const fs = require('fs'), path = require('path');

const BAD = [
  // Lettres accentuées
  '\u00C3\u00A9','\u00C3\u00A8','\u00C3\u00A0','\u00C3\u00A2','\u00C3\u00A7',
  '\u00C3\u00AA','\u00C3\u00AE','\u00C3\u00AF','\u00C3\u00B4','\u00C3\u00B9',
  '\u00C3\u00BB','\u00C3\u00BC','\u00C3\u0089','\u00C3\u0080','\u00C3\u0087',
  '\u00C3\u008B','\u00C3\u0088','\u00C3\u00AB','\u00C3\u00AA','\u00C5\u00BD',
  // Ponctuation
  '\u00E2\u20AC\u2014','\u00E2\u20AC\u201D','\u00E2\u20AC\u201C',
  '\u00E2\u20AC\u2019','\u00E2\u20AC\u2026','\u00E2\u20AC\u00A2',
  '\u00E2\u20AC\u2122','\u00C2\u00B7','\u00C2\u00B0','\u00C2\u00A9',
  '\u00C2\u00AB','\u00C2\u00BB',
  // Symboles (checkmarks, arrows)
  '\u00E2\u0153\u201C','\u00E2\u0153\u201D','\u00E2\u0153\u2014',
  '\u00E2\u2020\u2018','\u00E2\u2020\u201C',
];

// Fichiers/dossiers à ignorer
const SKIP_FILES = new Set([
  'encoding.test.js','scan_encoding.js','fix_encoding.js','fix_bom_mojibake.js',
  'fix_unicode.js','fix_score_page.js','check_encoding.js','scan_checkmarks.js',
  'scan_all.js',
]);
const SKIP_DIRS = new Set(['node_modules','.vite','dist','coverage','.git']);

function walk(d, r=[]) {
  for(const f of fs.readdirSync(d,{withFileTypes:true})) {
    const fp = path.join(d,f.name);
    if(f.isDirectory()) {
      if(!SKIP_DIRS.has(f.name)) walk(fp,r);
    } else if(/\.(jsx?|tsx?|css|html|vue)$/i.test(f.name)) {
      r.push(fp);
    }
  }
  return r;
}

let total = 0, dirty = 0;
for(const f of walk('/app/src')) {
  total++;
  const base = path.basename(f);
  if(SKIP_FILES.has(base)) continue;
  const content = fs.readFileSync(f,'utf8');
  if(content.startsWith('// @encoding-test-intentional')) continue;
  const found = BAD.filter(p => content.includes(p));
  if(found.length) {
    dirty++;
    console.log('GARBLED:', path.relative('/app/src',f));
    // Show context for first occurrence
    found.slice(0,3).forEach(p => {
      const i = content.indexOf(p);
      const line = content.slice(0,i).split('\n').length;
      console.log('  line', line, ':', JSON.stringify(content.slice(Math.max(0,i-20),i+20)));
    });
  }
}
console.log('\n--- ' + dirty + ' file(s) with issues out of ' + total + ' scanned ---');
if(dirty === 0) console.log('ALL CLEAN');
