// Draft contents stay in their mounted forms; this registry stores only tokens.
const pending = new Set<symbol>()

export function registerUnsavedChanges() {
  const token = Symbol('unsaved form')
  pending.add(token)
  return () => { pending.delete(token) }
}

export function hasUnsavedChanges() {
  return pending.size > 0
}

export function confirmDiscardChanges() {
  return !hasUnsavedChanges() || window.confirm(
    'You have unsaved changes. Leave this view and discard those changes?',
  )
}
