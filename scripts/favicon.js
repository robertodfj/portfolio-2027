/**
 * Rasteriza src/favicon.svg a los PNG que necesitan los navegadores que no
 * soportan favicons en SVG y la pantalla de inicio de iOS.
 *
 * Uso: node scripts/favicon.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SIZES = [
  { file: 'src/favicon-32.png', size: 32 },
  { file: 'src/apple-touch-icon.png', size: 180 },
];

(async () => {
  const svg = fs.readFileSync('src/favicon.svg', 'utf8');
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();

  for (const { file, size } of SIZES) {
    await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
    await page.setContent(
      `<style>*{margin:0}body{width:${size}px;height:${size}px}svg{width:100%;height:100%;display:block}</style>${svg}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, type: 'png', omitBackground: true });
    console.log(path.basename(file), size + 'px');
  }

  await browser.close();
})();
