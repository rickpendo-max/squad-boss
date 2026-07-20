import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

import { athletes } from '../data/athletes'
import type { Athlete } from '../types/athlete'

type AthleteContextType = {
  athletes: Athlete[]
  selectedAthlete: Athlete
  setSelectedAthlete: (athlete: Athlete) => void
}

const AthleteContext = createContext<AthleteContextType | undefined>(undefined)

export function AthleteProvider({ children }: { children: ReactNode }) {
  const [selectedAthlete, setSelectedAthlete] = useState(athletes[0])

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

export function useAthlete() {
  const context = useContext(AthleteContext)

  if (!context) {
    throw new Error('useAthlete must be used inside AthleteProvider')
  }

  return context
}