import { useState, useEffect } from 'react'

export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('sl_theme') || 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('sl_theme', theme)
  }, [theme])

  const toggleTheme = () => setThemeState(t => t === 'dark' ? 'light' : 'dark')

  return { theme, toggleTheme }
}
