import { useContext } from 'react'

import { AthleteContext } from './athlete-context'

export function useAthlete() {
  const context = useContext(AthleteContext)

  if (!context) {
    throw new Error('useAthlete must be used inside AthleteProvider')
  }

  return context
}
