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
    ['Congé',                        'envoye', '/rh/conges?operationId=16&tab=envoye'],
    ['Permission non conventionnelle','envoye', '/rh/permissions?operationId=16&tab=envoye'],
    ['Mission',                      'envoye', '/rh/missions?operationId=16&tab=envoye'],
    ['Frais de mission',             'envoye', '/rh/frais?operationId=16&tab=envoye'],
    ['Sortie',                       'envoye', '/rh/sorties?operationId=16&tab=envoye'],
    ['Congé',                        'recu',   '/rh/conges?operationId=16&tab=recu'],
    ['Permission non conventionnelle','recu',  '/rh/permissions?operationId=16&tab=recu'],
    ['Mission',                      'recu',   '/rh/missions?operationId=16&tab=recu'],
  ])('routes %s (%s) to the right page', (typeDemande, workflowBucket, expectedRoute) => {
    render(
      <NotificationToast
        notification={{
          id_operation: 16,
          type_demande: typeDemande,
          workflow_bucket: workflowBucket,
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

  it('routes fallback type to /rh/operations with tab=demandes', () => {
    render(
      <NotificationToast
        notification={{
          id_operation: 16,
          type_demande: 'Autre',
          workflow_bucket: 'envoye',
          type_notification: 'VALIDATION',
          titre: 'Titre',
          message: 'Message',
        }}
        onDismiss={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Voir #16'))

    expect(navigateMock).toHaveBeenCalledWith('/rh/operations?operationId=16&tab=demandes')
  })

  it('permission non conventionnelle routes to /rh/permissions not /rh/missions', () => {
    render(
      <NotificationToast
        notification={{
          id_operation: 42,
          type_demande: 'Permission non conventionnelle',
          workflow_bucket: 'envoye',
          type_notification: 'VALIDATION',
          titre: 'Titre',
          message: 'Message',
        }}
        onDismiss={() => {}}
      />
    )

    fireEvent.click(screen.getByText('Voir #42'))

    const calledWith = navigateMock.mock.calls[0][0]
    expect(calledWith).toContain('/rh/permissions')
    expect(calledWith).not.toContain('/rh/missions')
  })
})