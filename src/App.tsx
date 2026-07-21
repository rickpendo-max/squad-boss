import './App.css'

import { useState } from 'react'

import Header from './components/Header'
import Navigation from './components/Navigation'
import { useAthlete } from './context/useAthlete'
import AthleteProfile from './features/athlete/AthleteProfile'
import Dashboard from './features/dashboard/Dashboard'

function App() {
  const [activeView, setActiveView] = useState<
    'dashboard' | 'athlete-profile'
  >('dashboard')
  const { selectedAthlete } = useAthlete()
  const coachNotes = [...selectedAthlete.coachNotes].sort((a, b) =>
    b.date.localeCompare(a.date),
  )

  return (
    <div className="app-shell">
      <Header />

      <Navigation activeView={activeView} onNavigate={setActiveView} />

      {activeView === 'dashboard' ? <Dashboard /> : <AthleteProfile />}

      <aside className="context-panel">
        <section className="card">
          <h2>Notes</h2>
          {coachNotes.map((coachNote) => (
            <p key={`${coachNote.date}-${coachNote.note}`}>
              {coachNote.note}
            </p>
          ))}
        </section>

        <section className="card">
          <h2>Tasks</h2>
          <p>Review Thursday session</p>
          <p>Update athlete goal</p>
        </section>
      </aside>
    </div>
  )
}

export default App
