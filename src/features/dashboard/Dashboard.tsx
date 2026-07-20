import { useState } from 'react'

import AthleteSelector from '../../components/AthleteSelector'
import Card from '../../components/Card'
import BlockTimeline from '../../components/BlockTimeline'

import { dashboardData } from '../../data/dashboard'
import { trainingBlock } from '../../data/trainingBlock'
function getDaysUntil(dateString: string) {
  const today = new Date()
  const target = new Date(dateString)

  const difference = target.getTime() - today.getTime()

  return Math.ceil(difference / (1000 * 60 * 60 * 24))
}

function Dashboard() {
  const [activeView, setActiveView] = useState<'glance' | 'depth'>('glance')

  return (
    <>
    <AthleteSelector />
    <main className="workspace">
      <div className="dashboard-toggle">
        <button
          className={activeView === 'glance' ? 'active' : ''}
          onClick={() => setActiveView('glance')}
        >
          At a Glance
        </button>

        <button
          className={activeView === 'depth' ? 'active' : ''}
          onClick={() => setActiveView('depth')}
        >
          In Depth
        </button>
      </div>

      {activeView === 'glance' ? (
        <section className="glance-layout">
          <div className="glance-main">
            <Card eyebrow="Coach attention" title="Alerts">
              <div className="alert-list">
                {dashboardData.alerts.map((alert) => (
                  <div className="alert-item" key={alert.athlete}>
                    <strong>{alert.athlete}</strong>
                    <span>{alert.concern}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card
              eyebrow="Current session"
              title={dashboardData.currentSession.title}
            >
              <p>{dashboardData.currentSession.objective}</p>

              <div className="session-summary">
                <div>
                  <span>Planned volume</span>
                  <strong>{dashboardData.currentSession.volume}</strong>
                </div>

                <div>
                  <span>Athletes expected</span>
                  <strong>
                    {dashboardData.currentSession.athletesExpected}
                  </strong>
                </div>
              </div>

              <div className="session-detail">
                <span>Key set</span>
                <strong>{dashboardData.currentSession.keySet}</strong>
              </div>

              <div className="coach-notes">
                <span>Coach notes</span>

                {dashboardData.currentSession.coachNotes.map((note) => (
                  <p key={note}>• {note}</p>
                ))}
              </div>
            </Card>
          </div>

          <div className="glance-side">
            <Card eyebrow="Training block" title={trainingBlock.name}>
              <BlockTimeline
                previousBlock={trainingBlock.previousBlock}
                currentBlock={trainingBlock.name}
                nextBlock={trainingBlock.nextBlock}
              />

              <p>
                Week {trainingBlock.phase.current} of{' '}
                {trainingBlock.phase.total}
              </p>

              <progress
                value={trainingBlock.phase.current}
                max={trainingBlock.phase.total}
              />

              <p>{trainingBlock.objective}</p>
            </Card>

            <div className="metric-card countdown-card">
              <p>{dashboardData.mainEvent.name}</p>
              <h3>{getDaysUntil(dashboardData.mainEvent.date)}</h3>
              <span>days to main event</span>
            </div>
          </div>
        </section>
      ) : (
        <section className="depth-layout">
          <Card eyebrow="Athlete monitoring" title="Squad Readiness">
            <div className="readiness-list">
              {dashboardData.readiness.map((athlete) => (
                <div className="readiness-item" key={athlete.athlete}>
                  <div>
                    <strong>{athlete.athlete}</strong>
                    <span>{athlete.note}</span>
                  </div>

                  <span
                    className={`readiness-status ${athlete.status.toLowerCase()}`}
                  >
                    {athlete.status}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card eyebrow="Weekly adherence" title="Session Completion">
            <div className="completion-list">
              {dashboardData.completion.map((athlete) => {
                const percentage = Math.round(
                  (athlete.completed / athlete.planned) * 100,
                )

                return (
                  <div className="completion-item" key={athlete.athlete}>
                    <div className="completion-heading">
                      <strong>{athlete.athlete}</strong>

                      <span>
                        {athlete.completed} of {athlete.planned}
                      </span>
                    </div>

                    <div className="completion-track">
                      <div
                        className="completion-fill"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    <span className="completion-percentage">
                      {percentage}%
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card eyebrow="Planning" title="Weekly View">
  <div className="weekly-session-list">
    {dashboardData.weeklySessions.map((session, index) => (
      <div
        className="weekly-session-item"
        key={`${session.day}-${session.time}-${index}`}
      >
        <div className="weekly-session-day">
          <strong>{session.day}</strong>
          <span>{session.time}</span>
        </div>

        <div className="weekly-session-detail">
          <strong>{session.title}</strong>
          <span>{session.volume}</span>
        </div>

        <span className="session-focus">{session.focus}</span>
      </div>
    ))}
  </div>
</Card>

          <Card eyebrow="Performance" title="Test Results">
            <p>Testing module coming soon.</p>
          </Card>

          <Card eyebrow="Block objectives" title="Target Sessions This Block">
            {trainingBlock.keySessions.map((session) => (
              <p key={session}>{session}</p>
            ))}
          </Card>
        </section>
      )}
    </main>
    </>
  )
}

export default Dashboard