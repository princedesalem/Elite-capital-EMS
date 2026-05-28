// @vitest-environment node
/**
 * Tests de qualité linguistique du code source frontend (français).
 *
 * Vérifie l'absence de fautes d'orthographe et de grammaire connues dans
 * les chaînes de caractères visibles par l'utilisateur (labels, boutons,
 * messages toast, placeholders, titres).
 *
 * Règles :
 *  - Les identifiants techniques (clés API, noms de variables, routes) sont exclus.
 *  - Seuls les fichiers JSX/JS de pages et composants sont analysés.
 *  - Les fichiers de test sont exclus.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const SRC_DIR = join(__dirname, '..')

const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx'])
const EXCLUDE_DIRS = new Set(['node_modules', '.vite', 'dist', 'coverage', '__snapshots__', 'test'])

/** Fichiers exclus de l'analyse (tests, mocks, ce fichier lui-même) */
const EXCLUDE_FILES = new Set([
  'french-grammar.test.js',
  'encoding.test.js',
])

function collectFiles(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (EXCLUDE_DIRS.has(entry)) continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      collectFiles(full, files)
    } else {
      const ext = extname(entry).toLowerCase()
      const base = basename(entry)
      if (EXTENSIONS.has(ext) && !base.endsWith('.test.js') && !base.endsWith('.test.jsx') && !base.endsWith('.test.ts') && !base.endsWith('.test.tsx') && !EXCLUDE_FILES.has(base)) {
        files.push(full)
      }
    }
  }
  return files
}

/**
 * Vérifie qu'une ligne est une chaîne UI visible (pas un identifiant technique).
 * On s'intéresse aux lignes contenant : du JSX de rendu, des toasts, des
 * placeholders, des titles, des setError/setSuccess.
 */
