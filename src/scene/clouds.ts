import * as THREE from 'three';

/**
 * 祥云背景层：程序化 canvas 云纹 sprite，加法混合微光，慢速漂移。
 * 云纹取传统祥云「如意头 + 拖尾」的弧卷形态。
 */
export class Clouds {
  readonly group = new THREE.Group();
  private readonly sprites: { sprite: THREE.Sprite; speed: number; baseY: number; phase: number }[] = [];
  private time = 0;

  constructor() {
    const texA = this.makeCloudTexture(0);
    const texB = this.makeCloudTexture(1);

    const placements = 12;
    for (let i = 0; i < placements; i++) {
      const mat = new THREE.SpriteMaterial({
        map: i % 2 === 0 ? texA : texB,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        opacity: 0.05 + Math.random() * 0.1,
        rotation: (Math.random() - 0.5) * 0.6,
      });
      const sprite = new THREE.Sprite(mat);
      const s = 2.2 + Math.random() * 3.2;
      sprite.scale.set(s, s * 0.45, 1);
      sprite.position.set(
        (Math.random() - 0.5) * 18,
        (Math.random() - 0.5) * 9,
        -4 - Math.random() * 5,
      );
      this.group.add(sprite);
      this.sprites.push({
        sprite,
        speed: 0.08 + Math.random() * 0.15,
        baseY: sprite.position.y,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  private makeCloudTexture(variant: number): THREE.Texture {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.9)';
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(212, 175, 55, 0.8)';
    ctx.shadowBlur = 14;

    // 如意头：同心螺旋弧卷
    const cx = variant === 0 ? 150 : 340;
    const cy = 110;
    for (let ring = 0; ring < 4; ring++) {
      ctx.lineWidth = 7 - ring * 1.4;
      ctx.beginPath();
      const r0 = 18 + ring * 16;
      const start = variant === 0 ? 0.3 : Math.PI * 0.8;
      const sweep = Math.PI * (1.6 - ring * 0.12);
      for (let a = 0; a <= 1.001; a += 0.02) {
        const ang = start + a * sweep;
        // 内卷螺旋：半径随角度收缩
        const r = r0 * (1 - 0.35 * a * (ring === 0 ? 1 : 0.3));
        const x = cx + Math.cos(ang) * r;
        const y = cy + Math.sin(ang) * r * 0.72;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // 拖尾：向右（或左）延展的流线弧
    const dir = variant === 0 ? 1 : -1;
    for (let tail = 0; tail < 3; tail++) {
      ctx.lineWidth = 5 - tail * 1.2;
      ctx.beginPath();
      const y0 = cy + 30 + tail * 22;
      ctx.moveTo(cx + dir * 20, y0);
      ctx.bezierCurveTo(
        cx + dir * 120, y0 - 24,
        cx + dir * 210, y0 + 14,
        cx + dir * (300 - tail * 40), y0 - 8,
      );
      ctx.stroke();
      // 尾端小卷
      ctx.beginPath();
      ctx.arc(cx + dir * (300 - tail * 40), y0 - 12, 8 - tail * 2, 0, Math.PI * 1.6);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  update(dt: number) {
    this.time += dt;
    for (const c of this.sprites) {
      c.sprite.position.x += c.speed * dt;
      c.sprite.position.y = c.baseY + Math.sin(this.time * 0.25 + c.phase) * 0.3;
      // 飘出右侧后回到左侧
      if (c.sprite.position.x > 11) c.sprite.position.x = -11;
    }
  }
}
