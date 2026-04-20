const fs=require('fs'),path=require('path');
const BAD=['Ã©','Ã ','Ã¨','Ã€','Ã‡','Ã®','Ã´','Ã¹','Ã»','Ã§','â€"','â€™','â€˜','â€œ','â€\x9d','Ã‰','Ã‹','Ãª','Ã«','Ã½','â€¦','â€¢'];
function walk(d){const o=[];for(const f of fs.readdirSync(d,{withFileTypes:true})){const fp=path.join(d,f.name);if(f.isDirectory()&&f.name!=='node_modules'&&f.name!=='.git'&&f.name!=='dist')o.push(...walk(fp));else if(/\.(jsx?|py|css)$/.test(f.name))o.push(fp);}return o;}
const results=[];
for(const f of walk('/app')){
  const s=fs.readFileSync(f,'utf8');
  const matches=BAD.filter(p=>s.includes(p));
  if(matches.length)results.push({f,matches});
}
if(results.length===0)console.log('ALL_CLEAN');
else results.forEach(r=>console.log('GARBLED: '+path.relative('/app',r.f)+' ['+r.matches.slice(0,5).join(', ')+']'));
