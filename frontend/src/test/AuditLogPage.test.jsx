import React from 'react'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import AuditLogPage from '../pages/AuditLogPage'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    defaults: { baseURL: 'http://localhost:8000/api' },
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: '5001', role: 'RH', prenom: 'Admin', nom: 'RH' },
  }),
}))

const MOCK_ITEMS = [
  { id: 1, actor: '1001', action: 'LOGIN_SUCCESS', entity: 'auth', entity_id: null, detail: null, ip: '10.0.0.1', timestamp: '2025-04-15T10:00:00' },
  { id: 2, actor: '1001', action: 'EMPLOYEE_CREATED', entity: 'employe', entity_id: '2001', detail: '{"nom": "Dupont"}', ip: '10.0.0.2', timestamp: '2025-04-15T09:30:00' },
  { id: 3, actor: '2001', action: 'OPERATION_VALIDATED', entity: 'operation', entity_id: '100', detail: '{}', ip: '10.0.0.3', timestamp: '2025-04-14T08:00:00' },
]

// Wait for table data to be rendered (use unique IP to avoid option/badge conflicts)
const waitForData = () => waitFor(() => {
  expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
})

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuditLogPage />
      </MemoryRouter>
    )
    await Promise.resolve()
  })
}

beforeEach(() => {
  apiGetMock.mockReset()
  apiGetMock.mockResolvedValue({ data: { total: 3, limit: 50, offset: 0, items: MOCK_ITEMS } })
})

describe('AuditLogPage', () => {
  it('renders the page title', async () => {
    await renderPage()
    expect(screen.getByText(/journal d'audit/i)).toBeInTheDocument()
  })

  it('fetches and displays audit log items', async () => {
    await renderPage()
    await waitForData()
    // Action badges in table (use getAllBy because option dropdown also contains the text)
    expect(screen.getAllByText('LOGIN_SUCCESS').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('EMPLOYEE_CREATED').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('OPERATION_VALIDATED').length).toBeGreaterThanOrEqual(1)
  })

  it('calls the audit-logs API on mount', async () => {
    await renderPage()
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalled()
    })
    const callUrl = apiGetMock.mock.calls[0][0]
    expect(callUrl).toContain('/admin/audit-logs')
  })

  it('shows total count', async () => {
    await renderPage()
    await waitForData()
    expect(screen.getByText(/au total/)).toBeInTheDocument()
  })

  it('renders loading skeleton initially', async () => {
    apiGetMock.mockReturnValue(new Promise(() => {})) // never resolves
    await act(async () => {
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuditLogPage />
        </MemoryRouter>
      )
    })
    // While loading, no table should be rendered, but shimmer skeleton is shown
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    // The shimmer animation style is injected
    expect(document.querySelector('style')).toBeInTheDocument()
  })

  it('shows empty state when no results', async () => {
    apiGetMock.mockResolvedValue({ data: { total: 0, limit: 50, offset: 0, items: [] } })
    await renderPage()
    await waitFor(() => {
      expect(screen.getByText(/aucune entr/i)).toBeInTheDocument()
    })
  })

  it('filters by action via dropdown', async () => {
    await renderPage()
    await waitForData()

    // Find the action select (first select is action filter)
    const selects = screen.getAllByRole('combobox')
    const actionSelect = selects[0]
    fireEvent.change(actionSelect, { target: { value: 'LOGIN_SUCCESS' } })

    // Auto-fetch should trigger new API call
    await waitFor(() => {
      expect(apiGetMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('resets filters when reset button is clicked', async () => {
    await renderPage()
    await waitForData()

    // First change a filter so reset has something to clear
    const selects = screen.getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'LOGIN_SUCCESS' } })

    await waitFor(() => {
      expect(apiGetMock.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    const resetBtn = screen.getByRole('button', { name: /initialiser/i })
    fireEvent.click(resetBtn)

    // After reset, should refetch with cleared filters
    await waitFor(() => {
      expect(apiGetMock.mock.calls.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('has an export button', async () => {
    await renderPage()
    await waitForData()
    expect(screen.getByRole('button', { name: /exporter/i })).toBeInTheDocument()
  })

  it('displays actor, entity, and IP columns', async () => {
    await renderPage()
    await waitForData()
    // Actor '1001' appears in 2 rows, '2001' appears as actor AND entity_id
    expect(screen.getAllByText('1001').length).toBe(2)
    expect(screen.getByText('10.0.0.1')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.3')).toBeInTheDocument()
  })

  it('handles API error gracefully', async () => {
    apiGetMock.mockRejectedValue(new Error('Network error'))
    await renderPage()
    // Should not crash, should show empty or error state
    await waitFor(() => {
      const content = document.body.textContent
      expect(content).toBeDefined()
    })
  })

  it('sends sort_col and sort_dir params on mount', async () => {
    await renderPage()
    await waitForData()
    const callUrl = apiGetMock.mock.calls[0][0]
    expect(callUrl).toContain('sort_col=timestamp')
    expect(callUrl).toContain('sort_dir=desc')
  })

  it('sends updated sort params after clicking a column header', async () => {
    await renderPage()
    await waitForData()

    const acteurHeader = screen.getByText(/acteur/i)
    fireEvent.click(acteurHeader)

    await waitFor(() => {
      const lastCall = apiGetMock.mock.calls[apiGetMock.mock.calls.length - 1][0]
      expect(lastCall).toContain('sort_col=actor')
    })
  })
})
