import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import NotificationToast from './NotificationToast'


const navigateMock = vi.fn()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})


describe('NotificationToast routing', () => {
  beforeEach(() => {
    navigateMock.mockReset()
  })

  it.each([
    ['Congé', '/rh/conges?operationId=16'],
    ['Permission non conventionnelle', '/rh/permissions?operationId=16'],
    ['Mission', '/rh/missions?operationId=16'],
    ['Frais de mission', '/rh/frais?operationId=16'],
    ['Sortie', '/rh/sorties?operationId=16'],
    ['Autre', '/rh/operations?operationId=16&tab=demandes'],
  ])('routes %s notifications to the right page', (typeDemande, expectedRoute) => {
    render(
      <NotificationToast
        notification={{
          id_operation: 16,
          type_demande: typeDemande,
          type_notification: 'VALIDATION',
          titre: 'Titre',
          message: 'Message',
        }}
        onDismiss={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Voir #16'))

    expect(navigateMock).toHaveBeenCalledWith(expectedRoute)
  })
})