import { Buffer } from 'node:buffer'
import { readFile } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { bridge, options } from '../fixtures/bridge-v02-synthetic'

const storageKey = 'squad-boss:coaching-data'
const coach = 'synthetic-reviewer'

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
  await page.getByLabel('Ripe export JSON (maximum 5 MiB)').setInputFiles({
    name: 'synthetic-bridge.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(value)),
  })
  await expect(
    page.getByRole('heading', { name: 'Bridge v0.2 · Private reconciliation' }),
  ).toBeVisible()
}

async function reconcile(page: Page) {
  await page.getByLabel('Importing coach (audit label)').fill(coach)
  await page
    .getByLabel('Source athlete: Fictional One')
    .selectOption('demo-athlete-001')
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
  await expect(page.getByText('8,300 m', { exact: true })).toBeVisible()
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
  await expect(page.getByText('8,300 m', { exact: true })).toBeVisible()
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
  await expect(page.getByText('8,300 m', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Review rollback of synthetic-bridge.json' })
    .click()
  await page.getByLabel('Rollback reason').fill('Synthetic workflow test')
  await page.getByRole('button', { name: 'Confirm batch rollback' }).click()
  await expect(page.getByText('8,300 m', { exact: true })).toHaveCount(0)
  await expect(page.locator('.ripe-import [role="status"]')).toContainText(
    'Batch rolled back',
  )
  const context = await browser.newContext()
  try {
    const recovered = await context.newPage()
    await recovered.goto(page.url())
    await recovered
      .getByText('Verified session archive · Import & audit', { exact: true })
      .click()
    await recovered.getByLabel('Importing coach (audit label)').fill(coach)
    await recovered
      .getByText('Recover an archive backup', { exact: true })
      .click()
    await recovered
      .getByLabel('Archive backup JSON')
      .setInputFiles({
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
    await expect(recovered.getByText('8,300 m', { exact: true })).toBeVisible()
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
