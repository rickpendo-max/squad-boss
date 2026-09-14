import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { calculateSplitTotal } from '../../domain/performance-entry'
import {
  calculatePerformanceProgression,
  type PerformanceProgression,
} from '../../domain/performance-progression'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type {
  PerformanceCourse,
  PerformanceResultType,
  SwimmingStroke,
} from '../../types/performance'
import ResultsCsvImportPanel from './ResultsCsvImportPanel'

const CURRENT_COACH_ID = 'local-coach'

type PerformanceForm = {
  resultType: PerformanceResultType
  occurredAt: string
  distance: 100 | 200
  stroke: SwimmingStroke
  course: PerformanceCourse
  splitSeconds: string[]
  finalTotalSeconds: string
}

function initialForm(): PerformanceForm {
  return {
    resultType: 'competition',
    occurredAt: '',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    splitSeconds: ['', ''],
    finalTotalSeconds: '',
  }
}

function formatSeconds(value?: number) {
  if (value === undefined) return 'Not available'

  const minutes = Math.floor(value / 60)
  const seconds = value - minutes * 60

  return minutes
    ? `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`
    : `${seconds.toFixed(2)} s`
}

function formatDifference(value?: number) {
  if (value === undefined) return 'Not available'
  if (value === 0) return '0.00 s'

  return value > 0
    ? `+${value.toFixed(2)} s slower`
    : `${value.toFixed(2)} s faster`
}

function displayDate(value: string) {
  return new Date(value).toLocaleString()
}

function toDateTimeLocal(value: string) {
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function ProgressionChart({
  progression,
  onSelect,
}: {
  progression: PerformanceProgression
  onSelect: (resultId: string) => void
}) {
  const width = 640
  const height = 190
  const horizontalPadding = 42
  const verticalPadding = 28
  const benchmarkSeconds = progression.points.find(
    (point) => point.benchmarkSeconds !== undefined,
  )?.benchmarkSeconds
  const plottedTimes = progression.points.map((point) => point.totalSeconds)
  if (benchmarkSeconds !== undefined) plottedTimes.push(benchmarkSeconds)
  const minimum = Math.min(...plottedTimes)
  const maximum = Math.max(...plottedTimes)
  const range = maximum - minimum || 1
  const x = (index: number) =>
    progression.points.length === 1
      ? width / 2
      : horizontalPadding +
        (index / (progression.points.length - 1)) *
          (width - horizontalPadding * 2)
  const y = (seconds: number) =>
    verticalPadding +
    ((seconds - minimum) / range) * (height - verticalPadding * 2)
  const coordinates = progression.points
    .map((point, index) => `${x(index)},${y(point.totalSeconds)}`)
    .join(' ')

  return (
    <div className="progression-chart-wrap">
      <svg
        aria-label="Total time progression; lower points indicate faster performances"
        className="progression-chart"
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        <line
          className="progression-axis"
          x1={horizontalPadding}
          x2={width - horizontalPadding}
          y1={height - verticalPadding}
          y2={height - verticalPadding}
        />
        {benchmarkSeconds !== undefined && (
          <>
            <line
              className="progression-benchmark"
              x1={horizontalPadding}
              x2={width - horizontalPadding}
              y1={y(benchmarkSeconds)}
              y2={y(benchmarkSeconds)}
            />
            <text
              className="progression-benchmark-label"
              x={width - horizontalPadding}
              y={y(benchmarkSeconds) - 6}
              textAnchor="end"
            >
              Benchmark {formatSeconds(benchmarkSeconds)}
            </text>
          </>
        )}
        <polyline className="progression-line" points={coordinates} />
        {progression.points.map((point, index) => (
          <g key={point.resultId}>
            <circle
              aria-label={`${new Date(point.occurredAt).toLocaleDateString()}, ${formatSeconds(point.totalSeconds)}${point.isPb ? ', PB' : ''}${point.isSelected ? ', selected' : ''}`}
              className={`progression-point${point.isPb ? ' pb' : ''}${point.isSelected ? ' selected' : ''}`}
              cx={x(index)}
              cy={y(point.totalSeconds)}
              onClick={() => onSelect(point.resultId)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelect(point.resultId)
                }
              }}
              r={point.isSelected ? 7 : 5}
              role="button"
              tabIndex={0}
            />
            {point.isPb && (
              <text
                className="progression-point-label"
                x={x(index)}
                y={y(point.totalSeconds) - 10}
                textAnchor="middle"
              >
                PB
              </text>
            )}
            <text
              className="progression-date-label"
              x={x(index)}
              y={height - 8}
              textAnchor="middle"
            >
              {new Date(point.occurredAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
              })}
            </text>
          </g>
        ))}
      </svg>
      <p className="progression-chart-note">Lower total time is better.</p>
    </div>
  )
}

