export type AthleteStatus = 'Ready' | 'Monitor' | 'Modify' | 'Unavailable'

export interface AthleteProfile {
  id: string
  firstName: string
  lastName: string
  fullName?: string
  classification?: string
  squad?: string
  status: AthleteStatus
  statusNote?: string
  primaryEvents: string[]
  secondaryEvents: string[]
}
