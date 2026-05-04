import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Navbar from './Navbar'

const apiGetMock = vi.fn()
const apiPostMock = vi.fn()

vi.mock('../services/api', () => ({
  default: {
    get: (...args) => apiGetMock(...args),
    post: (...args) => apiPostMock(...args),
  },
}))

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { matricule: 1001, role: 'EMPLOYE' },
    logout: vi.fn(),
  }),
}))

// Helper : stubbing global AudioContext to count calls to playNotifSound
function stubAudioContext() {
  const startMock = vi.fn()
  const stopMock = vi.fn()
  const gainObj = {
    connect: vi.fn(),
    gain: {
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
  }
  const oscObj = {
    connect: vi.fn(),
    type: 'sine',
    frequency: { value: 0 },
    start: startMock,
    stop: stopMock,
  }
  const ctxObj = {
    currentTime: 0,
    destination: {},
    createOscillator: () => oscObj,
    createGain: () => gainObj,
  }
  const AudioCtxMock = vi.fn(() => ctxObj)
  // Sauvegarde des valeurs originales
  const original = {
    AudioContext: window.AudioContext,
    webkitAudioContext: window.webkitAudioContext,
  }
  window.AudioContext = AudioCtxMock
  window.webkitAudioContext = AudioCtxMock
  return {
    AudioCtxMock,
    startMock,
    restore() {
      window.AudioContext = original.AudioContext
      window.webkitAudioContext = original.webkitAudioContext
    },
  }
}

describe('Navbar', () => {
  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    window.sessionStorage.clear()
    apiGetMock.mockImplementation((url) => {
      if (String(url).includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (String(url).includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 3 } })
      if (String(url).includes('/api/notifications/non-lues/1001')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: {} })
    })
  })

  it('affiche une cloche de notifications avec badge et lien vers le centre', async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    const link = await screen.findByRole('link', { name: 'Notifications' })
    expect(link).toHaveAttribute('href', '/rh/notifications')

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })
  })

  it('le badge de notification est rouge (#c00000) et non orange', async () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    // Le badge doit avoir background #c00000 (rouge charte)
    const badge = screen.getByText('3')
    const style = badge.style.background || badge.style.backgroundColor || ''
    // jsdom normalise parfois en rgb — on vérifie soit hex soit rgb(192,0,0)
    const isRed = style.includes('c00000') ||
                  style.includes('rgb(192, 0, 0)') ||
                  style.includes('rgb(192,0,0)') ||
                  badge.getAttribute('style')?.includes('c00000')
    expect(isRed).toBe(true)
  })
})


describe('Navbar notification toast & sound', () => {
  let audio

  beforeEach(() => {
    apiGetMock.mockReset()
    apiPostMock.mockReset()
    window.sessionStorage.clear()
    audio = stubAudioContext()
  })

  afterEach(() => {
    audio.restore()
  })

  it('affiche le toast pour la dernière notif non-lue à lentrée en session et joue le son', async () => {
    // Compteur non_lues=2 dès le 1er poll → user vient d'entrer en session
    // avec des non-lues → toast de la plus récente + son.
    const notif = {
      id_notification: 100,
      titre: 'Mission validée',
      message: 'Votre mission a été validée',
      type_notification: 'VALIDATION',
    }
    apiGetMock.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (u.includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 2 } })
      if (u.includes('/api/notifications/non-lues/1001')) return Promise.resolve({ data: [notif] })
      return Promise.resolve({ data: {} })
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    // Le toast apparaît (texte titre visible)
    await waitFor(() => {
      expect(screen.getByText('Mission validée')).toBeInTheDocument()
    }, { timeout: 3000 })

    // Le son est joué (AudioContext instancié + oscillator.start appelé)
    expect(audio.AudioCtxMock).toHaveBeenCalled()
    expect(audio.startMock).toHaveBeenCalled()

    // sessionStorage mis à jour avec l'ID de la notif affichée pour éviter
    // les re-déclenchements ultérieurs.
    expect(window.sessionStorage.getItem('ems:lastSeenNotifId:1001')).toBe('100')
  })

  it('ne re-déclenche pas le toast/son pour une notification déjà vue', async () => {
    const notif = {
      id_notification: 55,
      titre: 'Déjà vue',
      message: 'msg',
      type_notification: 'VALIDATION',
    }
    apiGetMock.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (u.includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 1 } })
      if (u.includes('/api/notifications/non-lues/1001')) return Promise.resolve({ data: [notif] })
      return Promise.resolve({ data: {} })
    })

    // Pré-seed : l'ID 55 a déjà été vu dans la session
    window.sessionStorage.setItem('ems:lastSeenNotifId:1001', '55')

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    // Attendre que le compteur ait été appelé (ça prouve que le loop a tourné)
    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/notifications/compteur/1001'))
    }, { timeout: 3000 })

    // Laisser toutes les micro-tasks restantes se résoudre
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(screen.queryByText('Déjà vue')).not.toBeInTheDocument()
    expect(audio.startMock).not.toHaveBeenCalled()
  })

  it('n\'affiche PAS de toast quand il n\'y a aucune notification non-lue', async () => {
    apiGetMock.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (u.includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 0 } })
      if (u.includes('/api/notifications/non-lues/1001')) return Promise.resolve({ data: [] })
      return Promise.resolve({ data: {} })
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(apiGetMock).toHaveBeenCalledWith(expect.stringContaining('/api/notifications/compteur/1001'))
    }, { timeout: 3000 })
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(audio.startMock).not.toHaveBeenCalled()
    // Le compteur non-lues ne doit pas être requêté (optimisation)
    expect(apiGetMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/notifications/non-lues/1001'))
  })

  it('déclenche le son dans la même synchronisation que laffichage du toast (simultanéité)', async () => {
    const notif = {
      id_notification: 7,
      titre: 'Simultané',
      message: 'msg',
      type_notification: 'VALIDATION',
    }
    apiGetMock.mockImplementation((url) => {
      const u = String(url)
      if (u.includes('/employees/1001')) return Promise.resolve({ data: { photo_url: null } })
      if (u.includes('/api/notifications/compteur/1001')) return Promise.resolve({ data: { non_lues: 1 } })
      if (u.includes('/api/notifications/non-lues/1001')) return Promise.resolve({ data: [notif] })
      return Promise.resolve({ data: {} })
    })

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )

    // Dès que le toast est présent, le son doit déjà avoir été joué — preuve
    // que les 2 actions se font dans le même tick synchrone (même fonction
    // triggerToastAndSound → setToast + playNotifSound sans await entre).
    await waitFor(() => {
      expect(screen.getByText('Simultané')).toBeInTheDocument()
    }, { timeout: 3000 })
    expect(audio.startMock).toHaveBeenCalled()
  })
})
