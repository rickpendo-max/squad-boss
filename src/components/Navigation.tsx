type NavigationProps = {
  activeView: 'dashboard' | 'athlete-profile'
  onNavigate: (view: 'dashboard' | 'athlete-profile') => void
}

function Navigation({ activeView, onNavigate }: NavigationProps) {
  return (
    <aside className="sidebar">
      <nav>
        <button
          type="button"
          className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
          onClick={() => onNavigate('dashboard')}
        >
          Today
        </button>

        <button
          type="button"
          className={`nav-item ${activeView === 'athlete-profile' ? 'active' : ''}`}
          onClick={() => onNavigate('athlete-profile')}
        >
          Athlete Profile
        </button>

        <button type="button" className="nav-item">
          Athletes
        </button>

        <button type="button" className="nav-item">
          Plan
        </button>

        <button type="button" className="nav-item">
          Train
        </button>

        <button type="button" className="nav-item">
          Insights
        </button>
      </nav>
    </aside>
  )
}

export default Navigation
