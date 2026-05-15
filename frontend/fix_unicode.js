// Fix remaining mojibake with explicit Unicode codepoints
const fs = require('fs');

const MAP = [
  // Lettres accentuées mojibake (Windows-1252 re-encodé comme UTF-8)
  ['\u00C3\u00A9', '\u00E9'], // é
  ['\u00C3\u00A8', '\u00E8'], // è
  ['\u00C3\u00A0', '\u00E0'], // à
  ['\u00C3\u00A2', '\u00E2'], // â
  ['\u00C3\u00A7', '\u00E7'], // ç
  ['\u00C3\u00AA', '\u00EA'], // ê
  ['\u00C3\u00AE', '\u00EE'], // î
  ['\u00C3\u00AF', '\u00EF'], // ï
  ['\u00C3\u00B4', '\u00F4'], // ô
  ['\u00C3\u00B9', '\u00F9'], // ù
  ['\u00C3\u00BB', '\u00FB'], // û
  ['\u00C3\u00BC', '\u00FC'], // ü
  ['\u00C3\u0089', '\u00C9'], // É
  ['\u00C3\u0080', '\u00C0'], // À
  ['\u00C3\u0087', '\u00C7'], // Ç
  ['\u00C3\u008B', '\u00CB'], // Ë
  ['\u00C3\u0088', '\u00C8'], // È
  ['\u00C3\u0090', '\u00D0'], // Ð
  // Ponctuation typographique
  ['\u00E2\u20AC\u2014', '\u2014'], // — (em dash)
  ['\u00E2\u20AC\u201D', '\u2014'], // — (em dash variante)
  ['\u00E2\u20AC\u201C', '\u2013'], // – (en dash)
  ['\u00E2\u20AC\u2019', '\u2019'], // ' (right single quote)
  ['\u00E2\u20AC\u0153', '\u0153'], // œ (fallback)
  ['\u00E2\u20AC\u2122', '\u2122'], // ™
  ['\u00E2\u20AC\u2026', '\u2026'], // …
  ['\u00E2\u20AC\u00A2', '\u2022'], // •
  ['\u00C2\u00B7', '\u00B7'],       // ·
  ['\u00C2\u00B0', '\u00B0'],       // °
  ['\u00C2\u00A9', '\u00A9'],       // ©
  ['\u00C2\u00AB', '\u00AB'],       // «
  ['\u00C2\u00BB', '\u00BB'],       // »
  // Symboles / icônes mojibake (UTF-8 bytes lus comme Windows-1252)
  // ✓ (U+2713, UTF-8: E2 9C 93) → E2→â, 9C→œ(U+0153), 93→"(U+201C)
  ['\u00E2\u0153\u201C', '\u2713'], // âœ" → ✓
  // ✔ (U+2714, UTF-8: E2 9C 94) → E2→â, 9C→œ, 94→"(U+201D)
  ['\u00E2\u0153\u201D', '\u2714'], // âœ" → ✔
  // ✗ (U+2717, UTF-8: E2 9C 97) → E2→â, 9C→œ, 97→—(U+2014)
  ['\u00E2\u0153\u2014', '\u2717'], // âœ— → ✗
  // ✕ (U+2715, UTF-8: E2 9C 95) → E2→â, 9C→œ, 95→•(U+2022)
  ['\u00E2\u0153\u2022', '\u2715'], // âœ• → ✕
  // → (U+2192, UTF-8: E2 86 92) → E2→â, 86→†(U+2020), 92→'(U+2018)
  ['\u00E2\u2020\u2018', '\u2192'], // â†' → →
  // ← (U+2190, UTF-8: E2 86 90) → E2→â, 86→†, 90→\u2018(') or similar
  ['\u00E2\u2020\u201C', '\u2190'], // â†" → ←
];

function fixFile(filePath) {
  let data = fs.readFileSync(filePath);
  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) data = data.slice(3);
  let text = data.toString('utf8');
  let count = 0;
  for (const [bad, good] of MAP) {
    while (text.includes(bad)) {
      text = text.split(bad).join(good);
      count++;
    }
  }
  if (count > 0) fs.writeFileSync(filePath, text, 'utf8');
  return count;
}

const FILES = process.argv.slice(2);
for (const f of FILES) {
  const n = fixFile(f);
  console.log(n > 0 ? 'Fixed ' + n + ' replacements: ' + f : 'No change: ' + f);
}
