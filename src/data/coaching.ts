import type {
  Decision,
  Interpretation,
  Observation,
  Priority,
} from '../types/coaching'

// These collections intentionally start empty. Existing athlete and Compass
// strings lack verified authorship and must not be promoted to authoritative
// coaching records.
export const observations: Observation[] = []
export const interpretations: Interpretation[] = []
export const priorities: Priority[] = []
export const decisions: Decision[] = []
