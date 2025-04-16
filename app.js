import express from 'express'
import pixelmatch from 'pixelmatch'
import sharp from 'sharp'
import { promisify } from 'util'
import puppeteer from 'puppeteer-core'
import dotenv from 'dotenv'
import { PNG } from 'pngjs'
import * as cheerio from 'cheerio'
import chromium from '@sparticuz/chromium'

dotenv.config()
PNG.prototype.promisifyParse = promisify(PNG.prototype.parse)

const PORT = process.env.PORT || 5000

const app = express()

app.use(express.json())

app.post('/', async (req, res) => {
  const { targetUrl, html } = req.body

  try {
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    })
    const page = await browser.newPage()

    await page.setViewport({ width: 333, height: 266 })

    const $ = cheerio.load(html)
    const answerImageHTML = $.html()

    await page.setContent(answerImageHTML)

    const answerImagePng = await page.screenshot({ type: 'png' })

    await browser.close()

    const targetImageBuffer = Buffer.from(
      await (await fetch(targetUrl)).arrayBuffer()
    )

    const trimedTargetImage = await sharp(targetImageBuffer).toBuffer()
    const targetImageToCheck = await new PNG({}).promisifyParse(
      trimedTargetImage
    )

    const { width, height } = targetImageToCheck

    const trimedAnswerImage = await sharp(answerImagePng)
      .resize(width, height)
      .toBuffer()

    const answerImageToCheck = await new PNG({}).promisifyParse(
      trimedAnswerImage
    )

    const missmatch = pixelmatch(
      answerImageToCheck.data,
      targetImageToCheck.data,
      null,
      width,
      height,
      {
        /*
       The larger they are, the more we ignore color differentiation; the issue of aliasing on the edges also decreases.
       */
        threshold: 0.2,
      }
    )

    const pixelQty = width * height
    const percDiff = (missmatch / pixelQty) * 100
    const tolerance = Math.max(1, Math.floor(pixelQty * 0.006))

    let result

    /*
    The whole difficulty lies in properly balancing the tolerance multiplier (0.006) and the threshold.
    A threshold that is too high will cause colors to be ignored but will reduce aliasing; the current settings seem to work well, but it's possible that I’ve missed some task or case.
    */
    if (missmatch <= tolerance) {
      result = 100
    } else {
      result = Math.round(100 - percDiff)
    }
    // todo: hardcore level, easy level - pixel perfect or not
    res.send(
      JSON.stringify({
        result: String(result),
      })
    )
  } catch (error) {
    console.error('COUNT MATCH ERROR: ', error)
    res.send(JSON.stringify(0))
  }
})

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`)
})
