import type { AthleteCoach } from './coach'
import type { AthleteCompassData } from './compass'
import type { AthleteCompetition } from './competition'
import type { AthletePerformance } from './performance'
import type { AthleteProfile } from './profile'
import type { AthleteTesting } from './testing'
import type { AthleteTraining } from './training'

export type { AthleteCoach, CoachNote } from './coach'
export type { AthleteCompass, AthleteCompassData } from './compass'
export type { AthleteCompetition } from './competition'
export type { AthletePerformance, PersonalBest } from './performance'
export type { AthleteProfile, AthleteStatus } from './profile'
export type { AthleteTesting, TestResult } from './testing'
export type { AthleteTraining, Readiness } from './training'

export interface Athlete
  extends AthleteProfile,
    AthletePerformance,
    AthleteTraining,
    AthleteTesting,
    AthleteCoach,
    AthleteCompetition,
    AthleteCompassData {}
