import * as THREE from 'three';

export const TICKET_W = 4.04; // 1482:991 ≈ 1.495
export const TICKET_H = 2.7;
const TICKET_DEPTH = 0.05;
const CORNER_R = 0.09;

const PITCH_LIMIT = THREE.MathUtils.degToRad(35);
const YAW_LIMIT = THREE.MathUtils.degToRad(60);

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

export class Ticket {
  /** 外层：缩放 / 浮动 */
  readonly group = new THREE.Group();
  /** 中层：悬停视差倾斜（与用户旋转解耦） */
  readonly tilt = new THREE.Group();
  /** 内层：用户拖拽旋转 */
  readonly pivot = new THREE.Group();
  /** 供射线拾取的隐形平面（uv 即票面 UV） */
  readonly pickPlane: THREE.Mesh;

  private readonly edgeMat: THREE.ShaderMaterial;
  private readonly glowMat: THREE.ShaderMaterial;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private velX = 0; // yaw 速度
  private velY = 0; // pitch 速度
  private parallaxX = 0; // 目标视差（NDC）
  private parallaxY = 0;
  private zoomTarget = 1;
  private zoomCurrent = 1;
  private time = 0;
  edgePulse = 0; // 转场蓄力时由外部拉高

  constructor(tex: THREE.Texture) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;

    const shape = roundedRectShape(TICKET_W, TICKET_H, CORNER_R);

