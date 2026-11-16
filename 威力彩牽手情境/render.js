const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
  const outDir = path.resolve(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--font-render-hinting=none', '--force-color-profile=srgb'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 1400 },
    deviceScaleFactor: 2,
  });

  await page.goto('file://' + path.resolve(__dirname, 'poster.html'), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);

  const box = await page.evaluate(() => {
    const el = document.querySelector('.poster');
    return { w: el.scrollWidth, h: el.scrollHeight };
  });
  console.log('poster size:', box.w, 'x', box.h);

  const outFile = path.join(outDir, '威力彩第10期牽手獎勵條件_新聞稿.png');
  await page.screenshot({ path: outFile, fullPage: true, scale: 'device' });
  console.log('saved:', outFile);

  const overflow = await page.evaluate(() => {
    const p = document.querySelector('.poster');
    const pr = p.getBoundingClientRect();
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && (r.right > pr.right + 1 || r.left < pr.left - 1)) {
        bad.push(el.tagName + '.' + (el.className || '').toString().slice(0, 40));
      }
    });
    return bad.slice(0, 10);
  });
  console.log('overflow elements:', overflow.length ? overflow : 'none');

  // 檢查圖片是否都載入成功
  const imgs = await page.evaluate(() =>
    Array.from(document.images).map((i) => ({ src: i.src.split('/').pop(), ok: i.complete && i.naturalWidth > 0 }))
  );
  console.log('images:', JSON.stringify(imgs));

  await browser.close();
})();
