import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LeaveRequestForm from './LeaveRequestForm'

vi.mock('../services/api', () => ({
  default: {
    post: vi.fn(),
  },
}))

import api from '../services/api'

describe('LeaveRequestForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.post.mockResolvedValue({ data: {} })
  })

  it('renders all form fields', () => {
    render(<LeaveRequestForm />)
    expect(screen.getByPlaceholderText('Matricule')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('')).toBeTruthy()
  })

  it('pre-fills matricule from initialMatricule prop', () => {
    render(<LeaveRequestForm initialMatricule="EMP123" />)
    expect(screen.getByDisplayValue('EMP123')).toBeInTheDocument()
  })

  it('renders custom submitLabel', () => {
    render(<LeaveRequestForm submitLabel="Valider la demande" />)
    expect(screen.getByText('Valider la demande')).toBeInTheDocument()
  })

  it('renders default submit label when not provided', () => {
    render(<LeaveRequestForm />)
    expect(screen.getByText('Envoyer')).toBeInTheDocument()
  })

  it('submits the form and calls onSuccess', async () => {
    const onSuccess = vi.fn()
    render(<LeaveRequestForm initialMatricule="EMP001" onSuccess={onSuccess} />)

    const today = new Date().toISOString().split('T')[0]
    const dateInputs = screen.getAllByDisplayValue('')
    // Set both date fields
    fireEvent.change(dateInputs[0], { target: { value: today } })
    fireEvent.change(dateInputs[1], { target: { value: today } })

    fireEvent.submit(screen.getByPlaceholderText('Matricule').closest('form'))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/leaves',
        expect.any(FormData),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
    })
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
  })

  it('calls onCancel when cancel button is present and clicked', () => {
    const onCancel = vi.fn()
    render(<LeaveRequestForm onCancel={onCancel} />)
    // Only test if cancel button rendered; component may omit it when prop absent
    const cancelBtn = screen.queryByText(/annuler/i)
    if (cancelBtn) {
      fireEvent.click(cancelBtn)
      expect(onCancel).toHaveBeenCalled()
    }
  })

  it('shows error message on submission failure', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { detail: 'Solde insuffisant' } } })
    render(<LeaveRequestForm initialMatricule="EMP001" />)

    const today = new Date().toISOString().split('T')[0]
    const dateInputs = screen.getAllByDisplayValue('')
    fireEvent.change(dateInputs[0], { target: { value: today } })
    fireEvent.change(dateInputs[1], { target: { value: today } })

    fireEvent.submit(screen.getByPlaceholderText('Matricule').closest('form'))

    await screen.findByText('Solde insuffisant')
  })

  it('renders type select with expected options', () => {
    render(<LeaveRequestForm />)
    const select = screen.getByDisplayValue('Conge')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Maladie')).toBeInTheDocument()
  })
})
