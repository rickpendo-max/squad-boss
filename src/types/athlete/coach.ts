export interface CoachNote {
  date: string
  note: string
}

export interface AthleteCoach {
  coachNotes: CoachNote[]
  currentCoachingPriorities?: string[]
  recentObservations?: string[]
  alerts?: string[]
}
