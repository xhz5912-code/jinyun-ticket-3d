export class Hud {
  private readonly root: HTMLElement;
  private readonly fpsEl: HTMLElement;
  private readonly inputEl: HTMLElement;
  private readonly transitionEl: HTMLElement;
  private readonly particlesEl: HTMLElement;

  private frames = 0;
  private acc = 0;
  private fps = 0;
  private visible = true;

  constructor() {
    this.root = document.getElementById('hud')!;
    this.fpsEl = document.getElementById('hud-fps')!;
    this.inputEl = document.getElementById('hud-input')!;
    this.transitionEl = document.getElementById('hud-transition')!;
    this.particlesEl = document.getElementById('hud-particles')!;
  }

  setInput(label: string) {
    this.inputEl.textContent = `输入 ${label}`;
  }

  setTransition(label: string) {
    this.transitionEl.textContent = `转场 ${label}`;
  }

  setParticleCount(n: number) {
    this.particlesEl.textContent = `粒子 ${n.toLocaleString()}`;
  }

  toggle() {
    this.visible = !this.visible;
    this.root.classList.toggle('hidden', !this.visible);
  }

  update(dt: number) {
    this.frames++;
    this.acc += dt;
    if (this.acc >= 0.5) {
      this.fps = Math.round(this.frames / this.acc);
      this.frames = 0;
      this.acc = 0;
      this.fpsEl.textContent = `FPS ${this.fps}`;
    }
  }
}
