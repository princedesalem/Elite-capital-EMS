// Fix BOM + mojibake UTF-8/Windows-1252 in JSX/JS source files
const fs = require('fs'), path = require('path');

const SRC_DIR = '/app/src';
const EXTS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP = new Set(['encoding.test.js', 'scan_encoding.js', 'fix_encoding.js', 'fix_bom_mojibake.js']);

function fixFile(filePath) {
  let data = fs.readFileSync(filePath);
  // Strip BOM
  if (data[0] === 0xEF && data[1] === 0xBB && data[2] === 0xBF) {
    data = data.slice(3);
  }
  const text = data.toString('utf8');
  // Fix mojibake: the content has latin-1 codepoints that should be UTF-8 bytes
  // e.g. Ã© (U+00C3 U+00A9) was actually é (0xC3 0xA9 in UTF-8)
  // Strategy: encode back to latin-1 bytes, then decode as UTF-8
  try {
    const latinBytes = Buffer.from(text, 'latin1');
    const fixed = latinBytes.toString('utf8');
    if (fixed === text || fixed.includes('\ufffd')) return false;
    fs.writeFileSync(filePath, fixed, { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.vite', 'dist', 'coverage'].includes(entry.name))
        walk(full, files);
    } else if (!SKIP.has(entry.name) && EXTS.has(path.extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

let totalFixed = 0;
for (const f of walk(SRC_DIR)) {
  if (fixFile(f)) {
    console.log('Fixed:', f.replace(SRC_DIR, 'src/'));
    totalFixed++;
  }
}
console.log('Total fixed:', totalFixed);
