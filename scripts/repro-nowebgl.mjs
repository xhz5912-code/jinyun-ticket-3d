// 复现：禁用 WebGL 时启动层是否卡死
import { chromium } from 'playwright-core';

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--disable-webgl'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 120)));
await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/m5-nowebgl.png' });
const subText = await page.locator('#boot-layer .boot-sub').innerText();
console.log('error hint shown:', JSON.stringify(subText));
await page.touchscreen.tap(195, 422);
await page.waitForTimeout(1000);
const cls = await page.locator('#boot-layer').getAttribute('class');
console.log('boot locked (stays visible with error):', !cls?.includes('hidden') ? 'PASS' : 'FAIL');
console.log('pageerrors:', errors);
await browser.close();
