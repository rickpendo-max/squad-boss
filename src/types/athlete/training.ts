export interface Readiness {
  recovery?: number
  soreness?: number
  motivation?: number
  sleep?: number
  note?: string
}

export interface AthleteTraining {
  currentBlock?: string
  blockPurpose?: string
  currentTrainingFocus?: string[]
  weeklyPoolSessionTarget?: number
  weeklyGymSessionTarget?: number
  readiness?: Readiness
}
