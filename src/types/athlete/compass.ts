export interface AthleteCompass {
  currentDirection?: string
  performancePriorities: string[]
  constraints: string[]
  keyDecisions: string[]
  evidence: string[]
  reviewDate?: string
}

export interface AthleteCompassData {
  compass?: AthleteCompass
}
