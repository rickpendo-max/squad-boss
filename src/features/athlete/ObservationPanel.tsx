import { useReducer, useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type {
  ObservationContextType,
  ObservationSourceType,
} from '../../types/coaching'

// Authentication is out of scope for this prototype stage.
const CURRENT_COACH_ID = 'local-coach'

type ObservationForm = {
  sourceType: ObservationSourceType | ''
  contextType: ObservationContextType | ''
  occurredAt: string
  summary: string
}

const initialForm: ObservationForm = {
  sourceType: '',
  contextType: '',
  occurredAt: '',
  summary: '',
}

function displayDate(value: string) {
  return new Date(value).toLocaleString()
}

function ObservationPanel({ athleteId }: { athleteId: string }) {
  const [, refreshHistory] = useReducer((version: number) => version + 1, 0)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const observations =
    coachingRepository.listObservationsForAthlete(athleteId)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !form.sourceType ||
      !form.contextType ||
      !form.occurredAt ||
      !form.summary.trim()
    ) {
      setError('Source, context, occurred date and summary are required.')
      return
    }

    coachingRepository.createObservation({
      athleteId,
      sourceType: form.sourceType,
      contextType: form.contextType,
      occurredAt: new Date(form.occurredAt).toISOString(),
      summary: form.summary.trim(),
      createdBy: CURRENT_COACH_ID,
    })

    setForm(initialForm)
    setError('')
    refreshHistory()
  }

  return (
    <Card eyebrow="Coach workflow" title="Observations">
      <section className="observation-section">
        <h3>Observation History</h3>

        {observations.length ? (
          <div className="observation-history">
            {observations.map((observation) => (
              <article className="observation-record" key={observation.id}>
                <dl>
                  <div>
                    <dt>Occurred</dt>
                    <dd>{displayDate(observation.occurredAt)}</dd>
                  </div>
                  <div>
                    <dt>Created</dt>
                    <dd>{displayDate(observation.createdAt)}</dd>
                  </div>
                  <div>
                    <dt>Source</dt>
                    <dd>{observation.sourceType}</dd>
                  </div>
                  <div>
                    <dt>Context</dt>
                    <dd>{observation.contextType}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{observation.status}</dd>
                  </div>
                </dl>
                <p>{observation.summary}</p>
              </article>
            ))}
          </div>
        ) : (
          <p>No observations recorded.</p>
        )}
      </section>

      <section className="observation-section">
        <h3>New Observation</h3>

        <form className="observation-form" onSubmit={handleSubmit}>
          <label>
            Source type
            <select
              required
              value={form.sourceType}
              onChange={(event) =>
                setForm({
                  ...form,
                  sourceType: event.target.value as
                    | ObservationSourceType
                    | '',
                })
              }
            >
              <option value="">Select source</option>
              <option value="coach">Coach</option>
              <option value="athlete">Athlete</option>
              <option value="test">Test</option>
              <option value="training">Training</option>
              <option value="competition">Competition</option>
            </select>
          </label>

          <label>
            Context type
            <select
              required
              value={form.contextType}
              onChange={(event) =>
                setForm({
                  ...form,
                  contextType: event.target.value as
                    | ObservationContextType
                    | '',
                })
              }
            >
              <option value="">Select context</option>
              <option value="general">General</option>
              <option value="training">Training</option>
              <option value="competition">Competition</option>
              <option value="testing">Testing</option>
              <option value="wellbeing">Wellbeing</option>
            </select>
          </label>

          <label>
            Occurred at
            <input
              required
              type="datetime-local"
              value={form.occurredAt}
              onChange={(event) =>
                setForm({ ...form, occurredAt: event.target.value })
              }
            />
          </label>

          <label>
            Summary
            <textarea
              required
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
            />
          </label>

          {error && <p className="form-error">{error}</p>}

          <button type="submit">Save Observation</button>
        </form>
      </section>
    </Card>
  )
}

export default ObservationPanel
