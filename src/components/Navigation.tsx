function Navigation() {
  return (
    <aside className="sidebar">
      <nav>
        <button type="button" className="nav-item active">
          Today
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