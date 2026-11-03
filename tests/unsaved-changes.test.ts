import assert from 'node:assert/strict'
import test from 'node:test'
import { registerUnsavedChanges, hasUnsavedChanges } from '../src/domain/unsaved-changes.ts'

test('independent draft registrations release only their own pending state', () => {
  assert.equal(hasUnsavedChanges(), false)
  const first = registerUnsavedChanges()
  const second = registerUnsavedChanges()
  first()
  first()
  assert.equal(hasUnsavedChanges(), true)
  second()
  assert.equal(hasUnsavedChanges(), false)
})
