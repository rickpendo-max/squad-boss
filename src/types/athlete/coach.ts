export interface CoachNote {
  date: string
  note: string
}

export interface AthleteCoach {
  coachNotes: CoachNote[]
  // Legacy presentation fields. Authoritative observations and priorities live
  // in the coaching domain and these remain only to preserve the current UI.
  currentCoachingPriorities?: string[]
  recentObservations?: string[]
  alerts?: string[]
}
