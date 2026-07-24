export interface AthleteCompass {
  // The Compass is currently legacy presentation data. These values are not
  // authoritative coaching records and may become projections in future.
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
