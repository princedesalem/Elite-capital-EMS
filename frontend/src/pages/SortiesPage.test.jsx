import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import SortiesPage from './SortiesPage'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()
const apiPutMock = vi.fn()
const apiDeleteMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
    put: (...args) => apiPutMock(...args),
    delete: (...args) => apiDeleteMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      matricule: 123,
      sub: 123,
      role: 'RESPONSABLE',
      prenom: 'Jean',
      nom: 'Dupont',
    },
  }),
}))

vi.mock('../components/WorkflowModal', () => ({
  default: ({ isOpen, operationId }) => (isOpen ? <div data-testid="workflow-modal" data-op-id={String(operationId)} /> : null),
}))

function setupApiForSorties(details = []) {
  apiGetMock.mockImplementation((url) => {
    if (String(url).includes('/api/workflow/boite/')) {
      return Promise.resolve({
        data: {
          envoye: details.length
            ? [
                {
                  id_operation: details[0].id_operation,
                  type_demande: 'sortie',
                  statut: 'en attente',
                  date_demande: '2026-03-20',
                  date_debut: details[0].date_sortie,
                  date_fin: details[0].date_sortie,
                  motif: 'Sortie test',
                  demandeur: { prenom: 'Jean', nom: 'Dupont' },
                },
              ]
            : [],
          recu: [],
          valide: [],
          refuse: [],
        },
      })
    }

    if (String(url).includes('/api/sorties/')) {
      return Promise.resolve({ data: details })
    }

    return Promise.resolve({ data: [] })
  })

  apiPostMock.mockResolvedValue({ data: {} })
  apiPutMock.mockResolvedValue({ data: {} })
  apiDeleteMock.mockResolvedValue({ data: {} })
}

describe('SortiesPage single-day flow', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    apiPutMock.mockReset()
    apiDeleteMock.mockReset()
  })

  it('submits sortie payload without date_retour', async () => {
    setupApiForSorties([])
    const today = new Date().toISOString().split('T')[0]

    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    fireEvent.click(await screen.findByRole('button', { name: /nouvelle demande/i }))

    const dateInput = document.querySelector('input[type="date"]')
    const timeInputs = document.querySelectorAll('input[type="time"]')

    fireEvent.change(dateInput, { target: { value: today } })
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } })
    fireEvent.change(timeInputs[1], { target: { value: '11:30' } })

    fireEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(apiPostMock).toHaveBeenCalledWith(
        '/api/sorties/',
        expect.objectContaining({
          matricule: 123,
          date_sortie: today,
          heure_sortie: '08:00',
          heure_retour: '11:30',
        })
      )
    })

    const sentPayload = apiPostMock.mock.calls[0][1]
    expect(sentPayload).not.toHaveProperty('date_retour')
  })

  it('renders duration in hours and removes date retour column', async () => {
    setupApiForSorties([
      {
        id_operation: 7,
        date_sortie: '2026-03-20',
        heure_sortie: '08:00:00',
        heure_retour: '10:30:00',
        commentaire: 'Sortie test',
      },
    ])

    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    await screen.findByText('Sortie Test')
    expect(screen.queryByText(/date retour/i)).not.toBeInTheDocument()
    expect(screen.getByText('2 h 30 min')).toBeInTheDocument()
  })

  it('uses sortie cancellation endpoint when cancelling a request', async () => {
    setupApiForSorties([
      {
        id_operation: 7,
        date_sortie: '2026-03-20',
        heure_sortie: '08:00:00',
        heure_retour: '10:30:00',
        commentaire: 'Sortie test',
      },
    ])

    window.confirm = vi.fn(() => true)

    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    const cancelBtn = await screen.findByRole('button', { name: 'Annuler' })
    fireEvent.click(cancelBtn)

    await waitFor(() => {
      expect(apiPutMock).toHaveBeenCalledWith('/api/sorties/7/annuler')
    })
    expect(apiDeleteMock).not.toHaveBeenCalledWith('/api/operations/7')
  })

  it('ouvre WorkflowModal avec le bon operationId au clic sur une ligne (premier vu)', async () => {
    setupApiForSorties([
      {
        id_operation: 9001,
        date_sortie: '2026-03-20',
        heure_sortie: '08:00:00',
        heure_retour: '10:30:00',
        commentaire: 'Sortie test',
      },
    ])

    render(<MemoryRouter><SortiesPage /></MemoryRouter>)

    const cancelBtn = await screen.findByRole('button', { name: 'Annuler' })
    const row = cancelBtn.closest('tr')
    expect(row).toBeTruthy()
    fireEvent.click(row)

    await waitFor(() => {
      const modal = screen.getByTestId('workflow-modal')
      expect(modal.getAttribute('data-op-id')).toBe('9001')
    })
  })
})
