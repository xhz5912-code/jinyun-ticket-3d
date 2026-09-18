import './style.css';
import * as THREE from 'three';
import { Stage } from './scene/stage';
import { Ticket } from './scene/ticket';
import { Particles, TRANSITION_NAMES, type TransitionMode } from './scene/particles';
import { Clouds } from './scene/clouds';
import { Hotspots, type Hotspot } from './scene/hotspots';
import { STORIES, ScrollPanel } from './ui/stories';
import { Hud } from './ui/hud';

const isMobile =
  window.matchMedia('(pointer: coarse)').matches ||
  Math.min(window.innerWidth, window.innerHeight) < 720;

// ---- 启动层：最先注册关闭逻辑，保证后续任何初始化异常时仍可点击关闭 ----
// 多事件冗余：pointerdown 为主，click / touchend 兜底（部分移动端浏览器触摸链路有差异）
const boot = document.getElementById('boot-layer')!;
const hideBoot = () => boot.classList.add('hidden');
boot.addEventListener('pointerdown', hideBoot);
boot.addEventListener('click', hideBoot);
boot.addEventListener('touchend', hideBoot, { passive: true });

// 初始化异常时把原因显示在启动层上，便于真机排查
window.addEventListener('error', (e) => {
  if (boot.classList.contains('hidden')) return;
  const sub = boot.querySelector('.boot-sub');
  if (sub) sub.textContent = `加载异常：${e.message || '未知错误'}`;
});

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;

let stage: Stage;
try {
  stage = new Stage(canvas);
} catch (err) {
  // WebGL 不可用（部分旧机型/浏览器）：启动层给出明确提示并锁定，不静默卡死
  boot.removeEventListener('pointerdown', hideBoot);
  boot.removeEventListener('click', hideBoot);
  boot.removeEventListener('touchend', hideBoot);
  const sub = boot.querySelector('.boot-sub');
  if (sub) sub.textContent = '当前浏览器不支持 WebGL，无法进入雅集';
  boot.querySelector('.boot-enter')?.remove();
  throw err;
}

const hud = new Hud();
const scroll = new ScrollPanel();
const clouds = new Clouds();
stage.scene.add(clouds.group);

const particles = new Particles(isMobile);
stage.scene.add(particles.points);

const hotspotsRef: { value: Hotspots | null } = { value: null };
let ticket: Ticket;

const HOTSPOT_MODE: Record<string, TransitionMode> = {
  xitai: 1,
  yueqin: 2,
  kuaiban: 3,
};

function triggerStory(storyId: string) {
  const hotspot = HOTSPOT_LIST.find((h) => h.id === storyId);
  if (!hotspot || !hotspotsRef.value || particles.isActive) return;
  const center = hotspotsRef.value.worldCenter(hotspot, new THREE.Vector3());
  const mode = HOTSPOT_MODE[storyId];
  hud.setTransition(TRANSITION_NAMES[mode]);
  particles.startTransition(
    mode,
    center,
    () => {
      stage.pulseChroma(1.0);
      scroll.show(STORIES[storyId]);
    },
    () => hud.setTransition('待机'),
  );
}

function triggerFireworks() {
  if (particles.isActive) return;
  const center = new THREE.Vector3();
  ticket.group.getWorldPosition(center);
  hud.setTransition(TRANSITION_NAMES[4]);
  particles.startTransition(
    4,
    center,
    () => stage.pulseChroma(1.2),
    () => hud.setTransition('待机'),
  );
}

// ---- 交互状态 ----
const pointers = new Map<number, { x: number; y: number }>();
let downX = 0;
let downY = 0;
let moved = false;
let pinchDist = 0;
const seenInputs = new Set<string>();

function inputLabel(): string {
  const arr = [...seenInputs];
  const names = arr.map((t) => (t === 'touch' || t === 'pen' ? '触摸' : '鼠标'));
  return [...new Set(names)].join('·') || '--';
}

