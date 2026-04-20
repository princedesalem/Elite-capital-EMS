import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import UsageStats from './UsageStats'

const apiGetMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
  },
}))

// Return null for all icons to keep text content clean
vi.mock('lucide-react', () => ({
  BarChart2: () => null,
  Calendar: () => null,
  TrendingUp: () => null,
  CalendarDays: () => null,
  RefreshCw: () => null,
  ChevronRight: () => null,
  Home: () => null,
}))

const EMPLOYEES = [
  { matricule: 1001, prenom: 'Jean', nom: 'Dupont', id_entite: 'E1', id_direction: 'D1', dept_id: 'DEPT1' },
  { matricule: 1002, prenom: 'Marie', nom: 'Martin', id_entite: 'E1', id_direction: 'D2', dept_id: 'DEPT2' },
]

const SUMMARY = {
  today: {
    ranking: {
      entite: [
        { id: 'E1', label: 'ECG', minutes: 120, sessions: 3 },
        { id: 'E2', label: 'ECG2', minutes: 0, sessions: 0 },
      ],
      direction: [
        { id: 'D1', label: 'Finance', minutes: 80, sessions: 2 },
        { id: 'D2', label: 'RH Dir', minutes: 40, sessions: 1 },
      ],
      dept: [
        { id: 'DEPT1', label: 'Comptabilité', minutes: 60, sessions: 1 },
        { id: 'DEPT2', label: 'Paie Dept', minutes: 20, sessions: 1 },
      ],
      emp: [
        { id: '1001', label: 'Jean Dupont (1001)', minutes: 50, sessions: 1 },
        { id: '1002', label: 'Marie Martin (1002)', minutes: 0, sessions: 0 },
      ],
    },
  },
  week: {
    ranking: {
      entite: [{ id: 'E1', label: 'ECG', minutes: 600, sessions: 15 }],
      direction: [{ id: 'D1', label: 'Finance', minutes: 400, sessions: 10 }],
      dept: [{ id: 'DEPT1', label: 'Comptabilité', minutes: 300, sessions: 5 }],
      emp: [{ id: '1001', label: 'Jean Dupont (1001)', minutes: 200, sessions: 5 }],
    },
  },
  month: { ranking: { entite: [], direction: [], dept: [], emp: [] } },
  year:  { ranking: { entite: [], direction: [], dept: [], emp: [] } },
}

const defaultSetup = async (userObj = null) => {
  localStorage.clear()
  if (userObj) {
    localStorage.setItem('user', JSON.stringify(userObj))
  }

  apiGetMock.mockReset()
  apiGetMock.mockImplementation((url) => {
    if (url.includes('/stats/usage/all/summary')) return Promise.resolve({ data: SUMMARY })
    if (url === '/employees/')                    return Promise.resolve({ data: EMPLOYEES })
    if (url.includes('/stats/usage/'))            return Promise.resolve({ data: { total_hours: 1, total_minutes: 60, sessions_count: 2 } })
    return Promise.resolve({ data: [] })
  })

  let result
  await act(async () => {
    result = render(<UsageStats />)
    await new Promise((r) => setTimeout(r, 0))
  })
  return result
}

