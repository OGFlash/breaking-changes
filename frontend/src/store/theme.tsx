import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

const STORAGE_KEY = 'bc-theme'

function readDark(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'light') return false
    if (v === 'dark') return true
    // migrate old Zustand persist format
    if (v) {
      const p = JSON.parse(v)
      if (p?.state?.dark === false) return false
    }
  } catch {}
  return true // default dark
}

interface ThemeCtx {
  dark: boolean
  toggle: () => void
}

const ThemeContext = createContext<ThemeCtx>({ dark: true, toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [dark, setDark] = useState<boolean>(readDark)

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light') } catch {}
  }, [dark])

  const toggle = () => setDark(d => !d)

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext)
}
