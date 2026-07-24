export type Confidence = 1 | 2 | 3 | 4 | 5

export interface CoachingRecord<Status extends string> {
  id: string
  athleteId: string
  status: Status
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}
