/**
 * Formate la date de dernière connexion de façon contextuelle.
 *
 * - Même jour       → "En ligne à 14:32"
 * - Hier            → "Hier à 09:15"
 * - Même semaine    → "Lundi à 16:45"
 * - Plus d'1 semaine→ "24 avr. 2026 à 08:30"
 * - Jamais          → "Jamais connecté"
 */
export function formatLastSeen(iso, now = new Date()) {
  if (!iso) return 'Jamais connecté'
  // Force UTC : Python renvoie ISO sans 'Z', JS l'interpréterait sinon comme heure locale
  const normalized = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z'
  const d = new Date(normalized)
  const hhmm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  // Même jour
  if (d.toDateString() === now.toDateString()) return `En ligne à ${hhmm}`
  // Hier
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Hier à ${hhmm}`
  // Même semaine calendaire (lundi de la semaine courante)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  startOfWeek.setHours(0, 0, 0, 0)
  if (d >= startOfWeek) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
    return `${jours[d.getDay()]} à ${hhmm}`
  }
  // Plus d'une semaine
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) + ` à ${hhmm}`
}
