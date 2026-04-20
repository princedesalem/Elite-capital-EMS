import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkflowModal from './WorkflowModal'

vi.mock('./ProgressionValidation', () => ({
  default: ({ idOperation, onClose }) => (
    <div data-testid="progression-validation" data-operation-id={idOperation}>
      <button onClick={onClose}>Fermer Progression</button>
    </div>
  ),
}))

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
    // Click on the outermost overlay div (first child = overlay)
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
})
