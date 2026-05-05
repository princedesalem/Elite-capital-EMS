import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorkflowModal from './WorkflowModal'
import api from '../services/api'

vi.mock('./ProgressionValidation', () => ({
  default: vi.fn(({ idOperation, onClose, refreshTrigger }) => (
    <div
      data-testid="progression-validation"
      data-operation-id={idOperation}
      data-refresh-trigger={refreshTrigger ?? 0}
    >
      <button onClick={onClose}>Fermer Progression</button>
    </div>
  )),
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { matricule: 'TST001' } }),
}))

vi.mock('../services/api', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: { ok: true, already: true } })) },
}))

beforeEach(() => {
  api.post.mockClear()
  api.post.mockResolvedValue({ data: { ok: true, already: true } })
})

describe('WorkflowModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <WorkflowModal isOpen={false} operationId={42} onClose={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders ProgressionValidation when isOpen is true', () => {
    render(<WorkflowModal isOpen={true} operationId={42} onClose={vi.fn()} />)
    expect(screen.getByTestId('progression-validation')).toBeInTheDocument()
    expect(screen.getByTestId('progression-validation')).toHaveAttribute('data-operation-id', '42')
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <WorkflowModal isOpen={true} operationId={1} onClose={onClose} />
    )
    fireEvent.click(container.firstChild)
    expect(onClose).toHaveBeenCalled()
  })

  it('does not call onClose when clicking inner content', () => {
    const onClose = vi.fn()
    render(<WorkflowModal isOpen={true} operationId={1} onClose={onClose} />)
    fireEvent.click(screen.getByTestId('progression-validation'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('passes onClose to ProgressionValidation', () => {
    const onClose = vi.fn()
    render(<WorkflowModal isOpen={true} operationId={5} onClose={onClose} />)
    fireEvent.click(screen.getByText('Fermer Progression'))
    expect(onClose).toHaveBeenCalled()
  })

  it('appelle marquer-vu au mount avec la matricule de l\'utilisateur', async () => {
    render(<WorkflowModal isOpen={true} operationId={42} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/workflow/marquer-vu/42',
        null,
        { params: { matricule_observateur: 'TST001' } }
      )
    })
  })

  it('n\'incrémente PAS refreshTrigger si déjà vu (already=true)', async () => {
    api.post.mockResolvedValue({ data: { ok: true, already: true } })
    render(<WorkflowModal isOpen={true} operationId={42} onClose={vi.fn()} />)
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 50))
    expect(screen.getByTestId('progression-validation'))
      .toHaveAttribute('data-refresh-trigger', '0')
  })

  it('incrémente refreshTrigger après première vue (already=false)', async () => {
    api.post.mockResolvedValue({ data: { ok: true, already: false, date_vue: '2026-05-01T10:00:00' } })
    render(<WorkflowModal isOpen={true} operationId={42} onClose={vi.fn()} />)
    await waitFor(() => {
      expect(screen.getByTestId('progression-validation'))
        .toHaveAttribute('data-refresh-trigger', '1')
    })
  })

  it('n\'appelle PAS marquer-vu si modal fermé', () => {
    render(<WorkflowModal isOpen={false} operationId={42} onClose={vi.fn()} />)
    expect(api.post).not.toHaveBeenCalled()
  })
})
