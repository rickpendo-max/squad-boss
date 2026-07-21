export interface TestResult {
  test: string
  date: string
  result: string
  coachInterpretation?: string
}

export interface AthleteTesting {
  testing: TestResult[]
}
