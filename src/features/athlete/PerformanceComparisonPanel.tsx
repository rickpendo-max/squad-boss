import { useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type {
  PerformanceCourse,
  PerformanceResultType,
  SwimmingStroke,
} from '../../types/performance'

const CURRENT_COACH_ID = 'local-coach'

type PerformanceForm = {
  resultType: PerformanceResultType
  occurredAt: string
  distance: 100 | 200
  stroke: SwimmingStroke
  course: PerformanceCourse
  totalSeconds: string
  splitSeconds: string[]
}

function initialForm(): PerformanceForm {
  return {
    resultType: 'competition',
    occurredAt: '',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    totalSeconds: '',
    splitSeconds: ['', ''],
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

function PerformanceComparisonPanel({ athleteId }: { athleteId: string }) {
  const [results, setResults] = useState(() =>
    coachingRepository.getPerformanceResultsByAthleteId(athleteId),
  )
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const latestResult = results[0]
  const comparison = latestResult
    ? coachingRepository.getPerformanceComparison(latestResult.id)
    : undefined

  function handleDistanceChange(distance: 100 | 200) {
    setForm({
      ...form,
      distance,
      splitSeconds: Array.from(
        { length: distance / 50 },
        () => '',
      ),
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const totalSeconds = Number(form.totalSeconds)
    const splitSeconds = form.splitSeconds.map(Number)

    if (
      !form.occurredAt ||
      !form.totalSeconds ||
      form.splitSeconds.some((split) => !split)
    ) {
      setError('Date, total time and every 50 m split are required.')
      return
    }

    try {
      coachingRepository.createPerformanceResult({
        athleteId,
        resultType: form.resultType,
        occurredAt: new Date(form.occurredAt).toISOString(),
        event: `${form.distance} m ${form.stroke}`,
        distance: form.distance,
        stroke: form.stroke,
        course: form.course,
        totalSeconds,
        segments: splitSeconds.map((seconds, index) => ({
          segmentIndex: index + 1,
          distanceFrom: index * 50,
          distanceTo: (index + 1) * 50,
          seconds,
        })),
        createdBy: CURRENT_COACH_ID,
      })

      setResults(
        coachingRepository.getPerformanceResultsByAthleteId(athleteId),
      )
      setForm(initialForm())
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
        <h3>Latest Performance</h3>
        {latestResult ? (
          <div className="performance-latest">
            <strong>
              {latestResult.distance} m {latestResult.stroke}
            </strong>
            <span>{latestResult.course}</span>
            <span>{displayDate(latestResult.occurredAt)}</span>
            <strong>{formatSeconds(latestResult.totalSeconds)}</strong>
          </div>
        ) : (
          <p>No performance results recorded.</p>
        )}
      </section>

      <section className="performance-section">
        <h3>Add Performance</h3>
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

          <label>
            Total time (seconds)
            <input
              required
              min="0.01"
              step="0.01"
              type="number"
              value={form.totalSeconds}
              onChange={(event) =>
                setForm({ ...form, totalSeconds: event.target.value })
              }
            />
          </label>

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

          {error && <p className="form-error">{error}</p>}
          <button type="submit">Save Performance</button>
        </form>
      </section>

      <section className="performance-section">
        <h3>Comparison Summary</h3>
        {latestResult && comparison ? (
          <dl className="comparison-summary">
            <div>
              <dt>Result total</dt>
              <dd>{formatSeconds(latestResult.totalSeconds)}</dd>
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
      </section>

      <section className="performance-section">
        <h3>Segment Comparison</h3>
        {comparison ? (
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
        ) : (
          <p>No segment comparison available.</p>
        )}
        {comparison && !comparison.previousResultId && (
          <p>No previous comparable result.</p>
        )}
        {comparison && comparison.pbResultId === undefined && (
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
