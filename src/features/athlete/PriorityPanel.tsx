import { useState } from 'react'
import type { FormEvent } from 'react'

import Card from '../../components/Card'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import {
  priorityCategories,
  type PriorityCategory,
} from '../../types/coaching'

const CURRENT_COACH_ID = 'local-coach'

type PriorityForm = {
  interpretationIds: string[]
  focus: string
  rationale: string
  category: PriorityCategory | ''
  rank: number | ''
  reviewAt: string
}

const initialForm: PriorityForm = {
  interpretationIds: [],
  focus: '',
  rationale: '',
  category: '',
  rank: '',
  reviewAt: '',
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString()
}

function PriorityPanel({ athleteId }: { athleteId: string }) {
  const [renderedAt] = useState(() => Date.now())
  const [priorities, setPriorities] = useState(() =>
    coachingRepository
      .getPrioritiesByAthleteId(athleteId)
      .filter((priority) => priority.status === 'active'),
  )
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState('')
  const interpretations =
    coachingRepository.getInterpretationsByAthleteId(athleteId)
  const interpretationsById = new Map(
    interpretations.map((interpretation) => [
      interpretation.id,
      interpretation,
    ]),
  )
  const maximumReached = priorities.length >= 3

  function clearForm() {
    setForm(initialForm)
    setError('')
  }

  function refreshPriorities() {
    setPriorities(
      coachingRepository
        .getPrioritiesByAthleteId(athleteId)
        .filter((priority) => priority.status === 'active'),
    )
  }

  function toggleInterpretation(interpretationId: string) {
    setForm((current) => ({
      ...current,
      interpretationIds: current.interpretationIds.includes(interpretationId)
        ? current.interpretationIds.filter((id) => id !== interpretationId)
        : [...current.interpretationIds, interpretationId],
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      form.interpretationIds.length === 0 ||
      !form.focus.trim() ||
      !form.rationale.trim() ||
      !form.category ||
      !form.rank ||
      !form.reviewAt
    ) {
      setError('All Priority fields and a supporting Interpretation are required.')
      return
    }

    try {
      coachingRepository.createPriority({
        athleteId,
        interpretationIds: form.interpretationIds,
        focus: form.focus.trim(),
        rationale: form.rationale.trim(),
        category: form.category,
        rank: form.rank,
        reviewAt: form.reviewAt,
        createdBy: CURRENT_COACH_ID,
      })

      refreshPriorities()
      clearForm()
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'The Priority could not be saved.',
      )
    }
  }

  return (
    <Card eyebrow="Coach workflow" title="Priorities">
      <section className="observation-section">
        <h3>Active Priorities</h3>

        {priorities.length ? (
          <div className="observation-history">
            {priorities.map((priority) => {
              const isOverdue = Date.parse(priority.reviewAt) < renderedAt

              return (
                <article className="observation-record" key={priority.id}>
                  <div className="priority-heading">
                    <span className="priority-rank">Rank {priority.rank}</span>
                    <h4>{priority.focus}</h4>
                  </div>

                  <dl>
                    <div>
                      <dt>Category</dt>
                      <dd>{priority.category}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{priority.status}</dd>
                    </div>
                    <div>
                      <dt>Review date</dt>
                      <dd>
                        {displayDate(priority.reviewAt)}
                        {isOverdue && (
                          <span className="overdue-indicator"> Overdue</span>
                        )}
                      </dd>
                    </div>
                  </dl>

                  <p>{priority.rationale}</p>

                  <h4>Supporting Interpretations</h4>
                  <ul className="supporting-observations">
                    {priority.interpretationIds.map((interpretationId) => {
                      const interpretation =
                        interpretationsById.get(interpretationId)

                      return interpretation ? (
                        <li key={interpretationId}>
                          <strong>
                            {displayDate(interpretation.createdAt)}
                          </strong>
                          {' · '}
                          {interpretation.summary}
                          {' · Confidence '}
                          {interpretation.confidence}/5
                        </li>
                      ) : null
                    })}
                  </ul>
                </article>
              )
            })}
          </div>
        ) : (
          <p>No active Priorities recorded.</p>
        )}
      </section>

      <section className="observation-section">
        <h3>New Priority</h3>

        {maximumReached && (
          <p className="form-notice">
            The maximum of three active Priorities has been reached.
          </p>
        )}

        {!interpretations.length && (
          <p>Create an Interpretation before adding a Priority.</p>
        )}

        <form className="observation-form" onSubmit={handleSubmit}>
          <fieldset
            className="priority-form-fields"
            disabled={maximumReached}
          >
            <fieldset className="observation-options">
              <legend>Supporting Interpretations</legend>

              {interpretations.map((interpretation) => (
                <label key={interpretation.id}>
                  <input
                    checked={form.interpretationIds.includes(interpretation.id)}
                    type="checkbox"
                    onChange={() => toggleInterpretation(interpretation.id)}
                  />
                  <span>
                    <strong>{displayDate(interpretation.createdAt)}</strong>
                    {' · Confidence '}
                    {interpretation.confidence}/5
                    <br />
                    {interpretation.summary}
                  </span>
                </label>
              ))}
            </fieldset>

            <label>
              Focus
              <input
                required
                value={form.focus}
                onChange={(event) =>
                  setForm({ ...form, focus: event.target.value })
                }
              />
            </label>

            <label>
              Rationale
              <textarea
                required
                value={form.rationale}
                onChange={(event) =>
                  setForm({ ...form, rationale: event.target.value })
                }
              />
            </label>

            <label>
              Category
              <select
                required
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value as PriorityCategory | '',
                  })
                }
              >
                <option value="">Select category</option>
                {priorityCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rank
              <select
                required
                value={form.rank}
                onChange={(event) =>
                  setForm({
                    ...form,
                    rank: event.target.value
                      ? Number(event.target.value)
                      : '',
                  })
                }
              >
                <option value="">Select rank</option>
                <option value="1">1 — highest</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </label>

            <label>
              Review date
              <input
                required
                type="date"
                value={form.reviewAt}
                onChange={(event) =>
                  setForm({ ...form, reviewAt: event.target.value })
                }
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <div className="form-actions">
              <button type="submit">Save Priority</button>
              <button
                className="secondary-button"
                type="button"
                onClick={clearForm}
              >
                Clear
              </button>
            </div>
          </fieldset>
        </form>
      </section>
    </Card>
  )
}

export default PriorityPanel
