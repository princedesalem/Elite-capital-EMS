import { describe, it, expect } from 'vitest'
import { operationLabel, missionDestLabel, fraisLabel } from './operationLabel'

// ─── Suite 1: Mission ────────────────────────────────────────────────────────

describe('operationLabel - Mission', () => {
  it('genere Mission + ville + 2 mots du motif', () => {
    const label = operationLabel({ type_demande: 'Mission', ville: 'Douala', motif: 'Audit financier annuel' })
    expect(label).toContain('Mission')
    expect(label).toContain('Douala')
    expect(label).toContain('Audit')
  })

  it('extrait la ville depuis objet "PAYS - VILLE"', () => {
    const label = operationLabel({ type_demande: 'Mission', objet: 'Cameroun - Yaoundé', motif: 'Formation' })
    expect(label).toContain('Mission')
    expect(label.toLowerCase()).toContain('yaound')
  })

  it('utilise le pays si ville et objet absents', () => {
    const label = operationLabel({ type_demande: 'Mission', pays: 'Maroc', motif: 'Prospection' })
    expect(label).toContain('Mission')
    expect(label).toContain('Maroc')
  })

  it('retourne le titre explicite si present (non-numerique)', () => {
    const label = operationLabel({ type_demande: 'Mission', titre: 'Mission spéciale DG', ville: 'Douala' })
    expect(label).toBe('Mission spéciale DG')
  })

  it('ignore un titre uniquement numerique et genere le label', () => {
    const label = operationLabel({ type_demande: 'Mission', titre: '58', ville: 'Paris' })
    expect(label).toContain('Mission')
    expect(label).toContain('Paris')
    expect(label).not.toBe('58')
  })

  it('retourne "Mission" si aucune info disponible', () => {
    expect(operationLabel({ type_demande: 'Mission' })).toBe('Mission')
  })
})

// ─── Suite 2: Frais de mission ───────────────────────────────────────────────

describe('operationLabel - Frais de mission', () => {
  it('genere Frais mission + ville + motif', () => {
    const label = operationLabel({ type_demande: 'Frais de mission', ville: 'Paris', motif: 'Transport hébergement' })
    expect(label).toContain('Frais mission')
    expect(label).toContain('Paris')
  })

  it('retourne "Frais mission" si aucune info supplementaire disponible', () => {
    expect(operationLabel({ type_demande: 'Frais de mission' })).toBe('Frais mission')
  })
})

// ─── Suite 3: Congé ──────────────────────────────────────────────────────────

describe('operationLabel - Congé', () => {
  it('genere Congé + type_conge + motif', () => {
    const label = operationLabel({ type_demande: 'Congé', type_conge: 'annuel', motif: 'Repos famille' })
    expect(label).toContain('Cong')
    expect(label.toLowerCase()).toContain('annuel')
  })

  it('inclut les mots du motif quand type_conge absent', () => {
    const label = operationLabel({ type_demande: 'Congé', motif: 'Maladie grave certifiée' })
    expect(label).toContain('Cong')
    expect(label.toLowerCase()).toMatch(/maladie|grave/)
  })

  it('retourne uniquement "Congé" si aucune info disponible', () => {
    expect(operationLabel({ type_demande: 'Congé' })).toBe('Congé')
  })

  it('gere type_conge avec underscore comme "maternite_simple"', () => {
    const label = operationLabel({ type_demande: 'Congé', type_conge: 'maternite_simple' })
    expect(label.toLowerCase()).toContain('maternite')
    expect(label.toLowerCase()).toContain('simple')
  })
})

// ─── Suite 4: Permission ─────────────────────────────────────────────────────

describe('operationLabel - Permission', () => {
  it('genere Permission + type_permission', () => {
    const label = operationLabel({ type_demande: 'Permission', type_permission: 'médicale' })
    expect(label).toContain('Permission')
    expect(label.toLowerCase()).toContain('m\u00e9dicale')
  })

  it('inclut des mots du motif quand type_permission absent', () => {
    const label = operationLabel({ type_demande: 'Permission', motif: 'Rendez-vous médical urgence' })
    expect(label).toContain('Permission')
    expect(label.toLowerCase()).toMatch(/rendez|urgent|m\u00e9dical/)
  })

  it('retourne "Permission" si aucune info disponible', () => {
    expect(operationLabel({ type_demande: 'Permission' })).toBe('Permission')
  })
})

