// 画面の確認：PC 幅とスマホ幅でスクリーンショットを撮る
// node tools/shoot.mjs [URL] [出力フォルダ]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');
const base = process.argv[2] || 'http://localhost:8123/';
const out = process.argv[3] || 'docs/screens';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const shots = [
  { name: 'pc', viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 },
  { name: 'phone', ...devices['iPhone 13'] },
];
for (const s of shots) {
  const { name, ...opt } = s;
  const ctx = await browser.newContext(opt);
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  await page.goto(base + '?capture=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
  // 見るモード：タイトル→1台目の途中
  await page.evaluate(() => window.__cap.advance(1.2));
  await page.screenshot({ path: `${out}/${name}-1-title.png` });
  await page.evaluate(() => window.__cap.advance(6));
  await page.screenshot({ path: `${out}/${name}-2-run.png` });
  await page.evaluate(() => { for (let i = 0; i < 40 && !window.__stamp; i++) window.__cap.advance(0.5); });
  await page.evaluate(() => window.__cap.advance(10));
  await page.screenshot({ path: `${out}/${name}-3-later.png` });
  await page.evaluate(() => window.__cap.challenge(2));
  await page.evaluate(() => window.__cap.advance(0.6));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__cap.advance(0.1));
  await page.screenshot({ path: `${out}/${name}-4-challenge.png` });
  console.log(name, errs.slice(0, 8).join('\n'));
  await ctx.close();
}
await browser.close();
