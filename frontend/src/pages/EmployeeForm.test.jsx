import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployeeForm from './EmployeeForm'

const navigateMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: 'new' }),
  }
})

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <EmployeeForm />
    </MemoryRouter>
  )

describe('EmployeeForm', () => {
  beforeEach(async () => {
    navigateMock.mockReset()
    const api = (await import('../services/api')).default
    api.post.mockReset()
    api.put.mockReset()
    api.post.mockResolvedValue({ data: {} })
    api.get.mockImplementation((url) => {
      if (url === '/employees/autocomplete/diplomes') return Promise.resolve({ data: [] })
      if (url === '/employees/autocomplete/entites') return Promise.resolve({ data: [{ value: 1, label: 'ELCAM' }] })
      if (url === '/roles/') return Promise.resolve({ data: [{ name: 'EMPLOYE' }] })
      if (url.startsWith('/employees/autocomplete/fonctions')) return Promise.resolve({ data: [] })
      if (url.startsWith('/employees/autocomplete/departements')) return Promise.resolve({ data: [] })
      if (url.startsWith('/employees/autocomplete/directions')) return Promise.resolve({ data: [] })
      if (url.startsWith('/employees/autocomplete/villes')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
  })

  it('shows a strict sexe dropdown with Masculin and Feminin', async () => {
    renderPage()

    const sexeSelect = await screen.findByLabelText('Sexe')
    expect(sexeSelect).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Masculin' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Féminin' })).toBeInTheDocument()

    fireEvent.change(sexeSelect, { target: { value: 'F' } })
    expect(sexeSelect.value).toBe('F')
  })

  it('phone country code dropdown shows a short selected label and saves code+space+number', async () => {
    renderPage()

    const buttons = await screen.findAllByRole('button', { name: /choisir le code pays/i })
    expect(buttons.length).toBeGreaterThanOrEqual(2)

    const phoneButton = buttons[0]
    expect(phoneButton).toHaveTextContent('CM (+237)')

    const numberInput = screen.getAllByPlaceholderText('Numéro de téléphone')[0]
    fireEvent.change(numberInput, { target: { value: '699228877' } })

    fireEvent.click(phoneButton)
    fireEvent.click(screen.getByText(/France \(\+33\)/))

    expect(phoneButton).toHaveTextContent('FR (+33)')
    expect(numberInput.value).toBe('699228877')
  })

  it('phone country dropdown jumps to matching country when typing a letter', async () => {
    renderPage()

    const buttons = await screen.findAllByRole('button', { name: /choisir le code pays/i })
    const phoneButton = buttons[0]

    fireEvent.click(phoneButton)

    // Real user case: focus often stays on the toggle button
    phoneButton.focus()
    fireEvent.keyDown(phoneButton, { key: 'z' })

    expect(document.activeElement).toHaveTextContent(/Zambie \(\+260\)/)
  })

  it('submits a new employee and navigates back to list', async () => {
    renderPage()

    const api = (await import('../services/api')).default

    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: 'E12345' } })
    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Doe' } })
    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'John' } })

    fireEvent.change(screen.getByPlaceholderText('Entité *'), { target: { value: 'ELCAM' } })
    fireEvent.change(screen.getByPlaceholderText('Fonction *'), { target: { value: 'Auditeur' } })

    const dateInputs = document.querySelectorAll('input[type="date"]')
    const dateEmbaucheInput = dateInputs[1]
    fireEvent.change(dateEmbaucheInput, { target: { value: '2025-01-10' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/employees/', expect.objectContaining({
        matricule: 'E12345',
        nom: 'Doe',
        prenom: 'John',
        entite: 'ELCAM',
        fonction: 'Auditeur',
        date_embauche: '2025-01-10',
      }))
    })

    expect(navigateMock).toHaveBeenCalledWith('/employees')
  })

  it('selecting an entité from dropdown does not crash the page', async () => {
    renderPage()

    const entiteInput = await screen.findByPlaceholderText('Entité *')

    // Type to open dropdown
    fireEvent.focus(entiteInput)
    fireEvent.change(entiteInput, { target: { value: 'EL' } })

    // ELCAM option should appear (mocked as {value:1, label:'ELCAM'})
    await waitFor(() => {
      expect(screen.getByText('ELCAM')).toBeInTheDocument()
    })

    // Select it — previously caused blank page due to numeric value crash
    fireEvent.mouseDown(screen.getByText('ELCAM'))

    // Input shows the label, not the raw numeric id
    expect(entiteInput).toHaveValue('ELCAM')

    // Page must still be rendered (no crash)
    expect(screen.getByPlaceholderText('Direction (optionnelle)')).toBeInTheDocument()
  })
})