import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import ProgressionValidation from './ProgressionValidation'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

/** Helper : construit une progression avec les étapes fournies */
function makeProgression(etapes, overrides = {}) {
  return {
    data: {
      id_operation: 1,
      type_demande: 'Congé',
      demandeur: { nom_complet: 'Jean Dupont' },
      date_demande: '2026-04-01T08:00:00',
      est_modifie: false,
      date_modification: null,
      etapes,
      progression: 0,
      statut_final: 'EN COURS (0/1)',
      ...overrides,
    },
  }
}

describe('ProgressionValidation', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
  })

  it('affiche le badge modifiee et la date de modification', async () => {
    apiGetMock.mockResolvedValue(makeProgression(
      [{ numero: 1, role: 'DIRECTEUR', statut: 'en attente', validateur: null, date: null, commentaire: null }],
      { est_modifie: true, date_modification: '2026-04-02T09:30:00' }
    ))

    render(<ProgressionValidation idOperation={11} />)

    await waitFor(() => {
      expect(screen.getByText('Modifiée')).toBeInTheDocument()
    })
    expect(screen.getByText(/Modifiée le/i)).toBeInTheDocument()
  })

  // ── Tests : tooltip toujours affiché pour toutes les étapes ──────────────

  it('affiche "Reçu le" avec la date quand date_recu est renseignée', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'RESPONSABLE', statut: 'en attente',
      validateur: 'Alice Martin', date: null, commentaire: null,
      date_recu: '2026-05-01T08:00:00', date_vue: null,
    }]))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Reçu le/i)).toBeInTheDocument())
    expect(screen.getByText(/01\/05\/2026/)).toBeInTheDocument()
  })

  it('affiche "En attente" pour Reçu le quand date_recu est null', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'RH', statut: 'en attente',
      validateur: null, date: null, commentaire: null,
      date_recu: null, date_vue: null,
    }]))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Reçu le/i)).toBeInTheDocument())
    expect(screen.getByText(/En attente/i)).toBeInTheDocument()
  })

  it('affiche "Pas encore vue" pour Vu le quand date_vue est null', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'DIRECTEUR', statut: 'en attente',
      validateur: 'Bob Kone', date: null, commentaire: null,
      date_recu: '2026-05-01T08:00:00', date_vue: null,
    }]))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Vu le/i)).toBeInTheDocument())
    expect(screen.getByText(/Pas encore vue/i)).toBeInTheDocument()
  })

  it('affiche la date de vue quand date_vue est renseignée', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'DG', statut: 'en attente',
      validateur: 'Charles Eto', date: null, commentaire: null,
      date_recu: '2026-05-01T08:00:00', date_vue: '2026-05-02T09:30:00',
    }]))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Vu le/i)).toBeInTheDocument())
    // La date de vue doit apparaître (02/05/2026)
    expect(screen.getByText(/02\/05\/2026/)).toBeInTheDocument()
    expect(screen.queryByText(/Pas encore vue/i)).not.toBeInTheDocument()
  })

  it('affiche "Validé le" avec date pour une étape validée', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'RESPONSABLE', statut: 'validé',
      validateur: 'Alice Martin', date: '2026-05-03T14:00:00', commentaire: 'OK',
      date_recu: '2026-05-01T08:00:00', date_vue: '2026-05-02T09:00:00',
    }], { progression: 100, statut_final: 'APPROUVÉE' }))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Validé le/i)).toBeInTheDocument())
    expect(screen.getByText(/03\/05\/2026/)).toBeInTheDocument()
  })

  it('affiche "Refusé le" avec date pour une étape refusée', async () => {
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'DIRECTEUR', statut: 'refusé',
      validateur: 'Bob Kone', date: '2026-05-04T10:00:00', commentaire: 'Non justifié',
      date_recu: '2026-05-01T08:00:00', date_vue: '2026-05-03T11:00:00',
    }], { progression: 0, statut_final: 'REFUSÉE' }))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(screen.getByText(/Refusé le/i)).toBeInTheDocument())
    expect(screen.getByText(/Non justifié/i)).toBeInTheDocument()
  })

  it('le tooltip s\'affiche pour TOUTES les étapes, même entièrement en attente', async () => {
    apiGetMock.mockResolvedValue(makeProgression([
      { numero: 3, role: 'PCA', statut: 'en attente', validateur: null, date: null, commentaire: null, date_recu: null, date_vue: null },
      { numero: 2, role: 'DG', statut: 'en attente', validateur: 'DG One', date: null, commentaire: null, date_recu: null, date_vue: null },
      { numero: 1, role: 'RESPONSABLE', statut: 'en attente', validateur: null, date: null, commentaire: null, date_recu: '2026-05-01T08:00:00', date_vue: null },
    ]))
    const { container } = render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => expect(container.querySelector('.step-tooltip')).toBeTruthy())
    // Il doit y avoir un tooltip par étape (3 étapes = 3 tooltips)
    const tooltips = container.querySelectorAll('.step-tooltip')
    expect(tooltips.length).toBe(3)
    // Chaque tooltip doit contenir "Reçu le" et "Vu le"
    tooltips.forEach(t => {
      expect(t.textContent).toMatch(/Reçu le/i)
      expect(t.textContent).toMatch(/Vu le/i)
    })
  })

  it('le tooltip d\'une étape validée affiche "Vu le" (audit complet)', async () => {
    // Même après validation, on doit savoir quand le validateur a vu l'opération
    apiGetMock.mockResolvedValue(makeProgression([{
      numero: 1, role: 'RESPONSABLE', statut: 'validé',
      validateur: 'Alice Martin', date: '2026-05-03T14:00:00', commentaire: null,
      date_recu: '2026-05-01T08:00:00', date_vue: '2026-05-02T09:00:00',
    }], { progression: 100, statut_final: 'APPROUVÉE' }))
    render(<ProgressionValidation idOperation={1} />)
    await waitFor(() => {
      expect(screen.getByText(/Vu le/i)).toBeInTheDocument()
      expect(screen.queryByText(/Pas encore vue/i)).not.toBeInTheDocument()
    })
  })
})
