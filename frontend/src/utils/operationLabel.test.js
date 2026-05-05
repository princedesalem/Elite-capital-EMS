import { describe, it, expect } from 'vitest'
import { operationLabel, missionDestLabel, fraisLabel, fixOlStartAttributes } from './operationLabel'

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

// ─── Suite 9: fixOlStartAttributes ──────────────────────────────────────────

/** Helper : extract the start attribute of each <ol> in order */
function extractStarts(html) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
  return Array.from(doc.querySelectorAll('ol')).map(ol => {
    const s = ol.getAttribute('start')
    return s ? parseInt(s, 10) : 1
  })
}

describe('fixOlStartAttributes', () => {
  it('retourne le HTML inchange si pas de <ol>', () => {
    const html = '<p>Bonjour</p><ul><li>A</li></ul>'
    expect(fixOlStartAttributes(html)).toBe(html)
  })

  it('retourne le HTML inchange si html vide ou null', () => {
    expect(fixOlStartAttributes('')).toBe('')
    expect(fixOlStartAttributes(null)).toBe(null)
  })

  it('ne modifie pas un seul <ol> (deja correct)', () => {
    const html = '<ol><li>A</li><li>B</li><li>C</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1])
  })

  it('corrige 3 <ol> consecutifs avec 1 li chacun -> start 1, 2, 3', () => {
    const html = '<ol><li>A</li></ol><ol><li>B</li></ol><ol><li>C</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 2, 3])
  })

  it('corrige <ol> avec plusieurs li -> start correct', () => {
    // 2 li + 3 li → le 2e ol doit avoir start=3
    const html = '<ol><li>A</li><li>B</li></ol><ol><li>C</li><li>D</li><li>E</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 3])
  })

  it('reset le compteur apres un <h2> entre deux <ol>', () => {
    const html = '<ol><li>A</li><li>B</li></ol><h2>Titre</h2><ol><li>C</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    // Apres le h2, nouveau contexte -> start = 1
    expect(starts).toEqual([1, 1])
  })

  it('<p> entre deux <ol> NE remet PAS le compteur (pas un vrai nouveau groupe)', () => {
    const html = '<ol><li>A</li></ol><p>Texte</p><ol><li>B</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 2])
  })

  it('<ul> entre deux <ol> NE remet PAS le compteur (cas TipTap classique)', () => {
    // Structure typique: section ol -> ul de taches -> section ol
    const html = '<ol><li>Section A</li></ol><ul><li>tache 1</li><li>tache 2</li></ul><ol><li>Section B</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 2])
  })

  it('<table> entre deux <ol> NE remet PAS le compteur', () => {
    const html = '<ol><li>Section A</li></ol><table><tr><td>x</td></tr></table><ol><li>Section B</li></ol>'
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 2])
  })

  it('pattern TipTap reel: ol dans <td> numerotes en continu', () => {
    // Structure reelle depuis Word: toute la fiche est dans une table,
    // les sections numerotees sont dans des <td> de cette table
    const html = [
      '<table><tbody>',
      '  <tr><td><ol><li>Administration systemes</li></ol></td></tr>',
      '  <tr><td>tache 1</td><td><ul><li>critere</li></ul></td></tr>',
      '  <tr><td>tache 2</td><td><ul><li>critere</li></ul></td></tr>',
      '  <tr><td><ol><li>Administration reseau</li></ol></td></tr>',
      '  <tr><td>tache 3</td><td><ul><li>critere</li></ul></td></tr>',
      '  <tr><td><ol><li>Securite SI</li></ol></td></tr>',
      '</tbody></table>',
    ].join('')
    const result = fixOlStartAttributes(html)
    const starts = extractStarts(result)
    expect(starts).toEqual([1, 2, 3])
  })

  it('<ol> imbrique dans un <li> a un compteur independant', () => {
    // Outer: 2 items. Inner (dans li 2): 2 items. Outer continue apres.
    const html = [
      '<ol>',
      '  <li>A</li>',
      '  <li>B<ol><li>b1</li><li>b2</li></ol></li>',
      '</ol>',
      '<ol><li>C</li></ol>',
    ].join('')
    const result = fixOlStartAttributes(html)
    // Outer ol 1 -> start 1, inner ol -> start 1 (independant), outer ol 2 -> start 3
    const ols = new DOMParser()
      .parseFromString(`<div>${result}</div>`, 'text/html')
      .querySelectorAll('ol')
    const starts = Array.from(ols).map(ol => parseInt(ol.getAttribute('start') || '1', 10))
    expect(starts[0]).toBe(1)  // outer 1
    expect(starts[1]).toBe(1)  // inner (independant)
    expect(starts[2]).toBe(3)  // outer 2 continue apres 2 items
  })

  it('gere un <ol> vide sans erreur', () => {
    const html = '<ol></ol><ol><li>A</li></ol>'
    expect(() => fixOlStartAttributes(html)).not.toThrow()
  })
})
