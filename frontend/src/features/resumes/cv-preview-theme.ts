import { useSyncExternalStore } from 'react'

export type CvPreviewTheme = 'light' | 'dark'
const key = 'lumi.cv-preview-theme'
const changed = 'lumi-cv-preview-theme-changed'
let memoryTheme: CvPreviewTheme = 'light'
let memoryOnly = false

export function getCvPreviewTheme(): CvPreviewTheme {
  if (typeof window === 'undefined') return 'light'
  if (memoryOnly) return memoryTheme
  try {
    return window.localStorage.getItem(key) === 'dark' ? 'dark' : 'light'
  } catch {
    return memoryTheme
  }
}

export function setCvPreviewTheme(theme: CvPreviewTheme) {
  memoryTheme = theme
  try {
    window.localStorage.setItem(key, theme)
    memoryOnly = false
  } catch {
    memoryOnly = true
  }
  window.dispatchEvent(new Event(changed))
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) {
      memoryOnly = false
      onChange()
    }
  }
  window.addEventListener(changed, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(changed, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

export function useCvPreviewTheme() {
  const theme = useSyncExternalStore(subscribe, getCvPreviewTheme, () => 'light' as const)
  return [theme, setCvPreviewTheme] as const
}
