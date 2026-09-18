import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/m1-boot.png' });
await page.touchscreen.tap(195, 422);
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/m2-scene.png' });
const hud = await page.locator('#hud').innerText();
console.log('MOBILE HUD:', JSON.stringify(hud));
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
