/**
 * Builds human-readable 3-word labels for any operation type.
 * e.g. "Mission Douala Audit" instead of "Mission #58"
 */

const STOP = new Set([
  'de','du','des','le','la','les','un','une','\u00e0','au','aux','en',
  'et','ou','pour','par','sur','dans','avec','mon','ma','mes','je',
  'tu','il','elle','son','sa','ses','ce','cet','cette',
])

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/** Extract 2 meaningful content words from a motif/comment string. */
function shortMotif(text) {
  if (!text) return ''
  const words = text.trim().split(/\s+/).filter(
    w => w.length > 2 && !STOP.has(w.toLowerCase()) && !/^\d+$/.test(w)
  )
  return words.slice(0, 2).map(capitalize).join(' ')
}

/**
 * Extract the city/destination from operation item fields.
 * Priority: item.ville → parse item.objet ("PAYS - VILLE") → item.pays
 */
function extractDestination(item) {
  const bad = new Set(['n/a', 'undefined', 'null', ''])
  const clean = s => s && !bad.has(String(s).trim().toLowerCase()) ? String(s).trim() : null

  if (clean(item.ville)) return capitalize(item.ville)

  if (item.objet) {
    const parts = item.objet.split(/\s*[-\u2013]\s*/).map(s => s.trim()).filter(s => !bad.has(s.toLowerCase()))
    if (parts.length >= 2) return capitalize(parts[1]) // ville is after dash
    if (parts.length === 1) return capitalize(parts[0])
  }

  if (clean(item.pays)) return capitalize(item.pays)

  return ''
}

/** Join up to 3 parts, deduplicating words across parts to avoid "Sortie Sortie Test". */
function buildLabel(...parts) {
  const usedWords = new Set()
  const result = []
  for (const part of parts.slice(0, 3)) {
    if (!part) continue
    const words = part.trim().split(/\s+/).filter(w => {
      if (!w || usedWords.has(w.toLowerCase())) return false
      usedWords.add(w.toLowerCase())
      return true
    })
    const filtered = words.join(' ')
    if (filtered) result.push(filtered)
  }
  return result.join(' ')
}

/**
 * Returns a human-readable label for any operation/workflow item.
 *
 * Examples:
 *   { type_demande:'Mission', ville:'Douala', motif:'Audit financier' }
 *     => "Mission Douala Audit"
 *   { type_demande:'Conge', type_conge:'annuel', motif:'Repos famille' }
 *     => "Conge Annuel Repos"
 *   null
 *     => "Op\u00e9ration"
 */
export function operationLabel(item) {
  if (!item) return 'Op\u00e9ration'

  // Explicit title always wins (unless it's just a number like "62")
  const titre = (item.titre || '').trim()
  if (titre && !/^\d+$/.test(titre)) return titre

  const raw = (item.type_demande || item.type || '').toLowerCase()
  const motif = shortMotif(item.motif || item.commentaire || item.mission_comment || '')

  if (raw.includes('frais')) {
    const dest = extractDestination(item)
    return buildLabel('Frais mission', dest, motif) || 'Frais de mission'
  }

  if (raw.startsWith('permission')) {
    const tp = (item.type_permission || '').split(/[_\s]+/).map(capitalize).join(' ')
    return buildLabel('Permission', tp, motif) || 'Permission'
  }

  if (raw.includes('cong')) {
    const tc = (item.type_conge || item.type_permission || '')
      .split(/[_\s]+/).map(capitalize).join(' ')
    return buildLabel('Cong\u00e9', tc, motif) || 'Cong\u00e9'
  }

  if (raw.includes('mission')) {
    const dest = extractDestination(item)
    return buildLabel('Mission', dest, motif) || 'Mission'
  }

  if (raw.includes('sortie')) {
    return buildLabel('Sortie', motif) || 'Sortie'
  }

  if (raw) {
    const typeLabel = raw.charAt(0).toUpperCase() + raw.slice(1)
    return buildLabel(typeLabel, motif) || typeLabel
  }

  return 'Op\u00e9ration'
}

/**
 * Label for the "linked mission" column in frais rows.
 * Destination-focused: "Mission Douala Rapport"
 */
export function missionDestLabel(item) {
  if (!item) return 'Mission'
  const dest = extractDestination(item)
  const motif = shortMotif(item.motif || item.mission_comment || item.commentaire || '')
  return buildLabel('Mission', dest, motif) || 'Mission'
}

/**
 * Label for a frais de mission row title.
 * e.g. "Frais mission Douala Transport"
 */
export function fraisLabel(item) {
  if (!item) return 'Frais de mission'
  const dest = extractDestination(item)
  const motif = shortMotif(item.motif || item.mission_comment || item.commentaire || '')
  return buildLabel('Frais mission', dest, motif) || 'Frais de mission'
}

// ─── fixOlStartAttributes ────────────────────────────────────────────────────
/**
 * Fix <ol start="…"> attributes when TipTap generates multiple <ol> elements
 * that each restart at 1 instead of continuing the sequence.
 *
 * Uses document-order traversal: finds every <ol> not nested inside another
 * <ol> and numbers them continuously, resetting ONLY at heading elements
 * (h1-h6, hr). Crucially, <ul>, <table>, <p>, <div> do NOT reset the counter
 * — these commonly separate numbered section headers in TipTap/Word exports.
 *
 * @param {string} html - Raw HTML string (from TipTap / DOMPurify)
 * @returns {string} HTML with corrected <ol start="…"> attributes
 */

const _OL_RESET_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR'])

function _inOl(el, root) {
  let p = el.parentElement
  while (p && p !== root) {
    if (p.tagName === 'OL') return true
    p = p.parentElement
  }
  return false
}

export function fixOlStartAttributes(html) {
  if (!html || !html.includes('<ol')) return html
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstChild
  let cumulative = 0
  for (const el of Array.from(root.querySelectorAll('*'))) {
    if (_OL_RESET_TAGS.has(el.tagName) && !_inOl(el, root)) {
      cumulative = 0
    } else if (el.tagName === 'OL' && !_inOl(el, root)) {
      const directLi = Array.from(el.children).filter(c => c.tagName === 'LI')
      if (cumulative > 0) {
        el.setAttribute('start', String(cumulative + 1))
      }
      cumulative += directLi.length
    }
  }
  return root.innerHTML
}
