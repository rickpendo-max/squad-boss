/** Local built-artifact checks only. Never point this at a production athlete service. */
import assert from 'node:assert/strict'
import { chromium, expect } from '@playwright/test'

const viteUrl = process.env.VITE_RELEASE_TEST_URL ?? 'http://127.0.0.1:4173'
const nextUrl = process.env.NEXT_RELEASE_TEST_URL ?? 'http://127.0.0.1:3002'
for (const value of [viteUrl, nextUrl]) {
  const url = new URL(value)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Release checks require an isolated loopback server; remote targets are blocked.')
  }
}
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
})
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.clock.setFixedTime(new Date('2026-11-03T09:00:00Z'))
  await page.goto(viteUrl)
  await page.getByLabel('Current athlete', { exact: true }).selectOption('demo-athlete-001')
  await page.getByText('Verified session archive · Import & audit', { exact: true }).click()
  await page.getByLabel('Importing coach (audit label)').fill('synthetic-release-check')
  await page.getByRole('button', { name: 'Review synthetic demonstration' }).click()
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Import 3 ready sessions', exact: true }).click()
  const season = page.getByRole('region', { name: 'Season overview' })
  await expect(season.locator('.ripe-metrics').getByText('4,200 m', { exact: true })).toBeVisible()
  const snapshot = await page.evaluate(() => localStorage.getItem('squad-boss:coaching-data'))
  assert.equal(JSON.parse(snapshot).archive.sessions.length, 3)
  await page.reload()
  await page.getByLabel('Current athlete', { exact: true }).selectOption('demo-athlete-001')
  await expect(season.locator('.ripe-metrics').getByText('4,200 m', { exact: true })).toBeVisible()
  await page.getByText('Verified session archive · Import & audit', { exact: true }).click()
  await page.getByRole('button', { name: 'Review synthetic demonstration' }).click()
  await expect(page.getByRole('button', { name: 'Import 0 ready sessions', exact: true })).toBeDisabled()
  assert.equal(await page.evaluate(() => localStorage.getItem('squad-boss:coaching-data')), snapshot)
  await context.close()
  console.log('PASS: built Vite artifact — fictional import, exact metres, reload and duplicate retry')

  const foundation = await browser.newContext()
  const row = {
    id: 'synthetic-release-only', name: 'Fictional Release Athlete', event: 'Synthetic test',
    status: 'Monitor', detail: '', action: '', accent: 'teal', goal: 'Synthetic goal',
    primaryConstraint: 'Synthetic observation', confidence: 0, latestEvidence: [],
    currentDecision: { title: '', status: 'Monitoring', reviewDate: '' }, coachNote: '',
    swimmingResultsUrl: '', personalBests: [],
    priorityInputs: { timeVariancePct: null, heartRateVariancePct: null, behaviourConcern: 'None', coachOverride: false, lastUpdated: 'Not updated' },
  }
  await foundation.addInitScript((value) => {
    if (localStorage.getItem('squadboss-athletes-v2') === null) {
      localStorage.setItem('squadboss-athletes-v2', JSON.stringify([value]))
    }
  }, row)
  const profile = await foundation.newPage()
  await profile.goto(`${nextUrl}/athletes/${row.id}/edit`)
  await profile.getByLabel('Athlete name', { exact: true }).fill('Fictional Release Updated')
  await profile.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(profile.getByRole('heading', { name: 'Fictional Release Updated', exact: true })).toBeVisible()
  await profile.reload()
  await expect(profile.getByRole('heading', { name: 'Fictional Release Updated', exact: true })).toBeVisible()
  assert.equal(JSON.parse(await profile.evaluate(() => localStorage.getItem('squadboss-athletes-v2')))[0].name, 'Fictional Release Updated')
  await foundation.close()
  console.log('PASS: built Next.js artifact — fictional profile edit, save and reload')
} finally {
  await browser.close()
}
