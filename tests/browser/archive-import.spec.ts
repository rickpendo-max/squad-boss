import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bridge, options } from '../fixtures/bridge-v02-synthetic'
import { checkedBridge } from '../fixtures/checked-bridge-synthetic'

const storageKey = 'squad-boss:coaching-data'
const coach = 'synthetic-reviewer'

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'))
})

function browserFixture() {
  const value = bridge()
  // The browser's one fictional identity suffices for this fixture. No records
  // are mapped to real seeded athletes, and the source remains unmodified.
  Object.assign(value.sessions[2].record, { absent: {} })
  return value
}

async function openImport(page: Page) {
  await page.goto('/')
  await page
    .getByLabel('Current athlete', { exact: true })
    .selectOption('demo-athlete-001')
  await page
    .getByText('Verified session archive · Import & audit', { exact: true })
    .click()
}

async function upload(page: Page, value = browserFixture()) {
  const checked = checkedBridge(value)
  await page.getByLabel('Ripe export JSON (maximum 5 MiB)').setInputFiles({
    name: 'synthetic-bridge.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(checked.raw)),
  })
  await expect(
    page.getByRole('heading', { name: 'Bridge v0.2 · Private reconciliation' }),
  ).toBeVisible()
  await page
    .getByLabel('Original source JSON files (read-only SHA-256 verification)')
    .setInputFiles(
      checked.files.map((file) => ({
        name: file.name,
        mimeType: 'application/json',
        buffer: Buffer.from(file.contents),
      })),
    )
}

async function reconcile(page: Page) {
  await page.getByLabel('Importing coach (audit label)').fill(coach)
  if (await page.getByLabel('Source athlete: Fictional One').isEnabled())
    await page
      .getByLabel('Source athlete: Fictional One')
      .selectOption('demo-athlete-001')
  else
    await expect(page.getByLabel('Source athlete: Fictional One')).toHaveValue(
      'demo-athlete-001',
    )
  for (const [id, time] of Object.entries(options().startsAtBySessionId)) {
    await page
      .getByLabel(`Confirmed session ${id} start`, { exact: false })
      .fill(time)
  }
  await page
    .getByLabel('Coach attestation time (ISO 8601 with offset)')
    .fill(options().attestedAt)
  await page
    .getByRole('button', { name: 'Validate Bridge export for review' })
    .click()
}

async function importBridge(page: Page) {
  await upload(page)
  await reconcile(page)
  const commit = page.getByRole('button', {
    name: 'Import 3 ready sessions',
    exact: true,
  })
  await expect(commit).toBeDisabled()
  await page.getByRole('checkbox').check()
  await commit.click()
  await expect(page.locator('.ripe-import [role="status"]')).toContainText(
    'Imported 3 sessions',
  )
}

test('Bridge file upload, reconciliation, import, reload and duplicates preserve verified volume', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await openImport(page)
  await upload(page)
  await expect(page.getByLabel('Source athlete: Fictional One')).toHaveValue('')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  await reconcile(page)
  await expect(
    page.getByRole('button', { name: 'Import 3 ready sessions', exact: true }),
  ).toBeDisabled()
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Import 3 ready sessions', exact: true })
    .click()
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  await expect(
    page.getByText('Partial total · 1 session distance missing', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText('No performance results recorded.', { exact: true }),
  ).toBeVisible()
  const saved = await page.evaluate(
    (key) => localStorage.getItem(key),
    storageKey,
  )
  expect(saved).not.toBeNull()
  expect(saved).not.toContain('PRIVATE')
  expect(saved).not.toContain('source_location')
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE')
  await openImport(page)
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  await upload(page)
  await reconcile(page)
  await expect(
    page.getByRole('cell', { name: 'duplicate', exact: true }),
  ).toHaveCount(3)
  await expect(
    page.getByRole('button', { name: 'Import 0 ready sessions', exact: true }),
  ).toBeDisabled()
  expect(errors).toEqual([])
})

