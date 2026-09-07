/**
 * Genera src/assets/images/og-cover.jpg, la imagen que se ve al compartir el
 * enlace en LinkedIn, WhatsApp o Twitter.
 *
 * Uso: node scripts/og-image.js
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const CHROME =
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const HTML = `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Space Grotesk';
    src: url('file://${path.resolve('src/assets/fonts/SpaceGrotesk-700-latin.woff2').replace(/\\/g, '/')}') format('woff2');
    font-weight: 700;
  }
  @font-face {
    font-family: 'JetBrains Mono';
    src: url('file://${path.resolve('src/assets/fonts/JetBrainsMono-400-latin.woff2').replace(/\\/g, '/')}') format('woff2');
  }
  * { margin: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px;
    background: #08080a;
    color: #f2f2f0;
    font-family: 'Space Grotesk', sans-serif;
    padding: 82px 90px;
    display: flex; flex-direction: column; justify-content: center;
    position: relative; overflow: hidden;
  }
  .glow {
    position: absolute; right: -180px; top: -180px;
    width: 620px; height: 620px; border-radius: 50%;
    background: radial-gradient(circle, rgba(110,123,255,0.28), transparent 68%);
  }
  .eyebrow {
    font-family: 'JetBrains Mono', monospace;
    font-size: 24px; color: #6e7bff; letter-spacing: 0.02em; margin-bottom: 26px;
  }
  .eyebrow span { color: #6b6b70; }
  h1 {
    font-size: 88px; line-height: 1.02; letter-spacing: -0.02em;
    text-transform: uppercase; font-weight: 700;
  }
  h1 b { color: #6e7bff; font-weight: 700; }
  .role {
    font-family: 'JetBrains Mono', monospace;
    font-size: 28px; color: #a3a3a8; margin-top: 30px;
  }
  .stack {
    font-family: 'JetBrains Mono', monospace;
    font-size: 21px; color: #6b6b70; margin-top: 54px; letter-spacing: 0.04em;
  }
  .rule { width: 96px; height: 3px; background: #6e7bff; margin-top: 40px; }
</style>
<div class="glow"></div>
<p class="eyebrow"><span>//</span> portfolio</p>
<h1>Roberto<br><b>D</b>e <b>F</b>rutos <b>J</b>iménez</h1>
<p class="role">Full Stack Developer · Java / Spring Boot / .NET</p>
<div class="rule"></div>
<p class="stack">ANGULAR · THREE.JS · SQL · REST API · DOCKER</p>`;

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
  await page.setContent(HTML, { waitUntil: 'networkidle0' });
  await page.evaluate(() => document.fonts.ready);

  fs.mkdirSync('src/assets/images', { recursive: true });
  await page.screenshot({ path: 'src/assets/images/og-cover.jpg', type: 'jpeg', quality: 90 });

  await browser.close();
  console.log('og-cover.jpg generado');
})();
