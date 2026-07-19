import { useState } from 'react'
import { athletes } from '../data/athletes'

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
          <h2>{athlete.name}</h2>
          <p>Primary event: {athlete.event}</p>
        </div>

        <div className="athlete-status">
          <span className="status-badge">In training</span>
        </div>
      </section>

      <section className="metrics-grid">
        <div className="card metric-card">
          <p className="eyebrow">Today’s volume</p>
          <h3>{athlete.volume}</h3>
          <p>Planned pool distance</p>
        </div>

        <div className="card metric-card">
          <p className="eyebrow">Primary focus</p>
          <h3>{athlete.focus}</h3>
          <p>200m freestyle development</p>
        </div>

        <div className="card metric-card">
          <p className="eyebrow">Readiness</p>
          <h3>{athlete.readiness}</h3>
          <p>No current restrictions</p>
        </div>
      </section>
    </main>
  )
}

export default Workspace