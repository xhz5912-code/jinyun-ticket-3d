import * as THREE from 'three';

export type TransitionMode = 0 | 1 | 2 | 3 | 4; // 0 待机 1 漩涡 2 琴弦 3 节拍 4 烟花

export const TRANSITION_NAMES: Record<TransitionMode, string> = {
  0: '待机',
  1: '漩涡',
  2: '琴弦',
  3: '节拍',
  4: '烟花',
};

const MAIN_DURATION: Record<TransitionMode, number> = {
  0: 0,
  1: 1.0,  // 漩涡
  2: 0.9,  // 琴弦
  3: 1.1,  // 节拍
  4: 1.2,  // 烟花
};

const CHARGE_DURATION = 0.3;
const REFORM_DURATION = 0.5;
const CLIMAX_AT = 0.55; // 主特效高潮点（弹出卷轴）

const vertexShader = /* glsl */ `
  attribute vec3 aHome;
  attribute vec3 aRand;
  attribute float aSeed;

  uniform float uTime;
  uniform float uMode;
  uniform float uCharge;  // 蓄力 0..1
  uniform float uMain;    // 主特效 0..1
  uniform float uReform;  // 重组 0..1
  uniform vec3 uCenter;   // 热点世界坐标
  uniform float uSize;
  uniform float uPixelRatio;

  varying vec3 vColor;
  varying float vBright;

  float easeOutBack(float t) {
    float c1 = 1.70158;
    float c3 = c1 + 1.0;
    return 1.0 + c3 * pow(t - 1.0, 3.0) + c1 * pow(t - 1.0, 2.0);
  }

  mat2 rot2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    float seed = aSeed;

    // ---- 常态金粉云：切向环流 + 噪声微动 ----
    vec3 home = aHome;
    home.xy = rot2(uTime * (0.03 + 0.06 * seed)) * home.xy;
    home += 0.09 * vec3(
      sin(uTime * 0.7 + seed * 17.0),
      cos(uTime * 0.6 + seed * 23.0),
      sin(uTime * 0.5 + seed * 31.0)
    );

    float flash = 0.0;
    float dim = 1.0;
    vec3 eff = home;

    if (uMode > 0.5) {
      if (uMode < 1.5) {
        // ---- 漩涡：向热点收拢 → 爆发成扩散涟漪 ----
        float m = uMain;
        float dist0 = length(aHome.xy - uCenter.xy);
        float r = mix(dist0, 0.5, smoothstep(0.0, 0.42, m));
        float ring = smoothstep(0.42, 1.0, m);
        r += pow(ring, 1.5) * (2.0 + seed * 1.6);
        float swirl = atan(aHome.y - uCenter.y, aHome.x - uCenter.x) + m * (6.0 + seed * 6.0);
        eff = uCenter + vec3(cos(swirl), sin(swirl), 0.3 * sin(swirl * 2.0 + seed * 9.0)) * r;
        // 收拢时按半径压暗，避免 6 万粒子加法叠成白核
        dim = clamp(r * 1.3, 0.28, 1.0);
        flash = smoothstep(0.35, 0.55, m) * exp(-max(m - 0.55, 0.0) * 4.0) * 1.4 * dim;
      } else if (uMode < 2.5) {
        // ---- 琴弦：水平正弦波层层荡开（如拨弦） ----
        float m = uMain;
        float d = length(aHome.xy - uCenter.xy);
        float amp = sin(m * 3.14159);
        float layer = floor(seed * 5.0);
        eff = home;
        eff.z += sin(d * 4.0 - m * 14.0) * amp * 0.9;
        eff.y += sin((aHome.x - uCenter.x) * 3.0 - m * 11.0 + layer * 1.7) * amp * 0.45;
        eff.x += cos(d * 3.0 - m * 10.0) * amp * 0.15;
        flash = amp * (0.5 + 0.5 * sin(d * 4.0 - m * 14.0));
      } else if (uMode < 3.5) {
        // ---- 节拍：4 拍分批点阵跳跃闪烁，渐强 ----
        float m = uMain;
        float beat = floor(seed * 4.0);
        float bt = clamp(m * 4.0 - beat, 0.0, 1.0);
        float jump = smoothstep(0.0, 0.25, bt);
        float gx = mod(seed * 13.7, 1.0) - 0.5;
        float gy = mod(seed * 7.31, 1.0) - 0.5;
        vec3 gridPos = uCenter + vec3(gx * 2.4, gy * 1.5, 0.15 + 0.3 * mod(seed * 5.13, 1.0));
        eff = mix(home, gridPos, jump);
        flash = exp(-bt * 6.0) * (0.5 + beat * 0.35) * step(0.001, bt);
      } else {
        // ---- 烟花：自票心爆发 ----
        float m = uMain;
        vec3 dir = normalize(aRand);
        float ease = 1.0 - pow(1.0 - m, 3.0);
        eff = uCenter + dir * ease * (2.2 + seed * 2.6);
        eff.y -= m * m * 1.1;
        flash = exp(-m * 3.0) * 2.0 + 0.25;
      }
    }

    // ---- 弹性重组：per-particle 延迟 seed*0.22，easeOutBack 归位 ----
    float rt = clamp((uReform * 1.22 - seed * 0.22), 0.0, 1.0);
    float reformEase = uReform > 0.0 ? easeOutBack(rt) : 0.0;
    vec3 transPos = mix(eff, home, clamp(reformEase, 0.0, 1.0));
    // 落定微抖：easeOutBack 过冲之外再加一点衰减抖动
    transPos += (1.0 - rt) * uReform * 0.05 * vec3(
      sin(uTime * 21.0 + seed * 43.0),
      cos(uTime * 19.0 + seed * 47.0),
      0.0
    );

    // 蓄力：高频振动渐强，同时向特效位置过渡
    float engage = uMode > 0.5 ? smoothstep(0.0, 1.0, clamp(uCharge + step(0.001, uMain + uReform), 0.0, 1.0)) : 0.0;
    vec3 pos = mix(home, transPos, engage);
    pos += uCharge * 0.055 * vec3(
      sin(uTime * 37.0 + seed * 91.0),
      cos(uTime * 41.0 + seed * 83.0),
      sin(uTime * 43.0 + seed * 71.0)
    );

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    float size = uSize * (0.45 + seed * 0.9) * (1.0 + uCharge * 0.5 + flash * 0.8);
    gl_PointSize = size * uPixelRatio * (4.6 / -mv.z);

    // 金 / 朱砂 双色调
    vec3 gold = vec3(1.0, 0.78, 0.35);
    vec3 cinnabar = vec3(0.88, 0.30, 0.18);
    vColor = mix(gold, cinnabar, step(0.78, fract(seed * 7.77)) * 0.85);

    // 呼吸明暗
    vBright = 0.42 + 0.33 * sin(uTime * 0.9 + seed * 40.0);
    vBright = (vBright * 0.75 + uCharge * 0.7) * dim + flash;
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vBright;

  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float core = smoothstep(0.35, 0.0, d);
    float halo = smoothstep(1.0, 0.0, d) * 0.3;
    float a = core + halo;
    vec3 col = vColor * (core * 1.45 + halo) * vBright;
    gl_FragColor = vec4(col, a);
  }
`;

