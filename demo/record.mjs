import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = 'demo/out/raw'
fs.rmSync(OUT, { recursive: true, force: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined })
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT, size: { width: 1280, height: 720 } },
  deviceScaleFactor: 1,
})
const page = await context.newPage()

await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Climate exposure across the corporate book', { timeout: 15000 })
await wait(7000)

// 1. overview → 2030 → 2050 → baseline
await page.getByRole('button', { name: '2030', exact: true }).click()
await wait(6000)
await page.getByRole('button', { name: '2050', exact: true }).click()
await wait(9000)
await page.getByRole('button', { name: 'Baseline', exact: true }).click()
await wait(4000)

// 2. map, wait for tiles, sample a point
await page.locator('aside').getByRole('button', { name: 'Exposure map' }).click()
await wait(9000)

await page.mouse.click(760, 430)
await wait(9000)

// 3. heat layer, then back
await page.getByRole('button', { name: 'Heat', exact: true }).click()
await wait(7000)
await page.getByRole('button', { name: 'Pluvial flood' }).click()
await wait(3500)

// 4. open the top ranked borrower
await page.getByRole('button', { name: /Sidra Tower|Qasr Al Reem|Al Khor/ }).first().click()
await wait(11000)

// 5. scroll to the explanation panel and the clause list
await page.mouse.wheel(0, 260)
await wait(7000)
await page.mouse.wheel(0, 300)
await wait(6000)

// 6. disclosure
await page.locator('aside').getByRole('button', { name: 'CRFR2 disclosure' }).click()
await wait(9000)
await page.mouse.wheel(0, 240)
await wait(8000)

// 7. evidence, ending on the honest caveat
await page.locator('aside').getByRole('button', { name: 'Model & evidence' }).click()
await wait(8000)
await page.mouse.wheel(0, 300)
await wait(10000)

const video = page.video()
await context.close()
await browser.close()

const path = await video.path()
console.log('recorded', path)
