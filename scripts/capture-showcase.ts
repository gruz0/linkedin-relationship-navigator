import { chromium, type Page } from 'playwright-core'

const address = 'http://127.0.0.1:4173/'
const outputDirectory = 'public/showcase'

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(address)
      if (response.ok) return
    } catch {
      // The development server is still starting.
    }
    await Bun.sleep(100)
  }
  throw new Error(`Common Ground did not start at ${address}`)
}

async function openDemo(page: Page) {
  await page.goto(address, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Explore demo workspace' }).click()
  await page.locator('.people-list').waitFor()
  await page.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
  })
}

async function capturePage(page: Page, name: string) {
  await page.screenshot({
    path: `${outputDirectory}/${name}.jpg`,
    type: 'jpeg',
    quality: 91,
    fullPage: false,
  })
}

async function captureSocialPreview(page: Page) {
  const overview = Buffer.from(await Bun.file(`${outputDirectory}/workspace-overview.jpg`).arrayBuffer()).toString('base64')
  await page.setViewportSize({ width: 1280, height: 640 })
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          html, body { width: 1280px; height: 640px; margin: 0; overflow: hidden; }
          body {
            position: relative;
            display: flex;
            align-items: center;
            padding: 70px 74px;
            color: #1d2926;
            background:
              radial-gradient(circle at 90% 3%, rgba(210,179,115,.3), transparent 310px),
              radial-gradient(circle at 8% 92%, rgba(47,116,100,.18), transparent 350px),
              #f2f0e9;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .copy { position: relative; z-index: 2; width: 465px; }
          .brand { display: flex; align-items: center; gap: 13px; font-size: 21px; font-weight: 750; }
          .mark { width: 39px; height: 39px; position: relative; border: 2px solid #174c42; border-radius: 50%; }
          .mark::before, .mark::after { content: ''; width: 14px; height: 14px; position: absolute; top: 10px; border: 2px solid #174c42; border-radius: 50%; }
          .mark::before { left: 8px; }
          .mark::after { right: 8px; }
          h1 { margin: 48px 0 20px; max-width: 440px; font-family: Georgia, "Times New Roman", serif; font-size: 62px; font-weight: 600; letter-spacing: -.045em; line-height: .98; }
          p { max-width: 405px; margin: 0; color: #5e6a65; font-size: 19px; line-height: 1.55; }
          .labels { display: flex; gap: 9px; margin-top: 28px; }
          .labels span { padding: 8px 11px; border: 1px solid #c6d5ce; border-radius: 99px; background: rgba(255,255,255,.55); color: #174c42; font-size: 12px; font-weight: 700; }
          .screen { position: absolute; width: 790px; height: 515px; right: -75px; top: 74px; overflow: hidden; border: 1px solid rgba(29,41,38,.18); border-radius: 22px; background: white; box-shadow: 0 30px 80px rgba(29,41,38,.23); transform: rotate(-1.2deg); }
          .screen img { width: 790px; display: block; }
        </style>
      </head>
      <body>
        <section class="copy">
          <div class="brand"><span class="mark"></span>Common Ground</div>
          <h1>Make sense of your LinkedIn network.</h1>
          <p>A private relationship workspace built from the export you already own.</p>
          <div class="labels"><span>Browser only</span><span>Fictional demo included</span></div>
        </section>
        <div class="screen"><img src="data:image/jpeg;base64,${overview}" alt="" /></div>
      </body>
    </html>
  `, { waitUntil: 'load' })
  await page.screenshot({
    path: `${outputDirectory}/social-preview.png`,
    type: 'png',
    clip: { x: 0, y: 0, width: 1280, height: 640 },
  })
}

await Bun.$`mkdir -p ${outputDirectory}`

const server = Bun.spawn(
  ['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'],
  { stdout: 'ignore', stderr: 'ignore' },
)

let browser
try {
  await waitForServer()
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()

  await openDemo(page)
  await capturePage(page, 'workspace-overview')

  await page.getByRole('button', { name: /^Founder\s/ }).click()
  await page.getByLabel('Two-way').check({ force: true })
  await page.locator('.explorer').scrollIntoViewIfNeeded()
  await capturePage(page, 'filtered-founders')

  await page.locator('.person-row').first().click()
  await page.locator('.person-drawer').waitFor()
  await capturePage(page, 'relationship-detail')

  await openDemo(page)
  await page.getByRole('button', { name: 'Privacy mode' }).click()
  await page.getByRole('button', { name: 'Privacy on' }).waitFor()
  await capturePage(page, 'privacy-mode')

  await captureSocialPreview(page)
  await context.close()
} finally {
  await browser?.close()
  server.kill()
  await server.exited
}

console.log(`Showcase assets written to ${outputDirectory}`)
