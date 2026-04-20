import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext({ theme: 'clair', setTheme: () => {} })

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try { return localStorage.getItem('ems_theme') || 'clair' } catch { return 'clair' }
  })

  function setTheme(t) {
    const normalized = String(t || '').toLowerCase()
    setThemeState(normalized)
    try { localStorage.setItem('ems_theme', normalized) } catch {}
    document.documentElement.setAttribute('data-theme', normalized)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
