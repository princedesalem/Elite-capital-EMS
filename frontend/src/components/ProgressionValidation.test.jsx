import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

import ProgressionValidation from './ProgressionValidation'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

describe('ProgressionValidation', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
  })

  it('affiche le badge modifiee et la date de modification', async () => {
    apiGetMock.mockResolvedValue({
      data: {
        id_operation: 11,
        type_demande: 'Congé',
        demandeur: { nom_complet: 'Jean Dupont' },
        date_demande: '2026-04-01T08:00:00',
        est_modifie: true,
        date_modification: '2026-04-02T09:30:00',
        etapes: [
          { numero: 1, role: 'DIRECTEUR', statut: 'en attente', validateur: null, date: null, commentaire: null },
        ],
        progression: 0,
        statut_final: 'EN COURS (0/1)',
      },
    })

    render(<ProgressionValidation idOperation={11} />)

    await waitFor(() => {
      expect(screen.getByText('Modifiée')).toBeInTheDocument()
    })
    expect(screen.getByText(/Modifiée le/i)).toBeInTheDocument()
  })
})
