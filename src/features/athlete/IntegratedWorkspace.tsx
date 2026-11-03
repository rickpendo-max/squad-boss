import { useState, useSyncExternalStore } from 'react'
import Card from '../../components/Card'
import {
  athleteTrainingSummary,
  brisbaneDate,
  validateSeason,
  verifiedPersonalBests,
} from '../../domain/athlete-workspace'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type { Athlete } from '../../types/athlete'

export default function IntegratedWorkspace({ athlete }: { athlete: Athlete }) {
  useSyncExternalStore(
    coachingRepository.subscribe,
    coachingRepository.getRevision,
  )
  const year = brisbaneDate(new Date().toISOString()).slice(0, 4)
  const [season, setSeason] = useState({ startDate: `${year}-01-01`, endDate: `${year}-12-31` })
  const validSeason = validateSeason(season)
  const state = coachingRepository.getArchiveState()
  const summary = athleteTrainingSummary(state, athlete.id, validSeason ? season : { startDate: `${year}-01-01`, endDate: `${year}-12-31` })
  const results = coachingRepository.getPerformanceResultsByAthleteId(
    athlete.id,
  )
  const bests = verifiedPersonalBests(results)
  const tests = results.filter((r) => r.resultType === 'test')
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
            : summary.rows.length ? 'Imported archive evidence' : 'Local development profile'}
        </span>
      </section>
      <section className="ripe-section" aria-label="Season overview">
        <div className="ripe-section-heading">
          <div>
            <span className="eyebrow">Verified archive records</span>
            <h3>Season overview</h3>
          </div>
          <div className="season-dates">
            <label>Season start <input type="date" value={season.startDate}
              onChange={(e) => setSeason({ ...season, startDate: e.target.value })} /></label>
            <label>Season end <input type="date" value={season.endDate}
              onChange={(e) => setSeason({ ...season, endDate: e.target.value })} /></label>
          </div>
        </div>
        {!validSeason && <p role="alert">Choose valid season dates, with the end on or after the start. Showing the current calendar year until corrected.</p>}
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
              {summary.provisionalMeasurements} provisional and{' '}
              {summary.unverifiedMeasurements} unverified measurements excluded
            </small>
          </div>
        </div>
        <p className="ripe-muted">
          Selected season includes both boundary dates in Australia/Brisbane. The default is the current calendar year, not a coach-approved season.{' '}
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
                        {brisbaneDate(session.startsAt)} ·{' '}
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
          <p>No verified session imports for this athlete and season.</p>
        )}
      </section>
      {summary.weeks.length > 0 && <Card eyebrow="Selected season · Brisbane Monday weeks" title="Weekly completed distance">
        <ul className="ripe-data-list">
          {summary.weeks.map((week) => <li key={week.week}>
            <span>Week of {week.week}<small>{week.missingDistance ? `${week.missingDistance} missing distances · partial total` : 'Recorded actual distance'}</small></span>
            <meter min={0} max={Math.max(1, ...summary.weeks.map((w) => w.completedMeters))}
              value={week.completedMeters} aria-label={`Week of ${week.week} recorded metres`} />
            <strong>{week.completedMeters.toLocaleString()} m</strong>
          </li>)}
        </ul>
      </Card>}
      <div className="ripe-grid">
        <Card eyebrow="Comparable verified results" title="Verified recorded bests">
          <p>
            Verified recorded best times grouped by event, course and result type. These are not necessarily lifetime PBs. Unverified results remain available in performance comparison.
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
                        ? `${r.archiveProvenance.sourceFileName} · ${r.archiveProvenance.sessionId}`
                        : r.importMetadata?.sourceFileName ?? 'Manual record · source verification not recorded'}
                    </small>
                  </span>
                  <strong>{r.totalSeconds.toFixed(2)} s<small>{r.archiveProvenance || r.importMetadata?.verified === true || r.importMetadata?.verificationStatus === 'verified' ? 'Verified source' : 'Verification not recorded'}</small></strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No source-verified performance results recorded. This profile is incomplete; legacy seed PBs are not promoted to verified records.</p>
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
