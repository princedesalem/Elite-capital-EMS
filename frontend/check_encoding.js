const fs = require('fs');
const text = fs.readFileSync('/app/src/pages/FicheDePostePage.test.jsx', 'utf8');
const BAD = ['Ã©','Ã ','Ã¨','Ã€','Ã‡','Ã®','Ã´','Ã¹','Ã»','Ã§','\u00e2\u20ac\u201d','\u00e2\u20ac\u2122','\u00e2\u20ac\u0153','\u00c3\u2030','Ã‹','Ãª','Ã«','Ã½','\u00e2\u20ac\u00a6','\u00e2\u20ac\u00a2'];
BAD.forEach(p => {
  if(text.includes(p)) {
    const i = text.indexOf(p);
    console.log('BAD', JSON.stringify(p), 'ctx:', JSON.stringify(text.slice(Math.max(0,i-20), i+25)));
  }
});
if (!BAD.some(p => text.includes(p))) console.log('No standard patterns found');

// Also check for any char > 0xFF
let highChars = [];
for(let i=0;i<text.length;i++){
  const c = text.charCodeAt(i);
  if(c > 0x00FF && c < 0xFFFD) {
    highChars.push({c: c.toString(16), ch: text[i], ctx: JSON.stringify(text.slice(Math.max(0,i-5),i+5))});
  }
}
if(highChars.length > 0) {
  console.log('Non-latin chars found:');
  highChars.slice(0,20).forEach(x => console.log(' U+'+x.c, x.ch, x.ctx));
} else {
  console.log('All chars <= U+00FF');
}
