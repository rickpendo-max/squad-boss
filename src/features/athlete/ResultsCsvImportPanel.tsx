import { useState } from 'react'
import type { ChangeEvent } from 'react'

import {
  createOfficialResultsPreview,
  createOfficialResultDuplicateKey,
  isDuplicateOfficialResult,
  parseOfficialResultsCsv,
  type OfficialCsvRow,
} from '../../data-sources/official-results-csv'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'

const CURRENT_COACH_ID = 'local-coach'

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60)
  const seconds = value - minutes * 60
  return minutes
    ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
    : `${seconds.toFixed(2)} s`
}

function formatStroke(stroke: string) {
  return stroke === 'individual-medley'
    ? 'Individual Medley'
    : `${stroke.charAt(0).toUpperCase()}${stroke.slice(1)}`
}

function formatCourse(course: 'LCM' | 'SCM') {
  return course === 'SCM' ? 'Short Course' : 'Long Course'
}

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function ResultsCsvImportPanel({
  athleteId,
  onImported,
}: {
  athleteId: string
  onImported: () => void
}) {
  const [rows, setRows] = useState<OfficialCsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const athlete = coachingRepository.getAthleteById(athleteId)
  const athleteName = athlete?.fullName ??
    `${athlete?.firstName ?? ''} ${athlete?.lastName ?? ''}`.trim()
  const existingResults = coachingRepository.getPerformanceResultsByAthleteId(athleteId)
  const previewRows = createOfficialResultsPreview(
    athleteId,
    rows,
    existingResults,
  )
  const newRows = previewRows.filter((row) => row.result && !row.duplicate)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    setError('')
    setNotice('')
    setRows([])
    setSelectedRows(new Set())

    if (!file) {
      setFileName('')
      return
    }

    try {
      const parsedRows = parseOfficialResultsCsv(await file.text(), athleteName)
      setFileName(file.name)
      setRows(parsedRows)
      setSelectedRows(
        new Set(
          parsedRows
            .filter(
              (row) =>
                row.result &&
                !isDuplicateOfficialResult(
                  athleteId,
                  row.result,
                  existingResults,
                ),
            )
            .map((row) => row.rowNumber),
        ),
      )
    } catch (caughtError) {
      setFileName(file.name)
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The CSV could not be parsed.',
      )
    }
  }

  function toggleRow(rowNumber: number) {
    setSelectedRows((current) => {
      const next = new Set(current)
      if (next.has(rowNumber)) next.delete(rowNumber)
      else next.add(rowNumber)
      return next
    })
  }

  function importSelected() {
    const importedAt = new Date().toISOString()
    const inputs = previewRows
      .filter(
        (row) =>
          row.result && !row.duplicate && selectedRows.has(row.rowNumber),
      )
      .map((row) => {
        const result = row.result!
        return {
          athleteId,
          resultType: 'competition' as const,
          occurredAt: result.occurredAt,
          event: `${result.distance} m ${result.stroke}`,
          distance: result.distance,
          stroke: result.stroke,
          course: result.course,
          totalSeconds: result.totalSeconds,
          segments: [],
          createdBy: CURRENT_COACH_ID,
          importMetadata: {
            provider: 'Swimming Australia CSV' as const,
            sourceType: 'csv' as const,
            sourceFileName: fileName,
            meetName: result.meetName,
            externalResultId: result.externalResultId,
            roundStatus: result.roundStatus,
            verified: result.verified,
            verificationStatus: result.verificationStatus,
            age: result.age,
            duplicateKey: createOfficialResultDuplicateKey(athleteId, result),
            importedAt,
          },
        }
      })

    try {
      const imported = coachingRepository.importPerformanceResults(inputs)
      setSelectedRows(new Set())
      setNotice(
        imported.length
          ? `Imported ${imported.length} result${imported.length === 1 ? '' : 's'}.`
          : 'No new results were imported.',
      )
      onImported()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The selected results could not be imported.',
      )
    }
  }

  return (
    <details className="results-import">
      <summary>Import Results CSV</summary>
      <div className="results-import-content">
        <label>
          Official results CSV
          <input accept=".csv,text/csv" type="file" onChange={handleFile} />
        </label>
        {error && <p className="form-error">{error}</p>}
        {notice && <p className="form-notice" role="status">{notice}</p>}
        {rows.length > 0 && (
          <>
            <div className="results-import-actions">
              <span>
                {newRows.length} new,{' '}
                {previewRows.filter((row) => row.duplicate).length} duplicate,{' '}
                {previewRows.filter((row) => row.reason).length} needs review
              </span>
              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  setSelectedRows(new Set(newRows.map((row) => row.rowNumber)))
                }
              >
                Select All New
              </button>
            </div>
            <div className="comparison-table-wrap">
              <table className="comparison-table results-import-table">
                <thead>
                  <tr>
                    <th>Import</th>
                    <th>Date</th>
                    <th>Meet</th>
                    <th>Event</th>
                    <th>Course</th>
                    <th>Final time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => {
                    const status = row.reason
                      ? 'Invalid / Needs review'
                      : row.duplicateOfRowNumber
                        ? `Duplicate source row ${row.duplicateOfRowNumber}`
                      : row.duplicate
                        ? 'Duplicate'
                        : 'New'
                    return (
                      <tr key={row.rowNumber}>
                        <td>
                          <input
                            aria-label={`Import CSV row ${row.rowNumber}`}
                            checked={selectedRows.has(row.rowNumber)}
                            disabled={!row.result || row.duplicate}
                            type="checkbox"
                            onChange={() => toggleRow(row.rowNumber)}
                          />
                        </td>
                        <td>
                          {row.result
                            ? formatDate(row.result.occurredAt)
                            : `Row ${row.rowNumber}`}
                        </td>
                        <td>{row.result?.meetName ?? 'Not recognized'}</td>
                        <td>
                          {row.result
                            ? `${row.result.distance} ${formatStroke(row.result.stroke)}`
                            : 'Not recognized'}
                        </td>
                        <td>
                          {row.result
                            ? formatCourse(row.result.course)
                            : 'Not recognized'}
                        </td>
                        <td>
                          {row.result
                            ? formatSeconds(row.result.totalSeconds)
                            : 'Not recognized'}
                        </td>
                        <td title={row.reason}>{status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              disabled={selectedRows.size === 0}
              onClick={importSelected}
            >
              Import Selected
            </button>
          </>
        )}
      </div>
    </details>
  )
}

export default ResultsCsvImportPanel
