import { useReducer, useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type { Confidence } from '../../types/coaching'

const CURRENT_COACH_ID = 'local-coach'

type InterpretationForm = {
  observationIds: string[]
  summary: string
  confidence: Confidence | ''
}

const initialForm: InterpretationForm = {
  observationIds: [],
  summary: '',
  confidence: '',
}

function displayDate(value: string) {
  return new Date(value).toLocaleString()
}

function InterpretationPanel({ athleteId }: { athleteId: string }) {
  const [, refreshHistory] = useReducer((version: number) => version + 1, 0)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const observations =
    coachingRepository.listObservationsForAthlete(athleteId)
  const interpretations =
    coachingRepository.getInterpretationsByAthleteId(athleteId)
  const observationsById = new Map(
    observations.map((observation) => [observation.id, observation]),
  )

  function clearForm() {
    setForm(initialForm)
    setError('')
  }

  function toggleObservation(observationId: string) {
    setForm((current) => ({
      ...current,
      observationIds: current.observationIds.includes(observationId)
        ? current.observationIds.filter((id) => id !== observationId)
        : [...current.observationIds, observationId],
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      form.observationIds.length === 0 ||
      !form.summary.trim() ||
      !form.confidence
    ) {
      setError(
        'Select at least one Observation and provide a summary and confidence.',
      )
      return
    }

    try {
      coachingRepository.createInterpretation({
        athleteId,
        observationIds: form.observationIds,
        summary: form.summary.trim(),
        confidence: form.confidence,
        createdBy: CURRENT_COACH_ID,
      })

      clearForm()
      refreshHistory()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The Interpretation could not be saved.',
      )
    }
  }

  return (
    <Card eyebrow="Coach workflow" title="Interpretations">
      <section className="observation-section">
        <h3>Interpretation History</h3>

        {interpretations.length ? (
          <div className="observation-history">
            {interpretations.map((interpretation) => (
              <article className="observation-record" key={interpretation.id}>
                <dl>
                  <div>
                    <dt>Created</dt>
                    <dd>{displayDate(interpretation.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{interpretation.status}</dd>
                  </div>
                  <div>
                    <dt>Confidence</dt>
                    <dd>{interpretation.confidence} / 5</dd>
                  </div>
                </dl>

                <p>{interpretation.summary}</p>

                <h4>Supporting Observations</h4>
                <ul className="supporting-observations">
                  {interpretation.observationIds.map((observationId) => {
                    const observation = observationsById.get(observationId)

                    return observation ? (
                      <li key={observationId}>
                        <strong>{displayDate(observation.occurredAt)}</strong>
                        {' · '}
                        {observation.contextType}
                        {' · '}
                        {observation.summary}
                      </li>
                    ) : null
                  })}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <p>No interpretations recorded.</p>
        )}
      </section>

      <section className="observation-section">
        <h3>New Interpretation</h3>

        <form className="observation-form" onSubmit={handleSubmit}>
          <fieldset className="observation-options">
            <legend>Supporting Observations</legend>

            {observations.length ? (
              observations.map((observation) => (
                <label key={observation.id}>
                  <input
                    checked={form.observationIds.includes(observation.id)}
                    type="checkbox"
                    onChange={() => toggleObservation(observation.id)}
                  />
                  <span>
                    <strong>{displayDate(observation.occurredAt)}</strong>
                    {' · '}
                    {observation.contextType}
                    <br />
                    {observation.summary}
                  </span>
                </label>
              ))
            ) : (
              <p>Create an Observation before adding an Interpretation.</p>
            )}
          </fieldset>

          <label>
            Interpretation summary
            <textarea
              required
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
            />
          </label>

          <label>
            Confidence
            <select
              required
              value={form.confidence}
              onChange={(event) =>
                setForm({
                  ...form,
                  confidence: event.target.value
                    ? (Number(event.target.value) as Confidence)
                    : '',
                })
              }
            >
              <option value="">Select confidence</option>
              <option value="1">1 — very low</option>
              <option value="2">2 — low</option>
              <option value="3">3 — moderate</option>
              <option value="4">4 — high</option>
              <option value="5">5 — very high</option>
            </select>
          </label>

          {error && <p className="form-error">{error}</p>}

          <div className="form-actions">
            <button type="submit">Save Interpretation</button>
            <button className="secondary-button" type="button" onClick={clearForm}>
              Clear
            </button>
          </div>
        </form>
      </section>
    </Card>
  )
}

export default InterpretationPanel
