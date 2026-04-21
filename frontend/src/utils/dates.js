/**
 * Helpers de formatage de date centralisés.
 * Conventions FR :
 *  - formatDate   → "21/04/2026"
 *  - formatDateTime → "21/04/2026 14:35:42"
 *  - dateTitle    → même chose que formatDateTime, conçu pour l'attribut HTML `title`.
 * Les valeurs invalides / nulles renvoient "—".
 */
const INVALID = '—'

function _toDate(value) {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function formatDate(value) {
  const d = _toDate(value)
  if (!d) return INVALID
  return d.toLocaleDateString('fr-FR')
}

export function formatDateTime(value) {
  const d = _toDate(value)
  if (!d) return INVALID
  return d.toLocaleString('fr-FR')
}

export function dateTitle(value) {
  const d = _toDate(value)
  if (!d) return ''
  return d.toLocaleString('fr-FR')
}
