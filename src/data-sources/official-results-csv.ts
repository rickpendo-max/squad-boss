import type {
  PerformanceCourse,
  PerformanceResult,
  PerformanceVerificationStatus,
  SwimmingStroke,
} from '../types/performance'

export interface OfficialCsvResult {
  rowNumber: number
  occurredAt: string
  meetName: string
  distance: number
  stroke: SwimmingStroke
  course: PerformanceCourse
  totalSeconds: number
  externalResultId?: string
  roundStatus?: string
  verified?: boolean
  verificationStatus?: PerformanceVerificationStatus
  age?: number
}

export interface OfficialCsvRow {
  rowNumber: number
  result?: OfficialCsvResult
  reason?: string
}

export interface OfficialCsvPreviewRow extends OfficialCsvRow {
  duplicate: boolean
  duplicateOfRowNumber?: number
}

const aliases = {
  date: ['date', 'resultdate', 'swimdate'],
  meet: ['meet', 'meetname', 'competition', 'competitionname'],
  stroke: ['stroke', 'eventstroke'],
  distance: ['distance', 'eventdistance'],
  course: ['course', 'coursetype', 'poolcourse'],
  time: ['time', 'finaltime', 'resulttime'],
  verified: ['verified', 'verification', 'resultstatus'],
  swimmer: ['swimmer', 'swimmername', 'athlete', 'athletename', 'name'],
  firstName: ['firstname', 'givenname'],
  lastName: ['lastname', 'surname', 'familyname'],
  externalId: ['resultid', 'externalresultid', 'raceid'],
  round: ['round', 'heatfinal', 'roundstatus'],
  age: ['age', 'swimmerage', 'athleteage'],
} as const

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseCsvRows(csv: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"'
        index += 1
      } else {
        quoted = !quoted
      }
    } else if (character === ',' && !quoted) {
      row.push(value)
      value = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1
      row.push(value)
      if (row.some((cell) => cell.trim())) rows.push(row)
      row = []
      value = ''
    } else {
      value += character
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted value')
  row.push(value)
  if (row.some((cell) => cell.trim())) rows.push(row)

  return rows
}

function findColumn(headers: string[], options: readonly string[]) {
  return headers.findIndex((header) => options.includes(header))
}

function parseDate(value: string) {
  const trimmed = value.trim()
  let year: number
  let month: number
  let day: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed)
  const australian = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed)

  if (iso) {
    ;[, year, month, day] = iso.map(Number)
  } else if (australian) {
    ;[, day, month, year] = australian.map(Number)
  } else {
    return undefined
  }

  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }

  return date.toISOString()
}

function parseTime(value: string) {
  const parts = value.trim().split(':')
  if (parts.length > 2 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) {
    return undefined
  }

  const seconds =
    parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(parts[0])
  return Number.isFinite(seconds) && seconds > 0
    ? Math.round(seconds * 100) / 100
    : undefined
}

function parseStroke(value: string): SwimmingStroke | undefined {
  const strokes: Record<string, SwimmingStroke> = {
    freestyle: 'freestyle',
    free: 'freestyle',
    backstroke: 'backstroke',
    back: 'backstroke',
    breaststroke: 'breaststroke',
    breast: 'breaststroke',
    butterfly: 'butterfly',
    fly: 'butterfly',
    individualmedley: 'individual-medley',
    medley: 'individual-medley',
    im: 'individual-medley',
  }

  return strokes[normalizeHeader(value)]
}

function parseCourse(value: string): PerformanceCourse | undefined {
  const courses: Record<string, PerformanceCourse> = {
    lcm: 'LCM',
    lc: 'LCM',
    longcourse: 'LCM',
    long: 'LCM',
    scm: 'SCM',
    sc: 'SCM',
    shortcourse: 'SCM',
    short: 'SCM',
  }

  return courses[normalizeHeader(value)]
}

function parseDistance(value: string) {
  const match = /^(\d+)\s*m?$/i.exec(value.trim())
  const distance = match ? Number(match[1]) : undefined
  return distance && Number.isInteger(distance) ? distance : undefined
}

function parseVerified(
  value: string,
): PerformanceVerificationStatus | undefined {
  const normalized = normalizeText(value)
  if (['true', 'yes', 'verified'].includes(normalized)) return 'verified'
  if (['false', 'no', 'unverified', 'invalid', 'rejected'].includes(normalized)) {
    return 'unverified'
  }
  if (['n/a', 'na', 'not applicable', 'unavailable'].includes(normalized)) {
    return 'not-applicable'
  }
  return undefined
}

