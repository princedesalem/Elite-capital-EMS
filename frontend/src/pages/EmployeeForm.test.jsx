import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import EmployeeForm from './EmployeeForm'

const navigateMock = vi.fn()
let mockParamsId = 'new'

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
    useParams: () => ({ id: mockParamsId }),
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
    mockParamsId = 'new'
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

  it('submits without direction or department (nullable fields)', async () => {
    renderPage()

    const api = (await import('../services/api')).default

    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: '9999' } })
    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Mbarga' } })
    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'Paul' } })
    fireEvent.change(screen.getByPlaceholderText('Entité *'), { target: { value: 'ELCAM' } })
    fireEvent.change(screen.getByPlaceholderText('Fonction *'), { target: { value: 'Consultant' } })

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[1], { target: { value: '2024-06-01' } })

    // Leave direction and department empty
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/employees/', expect.objectContaining({
        nom: 'Mbarga',
        prenom: 'Paul',
        entite: 'ELCAM',
        direction: '',
        departement: '',
      }))
    })

    expect(navigateMock).toHaveBeenCalledWith('/employees')
  })

  it('submits with any function value without validation error', async () => {
    renderPage()

    const api = (await import('../services/api')).default

    fireEvent.change(screen.getByPlaceholderText('Matricule'), { target: { value: '8888' } })
    fireEvent.change(screen.getByPlaceholderText('Nom'), { target: { value: 'Kamga' } })
    fireEvent.change(screen.getByPlaceholderText('Prénom'), { target: { value: 'Alain' } })
    fireEvent.change(screen.getByPlaceholderText('Entité *'), { target: { value: 'ELCAM' } })
    fireEvent.change(screen.getByPlaceholderText('Fonction *'), { target: { value: 'Président du Conseil' } })

    const dateInputs = document.querySelectorAll('input[type="date"]')
    fireEvent.change(dateInputs[1], { target: { value: '2020-01-15' } })

    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/employees/', expect.objectContaining({
        fonction: 'Président du Conseil',
      }))
    })

    // No error message should appear
    expect(screen.queryByText(/fonction invalide/i)).not.toBeInTheDocument()
    expect(navigateMock).toHaveBeenCalledWith('/employees')
  })

  it('loads an existing employee with null fields without React warnings', async () => {
    mockParamsId = '9005'

    const api = (await import('../services/api')).default
    api.get.mockImplementation((url) => {
      if (url === '/employees/9005') return Promise.resolve({ data: {
        matricule: 9005, nom: 'Essono', prenom: 'Rachel', date_naissance: null,
        sexe: 'F', telephone: null, email: 'rachel@demo.ec',
        departement: null, fonction: 'PCA', ville: null,
        id_localisation: null, contact_urgence: null, diplome: null,
        solde_conges: 0, date_embauche: '2020-01-01', entite: null,
        role: null, direction: null, categorie: null, n1_fonction: null,
        annee_experience: null, statut_employe: 'ACTIF', statut_matrimonial: null,
        nombre_enfants: null
      }})
      if (url === '/employees/autocomplete/diplomes') return Promise.resolve({ data: [] })
      if (url === '/employees/autocomplete/entites') return Promise.resolve({ data: [] })
      if (url === '/roles/') return Promise.resolve({ data: [] })
      if (url.startsWith('/employees/autocomplete/')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    renderPage()

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nom')).toHaveValue('Essono')
    })

    // No React warning about null value prop
    const nullWarnings = consoleSpy.mock.calls.filter(
      call => call.some(arg => typeof arg === 'string' && arg.includes('value` prop on `input` should not be null'))
    )
    expect(nullWarnings).toHaveLength(0)

    // Fields with null should render as empty or default, not null
    expect(screen.getByPlaceholderText('Fonction *')).toHaveValue('PCA')
    expect(screen.getByPlaceholderText('Direction (optionnelle)')).toHaveValue('')

    consoleSpy.mockRestore()
  })
})