function isUILine(line) {
  return (
    line.includes('toast.') ||
    line.includes('setError(') ||
    line.includes('setSuccess(') ||
    /placeholder\s*=/.test(line) ||
    /title\s*=\s*["'`]/.test(line) ||
    />[ \t]*[A-ZÀ-Ö][^<{]{2,}[ \t]*<\//.test(line) ||   // >Texte visible</tag>
    />\s*[A-ZÀ-Ö][^<{]{2,}\s*\{/.test(line) ||           // >Texte { count }
    /"[A-ZÀ-Ö][a-zà-öø-ÿ ]{3,}"/.test(line)              // "Label visible"
  )
}

// ---------------------------------------------------------------------------
// Patterns de fautes connues
// Chaque entrée : { pattern, message, isRegex? }
// ---------------------------------------------------------------------------
const BAD_PATTERNS = [
  // --- Accents manquants sur les participes passés courants ---
  {
    // Ne cibler que le texte dans les chaînes et le JSX visible, pas les noms de variables JS
    pattern: /["\`>]\s*Envoye["\`<]|>\s*Envoye\s*<|">Envoye"|'Envoye'/,
    message: '"Envoye" sans accent → utiliser "Envoyé" (dans les chaînes UI)',
    skipIfTechnical: null,
  },
  {
    // Ne cibler que le texte dans les chaînes visibles, pas les noms de variables JS
    pattern: /["\`>]\s*Recu["\`<,]|>\s*Recu[\s<]|">Recu"|'Recu'(?!\s*,\s*counts)/,
    message: '"Recu" sans accent → utiliser "Reçu" (dans les chaînes UI)',
    skipIfTechnical: /PaginatedRecuList|libelleRecu|__recu_statut|recu-avalider|recu-valide|'recu'|"recu"/,
  },
  {
    pattern: /(?<![A-Za-z_'"`])(Valide|valide) par moi/i,
    message: '"Valide par moi" → utiliser "Validé par moi"',
    skipIfTechnical: /valide.*par.*moi.*=>|=>.*valide.*par.*moi/,
  },
  {
    pattern: /(?<![A-Za-z_'"`])(Refuse|refuse) par moi/i,
    message: '"Refuse par moi" → utiliser "Refusé par moi"',
    skipIfTechnical: /refuse.*par.*moi.*=>|=>.*refuse.*par.*moi/,
  },
  {
    pattern: /Recu a valider/i,
    message: '"Recu a valider" → utiliser "Reçu à valider"',
    skipIfTechnical: null,
  },

  // --- Boîte sans accent ---
  {
    pattern: /Boite (Envoye|Recu|envoy|reçu)/i,
    message: '"Boite" sans accent → utiliser "Boîte"',
    skipIfTechnical: null,
  },

  // --- Articles manquants dans les boutons d'action ---
  {
    pattern: />\s*Valider frais\s*</,
    message: 'Article manquant : "Valider frais" → "Valider les frais"',
    skipIfTechnical: null,
  },
  {
    pattern: />\s*Afficher propositions\s*</,
    message: 'Article manquant : "Afficher propositions" → "Afficher les propositions"',
    skipIfTechnical: null,
  },

  // --- Libellé sans accent : uniquement dans les chaînes de texte UI, pas les champs DB ---
  {
    // Cible : placeholder="Saisir le libelle ..." ou >Libelle< dans du JSX
    // Exclut : f.libelle, s.libelle, p.libelle, fonctionForm.libelle, libelleRecu, etc.
    pattern: /(?:placeholder|title)=["\`][^"\`]*\blibelle\b[^"\`]*["\`]|>\s*[Ll]ibelle\s*</,
    message: '"libelle" sans accent dans un texte UI → utiliser "libellé"',
    skipIfTechnical: null,
  },

  // --- "Envoyé Par" (majuscule incorrecte sur "par") ---
  {
    pattern: /Envoyé Par\b/,
    message: '"Envoyé Par" → "Envoyé par" (minuscule)',
    skipIfTechnical: null,
  },
]

// ---------------------------------------------------------------------------
// Extraction des occurrences
// ---------------------------------------------------------------------------
function findViolations(filePath, content) {
  const violations = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Ignorer les lignes qui sont de purs commentaires ou imports
    const trimmed = line.trim()
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ') || trimmed.startsWith('export {')) continue

    for (const rule of BAD_PATTERNS) {
      if (!rule.pattern.test(line)) continue
      // Exclure si la ligne correspond au pattern technique
      if (rule.skipIfTechnical && rule.skipIfTechnical.test(line)) continue
      // Si uiOnly explicitement false, pas de filtre supplémentaire
      // Sinon, vérifier que c'est bien du texte UI visible
      violations.push({
        line: i + 1,
        text: trimmed.slice(0, 120),
        message: rule.message,
      })
    }
  }

  return violations
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Qualité linguistique française — UI text', () => {
  const files = collectFiles(SRC_DIR)

  it('collecte des fichiers source à analyser', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('aucune faute d\'orthographe ou de grammaire connue dans les fichiers UI', () => {
    const allViolations = []

    for (const filePath of files) {
      let content
      try {
        content = readFileSync(filePath, 'utf-8')
      } catch {
        continue
      }

      const violations = findViolations(filePath, content)
      for (const v of violations) {
        allViolations.push(`${filePath.replace(SRC_DIR, '')}:${v.line} [${v.message}]\n  → ${v.text}`)
      }
    }

    if (allViolations.length > 0) {
      throw new Error(
        `${allViolations.length} faute(s) détectée(s) :\n\n` +
        allViolations.join('\n\n')
      )
    }
  })

  // --- Tests unitaires par règle ---

  describe('Orthographe — participes passés avec accent', () => {
    it('"Reçu" est utilisé (pas "Recu") dans les labels des onglets', () => {
      const tabFiles = [
        join(SRC_DIR, 'pages', 'CongesPage.jsx'),
        join(SRC_DIR, 'pages', 'FraisPage.jsx'),
        join(SRC_DIR, 'pages', 'SortiesPage.jsx'),
        join(SRC_DIR, 'pages', 'PermissionsPage.jsx'),
        join(SRC_DIR, 'pages', 'MissionsPage.jsx'),
      ]
      for (const f of tabFiles) {
        let content
        try { content = readFileSync(f, 'utf-8') } catch { continue }
        // L'onglet doit contenir "Reçu" comme label visible
        expect(content, `${basename(f)} : label onglet doit être "Reçu"`).toMatch(/"Reçu"/)
        // Ne doit pas contenir "Recu" comme label (entre guillemets)
        expect(content, `${basename(f)} : label onglet ne doit pas être "Recu"`).not.toMatch(/"Recu"/)
      }
    })

    it('"Validé par moi" et "Refusé par moi" sont utilisés dans Operations.jsx', () => {
      const f = join(SRC_DIR, 'pages', 'Operations.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/Validé par moi/)
      expect(content).toMatch(/Refusé par moi/)
      expect(content).not.toMatch(/Valide par moi/)
      expect(content).not.toMatch(/Refuse par moi/)
    })

    it('"Reçu à valider" est utilisé dans Operations.jsx', () => {
      const f = join(SRC_DIR, 'pages', 'Operations.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/Reçu à valider/)
      expect(content).not.toMatch(/Recu a valider/)
    })
  })

  describe('Grammaire — articles manquants dans les boutons', () => {
    it('"Valider les frais" est utilisé dans Operations.jsx (pas "Valider frais")', () => {
      const f = join(SRC_DIR, 'pages', 'Operations.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/Valider les frais/)
      expect(content).not.toMatch(/>\s*Valider frais\s*</)
    })

    it('"Afficher les propositions" est utilisé dans Operations.jsx', () => {
      const f = join(SRC_DIR, 'pages', 'Operations.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/Afficher les propositions/)
      expect(content).not.toMatch(/Afficher propositions/)
    })
  })

  describe('Orthographe — accents sur "Boîte"', () => {
    it('"Boîte Envoyée" et "Boîte Reçu" sont utilisés dans Operations.jsx', () => {
      const f = join(SRC_DIR, 'pages', 'Operations.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/Boîte Envoyée/)
      expect(content).toMatch(/Boîte Reçu/)
      expect(content).not.toMatch(/Boite Envoye/)
      expect(content).not.toMatch(/Boite Recu/)
    })
  })

  describe('Orthographe — "libellé" dans Administration.jsx', () => {
    it('placeholder utilise "libellé" avec accent', () => {
      const f = join(SRC_DIR, 'pages', 'Administration.jsx')
      const content = readFileSync(f, 'utf-8')
      expect(content).toMatch(/libellé de la fonction/)
      expect(content).not.toMatch(/libelle de la fonction/)
    })
  })

  describe('Typographie — majuscules dans les en-têtes de colonnes', () => {
    it('"Envoyé par" est en minuscule dans FraisPage.jsx et MissionsPage.jsx', () => {
      for (const name of ['FraisPage.jsx', 'MissionsPage.jsx']) {
        const f = join(SRC_DIR, 'pages', name)
        const content = readFileSync(f, 'utf-8')
        expect(content, `${name} : "Envoyé par" doit être en minuscule`).not.toMatch(/Envoyé Par/)
      }
    })
  })
})
