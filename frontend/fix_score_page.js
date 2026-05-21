// Fix mojibake in ScoreComportementalPage.jsx
const fs = require('fs');
const file = '/app/src/pages/ScoreComportementalPage.jsx';
let data = fs.readFileSync(file);
// Strip BOM if present
if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) data = data.slice(3);
let text = data.toString('utf8');

const MAP = [
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã ', 'à'], ['Ã¢', 'â'], ['Ã§', 'ç'],
  ['Ãª', 'ê'], ['Ã®', 'î'], ['Ã¯', 'ï'], ['Ã´', 'ô'], ['Ã¹', 'ù'],
  ['Ã»', 'û'], ['Ã¼', 'ü'], ['Ã‰', 'É'], ['Ã€', 'À'], ['Ã‡', 'Ç'],
  ['â€™', '\u2019'], ['â€œ', '\u201C'], ['â€\u009D', '\u201D'],
  ['â€"', '\u2013'], ['â€"', '\u2014'],
  ['Â·', '·'], ['Â°', '°'], ['Â©', '©'], ['Â«', '«'], ['Â»', '»'],
  ['â€¦', '…'], ['âœ"', '✓'], ['âœ—', '✗'], ['â„¢', '™'],
];

let count = 0;
for (const [bad, good] of MAP) {
  const before = text;
  text = text.split(bad).join(good);
  if (text !== before) count++;
}
fs.writeFileSync(file, text, 'utf8');
console.log('Fixed ' + count + ' pattern(s) in ' + file);
