import { useState } from 'react'
import type { ReactNode } from 'react'

import { coachingRepository } from '../repositories/in-memory-coaching-repository'
import { getInitialAthlete } from './athlete-selection'
import { AthleteContext } from './athlete-context'

export function AthleteProvider({ children }: { children: ReactNode }) {
  const athletes = coachingRepository.listAthletes()
  const [selectedAthlete, setSelectedAthlete] = useState(() =>
    getInitialAthlete(coachingRepository),
  )

  return (
    <AthleteContext.Provider
      value={{
        athletes,
        selectedAthlete,
        setSelectedAthlete,
      }}
    >
      {children}
    </AthleteContext.Provider>
  )
}
