const fs=require('fs'),path=require('path');
// Patterns mojibake : lettres accentuées + ponctuation + symboles (✓✗→)
const BAD=[
  'Ã©','Ã ','Ã¨','Ã€','Ã‡','Ã®','Ã´','Ã¹','Ã»','Ã§','â€"','â€™','â€˜','â€œ','â€\x9d','Ã‰','Ã‹','Ãª','Ã«','Ã½','â€¦','â€¢',
  // Symboles (UTF-8 E2 9C xx lu comme Windows-1252)
  '\u00E2\u0153\u201C', // âœ" → ✓
  '\u00E2\u0153\u201D', // âœ" → ✔
  '\u00E2\u0153\u2014', // âœ— → ✗
  '\u00E2\u2020\u2018', // â†' → →
];
// Fichiers intentionnellement exclus (contiennent ces patterns comme littéraux de test)
const INTENTIONAL=['encoding.test.js','scan_encoding.js','fix_encoding.js','fix_bom_mojibake.js','fix_unicode.js','fix_score_page.js'];
function walk(d){const o=[];for(const f of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,f.name);if(f.isDirectory()&&f.name!=='node_modules'&&f.name!=='.git'&&f.name!=='dist')o.push(...walk(fp));else if(/\.(jsx?|py|css)$/.test(f.name))o.push(fp);}return o;}
const results=[];
for(const f of walk('/app')){
  const base=path.basename(f);
  if(INTENTIONAL.includes(base)) continue;
  const s=fs.readFileSync(f,'utf8');
  // Honore le marqueur @encoding-test-intentional
  if(s.startsWith('// @encoding-test-intentional')) continue;
  const matches=BAD.filter(p=>s.includes(p));
  if(matches.length)results.push({f,matches});
}
if(results.length===0)console.log('ALL_CLEAN');
else results.forEach(r=>console.log('GARBLED: '+path.relative('/app',r.f)+' ['+r.matches.slice(0,5).join(', ')+']'));
