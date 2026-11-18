// 「見る」モードを1コマずつ描いて、縦長 1080×1920 の mp4 を作る（ffmpeg を使う）
// node tools/render_video.mjs [出力.mp4] [URL]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] || 'out.mp4';
const base = process.argv[3] || 'http://localhost:8123/';
const FPS = 30;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 540, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto(base + '?capture=1&q=high');
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 });
await page.evaluate(() => window.__cap.start());
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
let n = 0;
const t0 = Date.now();
while (true) {
  const url = await page.evaluate(() => window.__cap.frame(2));
  const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  n++;
  if (n % 150 === 0) console.log(`${n} コマ (${(n / FPS).toFixed(0)}秒分) ${((Date.now() - t0) / 1000).toFixed(0)}秒経過`);
  if (await page.evaluate(() => window.__cap.done())) break;
  if (n > FPS * 240) break;
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
console.log(JSON.stringify(await page.evaluate(() => window.__cap.results()), null, 0));
console.log(`完成：${out}（${n} コマ・${(n / FPS).toFixed(1)}秒）`);
await browser.close();