test('changed source conflicts, backup restores into a fresh browser, and rollback retains audit', async ({
  page,
  browser,
}) => {
  await openImport(page)
  await importBridge(page)
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download archive backup' }).click()
  const download = await downloadEvent
  const savedPath = await download.path()
  expect(savedPath).not.toBeNull()
  const bytes = await readFile(savedPath!)
  expect(bytes.toString()).not.toContain('PRIVATE')
  const changed = browserFixture()
  changed.sessions[0].record.distance_m!['Fictional One'] = 4100
  await upload(page, changed)
  await reconcile(page)
  await expect(
    page.getByRole('cell', { name: 'conflict', exact: true }),
  ).toHaveCount(1)
  await expect(
    page.getByRole('button', { name: 'Import 0 ready sessions', exact: true }),
  ).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Review rollback of synthetic-bridge.json' })
    .click()
  await page.getByLabel('Rollback reason').fill('Synthetic workflow test')
  await page.getByRole('button', { name: 'Confirm batch rollback' }).click()
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toHaveCount(0)
  await expect(page.locator('.ripe-import [role="status"]')).toContainText(
    'Batch rolled back',
  )
  const context = await browser.newContext()
  try {
    const recovered = await context.newPage()
    await recovered.clock.setFixedTime(new Date('2026-11-02T07:00:00Z'))
    await recovered.goto(page.url())
    await recovered
      .getByText('Verified session archive · Import & audit', { exact: true })
      .click()
    await recovered.getByLabel('Importing coach (audit label)').fill(coach)
    await recovered
      .getByText('Recover an archive backup', { exact: true })
      .click()
    await recovered.getByLabel('Archive backup JSON').setInputFiles({
      name: 'synthetic-backup.json',
      mimeType: 'application/json',
      buffer: bytes,
    })
    await recovered
      .getByRole('button', { name: 'Restore validated backup' })
      .click()
    await expect(
      recovered.locator('.ripe-import [role="status"]'),
    ).toContainText('Archive backup restored')
    await recovered
      .getByLabel('Current athlete', { exact: true })
      .selectOption('demo-athlete-001')
    await expect(recovered.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  } finally {
    await context.close()
  }
})

test('editing reconciliation or attestation invalidates prior conversion and approval', async ({
  page,
}) => {
  await openImport(page)
  await upload(page)
  await reconcile(page)
  await page.getByRole('checkbox').check()
  await page
    .getByLabel('Coach attestation time (ISO 8601 with offset)')
    .fill('2026-11-02')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Validate Bridge export for review' })
    .click()
  await expect(page.getByRole('alert')).toContainText('attestation')
  await reconcile(page)
  await page.getByRole('checkbox').check()
  await page
    .getByLabel('Importing coach (audit label)')
    .fill('different-synthetic-reviewer')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  await reconcile(page)
  await page.getByLabel('Source athlete: Fictional One').selectOption('')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Validate Bridge export for review' })
    .click()
  await expect(page.getByRole('alert')).toContainText('unmapped')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull()
})

test('contradictory source approvals block conversion without exposing source paths', async ({
  page,
}) => {
  await openImport(page)
  const value = browserFixture()
  Object.assign(value.sessions[0].record, {
    status: 'pending',
    review_status: 'coach_confirmed',
  })
  await upload(page, value)
  await reconcile(page)
  await expect(page.getByRole('alert')).toContainText('not coach-verified')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  expect(await page.locator('body').innerText()).not.toContain('PRIVATE')
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull()
})

test('switching to the canonical synthetic demo clears private reconciliation and preserves the original importer', async ({
  page,
}) => {
  await openImport(page)
  await upload(page)
  await reconcile(page)
  await page
    .getByRole('button', { name: 'Review synthetic demonstration' })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Bridge v0.2 · Private reconciliation' }),
  ).toHaveCount(0)
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Import 3 ready sessions', exact: true })
    .click()
  await expect(page.getByText('4,200 m', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('64.80 s', { exact: true }).first()).toBeVisible()
})

test('local .ripe_bridge folder imports feed attendance, volume and measured intelligence with reusable identities', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = []
  const sentData: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method()))
      sentData.push(request.method())
  })
  const { mkdir, writeFile } = await import('node:fs/promises')
  const directory = testInfo.outputPath(
    'synthetic-windows-archive',
    '.ripe_bridge',
  )
  await mkdir(directory, { recursive: true })
  const initial = checkedBridge(browserFixture())
  const exportText = JSON.stringify(initial.raw)
  await writeFile(`${directory}/verified-export.json`, exportText)
  await writeFile(`${directory}/settings.json`, '{}')
  await openImport(page)
  await page
    .getByLabel('Open local .ripe_bridge folder (read-only)')
    .setInputFiles(directory)
  await expect(page.locator('.ripe-import [role="status"]')).toContainText(
    'Found 1 recognized exports',
  )
  await page.getByLabel('Local export to review').selectOption('0')
  await expect(
    page.getByRole('heading', { name: 'Bridge v0.2 · Private reconciliation' }),
  ).toBeVisible()
  await page
    .getByLabel('Original source JSON files (read-only SHA-256 verification)')
    .setInputFiles(
      initial.files.map((file) => ({
        name: file.name,
        mimeType: 'application/json',
        buffer: Buffer.from(file.contents),
      })),
    )
  await reconcile(page)
  await page.getByRole('checkbox').check()
  await page
    .getByRole('button', { name: 'Import 3 ready sessions', exact: true })
    .click()
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  expect(await readFile(`${directory}/verified-export.json`, 'utf8')).toBe(
    exportText,
  )
  const originalAthleteCount = await page
    .getByLabel('Current athlete', { exact: true })
    .locator('option')
    .count()

  for (const [id, total, expectedVolume] of [
    ['D', 65.2, '10,800 m'],
    ['E', 64.8, '13,300 m'],
  ] as const) {
    await openImport(page)
    const value = browserFixture()
    value.sessions = [value.sessions[0]]
    Object.assign(value.sessions[0], { archive_id: id })
    Object.assign(value.sessions[0].record, {
      session_id: id,
      date: id === 'D' ? '2026-11-01' : '2026-11-02',
      starts_at:
        id === 'D' ? '2026-11-01T06:00:00+10:00' : '2026-11-02T06:00:00+10:00',
      distance_m: { 'Fictional One': 2500 },
      timed_results: [
        {
          athlete_name: 'Fictional One',
          id: `measured-${id}`,
          resultType: 'test',
          distance: 100,
          stroke: 'freestyle',
          course: 'LCM',
          totalSeconds: total,
          verificationStatus: 'verified',
        },
        {
          athlete_name: 'Fictional One',
          id: `provisional-${id}`,
          resultType: 'test',
          distance: 100,
          stroke: 'freestyle',
          course: 'LCM',
          totalSeconds: 20,
          verificationStatus: 'provisional',
        },
        {
          athlete_name: 'Fictional One',
          id: `unverified-${id}`,
          resultType: 'test',
          distance: 100,
          stroke: 'freestyle',
          course: 'LCM',
          totalSeconds: 10,
          verificationStatus: 'unverified',
        },
        {
          athlete_name: 'Fictional One',
          id: `missing-${id}`,
          resultType: 'test',
          distance: 100,
          stroke: 'freestyle',
          course: 'LCM',
          totalSeconds: null,
          verificationStatus: 'verified',
        },
      ],
    })
    await upload(page, value)
    const identity = page.getByLabel('Source athlete: Fictional One')
    await expect(identity).toHaveValue('demo-athlete-001')
    await expect(identity).toBeDisabled()
    await expect(
      page.getByLabel(`Confirmed session ${id} start`, { exact: false }),
    ).toHaveValue(
      id === 'D' ? '2026-11-01T06:00:00+10:00' : '2026-11-02T06:00:00+10:00',
    )
    await page.getByLabel('Importing coach (audit label)').fill(coach)
    await page
      .getByRole('button', { name: 'Validate Bridge export for review' })
      .click()
    await expect(
      page.getByRole('button', {
        name: 'Import 1 ready sessions',
        exact: true,
      }),
    ).toBeDisabled()
    await page.getByRole('checkbox').check()
    await page
      .getByRole('button', { name: 'Import 1 ready sessions', exact: true })
      .click()
    await expect(page.getByRole('region', { name: 'Season overview' }).getByText(expectedVolume, { exact: true })).toBeVisible()
    await expect(
      page.getByText(`${total.toFixed(2)} s`, { exact: true }).first(),
    ).toBeVisible()
    expect(
      await page
        .getByLabel('Current athlete', { exact: true })
        .locator('option')
        .count(),
    ).toBe(originalAthleteCount)
  }
  await expect(
    page.getByRole('heading', { name: /^Performance Progression/ }),
  ).toBeVisible()
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!),
    storageKey,
  )
  expect(
    saved.archive.bridge.identities.filter(
      (link: { active: boolean }) => link.active,
    ),
  ).toHaveLength(1)
  expect(saved.archive.batches).toHaveLength(3)
  expect(
    saved.archive.batches.every(
      (batch: { sourceChecks: unknown[] }) => batch.sourceChecks.length > 0,
    ),
  ).toBe(true)
  expect(await page.getByText('20.00 s', { exact: true }).count()).toBe(0)
  expect(await page.getByText('10.00 s', { exact: true }).count()).toBe(0)
  await expect(
    page.getByText('5 present / 5 known · 0 unknown', { exact: true }),
  ).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(sentData).toEqual([])
})

