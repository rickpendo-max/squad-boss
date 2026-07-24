import type { CoachingRecord, Confidence } from './common'

export type DecisionStatus = 'draft' | 'active' | 'reviewed' | 'closed'

export interface Decision extends CoachingRecord<DecisionStatus> {
  priorityId: string
  title: string
  rationale: string
  confidence: Confidence
  ownerId: string
  reviewDueAt: string
}