    const uvGen = {
      generateTopUV: (
        _geometry: THREE.ExtrudeGeometry,
        vertices: number[],
        indexA: number,
        indexB: number,
        indexC: number,
      ): THREE.Vector2[] => {
        const toUv = (i: number) =>
          new THREE.Vector2(vertices[i * 3] / TICKET_W + 0.5, vertices[i * 3 + 1] / TICKET_H + 0.5);
        return [toUv(indexA), toUv(indexB), toUv(indexC)];
      },
      generateSideWallUV: (): THREE.Vector2[] => [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(1, 0),
        new THREE.Vector2(1, 1),
        new THREE.Vector2(0, 1),
      ],
    };

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: TICKET_DEPTH,
      bevelEnabled: true,
      bevelThickness: 0.008,
      bevelSize: 0.008,
      bevelSegments: 2,
      curveSegments: 24,
      UVGenerator: uvGen,
    });
    geo.translate(0, 0, -TICKET_DEPTH / 2);

    const frontMat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.85,
      metalness: 0.05,
    });
    const sideMat = new THREE.MeshStandardMaterial({
      color: 0x2c2013,
      roughness: 0.7,
      metalness: 0.25,
    });
    const card = new THREE.Mesh(geo, [frontMat, sideMat]);
    this.pivot.add(card);

    // 鎏金描边：略大一圈的圆角环，发光 shader，bloom 拾取
    const ringShape = roundedRectShape(TICKET_W + 0.055, TICKET_H + 0.055, CORNER_R + 0.028);
    ringShape.holes.push(roundedRectShape(TICKET_W + 0.005, TICKET_H + 0.005, CORNER_R + 0.005));
    const ringGeo = new THREE.ShapeGeometry(ringShape, 24);
    this.edgeMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPulse: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vPos;
        void main() {
          vPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uPulse;
        varying vec2 vPos;
        void main() {
          float shimmer = 0.75 + 0.25 * sin(uTime * 1.6 + vPos.x * 2.4 + vPos.y * 3.1);
          float glow = shimmer * (0.85 + uPulse * 1.6);
          vec3 gold = vec3(1.05, 0.78, 0.32) * glow;
          gl_FragColor = vec4(gold, 0.9);
        }
      `,
    });
    const ring = new THREE.Mesh(ringGeo, this.edgeMat);
    ring.position.z = TICKET_DEPTH / 2 + 0.012;
    this.pivot.add(ring);

    // 热点悬停局部泛光
    this.glowMat = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uIntensity: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uIntensity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float halo = smoothstep(1.0, 0.0, d);
          halo *= 0.8 + 0.2 * sin(uTime * 5.0);
          vec3 gold = vec3(1.0, 0.75, 0.3) * halo * uIntensity;
          gl_FragColor = vec4(gold, halo * uIntensity);
        }
      `,
    });
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    const glow = new THREE.Mesh(glowGeo, this.glowMat);
    glow.position.z = TICKET_DEPTH / 2 + 0.008;
    glow.name = 'hotspot-glow';
    this.pivot.add(glow);

    // 射线拾取平面（不可见，uv 与票面一致）
    this.pickPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(TICKET_W, TICKET_H),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.pickPlane.position.z = TICKET_DEPTH / 2;
    this.pivot.add(this.pickPlane);

    this.tilt.add(this.pivot);
    this.group.add(this.tilt);
  }

  /** 热点悬停泛光：uv (0..1, 左上原点 v=1-y/h)，intensity 0 表示隐藏 */
  setGlow(u: number, v: number, radius: number, intensity: number) {
    const glow = this.pivot.getObjectByName('hotspot-glow') as THREE.Mesh;
    glow.position.x = (u - 0.5) * TICKET_W;
    glow.position.y = (0.5 - v) * TICKET_H;
    const s = Math.max(radius * TICKET_W, radius * TICKET_H) * 2.6;
    glow.scale.setScalar(Math.max(s, 0.001));
    this.glowMat.uniforms.uIntensity.value = intensity;
  }

  setParallax(nx: number, ny: number) {
    this.parallaxX = nx;
    this.parallaxY = ny;
  }

  zoomBy(delta: number) {
    this.zoomTarget = THREE.MathUtils.clamp(this.zoomTarget * delta, 0.6, 1.8);
  }

  /** 返回是否消耗了这次按下（拖拽总是消耗） */
  beginDrag(x: number, y: number) {
    this.dragging = true;
    this.lastX = x;
    this.lastY = y;
    this.velX = 0;
    this.velY = 0;
  }

  dragTo(x: number, y: number) {
    if (!this.dragging) return;
    const dx = x - this.lastX;
    const dy = y - this.lastY;
    this.lastX = x;
    this.lastY = y;
    const k = 0.005;
    this.pivot.rotation.y += dx * k;
    this.pivot.rotation.x += dy * k;
    this.velX = dx * k;
    this.velY = dy * k;
  }

  endDrag() {
    this.dragging = false;
  }

  get isDragging() {
    return this.dragging;
  }

  update(dt: number) {
    this.time += dt;
    const t = this.time;

    // 惯性 + 限幅回弹
    if (!this.dragging) {
      this.pivot.rotation.y += this.velX;
      this.pivot.rotation.x += this.velY;
      const damp = Math.exp(-dt * 5.2);
      this.velX *= damp;
      this.velY *= damp;

      // 超出限幅时弹簧拉回
      const spring = 1 - Math.exp(-dt * 7);
      if (this.pivot.rotation.x > PITCH_LIMIT) {
        this.pivot.rotation.x += (PITCH_LIMIT - this.pivot.rotation.x) * spring;
        this.velY = 0;
      } else if (this.pivot.rotation.x < -PITCH_LIMIT) {
        this.pivot.rotation.x += (-PITCH_LIMIT - this.pivot.rotation.x) * spring;
        this.velY = 0;
      }
      if (this.pivot.rotation.y > YAW_LIMIT) {
        this.pivot.rotation.y += (YAW_LIMIT - this.pivot.rotation.y) * spring;
        this.velX = 0;
      } else if (this.pivot.rotation.y < -YAW_LIMIT) {
        this.pivot.rotation.y += (-YAW_LIMIT - this.pivot.rotation.y) * spring;
        this.velX = 0;
      }
    }

    // 悬停视差：作用于独立 tilt 层，阻尼 1-exp(-dt*k)，不侵蚀用户旋转
    const pdamp = 1 - Math.exp(-dt * 3.2);
    const targetPitch = this.dragging ? 0 : this.parallaxY * 0.09;
    const targetYaw = this.dragging ? 0 : this.parallaxX * 0.14;
    this.tilt.rotation.x += (targetPitch - this.tilt.rotation.x) * pdamp;
    this.tilt.rotation.y += (targetYaw - this.tilt.rotation.y) * pdamp;

    // 待机浮动 + 呼吸倾斜
    this.group.position.y = Math.sin(t * 0.8) * 0.05;
    this.pivot.rotation.z = Math.sin(t * 0.5) * 0.012;

    // 缩放阻尼
    const zdamp = 1 - Math.exp(-dt * 6);
    this.zoomCurrent += (this.zoomTarget - this.zoomCurrent) * zdamp;
    this.group.scale.setScalar(this.zoomCurrent);

    // 描边
    this.edgePulse *= Math.exp(-dt * 3.5);
    this.edgeMat.uniforms.uTime.value = t;
    this.edgeMat.uniforms.uPulse.value = this.edgePulse;
    this.glowMat.uniforms.uTime.value = t;
  }
}
