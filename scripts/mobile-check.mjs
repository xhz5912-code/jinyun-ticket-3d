// 移动端验证：390×844 触摸仿真，断言启动层可关闭、画布可拖动、控制台零报错
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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

const bootBefore = await page.locator('#boot-layer').getAttribute('class');
console.log('ASSERT boot visible before tap:', !bootBefore?.includes('hidden') ? 'PASS' : 'FAIL', JSON.stringify(bootBefore));

// 触摸点击启动层进入
await page.touchscreen.tap(195, 422);
await page.waitForTimeout(1200);
const bootAfter = await page.locator('#boot-layer').getAttribute('class');
console.log('ASSERT boot hidden after tap:', bootAfter?.includes('hidden') ? 'PASS' : 'FAIL', JSON.stringify(bootAfter));
await page.screenshot({ path: 'shots/m3-enter.png' });

// 模拟触摸拖动票根（验证画布可交互）
await page.touchscreen.tap(195, 500); // 先确保无遮罩
await page.waitForTimeout(300);

// 用 CDP 发触摸序列模拟拖动
const cdp = await page.context().newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ x: 195, y: 500, id: 1 }],
});
for (let i = 1; i <= 10; i++) {
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: 195 + i * 8, y: 500 - i * 4, id: 1 }],
  });
  await page.waitForTimeout(30);
}
// 拖动中途取证：canvas 应带 dragging 类
const midDragCls = (await page.locator('#gl-canvas').getAttribute('class')) ?? '';
console.log('ASSERT canvas dragging mid-drag:', midDragCls.includes('dragging') ? 'PASS' : 'FAIL', JSON.stringify(midDragCls));
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await page.waitForTimeout(800);
const canvasCls = (await page.locator('#gl-canvas').getAttribute('class')) ?? '';
console.log('canvas class during/after drag:', JSON.stringify(canvasCls), '(dragging 说明拖拽事件已生效)');
await page.screenshot({ path: 'shots/m4-drag.png' });

const hud = await page.locator('#hud').innerText();
console.log('MOBILE HUD:', JSON.stringify(hud));
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
const allPass =
  (bootAfter?.includes('hidden') ?? false) && midDragCls.includes('dragging') && errors.length === 0;
console.log('RESULT:', allPass ? 'ALL PASS' : 'HAS FAILURE');
await browser.close();
