/**
 * The customer journey, end to end, in a real browser against the real API:
 * sign up, confirm the email, create an organization, upload a document with an
 * expiry date, find it on the dashboard, calendar and in a report, export the
 * report, start a renewal, check the plan page and the audit log. A second
 * customer then cannot reach the first one's organization.
 *
 * The app is the production build served with the production
 * Content-Security-Policy; any policy violation fails the test.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { E2E_DIR } from './settings.mjs'

const PASSWORD = 'Harbor-Lantern-4821' // test value for the throwaway database only

function isoDay(offset: number): string {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`
}

/** The newest link of a kind in an email to the address, from the API's file mailbox. */
async function linkFromEmail(to: string, path: string): Promise<string> {
  const mailbox = join(E2E_DIR, 'mail')
  let found: string | undefined
  await expect
    .poll(
      () => {
        let files: string[] = []
        try {
          files = readdirSync(mailbox).sort().reverse()
        } catch {
          return undefined
        }
        for (const file of files) {
          const message = JSON.parse(readFileSync(join(mailbox, file), 'utf8')) as { to: string; text: string }
          const match = message.to === to ? new RegExp(`https?://\\S+${path}\\S*`).exec(message.text) : null
          if (match) return (found = match[0])
        }
        return undefined
      },
      { message: `an email to ${to} with a ${path} link` },
    )
    .toBeTruthy()
  return found!
}

/** Fail on any Content-Security-Policy violation or uncaught error in the page. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content.Security.Policy|Refused to/i.test(message.text())) {
      problems.push(message.text())
    }
  })
  page.on('pageerror', (error) => problems.push(error.message))
  return problems
}

async function signUp(page: Page, name: string, email: string) {
  await page.goto('/register')
  await page.getByLabel('Full name').fill(name)
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/onboarding/)
  await page.goto(await linkFromEmail(email, '/verify-email'))
  await expect(page.getByText(/confirmed/i).first()).toBeVisible()
}

async function createOrganization(page: Page, name: string): Promise<string> {
  await page.goto('/onboarding')
  await page.getByLabel('Organization name').fill(name)
  await page.getByRole('button', { name: 'Create organization' }).click()
  await page.getByRole('button', { name: 'Skip setup' }).click()
  await expect(page).toHaveURL(/\/o\/[^/]+\/overview/)
  return new URL(page.url()).pathname.split('/')[2]!
}

test('the whole customer journey', async ({ page }) => {
  const problems = watchForProblems(page)
  const stamp = Date.now()
  const email = `owner-${stamp}@example.com`
  const expiry = isoDay(20)

  await test.step('sign up and confirm the email', () => signUp(page, 'Olivia Owner', email))

  const slug = await test.step('create an organization', () => createOrganization(page, `Harbour Logistics ${stamp}`))
  const org = `/o/${slug}`
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()

  await test.step('upload a document with an expiry date', async () => {
    await page.goto(`${org}/documents/upload`)
    await page.locator('input[type=file]').setInputFiles({
      name: 'trade-licence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
    })
    await page.getByLabel('Name for trade-licence.pdf').fill('Trade licence')
    await page.getByLabel('Type of trade-licence.pdf').selectOption({ label: 'Business licenses' })
    await page.getByLabel('Expiry date of trade-licence.pdf').fill(expiry)
    await page.getByRole('button', { name: 'Upload 1 file' }).click()
    await expect(page.getByRole('link', { name: 'View documents' })).toBeVisible()
  })

  await test.step('the dashboard counts it as expiring soon', async () => {
    await page.goto(`${org}/overview`)
    await expect(page.getByText('Trade licence').first()).toBeVisible()
    await expect(page.getByText(/Expires in 20 days/).first()).toBeVisible()
  })

  await test.step('the calendar shows the expiry', async () => {
    await page.goto(`${org}/calendar?view=list&month=${expiry.slice(0, 7)}`)
    await expect(page.getByText('Trade licence expires')).toBeVisible()
  })

  await test.step('the expiring report lists it and exports a PDF', async () => {
    await page.goto(`${org}/reports?report=expiring`)
    await expect(page.getByRole('cell', { name: 'Trade licence' })).toBeVisible()
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'PDF' }).click()
    expect((await download).suggestedFilename()).toMatch(/^novalyn-expiring-\d{8}\.pdf$/)
  })

  await test.step('start a renewal', async () => {
    await page.goto(`${org}/documents?q=Trade`)
    await page.getByRole('link', { name: 'Trade licence' }).first().click()
    await page.getByRole('button', { name: 'Start renewal' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /Create renewal|Request renewal/ }).click()
    await expect(page).toHaveURL(new RegExp(`${org}/renewals/`))
    await expect(page.getByText('Trade licence').first()).toBeVisible()
  })

  await test.step('the plan page is honest about payments', async () => {
    await page.goto(`${org}/billing`)
    await expect(page.getByText('Online payment is not set up yet')).toBeVisible()
    await expect(page.getByText('1 of 500')).toBeVisible() // one active document on Growth
  })

  await test.step('the audit log recorded it all', async () => {
    await page.goto(`${org}/audit-log`)
    for (const text of ['Uploaded', 'Exported the Expiring documents report as PDF']) {
      await expect(page.getByText(new RegExp(text)).first()).toBeVisible()
    }
  })

  await test.step('another customer cannot reach this organization', async () => {
    await page.context().clearCookies()
    const other = `other-${stamp}@example.com`
    await signUp(page, 'Otto Other', other)
    await createOrganization(page, `Other Co ${stamp}`)
    await page.goto(`${org}/documents`)
    await expect(page.getByText(/not found/i).first()).toBeVisible()
    await expect(page.getByText('Trade licence')).toHaveCount(0)
  })

  expect(problems, 'Content-Security-Policy violations or page errors').toEqual([])
})