function ndc(e: PointerEvent): [number, number] {
  return [(e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1];
}

const tip = document.getElementById('hotspot-tip')!;

function updateHover(e: PointerEvent) {
  if (!hotspotsRef.value || ticket.isDragging || pointers.size > 0) {
    canvas.classList.remove('hover-hotspot');
    tip.classList.add('hidden');
    return;
  }
  const [nx, ny] = ndc(e);
  ticket.setParallax(nx, ny);
  const hit = hotspotsRef.value.pick(nx, ny, stage.camera);
  canvas.classList.toggle('hover-hotspot', !!hit);
  if (hit) {
    tip.textContent = hit.name;
    tip.style.left = `${e.clientX}px`;
    tip.style.top = `${e.clientY}px`;
    tip.classList.remove('hidden');
  } else {
    tip.classList.add('hidden');
  }
}

canvas.addEventListener('pointerdown', (e) => {
  seenInputs.add(e.pointerType);
  hud.setInput(inputLabel());
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.setPointerCapture(e.pointerId);

  if (pointers.size === 1) {
    downX = e.clientX;
    downY = e.clientY;
    moved = false;
    ticket.beginDrag(e.clientX, e.clientY);
    canvas.classList.add('dragging');
  } else if (pointers.size === 2) {
    // 双指捏合开始：取消拖拽判定
    const pts = [...pointers.values()];
    pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    moved = true;
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointers.has(e.pointerId)) {
    updateHover(e);
    return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    const pts = [...pointers.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (pinchDist > 0) ticket.zoomBy(d / pinchDist);
    pinchDist = d;
    return;
  }

  if (ticket.isDragging) {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) moved = true;
    ticket.dragTo(e.clientX, e.clientY);
  }
});

canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  ticket.endDrag();

  // 以按下/抬起的位移判定点击，不依赖 moved 标志
  const clickDist = Math.hypot(e.clientX - downX, e.clientY - downY);
  if (!moved && clickDist < 8 && pointers.size === 0 && hotspotsRef.value) {
    const [nx, ny] = ndc(e);
    const hit = hotspotsRef.value.pick(nx, ny, stage.camera);
    if (hit) triggerStory(hit.id);
  }
  moved = false;
});

canvas.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  canvas.classList.remove('dragging');
  ticket.endDrag();
});

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    ticket.zoomBy(e.deltaY < 0 ? 1.09 : 0.92);
  },
  { passive: false },
);

// ---- 键盘 ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    scroll.close();
  } else if (e.key === 'h' || e.key === 'H') {
    hud.toggle();
  } else if (e.key === '1') {
    triggerStory('xitai');
  } else if (e.key === '2') {
    triggerStory('yueqin');
  } else if (e.key === '3') {
    triggerStory('kuaiban');
  } else if (e.key === ' ') {
    e.preventDefault();
    triggerFireworks();
  }
});

// ---- 加载贴图并启动 ----
const loader = new THREE.TextureLoader();
loader.load('./textures/ticket.png', (tex) => {
  ticket = new Ticket(tex);
  stage.scene.add(ticket.group);
  const hs = new Hotspots(ticket);
  hotspotsRef.value = hs;

  hud.setParticleCount(particles.count);
  hud.setInput(isMobile ? '触摸' : '鼠标');

  const clock = new THREE.Clock();
  let hoveredNow: Hotspot | null = null;

  // 每帧重查悬停（拖拽/票根运动时光标不动也要更新泛光）
  const hoverProbe = (e: PointerEvent) => {
    const [nx, ny] = ndc(e);
    hoveredNow = hs.pick(nx, ny, stage.camera);
  };
  canvas.addEventListener('pointermove', hoverProbe);

  stage.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    ticket.edgePulse = Math.max(ticket.edgePulse * Math.exp(-dt * 3), particles.chargeValue);
    ticket.update(dt);
    particles.update(dt, t);
    clouds.update(dt);
    stage.update(dt);
    hs.updateHover(dt, pointers.size === 0 && !ticket.isDragging ? hoveredNow : null);

    hud.update(dt);
    stage.render();
  });
});

// ---- resize ----
window.addEventListener('resize', () => {
  stage.resize(window.innerWidth, window.innerHeight);
  particles.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

// HOTSPOT_LIST 在 import 时装配
import { HOTSPOTS as HOTSPOT_LIST } from './scene/hotspots';
