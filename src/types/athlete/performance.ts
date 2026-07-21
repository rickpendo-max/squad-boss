export interface PersonalBest {
  event: string
  course: 'LC' | 'SC'
  time: string
  date?: string
}

export interface AthletePerformance {
  personalBests: PersonalBest[]
  currentPerformancePriorities?: string[]
  technicalStrengths?: string[]
  performanceRisks?: string[]
}
