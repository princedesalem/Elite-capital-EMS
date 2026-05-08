/**
 * Tests unitaires purs — formatLastSeen
 * Aucun rendu de composant, simple appel de fonction.
 */
import { describe, it, expect } from 'vitest'
import { formatLastSeen } from '../utils/formatLastSeen'

// Heure fixe de référence : vendredi 2026-05-08 15:00:00 UTC
const NOW = new Date('2026-05-08T15:00:00Z')

describe('formatLastSeen', () => {
  it('null → "Jamais connecté"', () => {
    expect(formatLastSeen(null, NOW)).toBe('Jamais connecté')
  })

  it('undefined → "Jamais connecté"', () => {
    expect(formatLastSeen(undefined, NOW)).toBe('Jamais connecté')
  })

  it('même jour, il y a 2 heures → "En ligne à HH:MM"', () => {
    const d = new Date(NOW.getTime() - 2 * 3600 * 1000) // 13:00 même jour
    const result = formatLastSeen(d.toISOString(), NOW)
    expect(result).toMatch(/^En ligne à \d{2}:\d{2}$/)
  })

  it('même jour, il y a 30 min → "En ligne à HH:MM"', () => {
    const d = new Date(NOW.getTime() - 30 * 60 * 1000)
    expect(formatLastSeen(d.toISOString(), NOW)).toMatch(/^En ligne à \d{2}:\d{2}$/)
  })

  it('hier → "Hier à HH:MM"', () => {
    // 2026-05-07 10:00
    const d = new Date('2026-05-07T10:00:00Z')
    expect(formatLastSeen(d.toISOString(), NOW)).toMatch(/^Hier à \d{2}:\d{2}$/)
  })

  it('même semaine (lundi 2026-05-04) → "Lundi à HH:MM"', () => {
    const d = new Date('2026-05-04T09:00:00Z')
    expect(formatLastSeen(d.toISOString(), NOW)).toMatch(/^Lundi à \d{2}:\d{2}$/)
  })

  it('même semaine (mardi 2026-05-05) → "Mardi à HH:MM"', () => {
    const d = new Date('2026-05-05T14:30:00Z')
    expect(formatLastSeen(d.toISOString(), NOW)).toMatch(/^Mardi à \d{2}:\d{2}$/)
  })

  it('même semaine (mercredi 2026-05-06) → "Mercredi à HH:MM"', () => {
    const d = new Date('2026-05-06T08:00:00Z')
    expect(formatLastSeen(d.toISOString(), NOW)).toMatch(/^Mercredi à \d{2}:\d{2}$/)
  })

  it('semaine précédente (2026-04-28) → date complète avec heure', () => {
    const d = new Date('2026-04-28T11:00:00Z')
    const result = formatLastSeen(d.toISOString(), NOW)
    // Ex: "28 avr. 2026 à 11:00" ou "28 avr 2026 à 11:00" selon locale
    expect(result).toMatch(/28/)
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/à \d{2}:\d{2}/)
    // Ne doit pas commencer par "En ligne", "Hier", ou un jour de semaine
    expect(result).not.toMatch(/^(En ligne|Hier|Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)/)
  })

  it('il y a 1 mois → date complète avec heure', () => {
    const d = new Date('2026-04-08T10:00:00Z')
    const result = formatLastSeen(d.toISOString(), NOW)
    expect(result).toMatch(/2026/)
    expect(result).toMatch(/à \d{2}:\d{2}/)
    expect(result).not.toMatch(/^(En ligne|Hier|Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)/)
  })
})
