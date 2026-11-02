import { useRef, useState } from 'react'
import {
  MAX_ARCHIVE_BYTES,
  parseArchiveBackup,
  parseRipeArchive,
} from '../../data-sources/ripe-archive'
import { syntheticArchive } from '../../data/synthetic-archive'
import { coachingRepository } from '../../repositories/in-memory-coaching-repository'
import type { VerifiedArchiveExport } from '../../types/archive'

function downloadJson(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export default function ArchiveImportPanel({
  onChange,
}: {
  onChange: () => void
}) {
  const [input, setInput] = useState<VerifiedArchiveExport>()
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [coach, setCoach] = useState('')
  const [approved, setApproved] = useState(false)
  const [reason, setReason] = useState('')
  const [rollbackId, setRollbackId] = useState('')
  const [backup, setBackup] = useState('')
  const request = useRef(0)
  const rows = input ? coachingRepository.reviewArchive(input) : []
  const ready = rows.filter((r) => r.status === 'ready').length
  const state = coachingRepository.getArchiveState()

  async function readFile(file?: File) {
    const token = ++request.current
    setInput(undefined)
    setApproved(false)
    setError('')
    setNotice('')
    if (!file) return
    try {
      if (file.size > MAX_ARCHIVE_BYTES)
        throw new Error('Archive exceeds the 5 MiB limit.')
      const parsed = parseRipeArchive(await file.text())
      if (request.current !== token) return
      setFileName(file.name)
      setInput(parsed)
    } catch (e) {
      if (request.current === token)
        setError(e instanceof Error ? e.message : 'Unable to read archive.')
    }
  }

  function commit() {
    setError('')
    setNotice('')
    try {
      if (!input || !approved || !coach.trim())
        throw new Error(
          'Review the archive and enter the importing coach first.',
        )
      const batch = coachingRepository.importArchive(
        input,
        fileName,
        coach.trim(),
      )
      setApproved(false)
      setNotice(
        `Imported ${batch.review.filter((r) => r.status === 'ready').length} sessions. Other review rows were not imported. Batch ${batch.id}.`,
      )
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.')
    }
  }

  function rollback() {
    try {
      coachingRepository.rollbackArchiveBatch(rollbackId, reason, coach)
      setRollbackId('')
      setReason('')
      setNotice(
        'Batch rolled back. Source evidence and audit history retained; derived results removed from active views.',
      )
      onChange()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rollback failed.')
    }
  }

  return (
    <details className="ripe-import">
      <summary>Verified session archive · Import & audit</summary>
      <div className="ripe-import-content">
        <p>
          Local review only. Only coach-verified sessions with known athlete IDs
          can enter confirmed records. No files are sent to a server.
        </p>
        <p className="ripe-muted">
          Bridge v0.2 field compatibility is pending a redacted schema/export.
          This importer validates the documented application contract. Source
          checksums are retained claims; original files are not available here
          to authenticate them.
        </p>
        <label className="ripe-field">
          Ripe export JSON (maximum 5 MiB)
          <input
            type="file"
            accept=".json,application/json"
            onChange={(e) => void readFile(e.target.files?.[0])}
          />
        </label>
        <div className="ripe-actions">
          <button
            type="button"
            onClick={() => {
              request.current++
              setInput(structuredClone(syntheticArchive))
              setFileName('synthetic-demo.json')
              setApproved(false)
              setNotice(
                'Synthetic data only. Select Demo Athlete to view it after import.',
              )
              setError('')
            }}
          >
            Review synthetic demonstration
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              downloadJson('ripe-archive-backup.json', {
                format: 'ripe-archive-backup-v1',
                exportedAt: new Date().toISOString(),
                archive: state,
              })
            }
          >
            Download archive backup
          </button>
        </div>
        <label className="ripe-field">
          Importing coach (audit label)
          <input
            value={coach}
            onChange={(e) => {
              setCoach(e.target.value)
              setApproved(false)
            }}
            maxLength={200}
          />
        </label>
        <small>
          This label records your action; it is not authenticated access
          control. Use a trusted local browser profile.
        </small>
        {input && (
          <>
            <p>
              <strong>{fileName}</strong> · Archive {input.archiveId} · {ready}{' '}
              ready of {rows.length}
            </p>
            <div className="comparison-table-wrap">
              <table className="comparison-table">
                <caption>
                  Import review — only ready sessions will be imported
                </caption>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Decision</th>
                    <th>Finding</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>
                        {r.title}
                        <br />
                        <small>{r.sessionId}</small>
                      </td>
                      <td>
                        <span className={`ripe-badge ${r.status}`}>
                          {r.status}
                        </span>
                      </td>
                      <td>{r.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details>
              <summary>Inspect source values and verification</summary>
              <pre className="ripe-source">
                {JSON.stringify(input, null, 2)}
              </pre>
            </details>
            <label className="ripe-check">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              I have reviewed the ready sessions, stable athlete IDs and
              verification provenance.
            </label>
            <button
              type="button"
              disabled={!ready || !approved || !coach.trim()}
              onClick={commit}
            >
              Import {ready} ready sessions
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        <h3>Import audit</h3>
        {state.recovery && (
          <p>
            Archive restored {state.recovery.restoredAt} by{' '}
            {state.recovery.restoredBy}.
          </p>
        )}
        {!state.batches.length && <p>No session import batches recorded.</p>}
        {state.batches.toReversed().map((b) => (
          <article key={b.id} className="ripe-audit">
            <strong>
              {b.fileName} · {b.status}
            </strong>
            <p>
              {b.importedAt} · {b.importedBy} ·{' '}
              {b.review.filter((r) => r.status === 'ready').length} sessions
            </p>
            <details>
              <summary>Batch provenance and review report</summary>
              <pre className="ripe-source">{JSON.stringify(b, null, 2)}</pre>
            </details>
            {b.rollback && (
              <p>
                Rollback: {b.rollback.reason} · {b.rollback.by} ·{' '}
                {b.rollback.at}
              </p>
            )}
            {b.status === 'active' && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setRollbackId(b.id)
                  setReason('')
                  setError('')
                }}
              >
                Review rollback of {b.fileName}
              </button>
            )}
          </article>
        ))}
        {rollbackId && (
          <div className="ripe-audit">
            <p>
              Rollback removes this batch from active training totals and
              performance comparisons. The original imported evidence and audit
              trail remain. Other records are preserved.
            </p>
            <label className="ripe-field">
              Rollback reason
              <input
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="ripe-actions">
              <button
                type="button"
                disabled={!reason.trim() || !coach.trim()}
                onClick={rollback}
              >
                Confirm batch rollback
              </button>
              <button type="button" onClick={() => setRollbackId('')}>
                Cancel rollback
              </button>
            </div>
          </div>
        )}
        <details>
          <summary>Recover an archive backup</summary>
          <p>
            Restore is available only when the archive has no batches. Existing
            athlete, competition and coaching records are preserved. Backups
            contain private data: keep them in a protected local folder.
          </p>
          <label className="ripe-field">
            Archive backup JSON
            <input
              type="file"
              accept=".json,application/json"
              disabled={Boolean(state.batches.length)}
              onChange={(e) => {
                const file = e.target.files?.[0]
                setBackup('')
                setError('')
                if (!file) return
                if (file.size > 30 * 1024 * 1024) {
                  setError('Backup exceeds 30 MiB.')
                  return
                }
                void file
                  .text()
                  .then((text) => {
                    const parsed = parseArchiveBackup(
                      text,
                      coachingRepository.listAthletes().map((a) => a.id),
                    )
                    setBackup(text)
                    setNotice(
                      `Backup validated: ${parsed.batches.length} batches, ${parsed.sessions.length} retained sessions. Ready to restore into this empty archive.`,
                    )
                  })
                  .catch((e) =>
                    setError(
                      e instanceof Error ? e.message : 'Invalid backup.',
                    ),
                  )
              }}
            />
          </label>
          <button
            type="button"
            disabled={!backup || !coach.trim() || Boolean(state.batches.length)}
            onClick={() => {
              try {
                coachingRepository.restoreArchiveBackup(backup, coach)
                setBackup('')
                setNotice('Archive backup restored.')
                onChange()
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Recovery failed.')
              }
            }}
          >
            Restore validated backup
          </button>
        </details>
      </div>
    </details>
  )
}
