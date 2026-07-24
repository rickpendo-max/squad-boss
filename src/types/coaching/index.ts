export type { CoachingRecord, Confidence } from './common'
export type {
  Decision,
  DecisionStatus,
} from './decision'
export type {
  Interpretation,
  InterpretationStatus,
} from './interpretation'
export type {
  Observation,
  ObservationContextType,
  ObservationSourceType,
  ObservationStatus,
} from './observation'
export type {
  Priority,
  PriorityStatus,
} from './priority'

import type { Decision } from './decision'
import type { Interpretation } from './interpretation'
import type { Observation } from './observation'
import type { Priority } from './priority'

export interface CoachingCycle {
  observations: Observation[]
  interpretations: Interpretation[]
  priorities: Priority[]
  decisions: Decision[]
}
