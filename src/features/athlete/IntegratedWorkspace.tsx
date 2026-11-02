import { useState, useSyncExternalStore } from 'react'
import Card from '../../components/Card'
import {
  athleteTrainingSummary,
  recordedPersonalBests,
} from '../../domain/athlete-workspace'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type { Athlete } from '../../types/athlete'

export default function IntegratedWorkspace({ athlete }: { athlete: Athlete }) {
  useSyncExternalStore(
    coachingRepository.subscribe,
    coachingRepository.getRevision,
  )
  const [year, setYear] = useState(String(new Date().getFullYear()))
  const state = coachingRepository.getArchiveState()
  const summary = athleteTrainingSummary(state, athlete.id, year)
  const results = coachingRepository.getPerformanceResultsByAthleteId(
    athlete.id,
  )
  const bests = recordedPersonalBests(results)
  const tests = results.filter((r) => r.resultType === 'test')
  const years = [
    ...new Set([
      String(new Date().getFullYear()),
      year,
      ...state.sessions.map((s) => s.session.startsAt.slice(0, 4)),
    ]),
  ]
    .sort()
    .reverse()
  return (
    <>
      <section className="ripe-hero">
        <div>
          <span className="eyebrow">Athlete workspace · {athlete.id}</span>
          <h2>
            {athlete.fullName ?? `${athlete.firstName} ${athlete.lastName}`}
          </h2>
          <p>Training evidence. Performance context. Coach decisions.</p>
        </div>
        <span className="ripe-badge">
          {athlete.id === 'demo-athlete-001'
            ? 'Synthetic demonstration'
            : 'Local development data'}
        </span>
      </section>
      <section className="ripe-section" aria-label="Season overview">
        <div className="ripe-section-heading">
          <div>
            <span className="eyebrow">Verified archive records</span>
            <h3>Season overview</h3>
          </div>
          <label>
            Calendar year{' '}
            <select
              aria-label="Calendar year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="ripe-metrics">
          <div>
            <span>Attendance</span>
            <strong>
              {summary.attendancePercent === null
                ? 'Not recorded'
                : `${summary.attendancePercent}%`}
            </strong>
            <small>
              {summary.attended} present / {summary.knownAttendance} known ·{' '}
              {summary.rows.length - summary.knownAttendance} unknown
            </small>
          </div>
          <div>
            <span>Completed distance</span>
            <strong>
              {summary.completedMeters === null
                ? 'Not recorded'
                : `${summary.completedMeters.toLocaleString()} m`}
            </strong>
            <small>
              {summary.missingDistance
                ? `Partial total · ${summary.missingDistance} session distance missing`
                : 'Recorded values only · planned volume excluded'}
            </small>
          </div>
          <div>
            <span>Session evidence</span>
            <strong>{summary.rows.length || 'Not recorded'}</strong>
            <small>
              {summary.provisionalMeasurements} provisional measurements
              excluded
            </small>
          </div>
        </div>
        <p className="ripe-muted">
          Calendar-year view, using source-local session dates.{' '}
          {summary.missingTimes} missing times remain missing. Distance is
          volume, not a physiological load estimate.
        </p>
        {summary.rows.length ? (
          <div className="comparison-table-wrap">
            <table className="comparison-table">
              <caption>Training attendance and volume</caption>
              <thead>
                <tr>
                  <th>Session / source</th>
                  <th>Attendance</th>
                  <th>Planned</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {summary.rows.map(({ session, participant, archiveId }) => (
                  <tr key={`${archiveId}:${session.id}`}>
                    <td>
                      <strong>{session.title}</strong>
                      <br />
                      <small>
                        {session.startsAt.slice(0, 10)} ·{' '}
                        {session.source.fileName}
                      </small>
                    </td>
                    <td>{participant.attendance}</td>
                    <td>
                      {session.plannedDistanceMeters === null
                        ? 'Not recorded'
                        : `${session.plannedDistanceMeters.toLocaleString()} m`}
                    </td>
                    <td>
                      {participant.completedDistanceMeters === null
                        ? 'Not recorded'
                        : `${participant.completedDistanceMeters.toLocaleString()} m`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No verified session imports for this athlete and year.</p>
        )}
      </section>
      <div className="ripe-grid">
        <Card eyebrow="Comparable recorded results" title="Personal bests">
          <p>
            Grouped by event, course and result type; legacy profile PBs remain
            below.
          </p>
          {bests.length ? (
            <ul className="ripe-data-list">
              {bests.map((r) => (
                <li key={r.id}>
                  <span>
                    {r.event} · {r.course} · {r.resultType}
                    <small>
                      {r.occurredAt.slice(0, 10)} ·{' '}
                      {r.archiveProvenance
                        ? 'Verified archive'
                        : 'Existing result record'}
                    </small>
                  </span>
                  <strong>{r.totalSeconds.toFixed(2)} s</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No recorded performance results.</p>
          )}
        </Card>
        <Card
          eyebrow="Verified archive + existing results"
          title="Testing history"
        >
          {tests.length ? (
            <ul className="ripe-data-list">
              {tests.map((r) => (
                <li key={r.id}>
                  <span>
                    {r.event} · {r.course}
                    <small>{r.occurredAt.slice(0, 10)}</small>
                  </span>
                  <strong>{r.totalSeconds.toFixed(2)} s</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No timed test results recorded. Legacy testing notes remain in
              athlete details.
            </p>
          )}
        </Card>
        <Card eyebrow="Individual Athlete Performance Plan" title="IAPP goals">
          {athlete.iappGoals?.length ? (
            athlete.iappGoals.map((g) => (
              <p key={g.id}>
                {g.goal} · {g.status}
                {g.reviewAt ? ` · Review ${g.reviewAt}` : ''}
              </p>
            ))
          ) : (
            <p>
              No IAPP goals recorded. Coaching priorities are retained
              separately.
            </p>
          )}
        </Card>
        <Card eyebrow="Performance Support Team" title="PST information">
          {athlete.performanceSupportTeam?.length ? (
            athlete.performanceSupportTeam.map((p) => (
              <p key={p.id}>
                {p.role} · {p.name}
                {p.note ? ` — ${p.note}` : ''}
              </p>
            ))
          ) : (
            <p>No support team records available.</p>
          )}
        </Card>
      </div>
    </>
  )
}