export class Particles {
  readonly points: THREE.Points;
  readonly count: number;
  private readonly mat: THREE.ShaderMaterial;

  private phase: 'idle' | 'charge' | 'main' | 'reform' = 'idle';
  private phaseT = 0;
  private mode: TransitionMode = 0;
  private onClimax: (() => void) | null = null;
  private onDone: (() => void) | null = null;
  private climaxFired = false;

  constructor(isMobile: boolean) {
    this.count = isMobile ? 20000 : 60000;

    const home = new Float32Array(this.count * 3);
    const rand = new Float32Array(this.count * 3);
    const seed = new Float32Array(this.count);

    for (let i = 0; i < this.count; i++) {
      const s = Math.random();
      seed[i] = s;

      // 环绕票根的云层：椭圆环带 + 少量内层浮尘（环带压扁、避开票面）
      const theta = Math.random() * Math.PI * 2;
      const inner = Math.random() < 0.1;
      const r = inner ? 1.6 + Math.random() * 1.0 : 2.9 + Math.pow(Math.random(), 0.8) * 2.0;
      home[i * 3] = Math.cos(theta) * r * 1.35;
      home[i * 3 + 1] = Math.sin(theta) * r * (inner ? 0.5 : 0.58);
      home[i * 3 + 2] = (Math.random() - 0.5) * (inner ? 0.7 : 1.7);

      // 单位球随机向量
      const v = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      );
      if (v.lengthSq() < 1e-5) v.set(0, 1, 0);
      v.normalize();
      rand[i * 3] = v.x;
      rand[i * 3 + 1] = v.y;
      rand[i * 3 + 2] = v.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(home.slice(), 3)); // 占位，实际用 aHome
    geo.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);

    this.mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uMode: { value: 0 },
        uCharge: { value: 0 },
        uMain: { value: 0 },
        uReform: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uSize: { value: isMobile ? 9 : 7 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
    });

    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
  }

  get isActive() {
    return this.phase !== 'idle';
  }

  get currentMode(): TransitionMode {
    return this.mode;
  }

  get chargeValue(): number {
    return this.phase === 'charge' ? this.phaseT / CHARGE_DURATION : 0;
  }

  /** 触发转场。onClimax 在主特效高潮时调用（弹出卷轴），onDone 在重组落定后调用 */
  startTransition(mode: TransitionMode, center: THREE.Vector3, onClimax?: () => void, onDone?: () => void) {
    if (this.phase !== 'idle') return false;
    this.mode = mode;
    this.phase = 'charge';
    this.phaseT = 0;
    this.onClimax = onClimax ?? null;
    this.onDone = onDone ?? null;
    this.climaxFired = false;
    this.mat.uniforms.uMode.value = mode;
    this.mat.uniforms.uCenter.value.copy(center);
    this.mat.uniforms.uCharge.value = 0;
    this.mat.uniforms.uMain.value = 0;
    this.mat.uniforms.uReform.value = 0;
    return true;
  }

  update(dt: number, time: number) {
    this.mat.uniforms.uTime.value = time;

    if (this.phase === 'idle') return;
    this.phaseT += dt;

    if (this.phase === 'charge') {
      const t = Math.min(this.phaseT / CHARGE_DURATION, 1);
      this.mat.uniforms.uCharge.value = t;
      if (t >= 1) {
        this.phase = 'main';
        this.phaseT = 0;
      }
    } else if (this.phase === 'main') {
      const dur = MAIN_DURATION[this.mode];
      const t = Math.min(this.phaseT / dur, 1);
      this.mat.uniforms.uMain.value = t;
      this.mat.uniforms.uCharge.value = Math.max(0, 1 - t * 3);
      if (!this.climaxFired && t >= CLIMAX_AT) {
        this.climaxFired = true;
        this.onClimax?.();
      }
      if (t >= 1) {
        this.phase = 'reform';
        this.phaseT = 0;
      }
    } else if (this.phase === 'reform') {
      const t = Math.min(this.phaseT / REFORM_DURATION, 1);
      this.mat.uniforms.uReform.value = t;
      if (t >= 1) {
        this.phase = 'idle';
        this.mat.uniforms.uMode.value = 0;
        this.mat.uniforms.uCharge.value = 0;
        this.mat.uniforms.uMain.value = 0;
        this.mat.uniforms.uReform.value = 0;
        const cb = this.onDone;
        this.mode = 0;
        this.onClimax = null;
        this.onDone = null;
        cb?.();
      }
    }
  }

  setPixelRatio(pr: number) {
    this.mat.uniforms.uPixelRatio.value = pr;
  }
}
