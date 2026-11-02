import { canonical, MAX_ARCHIVE_BYTES } from './ripe-archive.ts'

export interface ReadOnlySourceFile {
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface LocalJsonFile {
  name: string
  size: number
  text(): Promise<string>
}

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function bridgeEntries(raw: unknown): Record<string, unknown>[] {
  if (
    !object(raw) ||
    raw.schema !== 'ripe-verified-archive-v1' ||
    !Array.isArray(raw.sessions) ||
    !raw.sessions.length ||
    raw.sessions.length > 1000
  )
    throw new Error('Invalid Bridge session envelope.')
  return raw.sessions.map((entry) => {
    if (
      !object(entry) ||
      !object(entry.record) ||
      typeof entry.archive_id !== 'string' ||
      typeof entry.source_sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(entry.source_sha256)
    )
      throw new Error('Invalid Bridge source identity or checksum.')
    return entry
  })
}

export function bridgeSourceNames(raw: unknown) {
  return [
    ...new Set(
      bridgeEntries(raw).flatMap((entry) => {
        const record = entry.record as Record<string, unknown>
        const names: string[] = []
        for (const field of ['distance_m', 'athlete_distances_m', 'absent'])
          if (object(record[field])) names.push(...Object.keys(record[field]))
        if (Array.isArray(record.present))
          names.push(
            ...record.present.filter(
              (name): name is string => typeof name === 'string',
            ),
          )
        if (Array.isArray(record.timed_results))
          names.push(
            ...record.timed_results.flatMap((row) =>
              object(row) && typeof row.athlete_name === 'string'
                ? [row.athlete_name]
                : [],
            ),
          )
        return names
      }),
    ),
  ]
}

/** Browser File objects are read only; no directory handle or source path is stored. */
export async function verifyBridgeSourceFiles(
  raw: unknown,
  files: ReadOnlySourceFile[],
) {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      'Source checksum verification requires HTTPS or localhost (Web Crypto).',
    )
  const entries = bridgeEntries(raw)
  if (!files.length)
    throw new Error(
      'Select the original source JSON files to verify source checksums before importing.',
    )
  if (
    files.length > 1000 ||
    files.some((f) => f.size > 25 * 1024 * 1024) ||
    files.reduce((n, f) => n + f.size, 0) > 128 * 1024 * 1024
  )
    throw new Error(
      'Source selection exceeds the limit: 1000 files, 25 MiB each, 128 MiB total.',
    )
  const sources = new Map<string, unknown>()
  let bytesRead = 0
  for (const file of files) {
    const bytes = await file.arrayBuffer()
    bytesRead += bytes.byteLength
    if (bytes.byteLength > 25 * 1024 * 1024 || bytesRead > 128 * 1024 * 1024)
      throw new Error('Actual source bytes exceed the allowed size.')
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      (n) => n.toString(16).padStart(2, '0'),
    ).join('')
    if (entries.some((e) => e.source_sha256 === digest)) {
      try {
        sources.set(
          digest,
          JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
        )
      } catch {
        throw new Error(
          'A matching source is not UTF-8 JSON. Its extraction contract needs verification before import.',
        )
      }
    }
  }
  const checks = []
  for (const entry of entries) {
    const digest = entry.source_sha256 as string
    if (!sources.has(digest))
      throw new Error(
        `Source checksum did not match a selected file for session ${entry.archive_id}. No import was saved.`,
      )
    if (canonical(sources.get(digest)) !== canonical(entry.record))
      throw new Error(
        `Exported record differs from the checksum-verified JSON source for session ${entry.archive_id}. Verify the Bridge extraction contract.`,
      )
    checks.push({
      checksum: `sha256:${digest}`,
      method: 'sha256-selected-json' as const,
      checkedAt: new Date().toISOString(),
    })
  }
  return checks
}

/** Read only recognized exports; JSON index/settings files are reported as skipped. */
export async function discoverLocalExports(files: LocalJsonFile[]) {
  if (files.length > 1000)
    throw new Error('Select a folder containing at most 1000 files.')
  const exports: { name: string; contents: string; exportedAt: string }[] = []
  let skipped = 0
  let total = 0
  for (const file of files) {
    if (
      !file.name.toLowerCase().endsWith('.json') ||
      file.size > MAX_ARCHIVE_BYTES
    ) {
      skipped++
      continue
    }
    total += file.size
    if (total > 50 * 1024 * 1024)
      throw new Error(
        'Selected JSON exports exceed 50 MiB. Select a smaller export folder.',
      )
    try {
      const contents = await file.text()
      const raw: unknown = JSON.parse(contents)
      if (
        object(raw) &&
        (raw.schema === 'ripe-verified-archive-v1' ||
          raw.format === 'ripe-verified-archive-v1')
      ) {
        exports.push({
          name: file.name,
          contents,
          exportedAt: String(raw.exported_utc ?? raw.exportedAt ?? ''),
        })
      } else skipped++
    } catch {
      skipped++
    }
  }
  exports.sort(
    (a, b) =>
      b.exportedAt.localeCompare(a.exportedAt) || a.name.localeCompare(b.name),
  )
  return { exports, skipped }
}
