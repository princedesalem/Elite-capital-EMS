// Scan for ALL mojibake patterns including checkmarks
const fs = require('fs'), path = require('path');
function walk(d, r=[]) {
  for(const f of fs.readdirSync(d,{withFileTypes:true})) {
    const p = path.join(d,f.name);
    if(f.isDirectory() && !['node_modules','.vite','dist','coverage'].includes(f.name)) walk(p,r);
    else if(/\.(jsx?|tsx?)$/.test(f.name)) r.push(p);
  }
  return r;
}
const CHECKMARK_MOJI = [
  '\u00E2\u009C\u0094', // âœ" = ✔
  '\u00E2\u009C\u0097', // âœ— = ✗
  '\u00E2\u009C\u0093', // âœ" = ✓
  '\u00E2\u009C\u0095', // âœ• = ✕
];
for(const f of walk('/app/src')) {
  const t = fs.readFileSync(f,'utf8');
  const found = CHECKMARK_MOJI.filter(p=>t.includes(p));
  if(found.length) console.log('FOUND', path.relative('/app',f), found.length, 'pattern(s)');
}
console.log('done');
