import { useRef, useState } from 'react'
import {
  MAX_ARCHIVE_BYTES,
  parseArchiveBackup,
  parseRipeArchive,
} from '../../data-sources/ripe-archive'
import { adaptBridgeV02 } from '../../data-sources/ripe-bridge-v02-adapter'
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
  const [bridge, setBridge] = useState<Record<string, unknown> | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [sessionTimes, setSessionTimes] = useState<Record<string, string>>({})
  const [attestationTime, setAttestationTime] = useState('')
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
  const athletes = coachingRepository.listAthletes()
  const bridgeEntries =
    bridge && Array.isArray(bridge.sessions)
      ? bridge.sessions.filter(
          (e): e is Record<string, unknown> =>
            e !== null && typeof e === 'object' && !Array.isArray(e),
        )
      : []
  const bridgeNames = [
    ...new Set(
      bridgeEntries.flatMap((entry) => {
        const r = entry.record as Record<string, unknown> | undefined
        if (!r || typeof r !== 'object') return []
        const names: string[] = []
        for (const field of ['distance_m', 'athlete_distances_m', 'absent']) {
          const v = r[field]
          if (v && typeof v === 'object' && !Array.isArray(v))
            names.push(...Object.keys(v))
        }
        if (Array.isArray(r.present))
          names.push(
            ...r.present.filter((v): v is string => typeof v === 'string'),
          )
        return names
      }),
    ),
  ]

  async function readFile(file?: File) {
    const token = ++request.current
    setInput(undefined)
    setBridge(null)
    setApproved(false)
    setError('')
    setNotice('')
    if (!file) return
    try {
      if (file.size > MAX_ARCHIVE_BYTES)
        throw new Error('Archive exceeds the 5 MiB limit.')
      const contents = await file.text()
      const value: unknown = JSON.parse(contents)
      if (request.current !== token) return
      setFileName(file.name)
      if (
        value &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        'schema' in value &&
        value.schema === 'ripe-verified-archive-v1' &&
        'sessions' in value &&
        Array.isArray(value.sessions)
      ) {
        setBridge(value as Record<string, unknown>)
        setMapping({})
        setSessionTimes({})
        setAttestationTime('')
      } else {
        setInput(parseRipeArchive(contents))
      }
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
          Bridge v0.2 files require explicit local athlete matching and
          session-time confirmation. Source checksums are retained claims;
          original files are not available here to authenticate them.
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
              setBridge(null)
              setMapping({})
              setSessionTimes({})
              setAttestationTime('')
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
              if (bridge) setInput(undefined)
            }}
            maxLength={200}
          />
        </label>
        <small>
          This label records your action; it is not authenticated access
          control. Use a trusted local browser profile.
        </small>
        {bridge && (
          <section className="ripe-audit">
            <h3>Bridge v0.2 · Private reconciliation</h3>
            <p>
              Original source paths are not displayed or transferred. Confirm
              each source athlete and each session's actual start time. No data
              is imported until the converted export passes review.
            </p>
            {bridgeNames.map((name) => (
              <label className="ripe-field" key={name}>
                Source athlete: {name}
                <select
                  value={mapping[name] ?? ''}
                  onChange={(e) => {
                    setMapping((old) => ({ ...old, [name]: e.target.value }))
                    setInput(undefined)
                    setApproved(false)
                  }}
                >
                  <option value="">Select verified athlete identity</option>
                  {athletes.map((athlete) => (
                    <option key={athlete.id} value={athlete.id}>
                      {athlete.fullName ??
                        `${athlete.firstName} ${athlete.lastName}`}{' '}
                      · {athlete.id}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {bridgeEntries.map((entry, index) => (
              <label className="ripe-field" key={index}>
                Confirmed session {String(entry.archive_id)} start (ISO 8601
                with offset, e.g. 2026-10-29T06:00:00+10:00)
                <input
                  value={sessionTimes[String(entry.archive_id)] ?? ''}
                  onChange={(e) => {
                    setSessionTimes((old) => ({
                      ...old,
                      [String(entry.archive_id)]: e.target.value,
                    }))
                    setInput(undefined)
                    setApproved(false)
                  }}
                  placeholder="YYYY-MM-DDTHH:mm:ss+10:00"
                />
              </label>
            ))}
            <label className="ripe-field">
              Coach attestation time (ISO 8601 with offset)
              <input
                value={attestationTime}
                onChange={(e) => {
                  setAttestationTime(e.target.value)
                  setInput(undefined)
                  setApproved(false)
                }}
                placeholder="YYYY-MM-DDTHH:mm:ss+10:00"
              />
            </label>
            <button
              type="button"
              disabled={!coach.trim()}
              onClick={() => {
                setInput(undefined)
                setApproved(false)
                setNotice('')
                try {
                  const converted = adaptBridgeV02(bridge, {
                    archiveId: 'ripe-bridge-v02',
                    athleteIdsBySourceName: mapping,
                    startsAtBySessionId: sessionTimes,
                    attestedBy: coach.trim(),
                    attestedAt: attestationTime,
                  })
                  setInput(parseRipeArchive(JSON.stringify(converted)))
                  setApproved(false)
                  setError('')
                  setNotice(
                    'Converted for review. Original Bridge file remains unchanged.',
                  )
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : 'Bridge conversion failed.',
                  )
                }
              }}
            >
              Validate Bridge export for review
            </button>
          </section>
        )}
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