test('source mismatch blocks browser import and saved mapping revocation preserves historical athlete facts', async ({
  page,
}) => {
  await openImport(page)
  await upload(page)
  await page
    .getByLabel('Original source JSON files (read-only SHA-256 verification)')
    .setInputFiles({
      name: 'wrong-synthetic-source.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{}'),
    })
  await reconcile(page)
  await expect(page.getByRole('alert')).toContainText('checksum did not match')
  await expect(
    page.getByRole('button', { name: /^Import \d+ ready sessions$/ }),
  ).toHaveCount(0)
  expect(
    await page.evaluate((key) => localStorage.getItem(key), storageKey),
  ).toBeNull()
  await importBridge(page)
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  await page
    .getByText('Saved Bridge identities & audit', { exact: true })
    .click()
  await page.getByLabel('Mapping to revoke').selectOption('Fictional One')
  await page
    .getByLabel('Identity revocation reason')
    .fill('Synthetic roster verification changed')
  await page.getByRole('button', { name: 'Revoke selected identity' }).click()
  await expect(page.getByRole('region', { name: 'Season overview' }).getByText('8,300 m', { exact: true })).toBeVisible()
  await upload(page)
  await expect(page.getByLabel('Source athlete: Fictional One')).toHaveValue('')
  await expect(page.getByLabel('Source athlete: Fictional One')).toBeEnabled()
  const state = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)!).archive,
    storageKey,
  )
  expect(
    state.bridge.audit.some(
      (event: { action: string }) => event.action === 'revoke',
    ),
  ).toBe(true)
  expect(state.sessions).toHaveLength(3)
})

test('season controls filter actual distance, reject invalid ranges and remain usable on mobile', async ({ page }) => {
  await openImport(page)
  await importBridge(page)
  const season = page.getByRole('region', { name: 'Season overview' })
  await expect(season).toContainText('8,300 m')
  await page.getByLabel('Season start').fill('2026-10-30')
  await page.getByLabel('Season end').fill('2026-10-30')
  await expect(season).toContainText('Not recorded')
  await expect(season).not.toContainText('8,300 m')
  await page.getByLabel('Season end').fill('2026-10-29')
  await expect(season.getByRole('alert')).toContainText('Choose valid season dates')
  await page.getByLabel('Season start').fill('2026-10-29')
  await expect(season.getByRole('alert')).toHaveCount(0)
  await expect(season).toContainText('8,300 m')
  await expect(page.getByRole('meter')).toHaveAttribute('value', '8300')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByLabel('Season start')).toBeVisible()
  expect(await page.getByLabel('Season end').evaluate((el) => el.getBoundingClientRect().right)).toBeLessThanOrEqual(390)
})
