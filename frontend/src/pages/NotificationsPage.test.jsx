import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'

const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '5001', role: 'EMPLOYE', prenom: 'Jean', nom: 'Test' },
  }),
}))

function makeApiMock(notifications) {
  return {
    default: {
      get: vi.fn((url) => {
        if (url.includes('/non-lues/') || url.includes('/toutes/'))
          return Promise.resolve({ data: notifications })
        if (url.includes('/compteur/'))
          return Promise.resolve({ data: { non_lues: notifications.filter(n => !n.lue).length } })
        return Promise.resolve({ data: {} })
      }),
      put: vi.fn(() => Promise.resolve({ data: {} })),
      delete: vi.fn(() => Promise.resolve({ data: {} })),
    },
  }
}

async function renderPage(notifications) {
  vi.doMock('../services/api', () => makeApiMock(notifications))
  const { default: Page } = await import('./NotificationsPage')
  let result
  await act(async () => {
    result = render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    )
    await Promise.resolve()
  })
  return result
}

describe('NotificationsPage getTargetRoute', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    vi.resetModules()
  })

  it('permission notification shows "Voir ma permission" label', async () => {
    await renderPage([{
      id_notification: 1,
      type_notification: 'VALIDATION',
      titre: 'Permission accordée',
      message: 'Votre permission a été validée',
      lue: false,
      id_operation: 10,
      type_demande: 'Permission non conventionnelle',
      workflow_bucket: 'envoye',
    }])

    expect(screen.getByText('Voir ma permission')).toBeDefined()
  })

  it('permission notification routes to /rh/permissions not /rh/missions', async () => {
    await renderPage([{
      id_notification: 2,
      type_notification: 'VALIDATION',
      titre: 'Permission',
      message: 'Message',
      lue: false,
      id_operation: 20,
      type_demande: 'Permission non conventionnelle',
      workflow_bucket: 'envoye',
    }])

    fireEvent.click(screen.getByText('Voir ma permission'))

    const calledWith = navigateMock.mock.calls[0][0]
    expect(calledWith).toContain('/rh/permissions')
    expect(calledWith).not.toContain('/rh/missions')
  })

  it('permission notification with workflow_bucket=recu includes tab=recu', async () => {
    await renderPage([{
      id_notification: 3,
      type_notification: 'VALIDATION',
      titre: 'Permission reçue',
      message: 'Message',
      lue: false,
      id_operation: 30,
      type_demande: 'Permission conventionnelle',
      workflow_bucket: 'recu',
    }])

    fireEvent.click(screen.getByText('Voir ma permission'))

    expect(navigateMock).toHaveBeenCalledWith('/rh/permissions?operationId=30&tab=recu')
  })

  it('permission notification with workflow_bucket=envoye includes tab=envoye', async () => {
    await renderPage([{
      id_notification: 4,
      type_notification: 'VALIDATION',
      titre: 'Ma permission',
      message: 'Message',
      lue: false,
      id_operation: 40,
      type_demande: 'Permission non conventionnelle',
      workflow_bucket: 'envoye',
    }])

    fireEvent.click(screen.getByText('Voir ma permission'))

    expect(navigateMock).toHaveBeenCalledWith('/rh/permissions?operationId=40&tab=envoye')
  })

  it('mission notification routes to /rh/missions with operationId and tab', async () => {
    await renderPage([{
      id_notification: 5,
      type_notification: 'VALIDATION',
      titre: 'Mission validée',
      message: 'Message',
      lue: false,
      id_operation: 50,
      type_demande: 'Mission',
      workflow_bucket: 'envoye',
    }])

    fireEvent.click(screen.getByText('Voir ma mission'))

    expect(navigateMock).toHaveBeenCalledWith('/rh/missions?operationId=50&tab=envoye')
  })
})
