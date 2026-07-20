import { useState } from 'react'
import type { ReactNode } from 'react'

import { athletes } from '../data/athletes'
import { AthleteContext } from './athlete-context'

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
