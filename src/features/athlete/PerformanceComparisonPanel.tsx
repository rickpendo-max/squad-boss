import { useRef, useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { calculateSplitTotal } from '../../domain/performance-entry'
import {
  calculatePerformanceProgression,
  type PerformanceProgression,
} from '../../domain/performance-progression'
import {
  ALL_PERFORMANCE_EVENTS,
  filterPerformanceResults,
  getPerformanceEventOptions,
  performanceEventKey,
  type PerformanceCourseFilter,
} from '../../domain/performance-selection'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type {
  PerformanceComparison,
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

type SignalState = 'gain' | 'aligned' | 'variance' | 'recurring'
type SignalWeight = 'trace' | 'marked' | 'strong'

type GlanceSignal = {
  id: string
  label: string
  value: string
  caption: string
  state: SignalState
  weight: SignalWeight
  kind: 'context' | 'distribution' | 'shift' | 'pattern'
  focus?: boolean
}

function signalState(value: number): SignalState {
  if (Math.abs(value) <= 0.05) return 'aligned'

  return value < 0 ? 'gain' : 'variance'
}

function signalWeight(value: number): SignalWeight {
  const magnitude = Math.abs(value)

  if (magnitude <= 0.1) return 'trace'
  if (magnitude <= 0.5) return 'marked'

  return 'strong'
}

function formatSignalDelta(value?: number) {
  if (value === undefined) return '—'
  if (Math.abs(value) <= 0.005) return '±0.00'

  return `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}`
}

function signalCaption(value?: number) {
  if (value === undefined) return 'No comparison'
  if (Math.abs(value) <= 0.05) return 'Aligned'

  return value < 0 ? 'Faster' : 'Slower'
}

function buildGlanceSignals(
  comparison: PerformanceComparison,
  recurringPattern?: string,
) {
  const signals: GlanceSignal[] = []

  for (const context of [
    { id: 'pb', label: 'PB', value: comparison.pbTotalDifferenceSeconds },
    {
      id: 'previous',
      label: 'Previous',
      value: comparison.previousTotalDifferenceSeconds,
    },
  ]) {
    if (context.value === undefined) continue
    signals.push({
      id: context.id,
      label: context.label,
      value: formatSignalDelta(context.value),
      caption: signalCaption(context.value),
      state: signalState(context.value),
      weight: signalWeight(context.value),
      kind: 'context',
    })
  }

  const distribution = comparison.distributionSummary
  if (distribution) {
    const front = distribution.firstHalfDifferenceSeconds
    const back = distribution.secondHalfDifferenceSeconds
    const useBack =
      (back > 0 && Math.abs(back) >= Math.abs(front)) ||
      Math.abs(back) > Math.abs(front)
    const main = useBack ? back : front
    const other = useBack ? front : back
    signals.push({
      id: 'distribution',
      label: 'Race distribution',
      value:
        Math.abs(main) <= 0.05
          ? 'ALIGNED'
          : `${useBack ? 'BACK' : 'FRONT'} ${formatSignalDelta(main)}`,
      caption: `Other half ${formatSignalDelta(other)}`,
      state: signalState(main),
      weight: signalWeight(main),
      kind: 'distribution',
      focus: main > 0.05,
    })
  }

  const largest = comparison.largestAbsoluteSegmentDeviation
  const largestDifference = largest?.benchmarkDifferenceSeconds
  if (largest && largestDifference !== undefined && Math.abs(largestDifference) > 0.05) {
    signals.push({
      id: 'shift',
      label: 'Largest shift',
      value: `${largest.distanceFrom}–${largest.distanceTo}`,
      caption: `${formatSignalDelta(largestDifference)} s`,
      state: signalState(largestDifference),
      weight: signalWeight(largestDifference),
      kind: 'shift',
    })
  }

  const recurrence = recurringPattern?.match(/(\d+) of the last (\d+)/)
  if (recurrence) {
    signals.push({
      id: 'pattern',
      label: 'Recurring pattern',
      value: `${recurrence[1]}/${recurrence[2]}`,
      caption: 'Back-end distribution',
      state: 'recurring',
      weight: 'strong',
      kind: 'pattern',
      focus: true,
    })
  }

  return signals
}

function evidenceGaps(
  comparison: PerformanceComparison,
  comparableRaceCount: number,
  recurringPattern?: string,
) {
  const gaps: string[] = []

  if (comparison.previousTotalDifferenceSeconds === undefined) {
    gaps.push('PREVIOUS')
  }
  if (!comparison.distributionSummary) gaps.push('DISTRIBUTION')
  if (!recurringPattern) {
    gaps.push(`PATTERN ${Math.min(comparableRaceCount, 2)}/2`)
  }

  return gaps
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
  const plottedTimes = progression.points.map((point) => point.totalSeconds)
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
  const [eventFilter, setEventFilter] = useState(
    results[0] ? performanceEventKey(results[0]) : ALL_PERFORMANCE_EVENTS,
  )
  const [courseFilter, setCourseFilter] = useState<PerformanceCourseFilter>(
    results[0]?.course ?? 'all',
  )
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
  const eventOptions = getPerformanceEventOptions(results)
  const filteredResults = filterPerformanceResults(
    results,
    eventFilter,
    courseFilter,
  )
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
  const glanceSignals = comparison
    ? buildGlanceSignals(comparison, progression?.recurringPattern)
    : []
  const unavailableEvidence = comparison
    ? evidenceGaps(
        comparison,
        progression?.points.length ?? 0,
        progression?.recurringPattern,
      )
    : []

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

  function selectEventFilter(nextEvent: string) {
    const courseResults = filterPerformanceResults(
      results,
      nextEvent,
      courseFilter,
    )
    const nextCourse = courseResults.length ? courseFilter : 'all'
    const nextResults = filterPerformanceResults(results, nextEvent, nextCourse)

    setEventFilter(nextEvent)
    setCourseFilter(nextCourse)
    if (nextResults[0]) selectResult(nextResults[0].id)
  }

  function selectCourseFilter(nextCourse: PerformanceCourseFilter) {
    const nextResults = filterPerformanceResults(
      results,
      eventFilter,
      nextCourse,
    )

    setCourseFilter(nextCourse)
    if (nextResults[0]) selectResult(nextResults[0].id)
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

      <section className="performance-section performance-insight">
        <div className="glance-heading">
          <h3>At a Glance</h3>
          <span className="glance-key">◆ attention · ◇ aligned · ↘ gain</span>
        </div>
        {selectedResult && comparison ? (
          <>
            <div className="performance-signal-field" role="list">
              {glanceSignals.map((signal) => (
                <div
                  className={`performance-signal signal-${signal.state} signal-${signal.weight} signal-${signal.kind}${signal.focus ? ' signal-focus' : ''}`}
                  key={signal.id}
                  role="listitem"
                >
                  <span className="signal-marker" aria-hidden="true" />
                  <span className="signal-label">{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.caption}</small>
                </div>
              ))}
            </div>
            {unavailableEvidence.length > 0 && (
              <div className="evidence-strip" aria-label="Insufficient evidence">
                <span>○ EVIDENCE</span>
                {unavailableEvidence.map((gap) => (
                  <span key={gap}>{gap}</span>
                ))}
              </div>
            )}

            <details className="performance-details">
              <summary>Details</summary>
              <div className="performance-report-source">
                <section data-report-section="narrative">
                  <h4>Performance interpretation</h4>
                  <p>
                    {progression?.distributionHighlight ??
                      'Expected split distribution is unavailable for this result.'}
                  </p>
                  <p>
                    {progression?.recurringPattern ??
                      (progression && progression.points.length >= 2
                        ? 'No repeated distribution pattern established yet.'
                        : 'More comparable performances are needed to identify recurrence.')}
                  </p>
                </section>

                {comparison.distributionSummary && (
                  <section data-report-section="half-distribution">
                    <h4>Half-race distribution</h4>
                    <dl className="comparison-summary distribution-summary">
                      <div>
                        <dt>First half actual / expected</dt>
                        <dd>
                          {formatSeconds(
                            comparison.distributionSummary
                              .firstHalfActualSeconds,
                          )}{' '}
                          /{' '}
                          {formatSeconds(
                            comparison.distributionSummary
                              .firstHalfExpectedSeconds,
                          )}
                        </dd>
                        <span>
                          {formatDifference(
                            comparison.distributionSummary
                              .firstHalfDifferenceSeconds,
                          )}
                        </span>
                      </div>
                      <div>
                        <dt>Second half actual / expected</dt>
                        <dd>
                          {formatSeconds(
                            comparison.distributionSummary
                              .secondHalfActualSeconds,
                          )}{' '}
                          /{' '}
                          {formatSeconds(
                            comparison.distributionSummary
                              .secondHalfExpectedSeconds,
                          )}
                        </dd>
                        <span>
                          {formatDifference(
                            comparison.distributionSummary
                              .secondHalfDifferenceSeconds,
                          )}
                        </span>
                      </div>
                    </dl>
                  </section>
                )}

                <section data-report-section="segments">
                  <h4>Segment comparison</h4>
                  {selectedResult.segments.length ? (
                    <div className="comparison-table-wrap">
                      <table className="comparison-table">
                        <thead>
                          <tr>
                            <th>Segment</th>
                            <th>Actual</th>
                            <th>Expected</th>
                            <th>Difference</th>
                            <th>Previous</th>
                            <th>From previous</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.segmentComparisons.map((segment) => (
                            <tr key={segment.segmentIndex}>
                              <td>
                                {segment.distanceFrom}–{segment.distanceTo} m
                              </td>
                              <td>{formatSeconds(segment.actualSeconds)}</td>
                              <td>{formatSeconds(segment.benchmarkSeconds)}</td>
                              <td>
                                {formatDifference(
                                  segment.benchmarkDifferenceSeconds,
                                )}
                              </td>
                              <td>{formatSeconds(segment.previousSeconds)}</td>
                              <td>
                                {formatDifference(
                                  segment.previousDifferenceSeconds,
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>Split data unavailable for this result.</p>
                  )}
                </section>

                <section data-report-section="benchmark-provenance">
                  <h4>Benchmark method and provenance</h4>
                  {comparison.benchmarkProvenance ? (
                    <>
                      <p>
                        <strong>{comparison.benchmarkProvenance.label}</strong>
                      </p>
                      {comparison.benchmarkProvenance
                        .isOutsidePublishedRange && (
                        <p>
                          Outside the original published range. This is an
                          able-bodied pacing model, not a
                          classification-specific Para benchmark.
                        </p>
                      )}
                      <p>
                        Source: {comparison.benchmarkProvenance.source} (
                        {comparison.benchmarkProvenance.sourceVersion}).{' '}
                        {comparison.benchmarkProvenance.basis}.
                        {comparison.benchmarkProvenance.sourceUrl && (
                          <>{' '}<a href={comparison.benchmarkProvenance.sourceUrl} target="_blank" rel="noreferrer">View source report</a>.</>
                        )}
                      </p>
                    </>
                  ) : (
                    <p>No applicable benchmark available.</p>
                  )}
                </section>
              </div>
            </details>
          </>
        ) : (
          <p>Add a performance result to generate a comparison.</p>
        )}
      </section>

      <section className="performance-section">
        <div className="performance-finder">
          <h3>Find Performance</h3>
          <div className="performance-finder-controls">
            <label>
              Event
              <select
                value={eventFilter}
                onChange={(event) => selectEventFilter(event.target.value)}
              >
                <option value={ALL_PERFORMANCE_EVENTS}>All events</option>
                {eventOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Course
              <select
                value={courseFilter}
                onChange={(event) =>
                  selectCourseFilter(
                    event.target.value as PerformanceCourseFilter,
                  )
                }
              >
                <option value="all">All courses</option>
                <option value="LCM">LCM</option>
                <option value="SCM">SCM</option>
              </select>
            </label>
          </div>
        </div>
        <details className="performance-history">
          <summary>
            Performance History ({filteredResults.length} of {results.length})
          </summary>
          {filteredResults.length ? (
            <div className="performance-history-list">
              {filteredResults.map((result) => {
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
            <p>No performances match this event and course.</p>
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

    </Card>
  )
}

export default PerformanceComparisonPanel
