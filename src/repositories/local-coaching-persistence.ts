import type { Decision, Interpretation, Observation, Priority } from '../types/coaching'
import type { PerformanceResult } from '../types/performance'
import type { InMemoryCoachingData } from './in-memory-coaching-repository'

export const COACHING_STORAGE_KEY = 'squad-boss:coaching-data'
export const COACHING_STORAGE_VERSION = 1

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface PersistedCoachingDataV1 {
  version: 1
  observations: Observation[]
  interpretations: Interpretation[]
  priorities: Priority[]
  decisions: Decision[]
  performanceResults: PerformanceResult[]
}

function cloneData(data: InMemoryCoachingData): InMemoryCoachingData {
  return structuredClone(data)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? (value as T[]) : fallback
}

export function loadPersistedCoachingData(
  storage: KeyValueStorage | undefined,
  seedData: InMemoryCoachingData,
  warn: (message: string) => void = console.warn,
): InMemoryCoachingData {
  const fallback = cloneData(seedData)
  if (!storage) return fallback

  try {
    const stored = storage.getItem(COACHING_STORAGE_KEY)
    if (stored === null) return fallback

    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed)) throw new Error('stored value is not an object')
    if (parsed.version !== COACHING_STORAGE_VERSION) {
      throw new Error(`unsupported schema version ${String(parsed.version)}`)
    }

    return {
      ...fallback,
      observations: readArray(parsed.observations, fallback.observations),
      interpretations: readArray(
        parsed.interpretations,
        fallback.interpretations,
      ),
      priorities: readArray(parsed.priorities, fallback.priorities),
      decisions: readArray(parsed.decisions, fallback.decisions),
      performanceResults: readArray(
        parsed.performanceResults,
        fallback.performanceResults ?? [],
      ),
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    warn(`Squad Boss could not load local coaching data: ${detail}`)
    return fallback
  }
}

export function savePersistedCoachingData(
  storage: KeyValueStorage | undefined,
  data: InMemoryCoachingData,
  warn: (message: string) => void = console.warn,
) {
  if (!storage) return

  const persisted: PersistedCoachingDataV1 = {
    version: COACHING_STORAGE_VERSION,
    observations: data.observations,
    interpretations: data.interpretations,
    priorities: data.priorities,
    decisions: data.decisions,
    performanceResults: data.performanceResults ?? [],
  }

  try {
    storage.setItem(COACHING_STORAGE_KEY, JSON.stringify(persisted))
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    warn(`Squad Boss could not save local coaching data: ${detail}`)
  }
}
