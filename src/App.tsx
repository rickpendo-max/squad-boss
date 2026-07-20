import './App.css'

import Header from './components/Header'
import Navigation from './components/Navigation'
import Dashboard from './features/dashboard/Dashboard'

function App() {
  return (
    <div className="app-shell">
      <Header />

      <Navigation />

      <Dashboard />

      <aside className="context-panel">
        <section className="card">
          <h2>Notes</h2>
          <p>Latest coach observations appear here.</p>
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
