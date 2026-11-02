import { createHash } from 'node:crypto'
import { bridge } from './bridge-v02-synthetic.ts'

/** Only fictional source JSON; hashes cover the exact UTF-8 bytes supplied. */
export function checkedBridge<T extends ReturnType<typeof bridge>>(input: T) {
  const raw = structuredClone(input)
  const files = raw.sessions.map((entry, index) => {
    const contents = JSON.stringify(entry.record)
    entry.source_sha256 = createHash('sha256').update(contents).digest('hex')
    return { name: `synthetic-source-${index}.json`, contents }
  })
  return { raw, files }
}

export function sourceReaders(files: { contents: string }[]) {
  return files.map((file) => {
    const bytes = new TextEncoder().encode(file.contents)
    return {
      size: bytes.byteLength,
      arrayBuffer: async () => bytes.slice().buffer,
    }
  })
}
