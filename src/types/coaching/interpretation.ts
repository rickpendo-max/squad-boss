import type { CoachingRecord, Confidence } from './common'

export type InterpretationStatus = 'draft' | 'active' | 'superseded'

export interface Interpretation extends CoachingRecord<InterpretationStatus> {
  observationIds: string[]
  summary: string
  confidence: Confidence
}
