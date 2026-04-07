import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Employees from './Employees'

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'RH' } }),
}))

const makeEmployee = (i) => ({
  matricule: 1000 + i,
  nom: `Nom${i}`,
  prenom: `Prenom${i}`,
  fonction: 'Analyste',
  role: 'EMPLOYE',
  departement: 'Operations',
  direction: i % 2 === 0 ? 'Direction Generale' : null,
  id_direction: i % 2 === 0 ? 1 : 2,
  entite: 'ELCAM',
  email: `u${i}@test.com`,
  sexe: 'M',
  telephone: '+237600000000',
  categorie: 'Cadre moyen',
  diplome: 'Master',
  statut_employe: 'ACTIF',
})

const renderPage = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Employees />
    </MemoryRouter>
  )

describe('Employees page', () => {
  const originalCreateObjectURL = window.URL.createObjectURL
  const originalRevokeObjectURL = window.URL.revokeObjectURL
  const originalCreateElement = document.createElement.bind(document)

  beforeEach(async () => {
    const api = (await import('../services/api')).default
    window.URL.createObjectURL = vi.fn(() => 'blob:test')
    window.URL.revokeObjectURL = vi.fn()
    api.get.mockImplementation((url) => {
      if (url === '/employees/scoped') {
        return Promise.resolve({ data: Array.from({ length: 35 }, (_, i) => makeEmployee(i + 1)) })
      }
      if (url === '/employees/') {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/employees/export')) {
        return Promise.resolve({ data: new Blob(['csv']) })
      }
      return Promise.resolve({ data: [] })
    })
    api.post.mockResolvedValue({
      data: { total_rows: 1, imported_rows: 1, failed_rows: 0, errors: [] },
    })
  })

  afterEach(() => {
    window.URL.createObjectURL = originalCreateObjectURL
    window.URL.revokeObjectURL = originalRevokeObjectURL
  })

  it('uses 10 rows by default and supports 20/30/40/50 selector', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText('35 employés trouvés')).toBeInTheDocument()
    })

    // 10 visible data rows on first page
    expect(screen.getAllByRole('row').length).toBe(11)

    fireEvent.change(screen.getByDisplayValue('10 lignes'), { target: { value: '20' } })
    await waitFor(() => {
      expect(screen.getAllByRole('row').length).toBe(21)
    })
  })

  it('shows direction name when available', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getAllByText('Direction Generale').length).toBeGreaterThan(0)
    })
  })

  it('opens 3 dots menu and imports a file through the import option', async () => {
    const api = (await import('../services/api')).default
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actions import et export/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /actions import et export/i }))
    fireEvent.click(screen.getByRole('button', { name: /^import$/i }))

    const fileInput = document.querySelector('input[type="file"]')
    const file = new File(['matricule,nom\n1,A'], 'import.csv', { type: 'text/csv' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/employees/import', expect.any(FormData))
      expect(screen.getByText(/import terminé/i)).toBeInTheDocument()
    })
  })

  it('opens export submenu and downloads the selected format', async () => {
    const api = (await import('../services/api')).default
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /actions import et export/i })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /actions import et export/i }))
    fireEvent.click(screen.getByRole('button', { name: /^export$/i }))
    fireEvent.click(screen.getByRole('button', { name: 'XLSX' }))

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith('/employees/export?format=xlsx', { responseType: 'blob' })
      expect(clickSpy).toHaveBeenCalled()
    })

    clickSpy.mockRestore()
  })

  it('shows one-letter transparent avatar fallback in employee detail modal when no photo is provided', async () => {
    renderPage()

    const firstEmployeeCell = await screen.findByText('1001')
    fireEvent.click(firstEmployeeCell.closest('tr'))

    await waitFor(() => {
      expect(screen.getByText('Matricule: 1001')).toBeInTheDocument()
    })

    const avatarContainer = screen.getByTestId('employee-modal-avatar')
    expect(within(avatarContainer).queryByRole('img')).toBeNull()
    expect(within(avatarContainer).getByText('P')).toBeInTheDocument()
  })

  it('shows employee photo in detail modal avatar when photo_url exists', async () => {
    const api = (await import('../services/api')).default
    api.get.mockImplementation((url) => {
      if (url === '/employees/scoped') {
        return Promise.resolve({
          data: [
            {
              ...makeEmployee(1),
              photo_url: 'https://cdn.example.com/profiles/1001.jpg',
            },
            ...Array.from({ length: 10 }, (_, i) => makeEmployee(i + 2)),
          ],
        })
      }
      if (url === '/employees/') {
        return Promise.resolve({ data: [] })
      }
      if (url.startsWith('/employees/export')) {
        return Promise.resolve({ data: new Blob(['csv']) })
      }
      return Promise.resolve({ data: [] })
    })

    renderPage()

    const firstEmployeeCell = await screen.findByText('1001')
    fireEvent.click(firstEmployeeCell.closest('tr'))

    const avatarContainer = await screen.findByTestId('employee-modal-avatar')
    const image = avatarContainer.querySelector('img')
    expect(image).not.toBeNull()
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/profiles/1001.jpg')
  })
})
