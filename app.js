import express from "express";
import pixelmatch from 'pixelmatch';
import sharp from 'sharp';
import { promisify } from 'util';
import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
import {PNG} from 'pngjs';
import * as cheerio from 'cheerio';

dotenv.config();
PNG.prototype.promisifyParse = promisify(PNG.prototype.parse);

const PORT = process.env.PORT || 5000

const app = express()

app.use(express.json());

app.post('/', async (req, res) => {

  const {targetUrl, html} = req.body
  
  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
      ],
    });
    const page = await browser.newPage();

    await page.setViewport({ width: 333, height: 266 });

    const $ = cheerio.load(html);
    const answerImageHTML = $.html();

    await page.setContent(answerImageHTML);

    const answerImagePng = await page.screenshot({ type: 'png' });

    await browser.close();

    const targetImageBuffer = Buffer.from(
      await (await fetch(targetUrl)).arrayBuffer(),
    );

    const trimedTargetImage = await sharp(targetImageBuffer).toBuffer();
    const targetImageToCheck = await new PNG({}).promisifyParse(
      trimedTargetImage,
    );

    const { width, height } = targetImageToCheck;

    const trimedAnswerImage = await sharp(answerImagePng)
      .resize(width, height)
      .toBuffer();

    const answerImageToCheck = await new PNG({}).promisifyParse(
      trimedAnswerImage,
    );

    const missmatch = pixelmatch(
      answerImageToCheck.data,
      targetImageToCheck.data,
      null,
      width,
      height,
    );

    const pixlesQty = width * height;

    const result = Number(
      (((pixlesQty - missmatch) / pixlesQty) * 100).toFixed(0),
    );
    // todo: hardcore level, easy level - pixel perfect or not
    res.send(JSON.stringify({result:String(result > 97 ? 100 : result)}))
  } catch (error) {
    console.error('COUNT MATCH ERROR: ', error);
    res.send(JSON.stringify(0))
  }
  })

app.listen(process.env.PORT , () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

