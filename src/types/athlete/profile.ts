export type AthleteStatus = 'Ready' | 'Monitor' | 'Modify' | 'Unavailable'
export type AthleteSex = 'female' | 'male'

export interface AthleteProfile {
  id: string
  firstName: string
  lastName: string
  fullName?: string
  classification?: string
  sex?: AthleteSex
  squad?: string
  status: AthleteStatus
  statusNote?: string
  primaryEvents: string[]
  secondaryEvents: string[]
}
