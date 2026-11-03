import { confirmDiscardChanges } from '../domain/unsaved-changes'

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
          onClick={() => { if (activeView !== 'dashboard' && confirmDiscardChanges()) onNavigate('dashboard') }}
        >
          Squad overview
        </button>

        <button
          type="button"
          className={`nav-item ${activeView === 'athlete-profile' ? 'active' : ''}`}
          onClick={() => { if (activeView !== 'athlete-profile' && confirmDiscardChanges()) onNavigate('athlete-profile') }}
        >
          Athlete workspace
        </button>

        <p className="ripe-nav-note">Capture → Compare → Track<br />Highlight → Decide → Review</p>
      </nav>
    </aside>
  )
}

export default Navigation