describe('UsageStats — roll-up histogram', () => {
  it('shows Entités level by default', async () => {
    await defaultSetup()
    await waitFor(() => {
      expect(screen.getByText('ECG')).toBeInTheDocument()
    })
    // comparison-title div contains "Entités" text at root level
    const title = document.querySelector('.comparison-title')
    expect(title.textContent).toMatch(/Entités/)
  })

  it('shows "0 min" for entities with zero usage', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))
    // ECG2 has minutes:0 → HBar renders ".usage-hbar-zero" span with "0 min"
    const zeroSpans = document.querySelectorAll('.usage-hbar-zero')
    expect(zeroSpans.length).toBeGreaterThanOrEqual(1)
    expect(zeroSpans[0].textContent).toBe('0 min')
  })

  it('clicking an entité row drills down to Directions', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    const ecgRow = screen.getByText('ECG').closest('[role="button"]')
    expect(ecgRow).not.toBeNull()
    await act(async () => { fireEvent.click(ecgRow) })

    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Directions/)
    })
    // Only directions whose employees belong to E1 are shown
    expect(screen.getByText('Finance')).toBeInTheDocument()
    expect(screen.getByText('RH Dir')).toBeInTheDocument()
  })

  it('drilling direction→dept filters by parent direction', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    // Drill: Entités → ECG → Directions → Finance
    fireEvent.click(screen.getByText('ECG').closest('[role="button"]'))
    await waitFor(() => screen.getByText('Finance'))
    await act(async () => {
      fireEvent.click(screen.getByText('Finance').closest('[role="button"]'))
    })

    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Départements/)
    })
    // Only DEPT1 belongs to D1 (emp 1001); DEPT2 belongs to D2 so should be absent
    expect(screen.getByText('Comptabilité')).toBeInTheDocument()
    expect(screen.queryByText('Paie Dept')).not.toBeInTheDocument()
  })

  it('breadcrumb root button resets drill to Entités', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    // Drill into ECG
    fireEvent.click(screen.getByText('ECG').closest('[role="button"]'))
    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Directions/)
    })

    // Click root breadcrumb button to go back
    const rootBtn = document.querySelector('.breadcrumb-item.root')
    expect(rootBtn).not.toBeNull()
    await act(async () => { fireEvent.click(rootBtn) })

    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Entités/)
    })
    expect(screen.getByText('ECG')).toBeInTheDocument()
  })

  it('changing period resets drill stack to Entités', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    // Drill into ECG
    fireEvent.click(screen.getByText('ECG').closest('[role="button"]'))
    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Directions/)
    })

    // Switch to Semaine period
    fireEvent.click(screen.getByText('Semaine'))
    await waitFor(() => {
      const title = document.querySelector('.comparison-title')
      expect(title.textContent).toMatch(/Entités/)
    })
  })

  it('highlights selected user when drilled to employee level', async () => {
    await defaultSetup({ matricule: 1001, role: 'RH' })
    await waitFor(() => screen.getByText('ECG'))

    // Drill: Entités → ECG → Directions → Finance → Comptabilité → Employees
    fireEvent.click(screen.getByText('ECG').closest('[role="button"]'))
    await waitFor(() => screen.getByText('Finance'))
    fireEvent.click(screen.getByText('Finance').closest('[role="button"]'))
    await waitFor(() => screen.getByText('Comptabilité'))
    await act(async () => {
      fireEvent.click(screen.getByText('Comptabilité').closest('[role="button"]'))
    })

    // getByText matches both the <option> and the hbar label → use getAllByText
    await waitFor(() => screen.getAllByText('Jean Dupont (1001)'))
    const empLabel = screen.getAllByText('Jean Dupont (1001)')
      .find((el) => el.classList.contains('usage-hbar-label'))
    expect(empLabel).toBeDefined()
    const empRow = empLabel.closest('.usage-hbar-row')
    expect(empRow).toHaveClass('highlight')
  })

  it('employee rows at emp level are not drillable (no role=button)', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    // Drill all the way to emp level
    fireEvent.click(screen.getByText('ECG').closest('[role="button"]'))
    await waitFor(() => screen.getByText('Finance'))
    fireEvent.click(screen.getByText('Finance').closest('[role="button"]'))
    await waitFor(() => screen.getByText('Comptabilité'))
    fireEvent.click(screen.getByText('Comptabilité').closest('[role="button"]'))
    await waitFor(() => screen.getAllByText('Jean Dupont (1001)'))

    // At emp level, rows have no onClick → no role="button"
    const empLabel2 = screen.getAllByText('Jean Dupont (1001)')
      .find((el) => el.classList.contains('usage-hbar-label'))
    const empRow = empLabel2.closest('.usage-hbar-row')
    expect(empRow).not.toHaveAttribute('role', 'button')
  })

  it('Rafraîchir button triggers summary reload', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    const callsBefore = apiGetMock.mock.calls.length
    fireEvent.click(screen.getByText('Rafraîchir'))
    await waitFor(() => {
      expect(apiGetMock.mock.calls.length).toBeGreaterThan(callsBefore)
    })
    const urls = apiGetMock.mock.calls.map(([url]) => url)
    expect(urls.some((u) => u.includes('summary'))).toBe(true)
  })

  it('vue org — Par entité affiche les stats agrégées depuis le classement', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))  // histogram loaded

    const modeSelect = document.querySelectorAll('.user-select')[0]

    // Switch to Par entité
    fireEvent.change(modeSelect, { target: { value: 'entite' } })

    // A second select now shows org options from summaryData.ranking.entite
    await waitFor(() => expect(document.querySelectorAll('.user-select')).toHaveLength(2))
    const orgSelect = document.querySelectorAll('.user-select')[1]
    const labels = Array.from(orgSelect.querySelectorAll('option'))
      .map(o => o.text).filter(t => t !== '— Choisir —')
    expect(labels).toContain('ECG')
    expect(labels).toContain('ECG2')

    // Selecting ECG (id=E1) shows aggregate stat cards with 120 minutes and 3 sessions
    fireEvent.change(orgSelect, { target: { value: 'E1' } })

    await waitFor(() => {
      expect(screen.getByText('120 minutes')).toBeInTheDocument()
    })
    // Sessions count
    const sessionCard = screen.getByText('Nombre de Sessions')
      .closest('.stat-card')
    expect(sessionCard.textContent).toMatch(/3/)
  })

  it('retour en mode employé masque les stats org et affiche le sélecteur employé', async () => {
    await defaultSetup()
    await waitFor(() => screen.getByText('ECG'))

    const modeSelect = document.querySelectorAll('.user-select')[0]

    // Switch to entite, select ECG → org stats visible
    fireEvent.change(modeSelect, { target: { value: 'entite' } })
    await waitFor(() => expect(document.querySelectorAll('.user-select')).toHaveLength(2))
    fireEvent.change(document.querySelectorAll('.user-select')[1], { target: { value: 'E1' } })
    await waitFor(() => screen.getByText('120 minutes'))

    // Switch back to employe
    fireEvent.change(modeSelect, { target: { value: 'employe' } })

    await waitFor(() => {
      expect(screen.queryByText('120 minutes')).not.toBeInTheDocument()
    })
    // Employee select now present as second selector
    const empSelect = document.querySelectorAll('.user-select')[1]
    const empOptions = Array.from(empSelect.querySelectorAll('option'))
      .map(o => o.text).filter(t => t !== '— Choisir un employé —')
    expect(empOptions.length).toBeGreaterThan(0)
  })
})
