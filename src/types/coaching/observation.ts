import type { CoachingRecord } from './common'

export type ObservationStatus = 'active' | 'superseded'

export type ObservationSourceType =
  | 'coach'
  | 'athlete'
  | 'test'
  | 'training'
  | 'competition'

export type ObservationContextType =
  | 'general'
  | 'training'
  | 'competition'
  | 'testing'
  | 'wellbeing'

export interface Observation extends CoachingRecord<ObservationStatus> {
  occurredAt: string
  sourceType: ObservationSourceType
  contextType: ObservationContextType
  summary: string
}
