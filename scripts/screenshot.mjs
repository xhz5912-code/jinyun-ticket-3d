// 验证脚本（不进 package.json 依赖）：用系统 Chrome 截图首屏 / 拖拽 / 悬停 / 三种转场 / 卷轴 / 烟花
import { chromium } from 'playwright-core';

const EXEC = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4173/';

const browser = await chromium.launch({
  executablePath: EXEC,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: 'shots/1-boot.png' });

// 进入
await page.mouse.click(720, 450);
await page.waitForTimeout(1800);
await page.screenshot({ path: 'shots/2-scene.png' });

// 拖拽旋转 + 滚轮缩放
await page.mouse.move(720, 450);
await page.mouse.down();
await page.mouse.move(950, 380, { steps: 12 });
await page.mouse.up();
await page.mouse.wheel(0, -400);
await page.waitForTimeout(900);
await page.screenshot({ path: 'shots/3-drag-zoom.png' });

// 悬停月琴热点（uv 0.115, 0.76 → 票面无旋转时大约的屏幕位置；用 NDC 反推太繁，扫几个点）
// 直接触发 2 号「琴弦」转场
await page.keyboard.press('2');
await page.waitForTimeout(800);
await page.screenshot({ path: 'shots/4-strings.png' });
await page.waitForTimeout(1300);
await page.screenshot({ path: 'shots/5-scroll-yueqin.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 3 号「节拍」
await page.keyboard.press('3');
await page.waitForTimeout(850);
await page.screenshot({ path: 'shots/6-beats.png' });
await page.waitForTimeout(1300);
await page.screenshot({ path: 'shots/7-scroll-kuaiban.png' });
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// 点击票面中央戏台热点（真实点击路径）
await page.mouse.click(720, 470);
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/8-vortex.png' });
await page.waitForTimeout(3000);
await page.screenshot({ path: 'shots/9-scroll-xitai.png' });
const scrollVisible = await page.locator('#scroll-layer.hidden').count();
console.log('scroll hidden after click-trigger:', scrollVisible === 1);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// 烟花
await page.keyboard.press(' ');
await page.waitForTimeout(750);
await page.screenshot({ path: 'shots/10-fireworks.png' });
await page.waitForTimeout(1500);

const hudText = await page.locator('#hud').innerText().catch(() => '(no hud)');
console.log('HUD:', JSON.stringify(hudText));
console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');

await browser.close();
