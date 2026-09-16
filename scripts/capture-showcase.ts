import { type Browser, chromium, type Page } from 'playwright-core'

const address = 'http://127.0.0.1:4173/'
const outputDirectory = 'public/showcase'

type SocialPreviewFormat = {
  fileName: string
  width: number
  height: number
  paddingX: number
  copyWidth: number
  headingWidth: number
  headingSize: number
  headingTopMargin: number
  descriptionWidth: number
  descriptionSize: number
  screenWidth: number
  screenHeight: number
  screenRight: number
  screenTop: number
}

const socialPreviewFormats: SocialPreviewFormat[] = [
  {
    fileName: 'social-preview.png',
    width: 1280,
    height: 640,
    paddingX: 74,
    copyWidth: 465,
    headingWidth: 440,
    headingSize: 62,
    headingTopMargin: 48,
    descriptionWidth: 405,
    descriptionSize: 19,
    screenWidth: 790,
    screenHeight: 515,
    screenRight: -75,
    screenTop: 74,
  },
  {
    fileName: 'og-image.png',
    width: 1200,
    height: 630,
    paddingX: 68,
    copyWidth: 440,
    headingWidth: 415,
    headingSize: 58,
    headingTopMargin: 44,
    descriptionWidth: 385,
    descriptionSize: 18,
    screenWidth: 740,
    screenHeight: 500,
    screenRight: -82,
    screenTop: 72,
  },
]

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
    content:
      '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }',
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

async function captureSocialPreview(page: Page, format: SocialPreviewFormat) {
  const overview = Buffer.from(await Bun.file('screenshots/network-overview-privacy.png').arrayBuffer()).toString(
    'base64',
  )
  await page.setViewportSize({ width: format.width, height: format.height })
  await page.setContent(
    `
    <!doctype html>
    <html>
      <head>
        <style>
          * { box-sizing: border-box; }
          html, body { width: ${format.width}px; height: ${format.height}px; margin: 0; overflow: hidden; }
          body {
            position: relative;
            display: flex;
            align-items: center;
            padding: 70px ${format.paddingX}px;
            color: #1d2926;
            background:
              radial-gradient(circle at 90% 3%, rgba(210,179,115,.3), transparent 310px),
              radial-gradient(circle at 8% 92%, rgba(47,116,100,.18), transparent 350px),
              #f2f0e9;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .copy { position: relative; z-index: 2; width: ${format.copyWidth}px; }
          .brand { display: flex; align-items: center; gap: 13px; font-size: 21px; font-weight: 750; }
          .mark { width: 39px; height: 39px; position: relative; border: 2px solid #174c42; border-radius: 50%; }
          .mark::before, .mark::after { content: ''; width: 14px; height: 14px; position: absolute; top: 10px; border: 2px solid #174c42; border-radius: 50%; }
          .mark::before { left: 8px; }
          .mark::after { right: 8px; }
          h1 { margin: ${format.headingTopMargin}px 0 20px; max-width: ${format.headingWidth}px; font-family: Georgia, "Times New Roman", serif; font-size: ${format.headingSize}px; font-weight: 600; letter-spacing: -.045em; line-height: .98; }
          p { max-width: ${format.descriptionWidth}px; margin: 0; color: #5e6a65; font-size: ${format.descriptionSize}px; line-height: 1.55; }
          .labels { display: flex; gap: 9px; margin-top: 28px; }
          .labels span { padding: 8px 11px; border: 1px solid #c6d5ce; border-radius: 99px; background: rgba(255,255,255,.55); color: #174c42; font-size: 12px; font-weight: 700; }
          .screen { position: absolute; width: ${format.screenWidth}px; height: ${format.screenHeight}px; right: ${format.screenRight}px; top: ${format.screenTop}px; overflow: hidden; border: 1px solid rgba(29,41,38,.18); border-radius: 22px; background: white; box-shadow: 0 30px 80px rgba(29,41,38,.23); transform: rotate(-1.2deg); }
          .screen img { width: ${format.screenWidth}px; display: block; }
        </style>
      </head>
      <body>
        <section class="copy">
          <div class="brand"><span class="mark"></span>Common Ground</div>
          <h1>You may already know someone who can help.</h1>
          <p>Analyze connections and conversation history together—locally in your browser.</p>
          <div class="labels"><span>Your data stays local</span><span>Connections + messages combined</span></div>
        </section>
        <div class="screen"><img src="data:image/png;base64,${overview}" alt="" /></div>
      </body>
    </html>
  `,
    { waitUntil: 'load' },
  )
  await page.locator('.screen img').evaluate((image: HTMLImageElement) => image.decode())
  await page.screenshot({
    path: `${outputDirectory}/${format.fileName}`,
    type: 'png',
    clip: { x: 0, y: 0, width: format.width, height: format.height },
  })
}

await Bun.$`mkdir -p ${outputDirectory}`

const server = Bun.spawn(['bun', 'run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], {
  stdout: 'ignore',
  stderr: 'ignore',
})

let browser: Browser | undefined
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

  for (const format of socialPreviewFormats) {
    await captureSocialPreview(page, format)
  }
  await context.close()
} finally {
  await browser?.close()
  server.kill()
  await server.exited
}

console.log(`Showcase assets written to ${outputDirectory}`)
