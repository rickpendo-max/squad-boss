import { useState } from 'react'

import AthleteSelector from '../../components/AthleteSelector'
import Card from '../../components/Card'
import { useAthlete } from '../../context/useAthlete'
import InterpretationPanel from './InterpretationPanel'
import ObservationPanel from './ObservationPanel'

function displayList(values?: string[]) {
  return values?.length ? values.join(', ') : 'Not recorded'
}

function AthleteProfile() {
  const [isCompassOpen, setIsCompassOpen] = useState(false)
  const { selectedAthlete } = useAthlete()
  const fullName =
    selectedAthlete.fullName ??
    `${selectedAthlete.firstName} ${selectedAthlete.lastName}`

  return (
    <main className="workspace">
      <AthleteSelector />

      <section className="depth-layout">
        <ObservationPanel athleteId={selectedAthlete.id} />
        <InterpretationPanel athleteId={selectedAthlete.id} />

        <Card eyebrow="Athlete details" title="Profile">
          <p><strong>ID:</strong> {selectedAthlete.id}</p>
          <p><strong>Full name:</strong> {fullName}</p>
          <p><strong>First name:</strong> {selectedAthlete.firstName}</p>
          <p><strong>Last name:</strong> {selectedAthlete.lastName}</p>
          <p>
            <strong>Classification:</strong>{' '}
            {selectedAthlete.classification ?? 'Not recorded'}
          </p>
          <p><strong>Squad:</strong> {selectedAthlete.squad ?? 'Not recorded'}</p>
          <p><strong>Status:</strong> {selectedAthlete.status}</p>
          <p>
            <strong>Status note:</strong>{' '}
            {selectedAthlete.statusNote ?? 'Not recorded'}
          </p>
          <p>
            <strong>Primary events:</strong>{' '}
            {displayList(selectedAthlete.primaryEvents)}
          </p>
          <p>
            <strong>Secondary events:</strong>{' '}
            {displayList(selectedAthlete.secondaryEvents)}
          </p>
        </Card>

        <Card eyebrow="Athlete details" title="Performance">
          <p><strong>Personal bests</strong></p>
          {selectedAthlete.personalBests.length ? (
            selectedAthlete.personalBests.map((personalBest) => (
              <p key={`${personalBest.event}-${personalBest.course}`}>
                {personalBest.event} ({personalBest.course}): {personalBest.time}
                {personalBest.date ? ` — ${personalBest.date}` : ''}
              </p>
            ))
          ) : (
            <p>Not recorded</p>
          )}
          <p>
            <strong>Current performance priorities:</strong>{' '}
            {displayList(selectedAthlete.currentPerformancePriorities)}
          </p>
          <p>
            <strong>Technical strengths:</strong>{' '}
            {displayList(selectedAthlete.technicalStrengths)}
          </p>
          <p>
            <strong>Performance risks:</strong>{' '}
            {displayList(selectedAthlete.performanceRisks)}
          </p>
        </Card>

        <Card eyebrow="Athlete details" title="Training">
          <p>
            <strong>Current block:</strong>{' '}
            {selectedAthlete.currentBlock ?? 'Not recorded'}
          </p>
          <p>
            <strong>Block purpose:</strong>{' '}
            {selectedAthlete.blockPurpose ?? 'Not recorded'}
          </p>
          <p>
            <strong>Current training focus:</strong>{' '}
            {displayList(selectedAthlete.currentTrainingFocus)}
          </p>
          <p>
            <strong>Weekly pool-session target:</strong>{' '}
            {selectedAthlete.weeklyPoolSessionTarget ?? 'Not recorded'}
          </p>
          <p>
            <strong>Weekly gym-session target:</strong>{' '}
            {selectedAthlete.weeklyGymSessionTarget ?? 'Not recorded'}
          </p>
          <p>
            <strong>Recovery:</strong>{' '}
            {selectedAthlete.readiness?.recovery ?? 'Not recorded'}
          </p>
          <p>
            <strong>Soreness:</strong>{' '}
            {selectedAthlete.readiness?.soreness ?? 'Not recorded'}
          </p>
          <p>
            <strong>Motivation:</strong>{' '}
            {selectedAthlete.readiness?.motivation ?? 'Not recorded'}
          </p>
          <p>
            <strong>Sleep:</strong>{' '}
            {selectedAthlete.readiness?.sleep ?? 'Not recorded'}
          </p>
          <p>
            <strong>Readiness note:</strong>{' '}
            {selectedAthlete.readiness?.note ?? 'Not recorded'}
          </p>
        </Card>

        <Card eyebrow="Athlete details" title="Competition">
          <p>
            <strong>Next competition:</strong>{' '}
            {selectedAthlete.nextCompetition ?? 'Not recorded'}
          </p>
          <p>
            <strong>Main upcoming competition:</strong>{' '}
            {selectedAthlete.mainUpcomingCompetition ?? 'Not recorded'}
          </p>
          <p>
            <strong>Competition date:</strong>{' '}
            {selectedAthlete.competitionDate ?? 'Not recorded'}
          </p>
          <p>
            <strong>Target events:</strong>{' '}
            {displayList(selectedAthlete.targetEvents)}
          </p>
          <p>
            <strong>Competition priority:</strong>{' '}
            {selectedAthlete.competitionPriority ?? 'Not recorded'}
          </p>
        </Card>

        <Card eyebrow="Athlete details" title="Testing">
          {selectedAthlete.testing.length ? (
            selectedAthlete.testing.map((testResult) => (
              <div key={`${testResult.test}-${testResult.date}`}>
                <p><strong>Test name:</strong> {testResult.test}</p>
                <p><strong>Date:</strong> {testResult.date}</p>
                <p><strong>Result:</strong> {testResult.result}</p>
                <p>
                  <strong>Coach interpretation:</strong>{' '}
                  {testResult.coachInterpretation ?? 'Not recorded'}
                </p>
              </div>
            ))
          ) : (
            <p>Not recorded</p>
          )}
        </Card>

        <Card eyebrow="Athlete details" title="Coach">
          <p><strong>Coach notes</strong></p>
          {selectedAthlete.coachNotes.length ? (
            selectedAthlete.coachNotes.map((coachNote) => (
              <p key={`${coachNote.date}-${coachNote.note}`}>
                {coachNote.date}: {coachNote.note}
              </p>
            ))
          ) : (
            <p>Not recorded</p>
          )}
          <p>
            <strong>Current coaching priorities:</strong>{' '}
            {displayList(selectedAthlete.currentCoachingPriorities)}
          </p>
          <p>
            <strong>Recent observations:</strong>{' '}
            {displayList(selectedAthlete.recentObservations)}
          </p>
          <p><strong>Alerts:</strong> {displayList(selectedAthlete.alerts)}</p>
        </Card>

        <Card eyebrow="Athlete direction" title="Athlete Compass">
          {selectedAthlete.compass ? (
            <>
              <p>
                <strong>Current direction:</strong>{' '}
                {selectedAthlete.compass.currentDirection ?? 'Not recorded'}
              </p>

              <button type="button" onClick={() => setIsCompassOpen(true)}>
                Open Athlete Compass
              </button>

              {isCompassOpen && (
                <div id="athlete-compass-details">
                  <p>
                    <strong>Performance priorities:</strong>{' '}
                    {displayList(selectedAthlete.compass.performancePriorities)}
                  </p>
                  <p>
                    <strong>Constraints:</strong>{' '}
                    {displayList(selectedAthlete.compass.constraints)}
                  </p>
                  <p>
                    <strong>Key decisions:</strong>{' '}
                    {displayList(selectedAthlete.compass.keyDecisions)}
                  </p>
                  <p>
                    <strong>Evidence:</strong>{' '}
                    {displayList(selectedAthlete.compass.evidence)}
                  </p>
                  <p>
                    <strong>Review date:</strong>{' '}
                    {selectedAthlete.compass.reviewDate ?? 'Not recorded'}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p>Compass not yet established.</p>
              <button type="button" disabled>
                Open Athlete Compass
              </button>
            </>
          )}
        </Card>
      </section>
    </main>
  )
}

export default AthleteProfile
