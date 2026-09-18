// HUD 遮挡专项验证：
// 移动端 390×844 触摸：点击戏台热点→卷轴弹出时 HUD 不可见；收起后 HUD 恢复（且在左下角）
// 桌面端回归：H 键切换显隐；卷轴打开自动隐藏优先于 H 状态，Esc 收起后按 H 状态恢复
import { chromium } from 'playwright-core';

const EXEC = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = 'http://localhost:4173/';
const browser = await chromium.launch({
  executablePath: EXEC,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const hudClass = (page) => page.locator('#hud').getAttribute('class');
const hudHidden = (page) => hudClass(page).then((c) => (c ?? '').includes('hidden'));
const scrollOpen = (page) =>
  page.locator('#scroll-layer').getAttribute('class').then((c) => !(c ?? '').includes('hidden'));

let pass = true;
const check = (name, ok) => {
  console.log(`ASSERT ${name}:`, ok ? 'PASS' : 'FAIL');
  if (!ok) pass = false;
};

// ---------- 移动端 ----------
{
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.touchscreen.tap(195, 422); // 关闭启动层
  await page.waitForTimeout(1200);

  check('mobile: hud visible after enter', !(await hudHidden(page)));
  // HUD 位置：左下角（boundingBox 的 y 应在屏幕下半部）
  const box = await page.locator('#hud').boundingBox();
  check('mobile: hud at bottom-left', !!box && box.y > 422 && box.x < 40);

  // 点击戏台热点 → 转场 → 卷轴弹出
  await page.touchscreen.tap(195, 500);
  await page.waitForFunction(() => {
    const el = document.getElementById('scroll-layer');
    return el && !el.classList.contains('hidden');
  }, null, { timeout: 15000 });
  await page.waitForTimeout(400);
  check('mobile: scroll opened', await scrollOpen(page));
  check('mobile: hud hidden while scroll open', await hudHidden(page));
  await page.screenshot({ path: 'shots/m6-hud-hidden.png' });

  // 点击"收起"关闭卷轴
  await page.locator('#scroll-close').click();
  await page.waitForFunction(() => {
    const el = document.getElementById('scroll-layer');
    return el && el.classList.contains('hidden');
  }, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  check('mobile: hud restored after close', !(await hudHidden(page)));
  const box2 = await page.locator('#hud').boundingBox();
  check('mobile: hud still bottom-left after restore', !!box2 && box2.y > 422);
  await page.screenshot({ path: 'shots/m7-hud-restored.png' });

  console.log('mobile console errors:', errors.length ? errors : 'none');
  if (errors.length) pass = false;
  await page.close();
}

// ---------- 桌面端回归 ----------
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.mouse.click(720, 450); // 关闭启动层
  await page.waitForTimeout(800);

  // H 键切换
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  check('desktop: H hides hud', await hudHidden(page));
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  check('desktop: H shows hud again', !(await hudHidden(page)));

  // 桌面端 HUD 仍在左上角
  const box = await page.locator('#hud').boundingBox();
  check('desktop: hud at top-left', !!box && box.y < 100 && box.x < 40);

  // 卷轴打开 → 自动隐藏优先；Esc 收起 → 恢复
  await page.keyboard.press('1');
  await page.waitForFunction(() => {
    const el = document.getElementById('scroll-layer');
    return el && !el.classList.contains('hidden');
  }, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  check('desktop: hud auto-hidden while scroll open', await hudHidden(page));
  // 卷轴打开期间按 H 不应显示 HUD（自动隐藏优先）
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  check('desktop: H during scroll stays hidden (auto wins)', await hudHidden(page));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => {
    const el = document.getElementById('scroll-layer');
    return el && el.classList.contains('hidden');
  }, null, { timeout: 5000 });
  await page.waitForTimeout(300);
  // 收起后按 H 键状态恢复：刚才按过一次 H（用户状态=隐藏），应保持隐藏
  check('desktop: after close, H-state (hidden) restored', await hudHidden(page));
  await page.keyboard.press('h');
  await page.waitForTimeout(200);
  check('desktop: H toggles back to visible', !(await hudHidden(page)));

  console.log('desktop console errors:', errors.length ? errors : 'none');
  if (errors.length) pass = false;
  await page.close();
}

console.log('RESULT:', pass ? 'ALL PASS' : 'HAS FAILURE');
await browser.close();
