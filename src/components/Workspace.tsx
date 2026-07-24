import { useState } from 'react'
import { coachingRepository } from '../repositories/in-memory-coaching-repository'

const athletes = coachingRepository.listAthletes()

function Workspace() {
  const [selectedAthlete, setSelectedAthlete] = useState(1)

  const athlete = athletes[selectedAthlete]

  return (
    <main className="workspace">
      <div className="athlete-selector">
        <button
          onClick={() => setSelectedAthlete(0)}
          disabled={selectedAthlete === 0}
        >
          Maddie
        </button>

        <button
          onClick={() => setSelectedAthlete(1)}
          disabled={selectedAthlete === 1}
        >
          Sam
        </button>
      </div>

      <section className="athlete-summary card">
        <div>
          <p className="eyebrow">Athlete workspace</p>
          <h2>
            {athlete.firstName} {athlete.lastName}
          </h2>
          <p>Primary event: {athlete.primaryEvents[0]}</p>
        </div>

        <div className="athlete-status">
          <span className="status-badge">In training</span>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="card metric-card">
          <p className="eyebrow">Current block</p>
          <h3>{athlete.currentBlock ?? 'Not set'}</h3>
          <p>Current training phase</p>
        </div>

        <div className="card metric-card">
          <p className="eyebrow">Primary focus</p>
          <h3>{athlete.primaryEvents.join(', ')}</h3>
          <p>Primary event development</p>
        </div>

        <div className="card metric-card">
          <p className="eyebrow">Readiness</p>
          <h3>
            {athlete.readiness?.recovery !== undefined
              ? `${athlete.readiness.recovery}/10`
              : 'Not recorded'}
          </h3>
          <p>{athlete.readiness?.note ?? 'No current restrictions'}</p>
        </div>
      </section>
    </main>
  )
}

export default Workspace