export function createOfficialResultDuplicateKey(
  athleteId: string,
  result: OfficialCsvResult,
) {
  if (result.externalResultId) {
    return `swimming-australia:${normalizeText(result.externalResultId)}`
  }

  return [
    'swimming-australia',
    normalizeText(athleteId),
    result.occurredAt.slice(0, 10),
    normalizeText(result.meetName),
    result.distance,
    result.stroke,
    result.course,
    result.totalSeconds.toFixed(2),
    normalizeText(result.roundStatus ?? ''),
  ].join('|')
}

export function isDuplicateOfficialResult(
  athleteId: string,
  result: OfficialCsvResult,
  existingResults: PerformanceResult[],
) {
  const duplicateKey = createOfficialResultDuplicateKey(athleteId, result)
  return existingResults.some(
    (existing) => existing.importMetadata?.duplicateKey === duplicateKey,
  )
}

export function createOfficialResultsPreview(
  athleteId: string,
  rows: OfficialCsvRow[],
  existingResults: PerformanceResult[],
): OfficialCsvPreviewRow[] {
  const sourceRowsByDuplicateKey = new Map<string, number>()

  return rows.map((row) => {
    if (!row.result) return { ...row, duplicate: false }

    const duplicateKey = createOfficialResultDuplicateKey(athleteId, row.result)
    if (isDuplicateOfficialResult(athleteId, row.result, existingResults)) {
      return { ...row, duplicate: true }
    }

    const duplicateOfRowNumber = sourceRowsByDuplicateKey.get(duplicateKey)
    if (duplicateOfRowNumber !== undefined) {
      return { ...row, duplicate: true, duplicateOfRowNumber }
    }

    sourceRowsByDuplicateKey.set(duplicateKey, row.rowNumber)
    return { ...row, duplicate: false }
  })
}

export function parseOfficialResultsCsv(
  csv: string,
  activeAthleteName: string,
): OfficialCsvRow[] {
  const rows = parseCsvRows(csv)
  if (rows.length === 0) return []

  const headers = rows[0].map(normalizeHeader)
  const columns = Object.fromEntries(
    Object.entries(aliases).map(([name, options]) => [
      name,
      findColumn(headers, options),
    ]),
  ) as Record<keyof typeof aliases, number>
  const required = ['date', 'meet', 'stroke', 'distance', 'course', 'time'] as const
  const missing = required.filter((field) => columns[field] === -1)
  if (missing.length) {
    throw new Error(`CSV is missing required columns: ${missing.join(', ')}`)
  }

  return rows.slice(1).map((values, index) => {
    const rowNumber = index + 2
    const value = (column: keyof typeof aliases) =>
      columns[column] === -1 ? '' : (values[columns[column]] ?? '').trim()
    const swimmerName =
      value('swimmer') || [value('firstName'), value('lastName')].filter(Boolean).join(' ')

    if (
      swimmerName &&
      normalizeText(swimmerName) !== normalizeText(activeAthleteName)
    ) {
      return { rowNumber, reason: `Swimmer does not match ${activeAthleteName}.` }
    }
    const verifiedValue = value('verified')
    const verificationStatus = verifiedValue
      ? parseVerified(verifiedValue)
      : undefined
    if (verifiedValue && verificationStatus === undefined) {
      return { rowNumber, reason: 'Result verification status is not recognized.' }
    }

    const occurredAt = parseDate(value('date'))
    const stroke = parseStroke(value('stroke'))
    const distance = parseDistance(value('distance'))
    const course = parseCourse(value('course'))
    const totalSeconds = parseTime(value('time'))
    const meetName = value('meet')
    const ageValue = value('age')
    const parsedAge = /^\d+$/.test(ageValue) ? Number(ageValue) : undefined
    const invalidFields = [
      !occurredAt && 'date',
      !meetName && 'meet',
      !stroke && 'stroke',
      !distance && 'distance',
      !course && 'course',
      !totalSeconds && 'time',
    ].filter(Boolean)

    if (invalidFields.length) {
      return {
        rowNumber,
        reason: `Invalid or ambiguous ${invalidFields.join(', ')}.`,
      }
    }

    return {
      rowNumber,
      result: {
        rowNumber,
        occurredAt: occurredAt!,
        meetName,
        distance: distance!,
        stroke: stroke!,
        course: course!,
        totalSeconds: totalSeconds!,
        externalResultId: value('externalId') || undefined,
        roundStatus: value('round') || undefined,
        verified:
          verificationStatus === 'verified'
            ? true
            : verificationStatus === 'unverified'
              ? false
              : undefined,
        verificationStatus,
        age: parsedAge,
      },
    }
  })
}
