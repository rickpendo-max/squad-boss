import { createContext } from 'react'

import type { Athlete } from '../types/athlete'

export type AthleteContextValue = {
  athletes: Athlete[]
  selectedAthlete: Athlete
  setSelectedAthlete: (athlete: Athlete) => void
}

export const AthleteContext = createContext<AthleteContextValue | undefined>(
  undefined,
)
