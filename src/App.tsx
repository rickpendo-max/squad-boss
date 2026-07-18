import './App.css'

function App() {
  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">Squad Boss</div>
        <div className="top-actions">
          <button type="button">Search</button>
          <button type="button">Profile</button>
        </div>
      </header>

      <aside className="sidebar">
        <nav>
          <button type="button" className="nav-item active">Today</button>
          <button type="button" className="nav-item">Athletes</button>
          <button type="button" className="nav-item">Plan</button>
          <button type="button" className="nav-item">Train</button>
          <button type="button" className="nav-item">Insights</button>
        </nav>
      </aside>

      <main className="workspace">
        <section className="workspace-header">
          <p className="eyebrow">Athlete Workspace</p>
          <h1>Sam Gould</h1>
          <p>200 Freestyle · Senior Squad · Capacity Block</p>
        </section>

        <section className="workspace-grid">
          <article className="card">
            <h2>Current Priorities</h2>
            <p>Back-end speed</p>
            <p>200m race pacing</p>
            <p>Aerobic power progression</p>
          </article>

          <article className="card">
            <h2>Performance Snapshot</h2>
            <p>Personal best: 2:00.10</p>
            <p>Attendance: 96%</p>
            <p>Latest test: Improved</p>
          </article>

          <article className="card full-width">
            <h2>Next Decision</h2>
            <p>
              Increase back-end race pace exposure this week based on recent
              testing and race review.
            </p>
          </article>
        </section>
      </main>

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
