import { useEffect } from 'react'
import { registerUnsavedChanges } from '../domain/unsaved-changes'

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return
    const unregister = registerUnsavedChanges()
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      unregister()
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [dirty])
}
