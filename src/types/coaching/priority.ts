import type { CoachingRecord } from './common'

export type PriorityStatus = 'candidate' | 'active' | 'superseded'

export interface Priority extends CoachingRecord<PriorityStatus> {
  interpretationIds: string[]
  title: string
  rationale: string
  rank: number
}
