import { useAthlete } from '../context/useAthlete'

export default function AthleteSelector() {
  const {
    athletes,
    selectedAthlete,
    setSelectedAthlete,
  } = useAthlete()

  return (
    <section className="card">
      <h2>Current Athlete</h2>

      <select
        aria-label="Current athlete"
        value={selectedAthlete.id}
        onChange={(event) => {
          const athlete = athletes.find(
            (a) => a.id === event.target.value
          )

          if (athlete) {
            setSelectedAthlete(athlete)
          }
        }}
      >
        {athletes.map((athlete) => (
          <option
            key={athlete.id}
            value={athlete.id}
          >
            {athlete.firstName} {athlete.lastName}
          </option>
        ))}
      </select>

      <p>
        <strong>Status:</strong> {selectedAthlete.status}
      </p>

      <p>
        <strong>Current Block:</strong> {selectedAthlete.currentBlock ?? 'Not recorded'}
      </p>
    </section>
  )
}
