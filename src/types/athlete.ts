export type AthleteStatus = 'Ready' | 'Monitor' | 'Modify' | 'Unavailable'

export type PersonalBest = {
  event: string
  course: 'LC' | 'SC'
  time: string
  date?: string
}

export type Readiness = {
  recovery?: number
  soreness?: number
  motivation?: number
  sleep?: number
  note?: string
}

export type TestResult = {
  test: string
  date: string
  result: string
}

export type CoachNote = {
  date: string
  note: string
}

export type Athlete = {
  id: string
  firstName: string
  lastName: string
  classification?: string

  status: AthleteStatus
  statusNote?: string

  primaryEvents: string[]
  secondaryEvents: string[]

  currentBlock?: string
  nextCompetition?: string

  personalBests: PersonalBest[]
  readiness?: Readiness
  testing: TestResult[]
  coachNotes: CoachNote[]
}