// ─── Suite 5: Sortie ─────────────────────────────────────────────────────────

describe('operationLabel - Sortie', () => {
  it('genere Sortie + mots du motif', () => {
    const label = operationLabel({ type_demande: 'Sortie', motif: 'Réunion client importante' })
    expect(label).toContain('Sortie')
    expect(label.toLowerCase()).toMatch(/r\u00e9union|client/)
  })

  it('retourne "Sortie" si aucune info disponible', () => {
    expect(operationLabel({ type_demande: 'Sortie' })).toBe('Sortie')
  })
})

// ─── Suite 6: Edge cases ─────────────────────────────────────────────────────

describe('operationLabel - edge cases', () => {
  it('retourne "Opération" pour null', () => {
    expect(operationLabel(null)).toBe('Opération')
  })

  it('retourne "Opération" pour objet vide', () => {
    expect(operationLabel({})).toBe('Opération')
  })

  it('extrait "Paris" depuis objet "France - Paris"', () => {
    const label = operationLabel({ type_demande: 'Mission', objet: 'France - Paris' })
    expect(label).toContain('Paris')
    expect(label).not.toContain('France - Paris')
  })

  it('filtre N/A dans objet "Cameroun - N/A" et utilise pays', () => {
    const label = operationLabel({ type_demande: 'Mission', objet: 'Cameroun - N/A', pays: 'Cameroun' })
    expect(label).not.toContain('N/A')
    expect(label).toContain('Mission')
  })

  it('ne duplique pas un mot present dans le type et le motif', () => {
    const label = operationLabel({ type_demande: 'Mission', ville: 'mission', motif: '' })
    const parts = label.split(' ')
    expect(parts.filter(p => p.toLowerCase() === 'mission').length).toBe(1)
  })

  it('filtre les mots stopwords du motif', () => {
    const label = operationLabel({ type_demande: 'Sortie', motif: 'le de du avec' })
    // Only stopwords — motif becomes empty
    expect(label).toBe('Sortie')
  })
})

// ─── Suite 7: fraisLabel ─────────────────────────────────────────────────────

describe('fraisLabel', () => {
  it('genere "Frais mission Douala Hébergement"', () => {
    const label = fraisLabel({ ville: 'Douala', motif: 'Hébergement transport' })
    expect(label).toContain('Frais mission')
    expect(label).toContain('Douala')
    expect(label.toLowerCase()).toContain('h\u00e9bergement')
  })

  it('parse objet "France - Lyon" pour la ville', () => {
    const label = fraisLabel({ objet: 'France - Lyon' })
    expect(label).toContain('Lyon')
  })

  it('retourne "Frais de mission" pour null', () => {
    expect(fraisLabel(null)).toBe('Frais de mission')
  })

  it('retourne "Frais mission" pour objet vide (pas de destination)', () => {
    expect(fraisLabel({})).toBe('Frais mission')
  })
})

// ─── Suite 8: missionDestLabel ───────────────────────────────────────────────

describe('missionDestLabel', () => {
  it('genere "Mission Abidjan Conférence"', () => {
    const label = missionDestLabel({ ville: 'Abidjan', motif: 'Conférence annuelle internationale' })
    expect(label).toContain('Mission')
    expect(label).toContain('Abidjan')
    expect(label.toLowerCase()).toContain('conf\u00e9rence')
  })

  it('retourne "Mission Maroc" via pays quand ville absent', () => {
    const label = missionDestLabel({ pays: 'Maroc' })
    expect(label).toContain('Mission')
    expect(label).toContain('Maroc')
  })

  it('retourne "Mission" pour null', () => {
    expect(missionDestLabel(null)).toBe('Mission')
  })

  it('utilise mission_comment si motif absent', () => {
    const label = missionDestLabel({ ville: 'Tunis', mission_comment: 'Rapport stratégique' })
    expect(label).toContain('Tunis')
    expect(label.toLowerCase()).toContain('rapport')
  })
})