function PerformanceComparisonPanel({ athleteId }: { athleteId: string }) {
  const [results, setResults] = useState(() =>
    coachingRepository.getPerformanceResultsByAthleteId(athleteId),
  )
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const [editingResultId, setEditingResultId] = useState<string>()
  const [selectedResultId, setSelectedResultId] = useState<string>()
  const editSectionRef = useRef<HTMLElement>(null)
  const enteredFinalTotal = Number(form.finalTotalSeconds)
  const calculatedTotal = form.splitSeconds.length
    ? calculateSplitTotal(form.splitSeconds)
    : form.finalTotalSeconds.trim() &&
        Number.isFinite(enteredFinalTotal) &&
        enteredFinalTotal > 0
      ? Math.round(enteredFinalTotal * 100) / 100
      : undefined
  const selectedResult =
    results.find((result) => result.id === selectedResultId) ?? results[0]
  const comparison = selectedResult
    ? coachingRepository.getPerformanceComparison(selectedResult.id)
    : undefined
  const progression = selectedResult
    ? calculatePerformanceProgression(
        selectedResult,
        results,
        new Map(
          results.map((result) => [
            result.id,
            coachingRepository.getPerformanceComparison(result.id),
          ]),
        ),
      )
    : undefined

  function handleDistanceChange(distance: 100 | 200) {
    setForm({
      ...form,
      distance,
      splitSeconds: form.splitSeconds.length
        ? Array.from({ length: distance / 50 }, () => '')
        : [],
    })
  }

  function updateSplit(index: number, value: string) {
    setForm({
      ...form,
      splitSeconds: form.splitSeconds.map((split, splitIndex) =>
        splitIndex === index ? value : split,
      ),
    })
  }

  function startEditing() {
    if (!selectedResult) return

    setForm({
      resultType: selectedResult.resultType,
      occurredAt: toDateTimeLocal(selectedResult.occurredAt),
      distance: selectedResult.distance as 100 | 200,
      stroke: selectedResult.stroke,
      course: selectedResult.course,
      splitSeconds: selectedResult.segments.map((segment) =>
        String(segment.seconds),
      ),
      finalTotalSeconds: selectedResult.segments.length
        ? ''
        : String(selectedResult.totalSeconds),
    })
    setEditingResultId(selectedResult.id)
    setError('')
    requestAnimationFrame(() => {
      editSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
      editSectionRef.current?.focus({ preventScroll: true })
    })
  }

  function selectResult(resultId: string) {
    setSelectedResultId(resultId)
    setForm(initialForm())
    setEditingResultId(undefined)
    setError('')
  }

  function cancelEditing() {
    setForm(initialForm())
    setEditingResultId(undefined)
    setError('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const splitSeconds = form.splitSeconds.map(Number)

    if (
      !form.occurredAt ||
      calculatedTotal === undefined
    ) {
      setError('Date and a positive time for every 50 m split are required.')
      return
    }

    try {
      const input = {
        athleteId,
        resultType: form.resultType,
        occurredAt: new Date(form.occurredAt).toISOString(),
        event: `${form.distance} m ${form.stroke}`,
        distance: form.distance,
        stroke: form.stroke,
        course: form.course,
        totalSeconds: calculatedTotal,
        segments: splitSeconds.map((seconds, index) => ({
          segmentIndex: index + 1,
          distanceFrom: index * 50,
          distanceTo: (index + 1) * 50,
          seconds,
        })),
        createdBy: CURRENT_COACH_ID,
      }

      if (editingResultId) {
        coachingRepository.updatePerformanceResult(editingResultId, input)
        setSelectedResultId(editingResultId)
      } else {
        coachingRepository.createPerformanceResult(input)
        setSelectedResultId(undefined)
      }

      setResults(
        coachingRepository.getPerformanceResultsByAthleteId(athleteId),
      )
      setForm(initialForm())
      setEditingResultId(undefined)
      setError('')
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The performance result could not be saved.',
      )
    }
  }

  return (
    <Card eyebrow="Primary coach workflow" title="Performance Comparison">
      <section className="performance-section">
        <h3>{selectedResultId ? 'Selected Performance' : 'Latest Performance'}</h3>
        {selectedResult ? (
          <div className="performance-latest">
            <strong>{selectedResult.event}</strong>
            <span>{selectedResult.course}</span>
            <span>{displayDate(selectedResult.occurredAt)}</span>
            <strong>{formatSeconds(selectedResult.totalSeconds)}</strong>
            <button
              className="secondary-button performance-edit-button"
              type="button"
              onClick={startEditing}
            >
              Edit
            </button>
          </div>
        ) : (
          <p>No performance results recorded.</p>
        )}
      </section>

      <section className="performance-section">
        <details className="performance-history">
          <summary>Performance History ({results.length})</summary>
          {results.length ? (
            <div className="performance-history-list">
              {results.map((result) => {
                const isSelected = result.id === selectedResult?.id

                return (
                  <div
                    className={`performance-history-row${isSelected ? ' selected' : ''}`}
                    key={result.id}
                  >
                    <time dateTime={result.occurredAt}>
                      {new Date(result.occurredAt).toLocaleDateString()}
                    </time>
                    <strong>{result.event}</strong>
                    <span>{result.course}</span>
                    <span>{formatSeconds(result.totalSeconds)}</span>
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={isSelected}
                      onClick={() => selectResult(result.id)}
                    >
                      {isSelected ? 'Selected' : 'Open'}
                    </button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p>No performance results recorded.</p>
          )}
        </details>
      </section>

      <section className="performance-section">
        <ResultsCsvImportPanel
          athleteId={athleteId}
          onImported={() => {
            setResults(
              coachingRepository.getPerformanceResultsByAthleteId(athleteId),
            )
            setSelectedResultId(undefined)
          }}
        />
      </section>

      <section
        className={`performance-section${editingResultId ? ' performance-editing' : ''}`}
        ref={editSectionRef}
        tabIndex={-1}
      >
        <h3>{editingResultId ? 'Edit Performance' : 'Add Performance'}</h3>
        {editingResultId && selectedResult && (
          <p className="form-notice" role="status">
            Editing {selectedResult.event} from{' '}
            {new Date(selectedResult.occurredAt).toLocaleDateString()}
          </p>
        )}
        <form className="observation-form" onSubmit={handleSubmit}>
          <label>
            Result type
            <select
              value={form.resultType}
              onChange={(event) =>
                setForm({
                  ...form,
                  resultType: event.target.value as PerformanceResultType,
                })
              }
            >
              <option value="competition">Competition</option>
              <option value="test">Test</option>
              <option value="training">Training</option>
            </select>
          </label>

          <label>
            Date
            <input
              required
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) =>
                setForm({ ...form, occurredAt: event.target.value })
              }
            />
          </label>

          <label>
            Event distance
            <select
              value={form.distance}
              onChange={(event) =>
                handleDistanceChange(Number(event.target.value) as 100 | 200)
              }
            >
              <option value="100">100 m</option>
              <option value="200">200 m</option>
            </select>
          </label>

          <label>
            Stroke
            <select
              value={form.stroke}
              onChange={(event) =>
                setForm({
                  ...form,
                  stroke: event.target.value as SwimmingStroke,
                })
              }
            >
              <option value="freestyle">Freestyle</option>
              <option value="backstroke">Backstroke</option>
              <option value="breaststroke">Breaststroke</option>
              <option value="butterfly">Butterfly</option>
              <option value="individual-medley">Individual medley</option>
            </select>
          </label>

          <label>
            Course
            <select
              value={form.course}
              onChange={(event) =>
                setForm({
                  ...form,
                  course: event.target.value as PerformanceCourse,
                })
              }
            >
              <option value="LCM">LCM</option>
              <option value="SCM">SCM</option>
            </select>
          </label>

          {form.splitSeconds.length ? (
            <>
          <fieldset className="split-entry">
            <legend>50 m splits</legend>
            {form.splitSeconds.map((split, index) => (
              <label key={`${form.distance}-${index}`}>
                {index * 50}–{(index + 1) * 50} m
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={split}
                  onChange={(event) => updateSplit(index, event.target.value)}
                />
              </label>
            ))}
          </fieldset>

          <output className="calculated-total" aria-live="polite">
            <span>Calculated total</span>
            <strong>
              {calculatedTotal === undefined
                ? 'Enter every split'
                : formatSeconds(calculatedTotal)}
            </strong>
          </output>
            </>
          ) : (
            <>
              <p className="form-notice">
                Split data is unavailable for this imported result.
              </p>
              <label>
                Final time (seconds)
                <input
                  required
                  min="0.01"
                  step="0.01"
                  type="number"
                  value={form.finalTotalSeconds}
                  onChange={(event) =>
                    setForm({ ...form, finalTotalSeconds: event.target.value })
                  }
                />
              </label>
            </>
          )}

          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="submit">
              {editingResultId ? 'Save Changes' : 'Save Performance'}
            </button>
            {editingResultId && (
              <button
                className="secondary-button"
                type="button"
                onClick={cancelEditing}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="performance-section">
        <div className="progression-heading">
          <h3>
            Performance Progression
            {selectedResult &&
              ` — ${selectedResult.event} · ${selectedResult.course}`}
          </h3>
          {progression && (
            <span className={`progression-direction ${progression.direction}`}>
              {progression.direction}
            </span>
          )}
        </div>
        {progression?.points.length ? (
          <>
            <ProgressionChart
              progression={progression}
              onSelect={selectResult}
            />
            <div className="comparison-table-wrap">
              <table className="comparison-table progression-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Total</th>
                    <th>From previous</th>
                    <th>From PB</th>
                    <th>From benchmark</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {progression.points.map((point) => (
                    <tr
                      className={point.isSelected ? 'selected' : undefined}
                      key={point.resultId}
                    >
                      <td>{new Date(point.occurredAt).toLocaleDateString()}</td>
                      <td>{formatSeconds(point.totalSeconds)}</td>
                      <td>{formatDifference(point.previousDifferenceSeconds)}</td>
                      <td>{formatDifference(point.pbDifferenceSeconds)}</td>
                      <td>
                        {formatDifference(point.benchmarkDifferenceSeconds)}
                      </td>
                      <td>
                        <button
                          className="secondary-button"
                          type="button"
                          disabled={point.isSelected}
                          onClick={() => selectResult(point.resultId)}
                        >
                          {point.isSelected ? 'Selected' : 'Open'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="performance-findings progression-findings">
              {progression.findings.map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Select a performance result to view progression.</p>
        )}
      </section>

      <section className="performance-section">
        <h3>Comparison Summary</h3>
        {selectedResult && comparison ? (
          <dl className="comparison-summary">
            <div>
              <dt>Result total</dt>
              <dd>{formatSeconds(selectedResult.totalSeconds)}</dd>
            </div>
            <div>
              <dt>From previous</dt>
              <dd>
                {formatDifference(comparison.previousTotalDifferenceSeconds)}
              </dd>
            </div>
            <div>
              <dt>From PB</dt>
              <dd>{formatDifference(comparison.pbTotalDifferenceSeconds)}</dd>
            </div>
            <div>
              <dt>QAS benchmark</dt>
              <dd>{comparison.benchmarkMatchStatus}</dd>
            </div>
            <div>
              <dt>From QAS benchmark</dt>
              <dd>{formatDifference(comparison.benchmarkTotalDifferenceSeconds)}</dd>
            </div>
            <div>
              <dt>Largest segment deviation</dt>
              <dd>
                {comparison.largestPositiveSegmentDeviation
                  ? `${comparison.largestPositiveSegmentDeviation.distanceFrom}–${comparison.largestPositiveSegmentDeviation.distanceTo} m`
                  : 'Not available'}
              </dd>
            </div>
          </dl>
        ) : (
          <p>Add a performance result to generate a comparison.</p>
        )}
        {comparison?.benchmarkMatchStatus === 'unavailable' && (
          <p>No applicable QAS benchmark available.</p>
        )}
        {comparison?.benchmarkMatchStatus === 'out-of-range' && (
          <p>Result is outside the published QAS pacing-chart range.</p>
        )}
      </section>

      <section className="performance-section">
        <h3>Segment Comparison</h3>
        {comparison && selectedResult?.segments.length ? (
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>Actual</th>
                  <th>Previous</th>
                  <th>Difference</th>
                  <th>QAS</th>
                  <th>Difference</th>
                </tr>
              </thead>
              <tbody>
                {comparison.segmentComparisons.map((segment) => (
                  <tr key={segment.segmentIndex}>
                    <td>{segment.distanceFrom}–{segment.distanceTo} m</td>
                    <td>{formatSeconds(segment.actualSeconds)}</td>
                    <td>{formatSeconds(segment.previousSeconds)}</td>
                    <td>
                      {formatDifference(segment.previousDifferenceSeconds)}
                    </td>
                    <td>{formatSeconds(segment.benchmarkSeconds)}</td>
                    <td>
                      {formatDifference(segment.benchmarkDifferenceSeconds)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedResult ? (
          <p>Split data unavailable for this result.</p>
        ) : (
          <p>No segment comparison available.</p>
        )}
        {comparison && !comparison.previousResultId && (
          <p>No previous comparable result.</p>
        )}
        {comparison &&
          selectedResult?.segments.length > 0 &&
          comparison.pbResultId === undefined && (
          <p>PB split profile unavailable; PB comparison is total-time only when recorded.</p>
        )}
      </section>

      <section className="performance-section">
        <h3>Concise Findings</h3>
        {comparison?.findings.length ? (
          <ul className="performance-findings">
            {comparison.findings.map((finding) => (
              <li key={`${finding.comparisonType}-${finding.metricOrSegment}`}>
                {finding.summary}
              </li>
            ))}
          </ul>
        ) : (
          <p>No factual comparison findings available.</p>
        )}
      </section>
    </Card>
  )
}

export default PerformanceComparisonPanel
