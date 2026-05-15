// @vitest-environment node
/**
 * Test d'intégrité de l'encodage UTF-8 des fichiers source frontend.
 *
 * Détecte :
 *   1. La présence d'un BOM UTF-8 (EF BB BF) — cause d'erreurs avec certains
 *      bundlers et outils de traitement de fichiers.
 *   2. Le "mojibake" UTF-8/Windows-1252 : corruption qui survient lorsqu'un
 *      fichier UTF-8 est lu avec l'encodage ANSI de Windows (ex. : PowerShell 5.1
 *      `Get-Content` sans paramètre `-Encoding`), produisant des séquences comme
 *      "GÃ©nÃ©ral" au lieu de "Général".
 *
 * Comment ça se produit :
 *   - PowerShell 5.1 lit un fichier UTF-8 sans BOM comme Windows-1252 par défaut.
 *   - Les octets UTF-8 multi-octets (ex : é = 0xC3 0xA9) sont interprétés comme
 *     deux caractères Latin-1 distincts (Ã + ©).
 *   - `Set-Content -Encoding UTF8` réécrit ces caractères corrompus en UTF-8 avec BOM.
 *   - Le navigateur affiche alors "Ã©" au lieu de "é".
 *
 * Règle d'or pour modifier des fichiers source en PowerShell :
 *   Toujours utiliser [System.IO.File]::ReadAllText / WriteAllText avec
 *   new UTF8Encoding($false) au lieu de Get-Content / Set-Content.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SRC_DIR = join(__dirname, '..') // frontend/src/

// Extensions de fichiers source à analyser
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.css', '.html'])

// Répertoires à exclure de l'analyse
const EXCLUDE_DIRS = new Set(['node_modules', '.vite', 'dist', 'coverage', '__snapshots__'])

/**
 * Fichiers qui contiennent intentionnellement des patterns mojibake dans leurs
 * assertions de test (ex : vérification que les exports PDF ne contiennent pas
 * de caractères corrompus). Ajouter ici tout fichier qui teste explicitement
 * la non-présence de ces séquences.
 * Marqueur alternatif : ajouter `// @encoding-test-intentional` en première ligne.
 */
const INTENTIONAL_MOJIBAKE_FILES = new Set([
  'encoding.test.js', // ce fichier lui-même (définit les patterns)
])

/**
 * Collecte récursivement tous les fichiers source.
 */
function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectFiles(full, files)
    } else if (EXTENSIONS.has(extname(entry).toLowerCase())) {
      files.push(full)
    }
  }
  return files
}

/**
 * Séquences Mojibake UTF-8/Windows-1252 les plus courantes.
 * Chaque paire : [séquence corrompue, caractère original].
 */
const MOJIBAKE_PATTERNS = [
  ['Ã©', 'é'], ['Ã¨', 'è'], ['Ã ', 'à'], ['Ã¢', 'â'], ['Ã§', 'ç'],
  ['Ãª', 'ê'], ['Ã®', 'î'], ['Ã¯', 'ï'], ['Ã´', 'ô'], ['Ã¹', 'ù'],
  ['Ã»', 'û'], ['Ã¼', 'ü'], ['Ã±', 'ñ'], ['Å"', 'œ'],
  ['Ã‰', 'É'], ['Ã€', 'À'], ['Ã‡', 'Ç'], ['Ã"', 'Ô'], ['Ã™', 'Ù'],
  ['â€™', "'"], ['â€œ', '"'], ['\u00E2\u20AC\u009D', '"'], ['â€"', '–'], ['â€"', '—'],
  ['Â«', '«'], ['Â»', '»'], ['Â·', '·'], ['Â°', '°'], ['Â©', '©'],
  // Symboles et icônes (UTF-8 bytes lus comme Windows-1252)
  // ✓ (U+2713, E2 9C 93) → â + œ(U+0153) + "(U+201C)
  ['\u00E2\u0153\u201C', '✓'],
  // ✔ (U+2714, E2 9C 94) → â + œ + "(U+201D)
  ['\u00E2\u0153\u201D', '✔'],
  // ✗ (U+2717, E2 9C 97) → â + œ + —(U+2014)
  ['\u00E2\u0153\u2014', '✗'],
  // → (U+2192, E2 86 92) → â + †(U+2020) + '(U+2018)
  ['\u00E2\u2020\u2018', '→'],
]

const sourceFiles = collectFiles(SRC_DIR)

describe('Encodage UTF-8 des fichiers source', () => {
  it('aucun fichier source ne doit avoir un BOM UTF-8', () => {
    const withBom = []
    for (const file of sourceFiles) {
      const bytes = readFileSync(file)
      if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
        withBom.push(file.replace(SRC_DIR, 'src/'))
      }
    }
    expect(withBom, `Fichiers avec BOM UTF-8 détectés :\n${withBom.join('\n')}`).toHaveLength(0)
  })

  it('aucun fichier source ne doit contenir du mojibake UTF-8/Windows-1252', () => {
    const corrupted = []
    for (const file of sourceFiles) {
      const basename = file.split(/[/\\]/).pop()
      if (INTENTIONAL_MOJIBAKE_FILES.has(basename)) continue
      const content = readFileSync(file, 'utf8')
      // Ignore les fichiers marqués explicitement
      if (content.startsWith('// @encoding-test-intentional')) continue
      const found = MOJIBAKE_PATTERNS.filter(([bad]) => content.includes(bad))
      if (found.length > 0) {
        corrupted.push({
          file: file.replace(SRC_DIR, 'src/'),
          patterns: found.map(([bad, good]) => `"${bad}" → devrait être "${good}"`),
        })
      }
    }
    const report = corrupted.map(({ file, patterns }) =>
      `  ${file}:\n    - ${patterns.join('\n    - ')}`
    ).join('\n')
    expect(
      corrupted,
      `Fichiers avec encodage corrompu (mojibake) :\n${report}\n\n` +
      `Cause probable : fichier UTF-8 lu/écrit avec Get-Content/Set-Content PowerShell 5.1 ` +
      `sans spécifier -Encoding UTF8NoBOM.\n` +
      `Correction : utiliser [System.IO.File]::ReadAllText/WriteAllText avec ` +
      `new System.Text.UTF8Encoding($false).`
    ).toHaveLength(0)
  })
})
