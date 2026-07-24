import type { CoachingRecord } from './common'

export type PriorityStatus =
  | 'active'
  | 'resolved'
  | 'superseded'
  | 'archived'

export const priorityCategories = [
  'performance',
  'technical',
  'physical',
  'tactical',
  'psychological',
  'behavioural',
  'health-availability',
  'development',
] as const

export type PriorityCategory = (typeof priorityCategories)[number]

export interface Priority extends CoachingRecord<PriorityStatus> {
  interpretationIds: string[]
  focus: string
  rationale: string
  category: PriorityCategory
  rank: number
  reviewAt: string
}
