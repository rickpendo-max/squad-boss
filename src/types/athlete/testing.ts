export interface TestResult {
  test: string
  date: string
  result: string
  // Legacy presentation field; authoritative interpretations are separate
  // coaching-domain records.
  coachInterpretation?: string
}

export interface AthleteTesting {
  testing: TestResult[]
}
